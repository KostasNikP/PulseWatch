
import asyncio
import json
import logging
import sqlite3
import time

from contextlib import aclosing
from app.paths import DATA_DIR

from app.alerts import AlertMonitor
from app.monitor import get_system_metrics, NetworkMonitor
from app.database import init_database, save_metrics
from app.sensor_stream import stream_hardware_sensors


logger = logging.getLogger(__name__)


# ==========================================
# CONFIGURATION
# ==========================================

SAVE_INTERVAL = 30
SENSOR_RETRY_INTERVAL = 5
SENSOR_STALE_SECONDS = 10

ADMIN_SENSOR_FILE = DATA_DIR / "hardware_sensors_live.json"


# ==========================================
# ADMINISTRATOR SENSOR READER
# ==========================================

def read_admin_sensor_snapshot():
    """
    Read the latest hardware snapshot from the
    Administrator Sensor Helper.

    Return None if the helper is unavailable
    or the sensor data is outdated.
    """

    try:
        # Check whether the file is still being updated
        file_modified_at = ADMIN_SENSOR_FILE.stat().st_mtime

        if (
            time.time() - file_modified_at
            > SENSOR_STALE_SECONDS
        ):
            return None

        # Read the snapshot
        snapshot = json.loads(
            ADMIN_SENSOR_FILE.read_text(
                encoding="utf-8"
            )
        )

        # Validate the JSON structure
        if not isinstance(snapshot, dict):
            return None

        if not isinstance(
            snapshot.get("hardware"),
            list
        ):
            return None

        timestamp = snapshot.get("timestamp")

        if (
            isinstance(timestamp, bool)
            or not isinstance(timestamp, (int, float))
        ):
            return None

        # Reject outdated or future-dated measurements
        age = time.time() - timestamp

        if (
            age < -SENSOR_STALE_SECONDS
            or age > SENSOR_STALE_SECONDS
        ):
            return None

        return snapshot

    except (
        OSError,
        ValueError,
        TypeError
    ):
        return None


# ==========================================
# METRICS COLLECTOR
# ==========================================

class MetricsCollector:

    def __init__(self):

        # Basic system monitoring
        self.network_monitor = NetworkMonitor()
        self.alert_monitor = AlertMonitor()

        self.latest_metrics = None
        self.last_saved_at = 0.0

        # Hardware monitoring
        self.latest_hardware_sensors = None
        self.hardware_sensors_updated_at = None
        self.hardware_sensors_error = None

        # Current hardware monitoring mode
        self.hardware_monitoring_mode = "starting"

    # ======================================
    # HARDWARE SENSOR COLLECTION
    # ======================================

    async def collect_hardware_sensors(self):
        """
        Collect hardware measurements continuously.

        Priority:
        1. Administrator Sensor Helper
        2. Basic C# Sensor Bridge

        Automatically switch between modes
        based on helper availability.
        """

        while True:

            admin_snapshot = None

            try:

                # ----------------------------------
                # CHECK ADMINISTRATOR SENSOR HELPER
                # ----------------------------------

                admin_snapshot = await asyncio.to_thread(
                    read_admin_sensor_snapshot
                )

                if admin_snapshot is not None:

                    self.latest_hardware_sensors = (
                        admin_snapshot
                    )

                    self.hardware_sensors_updated_at = (
                        time.time()
                    )

                    self.hardware_sensors_error = None

                    self.hardware_monitoring_mode = (
                        "advanced"
                    )

                    # Check for new admin data again
                    await asyncio.sleep(2)

                    continue

                # ----------------------------------
                # BASIC HARDWARE MONITORING
                # ----------------------------------

                async with aclosing(
                    stream_hardware_sensors()
                ) as stream:

                    async for snapshot in stream:

                        # Check whether the
                        # Administrator Helper started
                        admin_snapshot = (
                            await asyncio.to_thread(
                                read_admin_sensor_snapshot
                            )
                        )

                        if admin_snapshot is not None:

                            self.latest_hardware_sensors = (
                                admin_snapshot
                            )

                            self.hardware_sensors_updated_at = (
                                time.time()
                            )

                            self.hardware_sensors_error = None

                            self.hardware_monitoring_mode = (
                                "advanced"
                            )

                            # Stop basic stream and switch
                            # to advanced monitoring
                            break

                        # Use basic hardware sensors
                        self.latest_hardware_sensors = (
                            snapshot
                        )

                        self.hardware_sensors_updated_at = (
                            time.time()
                        )

                        self.hardware_sensors_error = None

                        self.hardware_monitoring_mode = (
                            "basic"
                        )

            except asyncio.CancelledError:
                raise

            except Exception as error:

                logger.exception(
                    "Hardware sensor collection failed"
                )

                self.latest_hardware_sensors = None

                self.hardware_sensors_error = str(error)

                self.hardware_monitoring_mode = "error"

            # Retry basic sensor collection if necessary
            if admin_snapshot is None:
                await asyncio.sleep(
                    SENSOR_RETRY_INTERVAL
                )

    # ======================================
    # MAIN SYSTEM METRICS COLLECTION
    # ======================================

    async def collect(self):
        """
        Collect system, network and hardware
        measurements in the background.
        """

        # Initialize database
        await asyncio.to_thread(
            init_database
        )

        # Start hardware monitoring in parallel
        hardware_task = asyncio.create_task(
            self.collect_hardware_sensors()
        )

        try:

            while True:

                # ----------------------------------
                # SYSTEM METRICS
                # ----------------------------------

                system = await asyncio.to_thread(
                    get_system_metrics
                )

                # ----------------------------------
                # NETWORK METRICS
                # ----------------------------------

                network = (
                    self.network_monitor.get_metrics()
                )

                # ----------------------------------
                # SMART ALERTS
                # ----------------------------------

                alerts = (
                    self.alert_monitor.check(system)
                )

                # ----------------------------------
                # CACHE LATEST METRICS
                # ----------------------------------

                self.latest_metrics = {
                    "timestamp": time.time(),
                    "system": system,
                    "network": network,
                    "alerts": alerts
                }

                # ----------------------------------
                # SAVE METRICS HISTORY
                # ----------------------------------

                current_time = time.monotonic()

                if (
                    current_time - self.last_saved_at
                    >= SAVE_INTERVAL
                ):

                    self.last_saved_at = (
                        current_time
                    )

                    try:

                        await asyncio.to_thread(
                            save_metrics,
                            self.latest_metrics
                        )

                    except sqlite3.Error:

                        logger.exception(
                            "Failed to save metrics"
                        )

                # Refresh every 2 seconds
                await asyncio.sleep(2)

        finally:

            # ----------------------------------
            # CLEAN SHUTDOWN
            # ----------------------------------

            hardware_task.cancel()

            try:
                await hardware_task

            except asyncio.CancelledError:
                pass
