import psutil


def get_system_metrics():
    cpu = psutil.cpu_percent(interval=1)
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage("C:\\")

    return {
        "cpu_percent": cpu,
        "ram_percent": ram.percent,
        "ram_total_gib": round(ram.total / (1024 ** 3), 2),
        "ram_available_gib": round(ram.available / (1024 ** 3), 2),
        "disk_percent": disk.percent,
        "disk_total_gib": round(disk.total / (1024 ** 3), 2),
        "disk_free_gib": round(disk.free / (1024 ** 3), 2),
    }
import time


class NetworkMonitor:
    def __init__(self):
        self.previous_network = psutil.net_io_counters()
        self.previous_time = time.monotonic()

    def get_metrics(self):
        network = psutil.net_io_counters()
        current_time = time.monotonic()

        elapsed_time = current_time - self.previous_time

        download_speed = (
            (network.bytes_recv - self.previous_network.bytes_recv)
            * 8 / elapsed_time / 1_000_000
        )

        upload_speed = (
            (network.bytes_sent - self.previous_network.bytes_sent)
            * 8 / elapsed_time / 1_000_000
        )

        self.previous_network = network
        self.previous_time = current_time

        return {
            "download_mbps": round(download_speed, 2),
            "upload_mbps": round(upload_speed, 2),
            "bytes_sent": network.bytes_sent,
            "bytes_received": network.bytes_recv,
            "packets_sent": network.packets_sent,
            "packets_received": network.packets_recv,
        }