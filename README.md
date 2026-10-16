# PulseWatch

### Real-Time System, Network & Hardware Monitoring for Windows

PulseWatch is a local Windows monitoring application built with **Python, FastAPI, C#, and JavaScript**. It provides a responsive web dashboard for tracking system performance, network activity, and hardware sensors in real time.

The project combines REST API development, background data collection, SQLite persistence, hardware discovery, and live visualization. A C# sensor bridge powered by LibreHardwareMonitor reads hardware data, while the Python backend serves it to the dashboard.

## Windows Desktop Application — v0.2.0

PulseWatch is also available as a standalone Windows desktop application.

The desktop version includes a dedicated application window, advanced hardware monitoring, a custom application icon, persistent settings, and a Windows installer.

### Download & Install

1. Visit the [GitHub Releases](https://github.com/KostasNikP/PulseWatch/releases) page.
2. Download `PulseWatch_Setup_v0.2.0.exe`.
3. Run the installer and follow the setup instructions.
4. Launch PulseWatch from the Start Menu or desktop shortcut.
5. Optionally grant Administrator privileges for additional hardware sensors.

**Requirements:** Windows x64 and Microsoft Edge WebView2 Runtime.

Python and the .NET SDK are not required for the packaged desktop application.

**Note:** The desktop installer will be available with the v0.2.0 release. Hardware sensor availability depends on device compatibility and permissions.

The source-code installation instructions below remain available for developers.

## Features

### System & Network Monitoring

- Live CPU, RAM, and disk usage.
- Download and upload traffic in Mbps.
- Real-time CPU/memory and network charts using Chart.js.
- Historical charts for the last 15 minutes, 1 hour, or 6 hours.
- SQLite storage of system/network metrics approximately every 30 seconds.

### Hardware Monitor

- Automatic discovery of supported hardware, rather than hardcoded CPU or GPU models.
- Live readings for available CPU, GPU, motherboard, memory, and storage sensors.
- Sensor groups for temperatures, utilization, clock speeds, power, voltages, fan speeds, and other reported sensor types.
- Key readings highlighted at the top of device cards.
- Expandable sensor groups that stay open while their values update.
- **Customize Sensors:** search, select, or hide individual readings, including Select All / Deselect All.
- Sensor visibility preferences saved in the current browser's local storage.

**Sensor availability varies by hardware, drivers, and permissions.** Some readings require elevated privileges; unsupported sensors may not report valid values.

### Basic & Advanced Monitoring

- **Basic mode:** the backend and available sensor bridge features run without administrator privileges.
- **Advanced mode:** a separate administrator-approved helper collects additional hardware readings after Windows UAC permission is granted.
- The FastAPI server itself stays in the normal user context.
- When fresh advanced readings are not available, the collector can fall back to basic sensor monitoring.
- The administrator helper checks whether the PulseWatch server is still running and exits after the server has stopped.

### Alerts & API

- Configurable warning thresholds for CPU, RAM, and disk utilization.
- Alerts require three consecutive samples at or above their configured threshold.
- Dashboard notifications for monitoring status and alerts.
- REST endpoints for system metrics, hardware inventory, live sensor snapshots, historical data, and alert configuration.
- Interactive FastAPI API documentation at `/docs`.

## Tech Stack

| Technology | Role |
| --- | --- |
| Python | System metrics, background collection, API integration |
| FastAPI / Uvicorn | Local REST API and web server |
| psutil | CPU, memory, disk, and network metrics |
| C# / .NET 10 | Hardware sensor bridge |
| LibreHardwareMonitorLib | Hardware sensor readings |
| SQLite | Historical performance data |
| JavaScript / HTML / CSS | Interactive monitoring dashboard |
| Chart.js | Live and historical charts |
| Git / GitHub | Version control |

## Getting Started

### Requirements

- **Windows** (developed and tested on Windows 11).
- **Python 3** with `venv` and `pip` (tested with Python 3.14.6).
- **.NET 10 SDK** to build the sensor bridge.
- Internet access for initial package installation and for Chart.js loaded from a CDN.
- Administrator approval is optional for the main dashboard, but may be required for advanced hardware sensors.

### Installation

**1. Download or clone this repository.**

```powershell
git clone https://github.com/KostasNikP/PulseWatch.git
cd PulseWatch
```

Alternatively, use **Code → Download ZIP** on GitHub and extract the archive.

**2. Run the setup script.**

Double-click `setup_pulsewatch.bat` in the project folder. It will:

1. Check the installed Python interpreter.
2. Create `.venv` if it does not exist.
3. Install Python packages from `requirements.txt`.
4. Check for the .NET SDK.
5. Build the C# hardware sensor bridge.

Python and the .NET SDK must already be installed. The setup script does not currently install these prerequisites automatically.

**3. Start PulseWatch.**

Double-click `start_pulsewatch.bat`.

The launcher requests Windows UAC approval for the optional advanced sensor helper, starts the local FastAPI server, and opens the dashboard in your default browser when the server is ready.

**Dashboard:** <http://127.0.0.1:8000/dashboard>

If UAC permission is declined, the dashboard can still operate with basic monitoring and whichever sensors are accessible without elevation.

**4. Stop PulseWatch.**

Press `Ctrl+C` in the PulseWatch server window. The advanced sensor helper is designed to exit after it detects that the server has stopped.

### Run from the Terminal (Development)

After running the setup script, use:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.api:app --host 127.0.0.1 --port 8000
```

Open <http://127.0.0.1:8000/dashboard> manually. Starting the server this way does **not** automatically launch the elevated sensor helper.

**Windows note:** The current asyncio hardware streaming implementation may fail with `uvicorn --reload` on Windows because of subprocess event-loop limitations. Run the command above without `--reload`.

## REST API

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/` | API status |
| GET | `/dashboard` | Monitoring dashboard |
| GET | `/api/system` | Current CPU, RAM, and disk metrics |
| GET | `/api/network` | Current network metrics |
| GET | `/api/metrics` | Combined live metrics and alerts |
| GET | `/api/hardware` | Discovered hardware inventory |
| GET | `/api/sensors` | Latest hardware sensor snapshot |
| GET | `/api/history` | Saved system/network metrics |
| GET | `/api/alerts` | Current active usage alerts |
| GET | `/api/alert-settings` | Current warning thresholds |
| PUT | `/api/alert-settings` | Update warning thresholds |
| GET | `/docs` | Interactive Swagger UI |

The `/api/history` endpoint supports `limit` and `since` query parameters. Some live endpoints may briefly return HTTP `503` while the first readings are being collected.

## Alert Settings

Default warning thresholds:

| Metric | Default threshold |
| --- | ---: |
| CPU usage | 90% |
| RAM usage | 85% |
| Disk usage | 90% |

Thresholds are adjustable from **Alert Settings** in the dashboard. The values are stored locally in `data/alert_settings.json`. An alert is raised after three consecutive readings meet or exceed its threshold.

These alerts currently cover **system utilization**, not every individual hardware temperature or sensor.

## Local Data & Settings

- System and network history is stored in a local SQLite database under `data/`.
- Advanced sensor snapshots are written to `data/hardware_sensors_live.json` while the elevated helper runs.
- Alert thresholds are saved in `data/alert_settings.json`.
- Sensor visibility choices are stored in the browser's `localStorage`, rather than in the SQLite database.
- Runtime data, virtual environments, and .NET build outputs are excluded from version control through `.gitignore`.

## Project Structure

```text
PulseWatch/
|-- app/
|   |-- static/
|   |   |-- index.html
|   |   |-- style.css
|   |   |-- script.js
|   |   |-- hardware.js
|   |   |-- notifications.js
|   |   `-- settings.js
|   |-- admin_sensor_helper.py
|   |-- alerts.py
|   |-- api.py
|   |-- collector.py
|   |-- database.py
|   |-- hardware_discovery.py
|   |-- launch_admin_helper.py
|   |-- monitor.py
|   |-- open_dashboard.py
|   |-- sensor_stream.py
|   `-- sensors.py
|-- sensor_bridge/
|   |-- Program.cs
|   `-- sensor_bridge.csproj
|-- data/                  # Created/used locally, not committed
|-- requirements.txt
|-- setup_pulsewatch.bat
|-- start_pulsewatch.bat
|-- README.md
`-- .gitignore
```

## Troubleshooting

**The sensor bridge build fails because `sensor_bridge.dll` is in use.**

Close the PulseWatch server and Administrator Sensor Helper, wait a few seconds, and rerun `setup_pulsewatch.bat`. The installer detects when the DLL is locked and stops with an explanatory message.

**The hardware dashboard shows fewer sensors than expected.**

Some CPU, motherboard, fan, and storage sensors require elevated privileges, and availability varies by system. Approve the Windows UAC prompt to enable advanced monitoring when supported.

**PowerShell cannot run `Activate.ps1`.**

Activating the virtual environment is optional. Use `.\.venv\Scripts\python.exe` directly in the commands above; no PowerShell execution-policy change is required.

**The charts do not load without an internet connection.**

The dashboard currently loads Chart.js from a CDN. The chart library must be accessible for charts to render.

## Security & Limitations

- PulseWatch is a **local Windows development project**, not a hardened remote monitoring service.
- The API currently has no authentication. Keep it bound to `127.0.0.1`; do not expose it to the public internet.
- Advanced monitoring uses an elevated helper and a local JSON snapshot file. This is not yet a hardened inter-process communication design.
- Sensor readings are hardware-dependent and may be incomplete or inaccurate on some devices.
- Network speeds represent observed traffic, not your internet connection's maximum capacity.
- The setup process currently requires a preinstalled Python interpreter and .NET 10 SDK; it is not a standalone installer.

## Planned Improvements

- Automated tests and stronger error handling.
- More robust privileged-helper lifecycle and secure local communication.
- Packaging for easier Windows distribution without requiring users to set up development tools.
- Additional hardware alerts and monitoring views.
- Windows desktop notifications.

## Author

**Konstantinos Nikolakopoulos**  
Computer Science & Telecommunications Graduate

[GitHub Profile](https://github.com/KostasNikP)
