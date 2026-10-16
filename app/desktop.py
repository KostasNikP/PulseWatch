
import asyncio
import multiprocessing
import sys
import threading
import time

import uvicorn

from app.launch_admin_helper import launch_admin_helper


APP_TITLE = "PulseWatch - System Monitor"
APP_URL = "http://127.0.0.1:8000/dashboard"


def run_desktop():
    """Start the PulseWatch desktop application."""

    import webview

    print("Starting PulseWatch Desktop...")

    # Start FastAPI in the background.
    config = uvicorn.Config(
        "app.api:app",
        host="127.0.0.1",
        port=8000,
        reload=False,
        log_level="info",
    )

    server = uvicorn.Server(config)

    server_thread = threading.Thread(
        target=server.run,
        daemon=True,
        name="PulseWatch-Backend",
    )

    server_thread.start()

    # Wait for the backend to start.
    deadline = time.monotonic() + 20

    while not server.started:

        if not server_thread.is_alive():
            raise RuntimeError(
                "PulseWatch backend failed to start. "
                "Port 8000 may already be in use."
            )

        if time.monotonic() >= deadline:
            server.should_exit = True
            raise TimeoutError(
                "PulseWatch backend startup timed out."
            )

        time.sleep(0.1)

    try:
        # Request Administrator permissions for
        # advanced hardware monitoring.
        print("Starting hardware monitoring...")

        try:
            launch_admin_helper()

        except Exception as error:
            print(
                "Advanced monitoring unavailable. "
                "Continuing with basic monitoring."
            )
            print(f"Details: {error}")

        # Create the Windows desktop window.
        webview.create_window(
            title=APP_TITLE,
            url=APP_URL,
            width=1400,
            height=900,
            min_size=(950, 650),
            resizable=True,
            background_color="#10131a",
        )

        print("Opening PulseWatch Desktop...")

        # Run the desktop GUI on the main thread.
        webview.start(debug=False)

    finally:
        # Stop the backend when the window closes.
        print("Stopping PulseWatch...")

        server.should_exit = True
        server_thread.join(timeout=10)

        print("PulseWatch Desktop closed.")


def run_admin_helper():
    """Start the Administrator Sensor Helper."""

    from app.admin_sensor_helper import main

    asyncio.run(main())


def main():
    """Select the application startup mode."""

    if len(sys.argv) > 1 and sys.argv[1] == "--admin-helper":

        # Start only the elevated hardware sensor helper.
        run_admin_helper()

    else:

        # Start the normal Windows desktop application.
        run_desktop()



if __name__ == "__main__":
    multiprocessing.freeze_support()

    if getattr(sys, "frozen", False):
        from app.paths import DATA_DIR

        DATA_DIR.mkdir(parents=True, exist_ok=True)

        if "--admin-helper" in sys.argv:
            log_filename = "admin_helper.log"
        else:
            log_filename = "desktop.log"

        log_path = DATA_DIR / log_filename

        log_file = open(
            log_path,
            "a",
            encoding="utf-8",
            buffering=1
        )

        sys.stdout = log_file
        sys.stderr = log_file

    main()
