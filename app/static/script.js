
const MAX_POINTS = 30;
const STALE_AFTER_SECONDS = 10;

let lastTimestamp = null;


// ==========================================
// CHART CREATION
// ==========================================

function createChart(canvasId, labels, colors, maxY = null) {
    const canvas = document.getElementById(canvasId);

    return new Chart(canvas, {
        type: "line",
        data: {
            labels: [],
            datasets: labels.map((label, index) => ({
                label: label,
                data: [],
                borderColor: colors[index],
                backgroundColor: colors[index],
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 0
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: {
                    labels: {
                        color: "#cbd5e1"
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: "#94a3b8",
                        maxTicksLimit: 6
                    }
                },
                y: {
                    beginAtZero: true,
                    ...(maxY !== null ? { max: maxY } : {}),
                    ticks: {
                        color: "#94a3b8"
                    }
                }
            }
        }
    });
}


// ==========================================
// INITIALIZE CHARTS
// ==========================================

const systemChart = createChart(
    "systemChart",
    ["CPU %", "RAM %"],
    ["#38bdf8", "#34d399"],
    100
);

const networkChart = createChart(
    "networkChart",
    ["Download Mbps", "Upload Mbps"],
    ["#38bdf8", "#f59e0b"]
);

const historySystemChart = createChart(
    "historySystemChart",
    ["CPU %", "RAM %"],
    ["#38bdf8", "#34d399"],
    100
);

const historyNetworkChart = createChart(
    "historyNetworkChart",
    ["Download Mbps", "Upload Mbps"],
    ["#38bdf8", "#f59e0b"]
);


// ==========================================
// CONNECTION STATUS
// ==========================================

function setConnectionState(state) {
    const badge = document.getElementById("connectionStatus");
    const indicator = document.getElementById("liveIndicator");

    const states = {
        connecting: {
            badge: "Connecting...",
            indicator: "CONNECTING"
        },
        online: {
            badge: "Connected",
            indicator: "LIVE DATA"
        },
        stale: {
            badge: "Stale Data",
            indicator: "DATA DELAYED"
        },
        offline: {
            badge: "Disconnected",
            indicator: "OFFLINE"
        }
    };

    const current = states[state];

    if (!current) return;

    if (badge && (
        badge.dataset.state !== state ||
        badge.textContent.trim() !== current.badge
    )) {
        badge.dataset.state = state;
        badge.textContent = current.badge;
    }

    if (indicator && (
        indicator.dataset.state !== state ||
        indicator.textContent.trim() !== current.indicator
    )) {
        indicator.dataset.state = state;
        indicator.textContent = current.indicator;
    }
}


// ==========================================
// SMART SIDEBAR NAVIGATION
// ==========================================

const navigationItems = Array.from(
    document.querySelectorAll(".sidebar-nav a[href^='#']")
).map(link => ({
    link: link,
    section: document.querySelector(link.getAttribute("href"))
})).filter(item => item.section !== null);


function setActiveNavigation(activeItem) {
    navigationItems.forEach(item => {
        const isActive = item === activeItem;

        item.link.classList.toggle("active", isActive);

        if (isActive) {
            item.link.setAttribute("aria-current", "location");
        } else {
            item.link.removeAttribute("aria-current");
        }
    });
}


function updateActiveNavigation() {
    if (navigationItems.length === 0) return;

    const offset = Math.max(150, window.innerHeight * 0.25);

    let activeItem = navigationItems[0];

    navigationItems.forEach(item => {
        const position =
            item.section.getBoundingClientRect().top;

        if (position <= offset) {
            activeItem = item;
        }
    });

    setActiveNavigation(activeItem);
}


let navigationUpdatePending = false;

function scheduleNavigationUpdate() {
    if (navigationUpdatePending) return;

    navigationUpdatePending = true;

    requestAnimationFrame(() => {
        updateActiveNavigation();
        navigationUpdatePending = false;
    });
}


window.addEventListener(
    "scroll",
    scheduleNavigationUpdate,
    { passive: true }
);

window.addEventListener(
    "resize",
    scheduleNavigationUpdate
);

navigationItems.forEach(item => {
    item.link.addEventListener("click", () => {
        setActiveNavigation(item);
    });
});


// ==========================================
// ADD LIVE CHART DATA
// ==========================================

function addChartData(chart, label, values) {
    chart.data.labels.push(label);

    chart.data.datasets.forEach((dataset, index) => {
        dataset.data.push(values[index]);
    });

    if (chart.data.labels.length > MAX_POINTS) {
        chart.data.labels.shift();

        chart.data.datasets.forEach(dataset => {
            dataset.data.shift();
        });
    }

    chart.update("none");
}


// ==========================================
// UPDATE HISTORY CHART DATA
// ==========================================

function setHistoryChartData(chart, rows, fields) {
    chart.data.labels = rows.map(row =>
        new Date(row.timestamp * 1000)
            .toLocaleTimeString("el-GR")
    );

    chart.data.datasets.forEach((dataset, index) => {
        dataset.data = rows.map(row =>
            row[fields[index]]
        );
    });

    chart.update("none");
}


// ==========================================
// SYSTEM ALERTS
// ==========================================

function renderAlerts(alerts) {
    const container = document.getElementById("alerts-container");
    const count = document.getElementById("alerts-count");

    if (!container || !count) return;

    container.replaceChildren();
    count.textContent = `${alerts.length} active`;

    if (alerts.length === 0) {
        const message = document.createElement("div");

        message.className = "alerts-ok";
        message.textContent =
            "✓ All monitored metrics are within configured thresholds.";

        container.appendChild(message);
        return;
    }

    alerts.forEach(alert => {
        const alertBox = document.createElement("div");
        alertBox.className = "alert-item";

        const title = document.createElement("strong");
        title.textContent = alert.message;

        const description = document.createElement("p");
        description.textContent =
            `Current: ${alert.value}% | Threshold: ${alert.threshold}%`;

        alertBox.append(title, description);
        container.appendChild(alertBox);
    });
}


// ==========================================
// UPDATE DASHBOARD
// ==========================================

async function updateDashboard() {
    try {
        const response = await fetch("/api/metrics", {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const metrics = await response.json();

        const system = metrics.system;
        const network = metrics.network;

        // Check measurement freshness
        const ageSeconds =
            Date.now() / 1000 - metrics.timestamp;

        const isFresh =
            Number.isFinite(ageSeconds) &&
            ageSeconds >= -5 &&
            ageSeconds <= STALE_AFTER_SECONDS;

        setConnectionState(isFresh ? "online" : "stale");

        // Update metric cards
        document.getElementById("cpu").textContent =
            `${system.cpu_percent}%`;

        document.getElementById("ram").textContent =
            `${system.ram_percent}%`;

        document.getElementById("disk").textContent =
            `${system.disk_percent}%`;

        document.getElementById("download").textContent =
            `${network.download_mbps.toFixed(2)} Mbps`;

        document.getElementById("upload").textContent =
            `${network.upload_mbps.toFixed(2)} Mbps`;

        // Update alerts
        renderAlerts(metrics.alerts ?? []);

        // Don't add stale or duplicate measurements
        if (!isFresh || metrics.timestamp === lastTimestamp) {
            return;
        }

        lastTimestamp = metrics.timestamp;

        const timeLabel = new Date(
            metrics.timestamp * 1000
        ).toLocaleTimeString("el-GR");

        // Update live charts
        addChartData(systemChart, timeLabel, [
            system.cpu_percent,
            system.ram_percent
        ]);

        addChartData(networkChart, timeLabel, [
            network.download_mbps,
            network.upload_mbps
        ]);

        // Update history charts in Live Mode
        const selectedRange =
            document.getElementById("historyRange").value;

        if (selectedRange === "live") {
            addChartData(historySystemChart, timeLabel, [
                system.cpu_percent,
                system.ram_percent
            ]);

            addChartData(historyNetworkChart, timeLabel, [
                network.download_mbps,
                network.upload_mbps
            ]);
        }

    } catch (error) {
        console.error("PulseWatch update failed:", error);
        setConnectionState("offline");
    }
}


// ==========================================
// AUTOMATIC REFRESH
// ==========================================

async function refreshDashboard() {
    await updateDashboard();
    setTimeout(refreshDashboard, 3000);
}


// ==========================================
// LOAD HISTORICAL METRICS
// ==========================================

async function loadHistory() {
    const status = document.getElementById("historyStatus");

    const selectedRange =
        document.getElementById("historyRange").value;

    if (selectedRange === "live") {
        setHistoryChartData(
            historySystemChart,
            [],
            ["cpu_percent", "ram_percent"]
        );

        setHistoryChartData(
            historyNetworkChart,
            [],
            ["download_mbps", "upload_mbps"]
        );

        status.textContent =
            "Live monitoring — updating automatically";

        return;
    }

    status.textContent = "Loading history...";

    try {
        const range = Number(selectedRange);
        const since = Date.now() / 1000 - range;

        const response = await fetch(
            `/api/history?limit=1000&since=${since}`
        );

        if (!response.ok) {
            throw new Error("Failed to load history");
        }

        const history = await response.json();

        // Ignore outdated requests
        if (
            document.getElementById("historyRange").value
            !== selectedRange
        ) {
            return;
        }

        setHistoryChartData(
            historySystemChart,
            history,
            ["cpu_percent", "ram_percent"]
        );

        setHistoryChartData(
            historyNetworkChart,
            history,
            ["download_mbps", "upload_mbps"]
        );

        status.textContent = history.length > 0
            ? `${history.length} saved measurements loaded.`
            : "No saved measurements in this time range yet.";

    } catch (error) {
        console.error("History error:", error);

        if (
            document.getElementById("historyRange").value
            === selectedRange
        ) {
            status.textContent =
                "Failed to load historical data.";
        }
    }
}


// ==========================================
// HISTORY CONTROLS
// ==========================================

document.getElementById("historyRange")
    .addEventListener("change", loadHistory);

document.getElementById("refreshHistory")
    .addEventListener("click", loadHistory);


// ==========================================
// START PULSEWATCH
// ==========================================

setConnectionState("connecting");
updateActiveNavigation();
loadHistory();
refreshDashboard();
