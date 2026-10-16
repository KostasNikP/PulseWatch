
import json
import subprocess
from collections import Counter
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parent.parent

BRIDGE_DLL = (
    PROJECT_DIR
    / "sensor_bridge"
    / "bin"
    / "Debug"
    / "net10.0"
    / "sensor_bridge.dll"
)


def get_hardware_sensors():
    """Read available sensors using the C# Sensor Bridge."""

    if not BRIDGE_DLL.exists():
        raise FileNotFoundError(
            "Sensor Bridge is not built. Run dotnet build first."
        )

    result = subprocess.run(
        ["dotnet", str(BRIDGE_DLL)],
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
    """Include nested hardware such as motherboard chips."""

    for device in devices:
        yield device

        yield from iter_hardware(
            device.get("children", [])
        )


if __name__ == "__main__":
    try:
        result = get_hardware_sensors()

        devices = list(iter_hardware(result["hardware"]))

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

        for category, count in sorted(categories.items()):
            print(f"  {category}: {count}")

    except (
        OSError,
        subprocess.SubprocessError,
        ValueError
    ) as error:
        print(f"Sensor Bridge Error: {error}")
        raise SystemExit(1)
