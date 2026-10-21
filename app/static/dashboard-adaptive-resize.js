(function () {
"use strict";

// Chart.js needs an explicit resize when a parent card changes size.
// A browser window resize event alone does not cover pointer-based parent
// resizing or switching Smart/Free card layouts.
const containers = [
    ["#overviewCpuChart", ".pw3-cpu-chart-container"],
    ["#overviewGpuChart", ".pw3-gpu-chart-container"]
];
const targets = [];
for (const [canvasSelector, containerSelector] of containers) {
    const canvas = document.querySelector(canvasSelector);
    const container = document.querySelector(containerSelector);
    if (canvas && container) {
        targets.push({canvas,container});
    }
}
if (!targets.length) return;

const pending = new Set();
let scheduled = 0;
function flush() {
    scheduled = 0;
    if (!window.Chart || typeof window.Chart.getChart !== "function") {
        pending.clear();
        return;
    }
    for (const item of pending) {
        if (item.container.hidden || !item.container.getClientRects().length) continue;
        const chart = window.Chart.getChart(item.canvas);
        if (chart) chart.resize();
    }
    pending.clear();
}
function schedule(item) {
    pending.add(item);
    if (!scheduled) scheduled = requestAnimationFrame(flush);
}
function scheduleAll() {
    for (const item of targets) schedule(item);
}
if (typeof ResizeObserver !== "undefined") {
    const sizes = new WeakMap();
    const observer = new ResizeObserver(entries => {
        for (const entry of entries) {
            const item = targets.find(t=>t.container===entry.target);
            if (!item) continue;
            const {width,height} = entry.contentRect;
            const old = sizes.get(item.container);
            if (old && Math.abs(old.width-width)<1 && Math.abs(old.height-height)<1) {
                continue;
            }
            sizes.set(item.container,{width,height});
            schedule(item);
        }
    });
    for (const item of targets) observer.observe(item.container);
}
window.addEventListener("resize",scheduleAll);
window.addEventListener("pw-overview-card-order-changed",scheduleAll);
})();
