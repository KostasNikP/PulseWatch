
import time
import urllib.request
import webbrowser


DASHBOARD_URL = "http://127.0.0.1:8000/dashboard"

MAX_ATTEMPTS = 30


def open_dashboard():
    """Wait for FastAPI and open the dashboard."""

    for attempt in range(MAX_ATTEMPTS):
        try:
            with urllib.request.urlopen(
                DASHBOARD_URL,
                timeout=2
            ) as response:

                if response.status == 200:
                    webbrowser.open(DASHBOARD_URL)
                    return

        except (
            OSError,
            TimeoutError
        ):
            pass

        time.sleep(1)


if __name__ == "__main__":
    open_dashboard()
