
import ctypes
import sys
import time

from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]

SENSOR_FILE = (
    PROJECT_ROOT
    / "data"
    / "hardware_sensors_live.json"
)

SENSOR_STALE_SECONDS = 10


def helper_is_active():
    """Check whether the helper is producing fresh data."""

    try:
        age = time.time() - SENSOR_FILE.stat().st_mtime

        return (
            0 <= age <= SENSOR_STALE_SECONDS
        )

    except OSError:
        return False


def launch_admin_helper():
    """Launch the sensor helper through Windows UAC."""

    if sys.platform != "win32":
        raise RuntimeError(
            "Administrator Sensor Helper currently supports Windows."
        )

    if helper_is_active():
        print("Administrator Sensor Helper is already active.")
        return

    python_executable = str(
        Path(sys.executable).resolve()
    )

    shell_execute = ctypes.windll.shell32.ShellExecuteW

    shell_execute.argtypes = [
        ctypes.c_void_p,
        ctypes.c_wchar_p,
        ctypes.c_wchar_p,
        ctypes.c_wchar_p,
        ctypes.c_wchar_p,
        ctypes.c_int
    ]

    shell_execute.restype = ctypes.c_void_p

    result = shell_execute(
        None,
        "runas",
        python_executable,
        "-m app.admin_sensor_helper",
        str(PROJECT_ROOT),
        1
    )

    if not result or result <= 32:
        raise RuntimeError(
            f"Administrator Helper launch failed. Windows code: {result}"
        )

    print("Administrator Sensor Helper launch requested.")
    print("Waiting for elevated sensor data...")


if __name__ == "__main__":
    launch_admin_helper()
