
# PulseWatch

### Real-Time System & Network Monitoring Dashboard

PulseWatch is a Python-based monitoring application that provides real-time insights into system performance and network activity through a modern web dashboard.

Built with FastAPI, SQLite, and Chart.js, the project combines backend development, REST API design, system monitoring, and data visualization.

## Features

- **System Monitoring:** Track CPU usage, RAM utilization, and disk space.
- **Network Monitoring:** Monitor download and upload traffic in Mbps.
- **Live Dashboard:** Automatically updated system metrics and charts.
- **Historical Monitoring:** View recorded metrics from the last 15 minutes, 1 hour, or 6 hours.
- **SQLite Database:** Automatically save performance metrics for historical analysis.
- **System Alerts:** Detect high CPU, RAM, and disk usage.
- **REST API:** Access monitoring data through documented HTTP endpoints.
- **Interactive API Documentation:** Explore endpoints using FastAPI's Swagger UI.

## Tech Stack

| Technology | Purpose |
|---|---|
| Python | Core application and monitoring |
| FastAPI | REST API and backend |
| psutil | System and network metrics |
| SQLite | Persistent data storage |
| JavaScript | Dashboard functionality |
| Chart.js | Live and historical charts |
| HTML & CSS | Dashboard interface |
| Git & GitHub | Version control |

## Getting Started

### Requirements

- Windows operating system
- Python 3.10 or newer
- Internet connection to load Chart.js from its CDN

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/KostasNikP/PulseWatch.git
cd PulseWatch
```

**2. Create a virtual environment**

```powershell
py -m venv .venv
```

**3. Install dependencies**

```powershell
.\.venv\Scripts\python.exe -m pip install psutil "fastapi[standard]"
```

**4. Start the application**

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.api:app --reload
```

**5. Open the dashboard**

Visit:

http://127.0.0.1:8000/dashboard

## REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | API status |
| GET | `/api/system` | Current system metrics |
| GET | `/api/network` | Current network metrics |
| GET | `/api/metrics` | Combined monitoring data |
| GET | `/api/history` | Saved historical metrics |
| GET | `/api/alerts` | Active system alerts |
| GET | `/docs` | Interactive API documentation |

Historical measurements can be filtered using the `limit` and `since` query parameters.

## System Alerts

PulseWatch currently uses the following default thresholds:

| Metric | Warning Threshold |
|---|---|
| CPU Usage | 90% |
| RAM Usage | 85% |
| Disk Usage | 90% |

Alerts appear in the dashboard when a monitored value reaches or exceeds its configured threshold.

## Data Storage

PulseWatch uses SQLite to store system and network metrics approximately every 30 seconds while the backend is running.

The database is created automatically in the `data/` directory.

Monitoring data and virtual environment files are excluded from Git using `.gitignore`.

## Project Structure

```text
PulseWatch/
├── app/
│   ├── static/
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
│   ├── __init__.py
│   ├── alerts.py
│   ├── api.py
│   ├── collector.py
│   ├── database.py
│   └── monitor.py
├── main.py
└── .gitignore
```

## Security & Limitations

PulseWatch is currently designed for local monitoring on Windows.

The API does not yet include authentication. Keep the server accessible only from your local computer and do not expose it publicly to the Internet.

Network speeds represent observed traffic, not the maximum bandwidth of an Internet connection.

## Planned Improvements

- Configurable alert thresholds
- Sustained-usage alert detection
- Windows desktop notifications
- Dashboard UI improvements
- Automated tests
- Additional monitoring capabilities

## Author

**Konstantinos Nikolakopoulos**

Computer Science & Telecommunications Graduate

[GitHub Profile](https://github.com/KostasNikP)
