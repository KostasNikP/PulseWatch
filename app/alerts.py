
import json
from threading import Lock

from app.paths import DATA_DIR


CONFIG_PATH = DATA_DIR / "alert_settings.json"

DEFAULT_THRESHOLDS = {
    "cpu_percent": 90,
    "ram_percent": 85,
    "disk_percent": 90
}

ALERT_MESSAGES = {
    "cpu_percent": "High CPU usage",
    "ram_percent": "High RAM usage",
    "disk_percent": "High disk usage"
}

REQUIRED_CONSECUTIVE_SAMPLES = 3

settings_lock = Lock()


def get_alert_settings():
    with settings_lock:
        if not CONFIG_PATH.exists():
            return DEFAULT_THRESHOLDS.copy()

        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as file:
                settings = json.load(file)

            thresholds = {}

            for metric, default in DEFAULT_THRESHOLDS.items():
                value = settings.get(metric, default)

                if type(value) is not int or not 1 <= value <= 100:
                    raise ValueError("Invalid threshold")

                thresholds[metric] = value

            return thresholds

        except (OSError, ValueError, TypeError, AttributeError):
            return DEFAULT_THRESHOLDS.copy()


def save_alert_settings(settings):
    with settings_lock:
        CONFIG_PATH.parent.mkdir(
            parents=True,
            exist_ok=True
        )

        temporary_path = CONFIG_PATH.with_suffix(".tmp")

        with open(temporary_path, "w", encoding="utf-8") as file:
            json.dump(settings, file, indent=4)

        temporary_path.replace(CONFIG_PATH)

    return settings


class AlertMonitor:
    def __init__(self):
        self.consecutive_counts = {
            metric: 0 for metric in DEFAULT_THRESHOLDS
        }

        self.previous_thresholds = {}

    def check(self, system_metrics):
        alerts = []
        thresholds = get_alert_settings()

        for metric, threshold in thresholds.items():

            # Reset counter if threshold has changed
            if self.previous_thresholds.get(metric) != threshold:
                self.consecutive_counts[metric] = 0

            value = system_metrics.get(metric)

            if value is None:
                self.consecutive_counts[metric] = 0
                continue

            # Count consecutive high readings
            if value >= threshold:
                self.consecutive_counts[metric] += 1
            else:
                self.consecutive_counts[metric] = 0

            # Generate alert after consecutive readings
            if (
                self.consecutive_counts[metric]
                >= REQUIRED_CONSECUTIVE_SAMPLES
            ):
                alerts.append({
                    "metric": metric,
                    "level": "warning",
                    "message": ALERT_MESSAGES[metric],
                    "value": value,
                    "threshold": threshold
                })

        self.previous_thresholds = thresholds.copy()

        return alerts
