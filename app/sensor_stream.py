
import asyncio
import json
import subprocess

from contextlib import aclosing

from app.sensors import get_bridge_command, iter_hardware


async def stream_hardware_sensors():
    """Read continuous hardware sensor measurements."""

    # Automatically choose the available Sensor Bridge.
    command = get_bridge_command()

    options = {}

    if hasattr(subprocess, "CREATE_NO_WINDOW"):
        options["creationflags"] = subprocess.CREATE_NO_WINDOW

    process = await asyncio.create_subprocess_exec(
        *command,
        "--stream",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        limit=1024 * 1024,
        **options
    )

    try:
        while True:
            line = await asyncio.wait_for(
                process.stdout.readline(),
                timeout=30
            )

            if not line:
                error = (
                    await process.stderr.read()
                ).decode(
                    "utf-8",
                    errors="replace"
                ).strip()

                raise RuntimeError(
                    error or "Sensor Bridge stopped unexpectedly."
                )

            yield json.loads(line)

    finally:
        # Stop Sensor Bridge when monitoring ends.
        if process.returncode is None:
            process.terminate()

        try:
            await asyncio.wait_for(
                process.wait(),
                timeout=5
            )

        except asyncio.TimeoutError:
            process.kill()
            await process.wait()


async def test_stream():
    print("PulseWatch Live Sensor Streaming")
    print("Waiting for hardware measurements...\n")

    async with aclosing(stream_hardware_sensors()) as stream:
        for sample_number in range(1, 3):
            snapshot = await anext(stream)

            devices = list(
                iter_hardware(snapshot["hardware"])
            )

            sensor_count = sum(
                len(device["sensors"])
                for device in devices
            )

            print(
                f"Sample {sample_number}: "
                f"{sensor_count} sensors, "
                f"{len(devices)} hardware devices"
            )

    print("\nLive streaming test completed successfully.")


if __name__ == "__main__":
    asyncio.run(test_stream())
