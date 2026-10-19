
"use strict";

// ==========================================
// PULSEWATCH — HARDWARE MONITOR
// ==========================================

const hardwareContainer = document.getElementById("hardware-container");
const hardwareStatus = document.getElementById("hardwareStatus");
const sensorSettingsDialog = document.getElementById("sensorSettingsDialog");
const customizeSensorsButton = document.getElementById("customizeSensors");
const closeSensorSettingsButton = document.getElementById("closeSensorSettings");
const sensorSettingsList = document.getElementById("sensorSettingsList");

const SENSOR_STORAGE_KEY = "pulsewatch_hidden_sensors_v1";
const HARDWARE_LAYOUT_KEY = "pulsewatch_hardware_card_layout_v1";
const hardwareLayoutDialog = document.getElementById("pwHardwareLayoutDialog");
const hardwareLayoutList = document.getElementById("pwHardwareLayoutList");
const DEFAULT_CATEGORY_ORDER = ["Cpu","Gpu","Memory","Storage","Motherboard","SuperIO"];
let hardwareLayout = {order:[],hidden:[]};
let hardwareDraft = null;
const HARDWARE_REFRESH_INTERVAL = 3000;
const SENSOR_STALE_SECONDS = 15;

let latestHardwareSnapshot = null;
let hiddenSensors = new Set();
let hardwareLayoutSignature = null;

const hardwareSensorNodes = new Map();
const hardwareSummaryNodes = new Map();


// ==========================================
// SENSOR CONFIGURATION
// ==========================================

const hardwareUnits = {
    Temperature: "°C",
    Load: "%",
    Clock: "MHz",
    Fan: "RPM",
    Power: "W",
    Voltage: "V",
    Current: "A",
    Control: "%",
    Level: "%",
    Data: "GB",
    SmallData: "MB",
    Throughput: "B/s",
    Factor: ""
};

const sensorPriority = {
    Temperature: 0,
    Load: 1,
    Clock: 2,
    Fan: 3,
    Power: 4,
    Voltage: 5,
    Current: 6,
    Level: 7,
    Data: 8,
    SmallData: 9,
    Throughput: 10,
    Control: 11,
    Factor: 12
};

const sensorGroupNames = {
    Temperature: "Temperatures",
    Load: "Usage & Load",
    Clock: "Clock Speeds",
    Fan: "Fan Speeds",
    Power: "Power",
    Voltage: "Voltages",
    Current: "Current",
    Level: "Levels & Health",
    Data: "Memory & Data",
    SmallData: "Memory & Data",
    Throughput: "Throughput",
    Control: "Controls",
    Factor: "Factors"
};


// ==========================================
// SAVED PREFERENCES
// ==========================================

function loadSensorPreferences() {
    try {
        const saved = JSON.parse(
            localStorage.getItem(SENSOR_STORAGE_KEY) || "[]"
        );

        if (Array.isArray(saved)) {
            hiddenSensors = new Set(
                saved.filter(item => typeof item === "string")
            );
        }
    } catch (error) {
        console.warn("Could not load sensor preferences:", error);
        hiddenSensors = new Set();
    }
}

function deviceKey(device) {
    return String(device.id || device.name);
}
function defaultRank(device) {
    const cat=(device.category || "").startsWith("Gpu") ? "Gpu" : device.category;
    const index=DEFAULT_CATEGORY_ORDER.indexOf(cat);
    return index < 0 ? 999 : index;
}
function orderedDevices(devices, order) {
    const position=new Map(order.map((id,index)=>[id,index]));
    return [...devices].sort((a,b)=>{
        const ai=position.get(deviceKey(a)),bi=position.get(deviceKey(b));
        if(ai!==undefined && bi!==undefined) return ai-bi;
        if(ai!==undefined)return -1;
        if(bi!==undefined)return 1;
        return defaultRank(a)-defaultRank(b) || a.name.localeCompare(b.name);
    });
}
function loadHardwareLayout() {
    try {
        const stored=JSON.parse(localStorage.getItem(HARDWARE_LAYOUT_KEY)||"null");
        if(stored && Array.isArray(stored.order) && Array.isArray(stored.hidden)){
            hardwareLayout={
                order:stored.order.filter(x=>typeof x==="string"),
                hidden:stored.hidden.filter(x=>typeof x==="string")
            };
        }
    }catch(error){console.warn("Could not restore hardware card layout:",error);}
}
function saveHardwareLayout() {
    try{localStorage.setItem(HARDWARE_LAYOUT_KEY,JSON.stringify(hardwareLayout));}
    catch(error){console.warn("Could not save hardware layout:",error);}
}

function saveSensorPreferences() {
    try {
        localStorage.setItem(
            SENSOR_STORAGE_KEY,
            JSON.stringify([...hiddenSensors])
        );
    } catch (error) {
        console.warn("Could not save sensor preferences:", error);
    }
}


// ==========================================
// HARDWARE DETECTION
// ==========================================

function isSupportedHardware(device) {
    const category = device.category || "";

    return (
        category === "Cpu" ||
        category.startsWith("Gpu") ||
        category === "Motherboard" ||
        category === "SuperIO" ||
        category === "Memory" ||
        category === "Storage"
    );
}

function getHardwareCategoryLabel(device) {
    const category = device.category || "";

    if (category === "Cpu") return "CPU";
    if (category.startsWith("Gpu")) return "GPU";
    if (category === "Motherboard") return "MOTHERBOARD";
    if (category === "SuperIO") return "BOARD CONTROLLER";
    if (category === "Memory") return "MEMORY";
    if (category === "Storage") return "STORAGE";

    return category.toUpperCase();
}

function getDeviceSensors(device) {
    const sensors = [...(device.sensors || [])];

    for (const child of device.children || []) {
        sensors.push(...getDeviceSensors(child));
    }

    return sensors;
}

function getSensorKey(device, sensor) {
    return JSON.stringify([
        device.id || device.name,
        sensor.id || "",
        sensor.name,
        sensor.type
    ]);
}


// ==========================================
// VALIDATION AND FORMATTING
// ==========================================

function isValidSensor(sensor) {
    const value = sensor.value;

    if (
        typeof value !== "number" ||
        !Number.isFinite(value)
    ) {
        return false;
    }

    // Specifications are not live measurements.
    if (
        /warning|critical|limit|threshold|resolution/i
            .test(sensor.name)
    ) {
        return false;
    }

    // Usually represents an unsupported temperature sensor.
    if (
        sensor.type === "Temperature" &&
        value === 0
    ) {
        return false;
    }

    return true;
}

function getValidSensors(device) {
    return getDeviceSensors(device)
        .filter(isValidSensor)
        .sort((a, b) =>
            (sensorPriority[a.type] ?? 100) -
            (sensorPriority[b.type] ?? 100)
        );
}

function formatSensorValue(sensor) {
    const value = sensor.value;

    if (
        typeof value !== "number" ||
        !Number.isFinite(value)
    ) {
        return "N/A";
    }

    const formatted = value.toLocaleString("en-US", {
        maximumFractionDigits: 1
    });

    return `${formatted} ${hardwareUnits[sensor.type] || ""}`.trim();
}


// ==========================================
// MAIN METRICS FOR EACH HARDWARE TYPE
// ==========================================

function getKeySensorDefinitions(device) {
    const category = device.category || "";

    if (category === "Cpu") {
        return [
            {
                label: "Temperature",
                type: "Temperature",
                prefer: /Tctl\/Tdie|Package|CPU/i
            },
            {
                label: "Usage",
                type: "Load",
                prefer: /^CPU Total$/i
            },
            {
                label: "Clock",
                type: "Clock",
                prefer: /^Cores \(Average\)$/i
            }
        ];
    }

    if (category.startsWith("Gpu")) {
        return [
            {
                label: "Temperature",
                type: "Temperature",
                prefer: /GPU Core|GPU Temperature/i
            },
            {
                label: "Usage",
                type: "Load",
                prefer: /^GPU Core$|^GPU Load$/i
            },
            {
                label: "Core Clock",
                type: "Clock",
                prefer: /GPU Core/i
            }
        ];
    }

    if (category === "Motherboard") {
        return [
            {
                label: "Temperature",
                type: "Temperature",
                prefer: /^System$|^CPU$/i
            },
            {
                label: "CPU Fan",
                type: "Fan",
                prefer: /CPU Fan/i
            }
        ];
    }

    if (category === "Memory") {
        return [
            {
                label: "Usage",
                type: "Load",
                prefer: /Memory|RAM/i
            },
            {
                label: "Temperature",
                type: "Temperature",
                prefer: /Temperature/i
            }
        ];
    }

    if (category === "Storage") {
        return [
            {
                label: "Temperature",
                type: "Temperature",
                prefer: /^Temperature$|Composite/i
            },
            {
                label: "Health",
                type: "Level",
                prefer: /Remaining Life|Health/i
            },
            {
                label: "Used Space",
                type: "Load",
                prefer: /Used Space|Usage/i
            }
        ];
    }

    return [];
}

function getKeySensors(device, sensors) {
    const definitions = getKeySensorDefinitions(device);
    const selected = [];
    const usedKeys = new Set();

    for (const definition of definitions) {
        const candidates = sensors.filter(sensor =>
            sensor.type === definition.type &&
            (
                sensor.type !== "Clock" ||
                sensor.value > 0
            )
        );

        const sensor = candidates.find(item =>
            definition.prefer.test(item.name)
        );

        if (!sensor) continue;

        const key = getSensorKey(device, sensor);

        if (usedKeys.has(key)) continue;

        usedKeys.add(key);

        selected.push({
            label: definition.label,
            sensor
        });
    }

    return selected;
}


// ==========================================
// CREATE DEVICE HIGHLIGHTS
// ==========================================

function createHardwareHighlights(device, sensors) {
    const highlights = getKeySensors(device, sensors);

    if (highlights.length === 0) {
        return null;
    }

    const container = document.createElement("div");
    container.className = "hardware-highlights";

    for (const { label, sensor } of highlights) {
        const metric = document.createElement("div");
        metric.className = "hardware-highlight";

        const metricLabel = document.createElement("span");
        metricLabel.className = "hardware-highlight-label";
        metricLabel.textContent = label;

        const metricValue = document.createElement("strong");
        metricValue.className = "hardware-highlight-value";
        metricValue.textContent = formatSensorValue(sensor);

        const sensorKey = getSensorKey(device, sensor);

        hardwareSummaryNodes.set(sensorKey, metricValue);

        metric.append(metricLabel, metricValue);
        container.appendChild(metric);
    }

    return container;
}


// ==========================================
// CREATE HARDWARE CARD
// ==========================================

function createHardwareCard(device, sensors) {
    const card = document.createElement("article");
    card.className = "hardware-device-card";

    const header = document.createElement("div");
    header.className = "hardware-device-header";

    const category = document.createElement("span");
    category.className = "hardware-device-category";
    category.textContent = getHardwareCategoryLabel(device);

    const title = document.createElement("h3");
    title.className = "hardware-device-name";
    title.textContent = device.name;

    const count = document.createElement("span");
    count.className = "hardware-device-count";
    count.textContent = `${sensors.length} sensors`;

    header.append(category, title, count);
    card.appendChild(header);

    // Key metrics appear immediately below the device name.
    const highlights = createHardwareHighlights(device, sensors);

    if (highlights) {
        card.appendChild(highlights);
    }

    if (sensors.length === 0) {
        const empty = document.createElement("p");
        empty.className = "hardware-empty";
        empty.textContent = "No sensors selected or available.";
        card.appendChild(empty);
        return card;
    }

    const groups = new Map();

    for (const sensor of sensors) {
        const type = sensor.type || "Other";

        if (!groups.has(type)) {
            groups.set(type, []);
        }

        groups.get(type).push(sensor);
    }

    const groupContainer = document.createElement("div");
    groupContainer.className = "hardware-device-groups";

    let groupIndex = 0;

    for (const [type, groupSensors] of groups) {
        const details = document.createElement("details");
        details.className = "hardware-reading-group";

        details.open = groupIndex === 0;

        const summary = document.createElement("summary");
        summary.className = "hardware-group-heading";

        const groupTitle = document.createElement("span");
        groupTitle.textContent = sensorGroupNames[type] || type;

        const groupCount = document.createElement("span");
        groupCount.className = "hardware-group-count";
        groupCount.textContent = groupSensors.length;

        summary.append(groupTitle, groupCount);

        const readings = document.createElement("div");
        readings.className = "hardware-readings";

        for (const sensor of groupSensors) {
            const row = document.createElement("div");
            row.className = "hardware-reading";

            const name = document.createElement("span");
            name.className = "hardware-reading-name";
            name.textContent = sensor.name;

            const value = document.createElement("strong");
            value.className = "hardware-reading-value";
            value.textContent = formatSensorValue(sensor);

            hardwareSensorNodes.set(
                getSensorKey(device, sensor),
                value
            );

            row.append(name, value);
            readings.appendChild(row);
        }

        details.append(summary, readings);
        groupContainer.appendChild(details);

        groupIndex++;
    }

    card.appendChild(groupContainer);

    return card;
}


// ==========================================
// RENDER HARDWARE MONITOR
// ==========================================

function renderHardwareDashboard() {
    if (!latestHardwareSnapshot) return;

    const visibleDevices = orderedDevices(
        (latestHardwareSnapshot.hardware || []).filter(device =>
            isSupportedHardware(device) && !hardwareLayout.hidden.includes(deviceKey(device))
        ), hardwareLayout.order
    ).map(device => ({
            device,
            sensors: getValidSensors(device).filter(sensor =>
                !hiddenSensors.has(getSensorKey(device, sensor))
            )
        }));

    const signature = JSON.stringify(
        visibleDevices.map(({ device, sensors }) => [
            device.id || device.name,
            ...sensors.map(sensor =>
                getSensorKey(device, sensor)
            ),
            ...getKeySensors(device, sensors).map(item =>
                getSensorKey(device, item.sensor)
            )
        ])
    );

    if (
        hardwareLayoutSignature !== signature ||
        !hardwareContainer.querySelector(".hardware-grid")
    ) {
        hardwareSensorNodes.clear();
        hardwareSummaryNodes.clear();

        if (visibleDevices.length === 0) {
            hardwareContainer.textContent =
                "No supported hardware devices detected.";

            hardwareLayoutSignature = signature;
            return;
        }

        const grid = document.createElement("div");
        grid.className = "hardware-grid";

        for (const { device, sensors } of visibleDevices) {
            grid.appendChild(
                createHardwareCard(device, sensors)
            );
        }

        hardwareContainer.replaceChildren(grid);
        hardwareLayoutSignature = signature;
    }

    // Update values without rebuilding cards or closing groups.
    for (const { device, sensors } of visibleDevices) {
        for (const sensor of sensors) {
            const key = getSensorKey(device, sensor);
            const formatted = formatSensorValue(sensor);

            const rowValue = hardwareSensorNodes.get(key);
            const summaryValue = hardwareSummaryNodes.get(key);

            if (rowValue) {
                rowValue.textContent = formatted;
            }

            if (summaryValue) {
                summaryValue.textContent = formatted;
            }
        }
    }
}


// ==========================================
// SENSOR SETTINGS DIALOG
// ==========================================

function buildSensorSettings() {
    sensorSettingsList.replaceChildren();

    if (!latestHardwareSnapshot) {
        sensorSettingsList.textContent =
            "Waiting for hardware sensor data...";
        return;
    }

    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "Search sensors...";
    search.className = "sensor-search";
    search.setAttribute("aria-label", "Search sensors");

    const toolbar = document.createElement("div");
    toolbar.className = "sensor-selection-toolbar";

    const selectAll = document.createElement("button");
    selectAll.type = "button";
    selectAll.textContent = "Select All";

    const deselectAll = document.createElement("button");
    deselectAll.type = "button";
    deselectAll.textContent = "Deselect All";

    toolbar.append(selectAll, deselectAll);

    const counter = document.createElement("p");
    counter.className = "sensor-selection-count";

    const groupsContainer = document.createElement("div");
    groupsContainer.className = "sensor-selection-groups";

    const devices = (
        latestHardwareSnapshot.hardware || []
    ).filter(isSupportedHardware);

    for (const device of devices) {
        const sensors = getValidSensors(device);

        if (sensors.length === 0) continue;

        const group = document.createElement("div");
        group.className = "sensor-selection-group";

        const heading = document.createElement("h4");
        heading.textContent = device.name;
        group.appendChild(heading);

        for (const sensor of sensors) {
            const key = getSensorKey(device, sensor);

            const label = document.createElement("label");
            label.className = "sensor-choice";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = !hiddenSensors.has(key);
            checkbox.dataset.sensorKey = key;

            const text = document.createElement("span");
            text.textContent = `${sensor.name} (${sensor.type})`;

            label.append(checkbox, text);

            label.dataset.search = (
                device.name + " " +
                sensor.name + " " +
                sensor.type
            ).toLowerCase();

            checkbox.addEventListener("change", () => {
                if (checkbox.checked) {
                    hiddenSensors.delete(key);
                } else {
                    hiddenSensors.add(key);
                }

                saveSensorPreferences();
                updateCounter();
                renderHardwareDashboard();
            });

            group.appendChild(label);
        }

        groupsContainer.appendChild(group);
    }

    function getCheckboxes() {
        return [
            ...groupsContainer.querySelectorAll(
                ".sensor-choice input[type='checkbox']"
            )
        ];
    }

    function updateCounter() {
        const checkboxes = getCheckboxes();

        const selected = checkboxes.filter(
            checkbox => checkbox.checked
        ).length;

        counter.textContent =
            `${selected} of ${checkboxes.length} sensors selected`;
    }

    function applySelection(checked) {
        const visibleLabels = [
            ...groupsContainer.querySelectorAll(".sensor-choice")
        ].filter(label => !label.hidden);

        for (const label of visibleLabels) {
            const checkbox = label.querySelector("input");
            const key = checkbox.dataset.sensorKey;

            checkbox.checked = checked;

            if (checked) {
                hiddenSensors.delete(key);
            } else {
                hiddenSensors.add(key);
            }
        }

        saveSensorPreferences();
        updateCounter();
        renderHardwareDashboard();
    }

    selectAll.addEventListener("click", () => {
        applySelection(true);
    });

    deselectAll.addEventListener("click", () => {
        applySelection(false);
    });

    search.addEventListener("input", () => {
        const query = search.value.trim().toLowerCase();

        for (const group of groupsContainer.children) {
            let visibleCount = 0;

            const labels = group.querySelectorAll(".sensor-choice");

            for (const label of labels) {
                const matches = label.dataset.search.includes(query);

                label.hidden = !matches;

                if (matches) visibleCount++;
            }

            group.hidden = visibleCount === 0;
        }
    });

    sensorSettingsList.append(
        search,
        toolbar,
        counter,
        groupsContainer
    );

    updateCounter();
}


// ==========================================
// DIALOG EVENTS
// ==========================================

customizeSensorsButton.addEventListener("click", () => {
    buildSensorSettings();
    sensorSettingsDialog.showModal();
});

closeSensorSettingsButton.addEventListener("click", () => {
    sensorSettingsDialog.close();
});


// ==========================================
// LIVE UPDATES
// ==========================================

function setHardwareStatus(state, label) {
    hardwareStatus.dataset.state = state;
    hardwareStatus.textContent = label;
}

async function updateHardwareMonitor() {
    try {
        const response = await fetch("/api/sensors", {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(
                `Sensor API returned ${response.status}`
            );
        }

        const snapshot = await response.json();

        if (!Array.isArray(snapshot.hardware)) {
            throw new Error("Invalid hardware data");
        }

        latestHardwareSnapshot = snapshot;
        renderHardwareDashboard();

        const age = Date.now() / 1000 - snapshot.timestamp;

        // Optional sensor widgets should never interrupt core monitoring.
        try {
            window.PulseWatchWidgets?.update(snapshot);
        } catch (widgetError) {
            console.warn("Custom sensor widget error:", widgetError);
        }

        /* ==========================================
           PULSEWATCH v0.3 — CPU OVERVIEW METRICS
           ========================================== */

        const cpuTemperatureElement =
            document.getElementById("overviewCpuTemp");

        const cpuClockElement =
            document.getElementById("overviewCpuClock");

        if (cpuTemperatureElement && cpuClockElement) {

            const isFresh =
                Number.isFinite(age) &&
                Math.abs(age) <= SENSOR_STALE_SECONDS;

            const cpuDevice = snapshot.hardware.find(
                device => device.category === "Cpu"
            );

            const highlights = isFresh && cpuDevice
                ? getKeySensors(
                    cpuDevice,
                    getValidSensors(cpuDevice)
                )
                : [];

            const temperature = highlights.find(
                item => item.label === "Temperature"
            )?.sensor;

            const clock = highlights.find(
                item => item.label === "Clock"
            )?.sensor;

            cpuTemperatureElement.textContent = temperature
                ? `${temperature.value.toFixed(1)} °C`
                : "-- °C";

            cpuClockElement.textContent = clock
                ? `${Math.round(clock.value).toLocaleString("en-US")} MHz`
                : "-- MHz";
        }

        /* ==========================================
           PULSEWATCH v0.3 — GPU OVERVIEW METRICS
           ========================================== */

        const gpuNameElement =
            document.getElementById("overviewGpuName");

        const gpuGaugeValue =
            document.getElementById("overviewGpuGaugeValue");

        const gpuGauge =
            document.querySelector(".pw3-gpu-gauge");

        const gpuTempElement =
            document.getElementById("overviewGpuTemp");

        const gpuClockElement =
            document.getElementById("overviewGpuClock");

        const gpuVramElement =
            document.getElementById("overviewGpuVram");


        if (
            gpuNameElement &&
            gpuGaugeValue &&
            gpuGauge &&
            gpuTempElement &&
            gpuClockElement &&
            gpuVramElement
        ) {
            const gpuDevice = snapshot.hardware.find(
                device => (device.category || "").startsWith("Gpu")
            );

            const freshGpuData =
                Number.isFinite(age) &&
                Math.abs(age) <= SENSOR_STALE_SECONDS;

            const sensors = gpuDevice && freshGpuData
                ? getValidSensors(gpuDevice)
                : [];

            const highlights = gpuDevice && freshGpuData
                ? getKeySensors(gpuDevice, sensors)
                : [];

            // GPU model
            gpuNameElement.textContent = gpuDevice
                ? gpuDevice.name
                : "GPU not detected";

            // GPU usage
            const usage = highlights.find(
                item => item.label === "Usage"
            )?.sensor;

            if (usage) {
                const percent = Math.max(
                    0,
                    Math.min(100, usage.value)
                );


                // A chart failure must not mark the hardware sensors OFFLINE.
                // This also tolerates a WebView2 cache with an older script.js.
                if (
                    typeof addChartData === "function" &&
                    typeof overviewGpuChart !== "undefined"
                ) {
                    try {
                        addChartData(
                            overviewGpuChart,
                            new Date(snapshot.timestamp * 1000)
                                .toLocaleTimeString("el-GR"),
                            [percent]
                        );
                    } catch (chartError) {
                        console.warn(
                            "GPU live graph update failed:",
                            chartError
                        );
                    }
                }


                gpuGaugeValue.textContent =
                    `${percent.toFixed(1)}%`;

                gpuGauge.style.setProperty(
                    "--pw3-gpu-angle",
                    `${percent * 3.6}deg`
                );
            } else {
                gpuGaugeValue.textContent = "--%";

                gpuGauge.style.setProperty(
                    "--pw3-gpu-angle",
                    "0deg"
                );
            }

            // GPU temperature
            const temperature = highlights.find(
                item => item.label === "Temperature"
            )?.sensor;

            gpuTempElement.textContent = temperature
                ? `${temperature.value.toFixed(1)} °C`
                : "-- °C";

            // GPU core clock
            const clock = highlights.find(
                item => item.label === "Core Clock"
            )?.sensor;

            gpuClockElement.textContent = clock
                ? `${Math.round(clock.value).toLocaleString("en-US")} MHz`
                : "-- MHz";

            // Dedicated GPU memory sensors
            const memoryUsed = sensors.find(
                sensor =>
                    ["SmallData", "Data"].includes(sensor.type) &&
                    /GPU Memory Used|Dedicated Memory Used|VRAM Used/i
                        .test(sensor.name) &&
                    !/Shared|System/i.test(sensor.name)
            );

            const memoryTotal = sensors.find(
                sensor =>
                    ["SmallData", "Data"].includes(sensor.type) &&
                    /GPU Memory Total|Dedicated Memory Total|VRAM Total/i
                        .test(sensor.name) &&
                    !/Shared|System/i.test(sensor.name)
            );

            function memoryInGB(sensor) {
                if (!sensor) return null;

                return sensor.type === "SmallData"
                    ? sensor.value / 1024
                    : sensor.value;
            }

            const usedGB = memoryInGB(memoryUsed);
            const totalGB = memoryInGB(memoryTotal);

            if (usedGB !== null && totalGB !== null) {
                gpuVramElement.textContent =
                    `${usedGB.toFixed(2)} / ${totalGB.toFixed(1)} GB`;
            } else if (usedGB !== null) {
                gpuVramElement.textContent =
                    `${usedGB.toFixed(2)} GB`;
            } else {
                gpuVramElement.textContent = "--";
            }
        }



        if (
            !Number.isFinite(age) ||
            age > SENSOR_STALE_SECONDS ||
            age < -SENSOR_STALE_SECONDS
        ) {
            setHardwareStatus("stale", "DATA DELAYED");
        } else {
            setHardwareStatus("online", "LIVE DATA");
        }

    } catch (error) {
        console.error("Hardware monitoring error:", error);

        setHardwareStatus("offline", "OFFLINE");

        hardwareContainer.textContent =
            "Hardware sensor data is currently unavailable.";

        latestHardwareSnapshot = null;
        hardwareLayoutSignature = null;

        hardwareSensorNodes.clear();
        hardwareSummaryNodes.clear();
    }
}

async function refreshHardwareMonitor() {
    await updateHardwareMonitor();

    setTimeout(
        refreshHardwareMonitor,
        HARDWARE_REFRESH_INTERVAL
    );
}



// ==========================================
// HARDWARE MONITOR: CARD ORDER, SHOW/HIDE, PRESETS
// ==========================================
function allAvailableDevices(){
    return (latestHardwareSnapshot?.hardware || []).filter(isSupportedHardware);
}
function renderHardwareLayoutChoices(){
    hardwareLayoutList.replaceChildren();
    if(!hardwareDraft)return;
    const devices=orderedDevices(allAvailableDevices(),hardwareDraft.order);
    if(!devices.length){
        const empty=document.createElement("p");
        empty.className="pw-hardware-empty";
        empty.textContent="Waiting for hardware devices...";
        hardwareLayoutList.append(empty);
        return;
    }
    for(let index=0;index<devices.length;index++){
        const device=devices[index],key=deviceKey(device);
        const row=document.createElement("div");
        row.className="pw-hardware-device-choice";
        row.draggable=true;
        row.dataset.deviceKey=key;
        const label=document.createElement("label");
        const input=document.createElement("input");
        input.type="checkbox";
        input.checked=!hardwareDraft.hidden.includes(key);
        input.addEventListener("change",()=>{
            hardwareDraft.hidden=input.checked
                ? hardwareDraft.hidden.filter(x=>x!==key)
                : [...new Set([...hardwareDraft.hidden,key])];
        });
        const detail=document.createElement("span");
        const title=document.createElement("strong");
        title.textContent=device.name;
        const category=document.createElement("small");
        category.textContent=getHardwareCategoryLabel(device);
        detail.append(title,category);
        label.append(input,detail);
        const controls=document.createElement("div");
        controls.className="pw-hardware-order-controls";
        for(const [direction,symbol,titleText] of [[-1,"↑","Move up"],[1,"↓","Move down"]]){
            const button=document.createElement("button");
            button.type="button";button.textContent=symbol;
            button.title=titleText+" "+device.name;
            button.setAttribute("aria-label",titleText+" "+device.name);
            button.disabled=direction<0?index===0:index===devices.length-1;
            button.addEventListener("click",()=>{
                const keys=devices.map(deviceKey),swap=index+direction;
                [keys[index],keys[swap]]=[keys[swap],keys[index]];
                hardwareDraft.order=keys;
                renderHardwareLayoutChoices();
            });
            controls.append(button);
        }
        row.addEventListener("dragstart",event=>{
            if(!event.dataTransfer)return;
            event.dataTransfer.setData("text/plain",key);
            event.dataTransfer.effectAllowed="move";
        });
        row.addEventListener("dragover",event=>{
            event.preventDefault();
            if(event.dataTransfer)event.dataTransfer.dropEffect="move";
        });
        row.addEventListener("drop",event=>{
            event.preventDefault();
            const dragged=event.dataTransfer?.getData("text/plain");
            if(!dragged || dragged===key || !devices.some(d=>deviceKey(d)===dragged))return;
            const keys=devices.map(deviceKey).filter(k=>k!==dragged);
            keys.splice(keys.indexOf(key),0,dragged);
            hardwareDraft.order=keys;
            renderHardwareLayoutChoices();
        });
        row.append(label,controls);
        hardwareLayoutList.append(row);
    }
}
function closeHardwareLayout(){
    hardwareDraft=null;
    if(hardwareLayoutDialog.open)hardwareLayoutDialog.close();
}
document.getElementById("pwHardwareLayoutOpen").addEventListener("click",()=>{
    hardwareDraft={
        order:[...hardwareLayout.order],
        hidden:[...hardwareLayout.hidden]
    };
    renderHardwareLayoutChoices();
    hardwareLayoutDialog.showModal();
});
document.getElementById("pwHardwareLayoutClose").addEventListener("click",closeHardwareLayout);
document.getElementById("pwHardwareCancel").addEventListener("click",closeHardwareLayout);
hardwareLayoutDialog.addEventListener("close",()=>{hardwareDraft=null;});
document.getElementById("pwHardwareBasic").addEventListener("click",()=>{
    if(!hardwareDraft)return;
    const available=orderedDevices(allAvailableDevices(),[]);
    // Four principal monitors. Sensor-by-sensor customization remains intact.
    hardwareDraft.order=available.map(deviceKey);
    hardwareDraft.hidden=available
        .filter(d=>!["Cpu","Memory","Storage"].includes(d.category)
            && !(d.category||"").startsWith("Gpu"))
        .map(deviceKey);
    renderHardwareLayoutChoices();
});
document.getElementById("pwHardwareReset").addEventListener("click",()=>{
    if(!hardwareDraft)return;
    hardwareDraft={order:[],hidden:[]};
    renderHardwareLayoutChoices();
});
document.getElementById("pwHardwareApply").addEventListener("click",()=>{
    if(!hardwareDraft)return;
    hardwareLayout={
        order:[...hardwareDraft.order],
        hidden:[...hardwareDraft.hidden]
    };
    saveHardwareLayout();
    hardwareLayoutSignature=null;
    renderHardwareDashboard();
    closeHardwareLayout();
});

// ==========================================
// START
// ==========================================

loadHardwareLayout();
loadSensorPreferences();
refreshHardwareMonitor();
