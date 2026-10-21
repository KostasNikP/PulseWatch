(function () {
"use strict";

// Fill leftover *vertical* space in each resized overview card's Auto
// sensor layout. Only a temporary CSS minimum height is applied; saved
// widget height, width, order, modes and Free coordinates stay unchanged.
const configs = [
    [".pw3-cpu-card","#pwCpuMiniWidgets"],
    [".pw3-gpu-card","#pwGpuMiniWidgets"],
    [".pw-ram-card","#pwRamMiniWidgets"],
    [".pw-storage-card","#pwStorageMiniWidgets"],
    [".pw-network-card","#pwNetworkMiniWidgets"],
    [".pw-motherboard-card","#pwMotherboardMiniWidgets"]
];
const areas = configs.map(([cardSelector,regionSelector])=>({
    card:document.querySelector(cardSelector),
    region:document.querySelector(regionSelector)
})).filter(entry=>entry.card&&entry.region);

const PROPERTY = "--pw-auto-widget-min-height";
const MIN_HEIGHT = 155;
const rowGap = 12;
let scheduled = 0;

function clear(entry) {
    for (const node of entry.region.querySelectorAll(":scope > .pw-mini-widget")) {
        node.style.removeProperty(PROPERTY);
    }
}
function measure(entry) {
    const {card,region} = entry;
    // Auto within a card and Smart/Free for whole cards are independent.
    // Respect all saved mini-widget sizes when Auto is not active.
    if (card.dataset.view!=="widgets" ||
        region.classList.contains("pw-mini-free") ||
        !card.style.height ||
        !region.getClientRects().length) {
        clear(entry);
        return;
    }
    const widgets=[...region.querySelectorAll(":scope > .pw-mini-widget")];
    if (!widgets.length) return;
    if (widgets.some(node=>node.classList.contains("is-dragging") ||
        node.querySelector(".pw-mini-corner.is-resizing"))) return;

    const computed=getComputedStyle(region);
    const padding=Math.max(0,parseFloat(computed.paddingBottom)||0) +
        Math.max(0,parseFloat(computed.paddingTop)||0);
    const gap=Math.max(0,parseFloat(computed.rowGap)||rowGap);
    const available=Math.max(0,region.clientHeight-padding);

    // Each flex-wrap line has a shared top offset. It may contain widgets
    // with different saved heights; use the tallest as the row baseline.
    const rows=[];
    for(const node of widgets) {
        const top=node.offsetTop;
        let row=rows.find(item=>Math.abs(item.top-top)<3);
        if(!row) {
            row={top,nodes:[],base:MIN_HEIGHT};
            rows.push(row);
        }
        row.nodes.push(node);
        const specified=parseFloat(node.style.height);
        const baseline=Number.isFinite(specified)?specified:node.offsetHeight;
        row.base=Math.max(row.base,baseline,MIN_HEIGHT);
    }
    if(!rows.length) return;
    const baseTotal=rows.reduce((sum,row)=>sum+row.base,0);
    const free=Math.max(0,available-baseTotal-gap*Math.max(0,rows.length-1));
    const extra=free/rows.length;
    for(const row of rows) {
        const target=Math.max(MIN_HEIGHT,Math.round(row.base+extra));
        for(const node of row.nodes) {
            if (node.classList.contains("pw-mini-manual-height")) {
                node.style.removeProperty(PROPERTY);
                continue;
            }
            const prior=parseFloat(node.style.getPropertyValue(PROPERTY));
            if(!Number.isFinite(prior)||Math.abs(prior-target)>1) {
                node.style.setProperty(PROPERTY,target+"px");
            }
        }
    }
}
function flush() {
    scheduled=0;
    for(const entry of areas) measure(entry);
}
function schedule() {
    if(!scheduled) scheduled=requestAnimationFrame(flush);
}
if(typeof ResizeObserver!=="undefined") {
    const observer=new ResizeObserver(schedule);
    for(const entry of areas) {
        observer.observe(entry.card);
        // The scroll area may change height while the card remains fixed.
        const body=entry.card.querySelector(".pw-overview-content");
        if(body) observer.observe(body);
    }
}
if(typeof MutationObserver!=="undefined") {
    for(const entry of areas) {
        new MutationObserver(schedule).observe(entry.card,{
            attributes:true,attributeFilter:["data-view"]
        });
        new MutationObserver(schedule).observe(entry.region,{
            attributes:true,attributeFilter:["class"],
            childList:true
        });
    }
}
// Mini widget manual resizing and parent resizing both finish on pointerup.
document.addEventListener("pointerup",schedule);
document.addEventListener("pointercancel",schedule);
window.addEventListener("pw-mini-widget-resized",schedule);
window.addEventListener("resize",schedule);
window.addEventListener("pw-overview-card-order-changed",schedule);
schedule();
})();
