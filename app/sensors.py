
import json
import subprocess
import sys

from collections import Counter
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parent.parent

BUNDLE_DIR = Path(
    getattr(sys, "_MEIPASS", PROJECT_DIR)
)

# Sensor Bridge included in a packaged application
PACKAGED_BRIDGE_EXE = (
    BUNDLE_DIR
    / "sensor_bridge"
    / "sensor_bridge.exe"
)

# Self-contained Sensor Bridge for development
PUBLISHED_BRIDGE_EXE = (
    PROJECT_DIR
    / "sensor_bridge"
    / "bin"
    / "Release"
    / "net10.0"
    / "win-x64"
    / "publish"
    / "sensor_bridge.exe"
)

# Original development Sensor Bridge
BRIDGE_DLL = (
    PROJECT_DIR
    / "sensor_bridge"
    / "bin"
    / "Debug"
    / "net10.0"
    / "sensor_bridge.dll"
)


def get_bridge_command():
    """Select the available hardware sensor bridge."""

    if PACKAGED_BRIDGE_EXE.is_file():
        return [str(PACKAGED_BRIDGE_EXE)]

    if PUBLISHED_BRIDGE_EXE.is_file():
        return [str(PUBLISHED_BRIDGE_EXE)]

    if BRIDGE_DLL.is_file():
        return ["dotnet", str(BRIDGE_DLL)]

    raise FileNotFoundError(
        "Hardware Sensor Bridge not found. "
        "Build or publish the sensor bridge first."
    )


def get_hardware_sensors():
    """Read available hardware sensors."""

    command = get_bridge_command()

    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=30,
        check=True,
        creationflags=getattr(
            subprocess,
            "CREATE_NO_WINDOW",
            0
        )
    )

    return json.loads(result.stdout)


def iter_hardware(devices):
    """Include nested hardware and sensors."""

    for device in devices:
        yield device

        yield from iter_hardware(
            device.get("children", [])
        )


if __name__ == "__main__":
    try:
        result = get_hardware_sensors()

        devices = list(
            iter_hardware(result["hardware"])
        )

        sensor_count = sum(
            len(device["sensors"])
            for device in devices
        )

        categories = Counter(
            device["category"]
            for device in devices
        )

        print("PulseWatch Sensor Bridge: Connected")
        print(f"Total sensors: {sensor_count}")

        print("\nDetected hardware categories:")

        for category, count in sorted(
            categories.items()
        ):
            print(f"  {category}: {count}")

    except (
        OSError,
        subprocess.SubprocessError,
        ValueError
    ) as error:
        print(f"Sensor Bridge Error: {error}")
        raise SystemExit(1)
