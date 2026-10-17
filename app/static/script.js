
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

/* ==========================================
   NETWORK TRAFFIC CHART
   ========================================== */

const networkChart = createChart(
    "networkChart",
    ["Download Mbps", "Upload Mbps"],
    ["#38bdf8", "#f59e0b"]
);



/* ==========================================
   PULSEWATCH v0.3 — LIVE CPU GRAPH
   ========================================== */

const overviewCpuChart = createChart(
    "overviewCpuChart",
    ["CPU Usage %"],
    ["#ff9e45"],
    100
);

// Orange area below the CPU line
overviewCpuChart.data.datasets[0].fill = true;
overviewCpuChart.data.datasets[0].backgroundColor =
    "rgba(255, 158, 69, 0.12)";

overviewCpuChart.data.datasets[0].borderWidth = 2.5;
overviewCpuChart.data.datasets[0].tension = 0.35;
overviewCpuChart.data.datasets[0].pointRadius = 0;

overviewCpuChart.update("none");

/* ==========================================
   PULSEWATCH v0.3 — GPU LIVE GRAPH
   ========================================== */

const overviewGpuChart = createChart(
    "overviewGpuChart",
    ["GPU Usage %"],
    ["#39cfff"],
    100
);

// Blue area below the GPU line
overviewGpuChart.data.datasets[0].fill = true;

overviewGpuChart.data.datasets[0].backgroundColor =
    "rgba(57, 207, 255, 0.12)";

overviewGpuChart.data.datasets[0].borderWidth = 2.5;
overviewGpuChart.data.datasets[0].tension = 0.35;
overviewGpuChart.data.datasets[0].pointRadius = 0;

overviewGpuChart.update("none");

/* ==========================================
   PULSEWATCH v0.3 — GPU DISPLAY MODES
   ========================================== */

const gpuCard = document.querySelector(".pw3-gpu-card");

const gpuViewButtons = gpuCard.querySelectorAll(
    ".pw3-view-switch button[data-gpu-view]"
);

const gpuGaugeView = gpuCard.querySelector(
    ".pw3-gpu-gauge"
);

const gpuContent = gpuCard.querySelector(
    ".pw3-gpu-content"
);

const gpuGraphView = gpuCard.querySelector(
    ".pw3-gpu-chart-container"
);

const GPU_VIEW_STORAGE_KEY = "pulsewatch_gpu_view_v3";

function setGpuView(view) {

    const validViews = ["gauge", "graph", "compact"];

    if (!validViews.includes(view)) {
        view = "gauge";
    }

    gpuCard.dataset.view = view;

    // Show the circular Gauge only in Gauge mode
    gpuGaugeView.style.display =
        view === "gauge" ? "" : "none";

    // Keep hardware statistics visible
    gpuContent.style.gridTemplateColumns =
        view === "gauge" ? "" : "1fr";

    // Show the live chart only in Graph mode
    gpuGraphView.hidden = view !== "graph";

    // Update active buttons
    gpuViewButtons.forEach(button => {

        const isActive =
            button.dataset.gpuView === view;

        button.classList.toggle("active", isActive);

        button.setAttribute(
            "aria-pressed",
            String(isActive)
        );
    });

    // Resize Chart.js after displaying the graph
    if (view === "graph") {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                overviewGpuChart.resize();
            });
        });
    }

    // Save display preference
    try {
        localStorage.setItem(
            GPU_VIEW_STORAGE_KEY,
            view
        );
    } catch (error) {
        console.warn("Could not save GPU view:", error);
    }
}

// GPU buttons
gpuViewButtons.forEach(button => {

    button.addEventListener("click", () => {
        setGpuView(button.dataset.gpuView);
    });

});

// Restore GPU view after restarting PulseWatch
let savedGpuView = "gauge";

try {
    savedGpuView =
        localStorage.getItem(GPU_VIEW_STORAGE_KEY)
        || "gauge";
} catch (error) {
    console.warn("Could not load GPU view:", error);
}

setGpuView(savedGpuView);


/* ==========================================
   PULSEWATCH v0.3 — GPU EXPAND / COLLAPSE
   ========================================== */

const gpuExpandButton = document.getElementById("pw3GpuExpand");
let gpuIsExpanded = false;

function setGpuExpanded(expanded) {
    // Only one monitoring widget can be expanded at a time.
    if (expanded && cpuIsExpanded) {
        setCpuExpanded(false);
    }

    gpuIsExpanded = expanded;
    gpuCard.classList.toggle("pw3-expanded", expanded);
    document.body.classList.toggle("pw3-overlay-open", expanded);
    gpuExpandButton.textContent = expanded ? "Collapse" : "Expand";
    gpuExpandButton.setAttribute("aria-pressed", String(expanded));

    // Chart.js needs to re-measure after the widget changes size.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => overviewGpuChart.resize());
    });
}

gpuExpandButton.addEventListener("click", () => {
    setGpuExpanded(!gpuIsExpanded);
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && gpuIsExpanded) {
        setGpuExpanded(false);
        gpuExpandButton.focus();
    }
});


/* ==========================================
   PULSEWATCH v0.3 — GPU DRAG RESIZE
   ========================================== */

const gpuResizeHandle = document.getElementById("pw3GpuResize");
const gpuDashboardGrid = gpuCard.closest(".dashboard");
const GPU_SIZE_STORAGE_KEY = "pulsewatch_gpu_width_v3";

let gpuSavedSpan = null;
let gpuResizeSession = null;

try {
    const stored = Number.parseInt(
        localStorage.getItem(GPU_SIZE_STORAGE_KEY),
        10
    );

    if ([2, 3, 4].includes(stored)) {
        gpuSavedSpan = stored;
        gpuCard.style.setProperty("--pw3-gpu-span", stored);
    }
} catch (error) {
    console.warn("GPU width storage unavailable:", error);
}

function getGpuSpan() {
    return gpuSavedSpan ?? (gpuCard.dataset.view === "graph" ? 4 : 2);
}

function setGpuSpan(span) {
    const safeSpan = Math.max(2, Math.min(4, span));
    gpuSavedSpan = safeSpan;
    gpuCard.style.setProperty("--pw3-gpu-span", safeSpan);

    try {
        localStorage.setItem(GPU_SIZE_STORAGE_KEY, String(safeSpan));
    } catch (error) {
        console.warn("Could not save GPU width:", error);
    }

    if (gpuCard.dataset.view === "graph") {
        requestAnimationFrame(() => overviewGpuChart.resize());
    }
}

gpuResizeHandle.addEventListener("pointerdown", event => {
    if (
        event.button !== 0 ||
        gpuIsExpanded ||
        window.matchMedia("(max-width: 1100px)").matches
    ) {
        return;
    }

    event.preventDefault();

    const styles = getComputedStyle(gpuDashboardGrid);
    const gap = Number.parseFloat(styles.columnGap) || 18;
    const columnStep = (gpuDashboardGrid.clientWidth + gap) / 4;

    gpuResizeSession = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startSpan: getGpuSpan(),
        columnStep
    };

    gpuResizeHandle.setPointerCapture(event.pointerId);
    gpuResizeHandle.classList.add("is-resizing");
});

gpuResizeHandle.addEventListener("pointermove", event => {
    if (
        !gpuResizeSession ||
        event.pointerId !== gpuResizeSession.pointerId
    ) {
        return;
    }

    const distance = event.clientX - gpuResizeSession.startX;
    const columnChange = Math.round(
        distance / gpuResizeSession.columnStep
    );
    const newSpan = gpuResizeSession.startSpan + columnChange;
    const safeSpan = Math.max(2, Math.min(4, newSpan));

    if (safeSpan !== getGpuSpan()) {
        setGpuSpan(safeSpan);
    }
});

function finishGpuResize() {
    gpuResizeSession = null;
    gpuResizeHandle.classList.remove("is-resizing");
}

gpuResizeHandle.addEventListener("pointerup", finishGpuResize);
gpuResizeHandle.addEventListener("pointercancel", finishGpuResize);
gpuResizeHandle.addEventListener("lostpointercapture", finishGpuResize);


/* ==========================================
   PULSEWATCH v0.3 — CPU DISPLAY MODES
   ========================================== */

const cpuCard = document.querySelector(".pw3-cpu-card");

const cpuViewButtons = cpuCard.querySelectorAll(
    ".pw3-view-switch button[data-view]"
);

const cpuGraphView = cpuCard.querySelector(
    ".pw3-cpu-chart-container"
);

// Create the CPU Gauge view
const cpuGaugeView = document.createElement("div");

cpuGaugeView.className = "pw3-cpu-gauge-view";
cpuGaugeView.hidden = true;

cpuGaugeView.innerHTML = `
    <div class="pw3-cpu-gauge-ring"
         role="img"
         aria-label="CPU usage">

        <div class="pw3-cpu-gauge-center">
            <strong id="pw3CpuGaugeValue">--%</strong>
            <span>CPU Usage</span>
        </div>

    </div>

    <p>Real-time processor utilization</p>
`;

cpuGraphView.after(cpuGaugeView);

const cpuGaugeRing = cpuGaugeView.querySelector(
    ".pw3-cpu-gauge-ring"
);

const cpuGaugeValue = document.getElementById(
    "pw3CpuGaugeValue"
);

const CPU_VIEW_STORAGE_KEY = "pulsewatch_cpu_view_v3";


// Update CPU Gauge using live measurements
function updateCpuGauge(value) {

    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) return;

    const usage = Math.max(
        0,
        Math.min(100, numericValue)
    );

    const angle = usage * 3.6;

    cpuGaugeRing.style.setProperty(
        "--cpu-gauge-angle",
        `${angle}deg`
    );

    cpuGaugeValue.textContent =
        `${usage.toFixed(1)}%`;

    cpuGaugeRing.setAttribute(
        "aria-label",
        `CPU usage ${usage.toFixed(1)} percent`
    );
}


// Switch between Graph, Gauge and Compact
function setCpuView(view) {

    const validViews = [
        "graph",
        "gauge",
        "compact"
    ];

    if (!validViews.includes(view)) {
        view = "graph";
    }

    cpuCard.dataset.view = view;

    cpuGraphView.hidden = view !== "graph";
    cpuGaugeView.hidden = view !== "gauge";

    cpuViewButtons.forEach(button => {

        const isActive =
            button.dataset.view === view;

        button.classList.toggle(
            "active",
            isActive
        );

        button.setAttribute(
            "aria-pressed",
            String(isActive)
        );
    });

    // Resize Chart.js when returning to Graph mode
    if (view === "graph") {
        requestAnimationFrame(() => {
            overviewCpuChart.resize();
        });
    }

    // Save user preference
    try {
        localStorage.setItem(
            CPU_VIEW_STORAGE_KEY,
            view
        );
    } catch (error) {
        console.warn(
            "Could not save CPU view:",
            error
        );
    }
}


// Handle button clicks
cpuViewButtons.forEach(button => {

    button.addEventListener("click", () => {
        setCpuView(button.dataset.view);
    });

});


// Restore previously selected view
let savedCpuView = "graph";

try {
    savedCpuView =
        localStorage.getItem(CPU_VIEW_STORAGE_KEY)
        || "graph";
} catch (error) {
    console.warn(
        "Could not load CPU view:",
        error
    );
}

setCpuView(savedCpuView);

/* ==========================================
   PULSEWATCH v0.3 — CPU EXPAND / COLLAPSE
   ========================================== */

const cpuExpandButton =
    document.getElementById("pw3CpuExpand");

let cpuIsExpanded = false;


function setCpuExpanded(expanded) {

    if (expanded && gpuIsExpanded) {
        setGpuExpanded(false);
    }

    cpuIsExpanded = expanded;

    cpuCard.classList.toggle(
        "pw3-expanded",
        expanded
    );

    document.body.classList.toggle(
        "pw3-overlay-open",
        expanded
    );

    cpuExpandButton.textContent =
        expanded ? "Collapse" : "Expand";

    cpuExpandButton.setAttribute(
        "aria-pressed",
        String(expanded)
    );

    // Adjust the live chart to the new dimensions.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            overviewCpuChart.resize();
        });
    });
}


// Expand or collapse when clicking the button.
cpuExpandButton.addEventListener("click", () => {

    setCpuExpanded(!cpuIsExpanded);

});


// Press Escape to close the expanded CPU panel.
document.addEventListener("keydown", event => {

    if (event.key === "Escape" && cpuIsExpanded) {
        setCpuExpanded(false);
        cpuExpandButton.focus();
    }

});




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

    const offset = Math.max(
        150,
        window.innerHeight * 0.25
    );

    let activeItem = null;
    let closestPosition = -Infinity;

    let firstItem = null;
    let firstPosition = Infinity;

    navigationItems.forEach(item => {
        const position =
            item.section.getBoundingClientRect().top;

        // Find the first section on the page
        if (position < firstPosition) {
            firstPosition = position;
            firstItem = item;
        }

        // Find the section closest to the active viewport area
        if (
            position <= offset &&
            position > closestPosition
        ) {
            closestPosition = position;
            activeItem = item;
        }
    });

    setActiveNavigation(activeItem ?? firstItem);
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
            updateCpuGauge(system.cpu_percent);

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

        // Update the new CPU overview graph
        addChartData(
            overviewCpuChart,
            timeLabel,
            [system.cpu_percent]
        );


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


/* ==========================================
   PULSEWATCH v0.3 — CPU WIDGET RESIZING
   ========================================== */

const cpuResizeHandle =
    document.getElementById("pw3CpuResize");

const cpuDashboardGrid =
    cpuCard.closest(".dashboard");

const CPU_SIZE_STORAGE_KEY =
    "pulsewatch_cpu_width_v3";

let cpuSavedSpan = null;
let cpuResizeSession = null;


// Restore saved width
try {
    const stored = Number.parseInt(
        localStorage.getItem(CPU_SIZE_STORAGE_KEY),
        10
    );

    if ([2, 3, 4].includes(stored)) {
        cpuSavedSpan = stored;
    }
} catch (error) {
    console.warn("CPU width storage unavailable:", error);
}


// Default width depends on display mode
function getCpuSpan() {
    if (cpuSavedSpan !== null) {
        return cpuSavedSpan;
    }

    return cpuCard.dataset.view === "graph" ? 4 : 2;
}


// Apply selected width
function setCpuSpan(span) {
    const safeSpan = Math.max(
        2,
        Math.min(4, span)
    );

    cpuSavedSpan = safeSpan;

    cpuCard.style.setProperty(
        "--pw3-cpu-span",
        safeSpan
    );

    try {
        localStorage.setItem(
            CPU_SIZE_STORAGE_KEY,
            String(safeSpan)
        );
    } catch (error) {
        console.warn("Could not save CPU width:", error);
    }

    // Keep Chart.js responsive
    if (cpuCard.dataset.view === "graph") {
        requestAnimationFrame(() => {
            overviewCpuChart.resize();
        });
    }
}


// Apply stored width on startup
if (cpuSavedSpan !== null) {
    cpuCard.style.setProperty(
        "--pw3-cpu-span",
        cpuSavedSpan
    );
}


// Start dragging
cpuResizeHandle.addEventListener(
    "pointerdown",
    event => {

        if (event.button !== 0) return;

        if (
            window.matchMedia(
                "(max-width: 1100px)"
            ).matches ||
            cpuIsExpanded
        ) {
            return;
        }

        event.preventDefault();

        const styles = getComputedStyle(
            cpuDashboardGrid
        );

        const gap =
            parseFloat(styles.columnGap) || 18;

        const columnStep =
            (cpuDashboardGrid.clientWidth + gap) / 4;

        cpuResizeSession = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startSpan: getCpuSpan(),
            columnStep
        };

        cpuResizeHandle.setPointerCapture(
            event.pointerId
        );

        cpuResizeHandle.classList.add(
            "is-resizing"
        );
    }
);


// Resize while dragging
cpuResizeHandle.addEventListener(
    "pointermove",
    event => {

        if (
            !cpuResizeSession ||
            event.pointerId !== cpuResizeSession.pointerId
        ) {
            return;
        }

        const distance =
            event.clientX - cpuResizeSession.startX;

        const columnChange = Math.round(
            distance / cpuResizeSession.columnStep
        );

        const newSpan =
            cpuResizeSession.startSpan + columnChange;

        const safeSpan = Math.max(
            2,
            Math.min(4, newSpan)
        );

        if (safeSpan !== getCpuSpan()) {
            setCpuSpan(safeSpan);
        }
    }
);


// Finish resizing
function finishCpuResize() {
    cpuResizeSession = null;

    cpuResizeHandle.classList.remove(
        "is-resizing"
    );
}

cpuResizeHandle.addEventListener(
    "pointerup",
    finishCpuResize
);

cpuResizeHandle.addEventListener(
    "pointercancel",
    finishCpuResize
);

cpuResizeHandle.addEventListener(
    "lostpointercapture",
    finishCpuResize
);

