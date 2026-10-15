from fastapi import Query
from app.database import get_metrics_history
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.collector import MetricsCollector


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