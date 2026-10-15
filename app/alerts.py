ALERT_RULES = {
    "cpu_percent": {
        "threshold": 90,
        "message": "High CPU usage"
    },
    "ram_percent": {
        "threshold": 85,
        "message": "High RAM usage"
    },
    "disk_percent": {
        "threshold": 90,
        "message": "High disk usage"
    }
}


def check_alerts(system_metrics):
    alerts = []

    for metric, rule in ALERT_RULES.items():
        value = system_metrics.get(metric)

        if value is not None and value >= rule["threshold"]:
            alerts.append({
                "metric": metric,
                "level": "warning",
                "message": rule["message"],
                "value": value,
                "threshold": rule["threshold"]
            })

    return alerts