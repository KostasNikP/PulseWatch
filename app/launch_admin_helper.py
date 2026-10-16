
import ctypes
import subprocess
import sys
import time

from pathlib import Path

from app.paths import DATA_DIR, IS_FROZEN, PROJECT_ROOT


SENSOR_FILE = DATA_DIR / "hardware_sensors_live.json"

SENSOR_STALE_SECONDS = 10


def helper_is_active():
    """Check whether the Administrator Helper is active."""

    try:
        age = time.time() - SENSOR_FILE.stat().st_mtime

        return 0 <= age <= SENSOR_STALE_SECONDS

    except OSError:
        return False


def launch_admin_helper():
    """Launch the advanced sensor helper through Windows UAC."""

    if sys.platform != "win32":
        raise RuntimeError(
            "Administrator Sensor Helper requires Windows."
        )

    if helper_is_active():
        print("Administrator Sensor Helper is already active.")
        return

    executable = str(Path(sys.executable).resolve())

    if IS_FROZEN:
        # Packaged application:
        # Start the same PulseWatch.exe in helper mode.
        arguments = ["--admin-helper"]

        working_directory = str(
            Path(sys.executable).resolve().parent
        )

    else:
        # Development environment:
        # Start the helper using the virtual environment.
        arguments = [
            "-m",
            "app.admin_sensor_helper"
        ]

        working_directory = str(PROJECT_ROOT)

    parameters = subprocess.list2cmdline(arguments)

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
        executable,
        parameters,
        working_directory,
        1
    )

    if not result or result <= 32:
        raise RuntimeError(
            "Administrator Helper could not start. "
            f"Windows code: {result}"
        )

    print("Administrator Sensor Helper launch requested.")
    print("Waiting for advanced hardware measurements...")


if __name__ == "__main__":
    launch_admin_helper()
