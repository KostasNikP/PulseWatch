
import sqlite3

from app.paths import DATA_DIR


DB_PATH = DATA_DIR / "pulsewatch.db"


def init_database():
    DATA_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    connection = sqlite3.connect(DB_PATH)

    try:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp REAL NOT NULL,
                cpu_percent REAL,
                ram_percent REAL,
                disk_percent REAL,
                download_mbps REAL,
                upload_mbps REAL
            )
        """)

        connection.commit()

    finally:
        connection.close()


def save_metrics(metrics):
    system = metrics["system"]
    network = metrics["network"]

    connection = sqlite3.connect(DB_PATH)

    try:
        connection.execute("""
            INSERT INTO metrics (
                timestamp,
                cpu_percent,
                ram_percent,
                disk_percent,
                download_mbps,
                upload_mbps
            )
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            metrics["timestamp"],
            system["cpu_percent"],
            system["ram_percent"],
            system["disk_percent"],
            network["download_mbps"],
            network["upload_mbps"]
        ))

        connection.commit()

    finally:
        connection.close()


def get_metrics_history(limit=100, since=None):
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row

    try:
        query = """
            SELECT
                timestamp,
                cpu_percent,
                ram_percent,
                disk_percent,
                download_mbps,
                upload_mbps
            FROM metrics
        """

        parameters = []

        if since is not None:
            query += " WHERE timestamp >= ?"
            parameters.append(since)

        query += " ORDER BY timestamp DESC, id DESC LIMIT ?"
        parameters.append(limit)

        cursor = connection.execute(
            query,
            parameters
        )

        rows = cursor.fetchall()

        return [
            dict(row)
            for row in reversed(rows)
        ]

    finally:
        connection.close()
