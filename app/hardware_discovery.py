
import json
import platform
import subprocess

import psutil


def get_hardware_inventory():
    """Discover the local computer's hardware."""

    if platform.system() != "Windows":
        return {
            "error": "Hardware discovery currently supports Windows."
        }

    script = """
    $ErrorActionPreference = 'Stop'
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

    [PSCustomObject]@{
        cpu = @(
            Get-CimInstance Win32_Processor |
            Select-Object Name, Manufacturer,
                NumberOfCores, NumberOfLogicalProcessors
        )

        gpu = @(
            Get-CimInstance Win32_VideoController |
            Select-Object Name, AdapterCompatibility,
                DriverVersion
        )

        motherboard = @(
            Get-CimInstance Win32_BaseBoard |
            Select-Object Manufacturer, Product
        )
    } | ConvertTo-Json -Depth 5 -Compress
    """

    try:
        result = subprocess.run(
            [
                "powershell.exe",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                script
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=20,
            check=True
        )

        hardware = json.loads(result.stdout)

        for key in ("cpu", "gpu", "motherboard"):
            value = hardware.get(key)

            if isinstance(value, dict):
                hardware[key] = [value]
            elif value is None:
                hardware[key] = []

        hardware["memory"] = {
            "total_gb": round(
                psutil.virtual_memory().total / (1024 ** 3),
                2
            )
        }

        hardware["operating_system"] = {
            "name": platform.system(),
            "version": platform.version()
        }

        return hardware

    except (
        subprocess.SubprocessError,
        OSError,
        ValueError
    ) as error:
        return {
            "error": f"Hardware discovery failed: {error}"
        }


if __name__ == "__main__":
    print(
        json.dumps(
            get_hardware_inventory(),
            indent=4,
            ensure_ascii=False
        )
    )
