
import asyncio
import ctypes
import json
import os
import time
import urllib.error
import urllib.request

from pathlib import Path
from contextlib import aclosing

from app.sensor_stream import stream_hardware_sensors


PROJECT_ROOT = Path(__file__).resolve().parents[1]

SENSOR_FILE = (
    PROJECT_ROOT / "data" / "hardware_sensors_live.json"
)

SERVER_URL = "http://127.0.0.1:8000/api/metrics"

STARTUP_GRACE_SECONDS = 45
SERVER_TIMEOUT_SECONDS = 15


def server_is_running():
    """Check whether the PulseWatch API is available."""

    try:
        with urllib.request.urlopen(
            SERVER_URL,
            timeout=1
        ) as response:

            if response.status != 200:
                return False

            data = json.load(response)

            return (
                isinstance(data, dict)
                and "system" in data
                and "network" in data
            )

    except (
        OSError,
        TimeoutError,
        ValueError
    ):
        return False


async def main():

    if not ctypes.windll.shell32.IsUserAnAdmin():
        raise SystemExit(
            "Administrator privileges are required."
        )

    SENSOR_FILE.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    print("PulseWatch Administrator Sensor Helper")
    print("Reading advanced hardware sensors...")
    print("Monitoring PulseWatch server status...")
    print("Press Ctrl+C to stop.\n")

    started_at = time.monotonic()
    last_server_seen = None

    async with aclosing(stream_hardware_sensors()) as stream:

        async for snapshot in stream:

            # Check server availability without blocking
            # the hardware stream event loop
            server_available = await asyncio.to_thread(
                server_is_running
            )

            now = time.monotonic()

            if server_available:
                last_server_seen = now

            elif last_server_seen is None:

                # Allow FastAPI time to start
                if (
                    now - started_at
                    >= STARTUP_GRACE_SECONDS
                ):
                    print(
                        "PulseWatch server did not start. "
                        "Stopping Sensor Helper."
                    )
                    break

            elif (
                now - last_server_seen
                >= SERVER_TIMEOUT_SECONDS
            ):
                print(
                    "PulseWatch server is offline. "
                    "Stopping Sensor Helper."
                )
                break

            # Write complete sensor snapshot atomically
            temporary_file = SENSOR_FILE.with_name(
                SENSOR_FILE.name + ".tmp"
            )

            temporary_file.write_text(
                json.dumps(snapshot),
                encoding="utf-8"
            )

            os.replace(
                temporary_file,
                SENSOR_FILE
            )

            print(
                f"Updated hardware sensors: "
                f"{snapshot['timestamp']}",
                flush=True
            )

    print("Administrator Sensor Helper stopped.")


if __name__ == "__main__":
    try:
        asyncio.run(main())

    except KeyboardInterrupt:
        print("\nSensor Helper stopped.")
