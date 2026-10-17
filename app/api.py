from fastapi import Query
from app.database import get_metrics_history
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from app.hardware_discovery import get_hardware_inventory
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


from app.collector import MetricsCollector

from pydantic import BaseModel, Field

from app.alerts import (
    get_alert_settings,
    save_alert_settings
)

collector = MetricsCollector()


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(collector.collect())

    try:
        yield
    finally:
        task.cancel()

        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="PulseWatch API",
    description="System and Network Monitoring API",
    version="1.0.0",
    lifespan=lifespan
)


STATIC_DIR = Path(__file__).resolve().parent / "static"

app.mount(
    "/static",
    StaticFiles(directory=STATIC_DIR),
    name="static"
)



@app.middleware("http")
async def prevent_dashboard_caching(request, call_next):
    """Avoid stale JavaScript/CSS in persistent WebView2 sessions."""
    response = await call_next(request)

    if (
        request.url.path == "/dashboard"
        or request.url.path.startswith("/static/")
    ):
        response.headers["Cache-Control"] = "no-store, max-age=0"

    return response


@app.get("/")
def home():
    return {"message": "PulseWatch API is running"}


@app.get("/api/system")
def system_metrics():
    if collector.latest_metrics is None:
        raise HTTPException(
            status_code=503,
            detail="Metrics are not available yet"
        )

    return collector.latest_metrics["system"]


@app.get("/api/network")
def network_metrics():
    if collector.latest_metrics is None:
        raise HTTPException(
            status_code=503,
            detail="Metrics are not available yet"
        )

    return collector.latest_metrics["network"]


@app.get("/api/metrics")
def all_metrics():
    if collector.latest_metrics is None:
        raise HTTPException(
            status_code=503,
            detail="Metrics are not available yet"
        )

    return collector.latest_metrics


@app.get("/dashboard")
def dashboard():
    return FileResponse(STATIC_DIR / "index.html")
@app.get("/api/history")
def metrics_history(
    limit: int = Query(default=100, ge=1, le=1000),
    since: float | None = Query(default=None, ge=0)
):
    return get_metrics_history(
        limit=limit,
        since=since
    )
@app.get("/api/alerts")
def get_alerts():
    if collector.latest_metrics is None:
        raise HTTPException(
            status_code=503,
            detail="Metrics are not available yet"
        )

    return {
        "timestamp": collector.latest_metrics["timestamp"],
        "alerts": collector.latest_metrics["alerts"]
    }
class AlertSettings(BaseModel):
    cpu_percent: int = Field(ge=1, le=100)
    ram_percent: int = Field(ge=1, le=100)
    disk_percent: int = Field(ge=1, le=100)


@app.get("/api/alert-settings")
def read_alert_settings():
    return get_alert_settings()


@app.put("/api/alert-settings")
def update_alert_settings(settings: AlertSettings):
    return save_alert_settings(
        settings.model_dump()
    )
@app.get("/api/hardware")
def hardware_inventory():
    hardware = get_hardware_inventory()

    if "error" in hardware:
        raise HTTPException(
            status_code=503,
            detail=hardware["error"]
        )

    return hardware

@app.get("/api/sensors")
def hardware_sensors():
    snapshot = collector.latest_hardware_sensors

    if snapshot is None:
        raise HTTPException(
            status_code=503,
            detail=(
                collector.hardware_sensors_error
                or "Hardware sensors are starting..."
            )
        )

    return snapshot
