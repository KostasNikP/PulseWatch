
(() => {
    // ==========================================
    // PULSEWATCH - ALERT SETTINGS
    // ==========================================

    const form = document.getElementById("alertSettingsForm");
    const saveButton = document.getElementById("saveSettings");
    const status = document.getElementById("settingsStatus");

    const controls = {
        cpu_percent: {
            slider: document.getElementById("cpuThreshold"),
            output: document.getElementById("cpuThresholdValue")
        },
        ram_percent: {
            slider: document.getElementById("ramThreshold"),
            output: document.getElementById("ramThresholdValue")
        },
        disk_percent: {
            slider: document.getElementById("diskThreshold"),
            output: document.getElementById("diskThresholdValue")
        }
    };

    if (!form || !saveButton || !status) {
        console.error("Alert Settings elements not found.");
        return;
    }

    // Update displayed percentage when slider changes
    Object.values(controls).forEach(control => {
        control.slider.addEventListener("input", () => {
            control.output.textContent =
                `${control.slider.value}%`;

            status.textContent = "Unsaved changes";
        });
    });


    // ==========================================
    // LOAD SETTINGS FROM FASTAPI
    // ==========================================

    async function loadSettings() {
        saveButton.disabled = true;
        status.textContent = "Loading settings...";

        try {
            const response = await fetch(
                "/api/alert-settings",
                { cache: "no-store" }
            );

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const settings = await response.json();

            Object.entries(controls).forEach(([metric, control]) => {
                control.slider.value = settings[metric];
                control.output.textContent =
                    `${settings[metric]}%`;
            });

            status.textContent = "Settings loaded";
            saveButton.disabled = false;

        } catch (error) {
            console.error("Failed to load settings:", error);
            status.textContent = "Failed to load settings";
        }
    }


    // ==========================================
    // SAVE SETTINGS TO FASTAPI
    // ==========================================

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const settings = {};

        Object.entries(controls).forEach(([metric, control]) => {
            settings[metric] = Number(control.slider.value);
        });

        saveButton.disabled = true;
        status.textContent = "Saving settings...";

        try {
            const response = await fetch("/api/alert-settings", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(settings)
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            status.textContent = "✓ Settings saved successfully";

        } catch (error) {
            console.error("Failed to save settings:", error);
            status.textContent = "Failed to save settings";

        } finally {
            saveButton.disabled = false;
        }
    });


    // Initialize
    loadSettings();

})();
