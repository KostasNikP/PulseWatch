
import asyncio
import logging
import sqlite3
import time

from app.alerts import AlertMonitor
from app.monitor import get_system_metrics, NetworkMonitor
from app.database import init_database, save_metrics


logger = logging.getLogger(__name__)

SAVE_INTERVAL = 30


class MetricsCollector:
    def __init__(self):
        self.network_monitor = NetworkMonitor()
        self.alert_monitor = AlertMonitor()

        self.latest_metrics = None
        self.last_saved_at = 0.0

    async def collect(self):
        await asyncio.to_thread(init_database)

        while True:
            # Collect system and network metrics
            system = await asyncio.to_thread(get_system_metrics)
            network = self.network_monitor.get_metrics()

            # Evaluate consecutive high readings
            alerts = self.alert_monitor.check(system)

            # Store latest measurements in memory
            self.latest_metrics = {
                "timestamp": time.time(),
                "system": system,
                "network": network,
                "alerts": alerts
            }

            current_time = time.monotonic()

            # Save measurements periodically
            if current_time - self.last_saved_at >= SAVE_INTERVAL:
                self.last_saved_at = current_time

                try:
                    await asyncio.to_thread(
                        save_metrics,
                        self.latest_metrics
                    )
                except sqlite3.Error:
                    logger.exception("Failed to save metrics")

            await asyncio.sleep(2)
