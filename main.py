import os
import time

from app.monitor import get_system_metrics, NetworkMonitor


network_monitor = NetworkMonitor()

try:
    while True:
        system = get_system_metrics()
        network = network_monitor.get_metrics()

        os.system("cls")

        print("========== RigObserver ==========")

        print("\n===== CPU Information =====")
        print(f"CPU Usage: {system['cpu_percent']}%")

        print("\n===== RAM Information =====")
        print(f"RAM Usage: {system['ram_percent']}%")
        print(f"Total RAM: {system['ram_total_gib']:.2f} GiB")
        print(f"Available RAM: {system['ram_available_gib']:.2f} GiB")

        print("\n===== Disk Information =====")
        print(f"Disk Usage: {system['disk_percent']}%")
        print(f"Total Disk: {system['disk_total_gib']:.2f} GiB")
        print(f"Free Disk: {system['disk_free_gib']:.2f} GiB")

        print("\n===== Network Information =====")
        print(f"Download Speed: {network['download_mbps']:.2f} Mbps")
        print(f"Upload Speed: {network['upload_mbps']:.2f} Mbps")
        print(f"Data Sent: {network['bytes_sent'] / (1024 ** 2):.2f} MiB")
        print(f"Data Received: {network['bytes_received'] / (1024 ** 2):.2f} MiB")
        print(f"Packets Sent: {network['packets_sent']}")
        print(f"Packets Received: {network['packets_received']}")

        print("\nPress Ctrl+C to stop monitoring.")

        time.sleep(2)

except KeyboardInterrupt:
    print("\nRigObserver stopped.")