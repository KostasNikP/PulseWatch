(function () {
"use strict";

// Responsive column planning for AUTO sensor widgets only. Widths saved by
// manual widget resize remain intact; this sets just a temporary MINIMUM
// column size and lets CSS flex-wrap position each widget automatically.
const configs=[
    [".pw3-cpu-card","#pwCpuMiniWidgets"],
    [".pw3-gpu-card","#pwGpuMiniWidgets"],
    [".pw-ram-card","#pwRamMiniWidgets"],
    [".pw-storage-card","#pwStorageMiniWidgets"],
    [".pw-network-card","#pwNetworkMiniWidgets"],
    [".pw-motherboard-card","#pwMotherboardMiniWidgets"]
];
const entries=configs.map(([cardSelector,regionSelector])=>({
    card:document.querySelector(cardSelector),
    region:document.querySelector(regionSelector)
})).filter(item=>item.card&&item.region);
const GAP=12;
const COMFORTABLE=275;
const PROPERTY="--pw-auto-column-width";
let scheduled=0;
function chooseColumns(count,width) {
    // If there is room only for one readable widget, stack the sensors.
    const maximum=Math.max(1,Math.floor((width+GAP)/(COMFORTABLE+GAP)));
    let columns=Math.min(Math.max(1,count),maximum);
    // Four sensors should form two balanced rows, not a cramped 3+1.
    // Apply the same balancing rule to a single short second row.
    if(columns>2 && count>columns &&
        count%columns===1 && count===columns+1) {
        columns-=1;
    }
    return columns;
}
function update(entry) {
    const {card,region}=entry;
    if(card.dataset.view!=="widgets" || region.classList.contains("pw-mini-free")) {
        region.style.removeProperty(PROPERTY);
        return;
    }
    const visible=[...region.querySelectorAll(":scope > .pw-mini-widget")];
    const width=region.clientWidth;
    if(!visible.length || !width) {
        region.style.removeProperty(PROPERTY);
        return;
    }
    const columns=chooseColumns(visible.length,width);
    const columnWidth=Math.max(1,Math.floor(
        (width-GAP*(columns-1))/columns
    ));
    const previous=parseFloat(region.style.getPropertyValue(PROPERTY));
    if(!Number.isFinite(previous) || Math.abs(columnWidth-previous)>=1) {
        region.style.setProperty(PROPERTY,columnWidth+"px");
    }
}
function flush() {
    scheduled=0;
    for(const entry of entries) update(entry);
}
function schedule() {
    if(!scheduled) scheduled=requestAnimationFrame(flush);
}
if(typeof ResizeObserver!=="undefined") {
    // Only widths matter. CSS row changes can change the height and must
    // NOT trigger a repeating ResizeObserver -> layout -> observer cycle.
    const widths=new WeakMap();
    const observer=new ResizeObserver(observed=>{
        for(const {target,contentRect} of observed) {
            const width=contentRect.width;
            if(Math.abs(width-(widths.get(target)||0))<1)continue;
            widths.set(target,width);
            schedule();
        }
    });
    for(const entry of entries) observer.observe(entry.region);
}
if(typeof MutationObserver!=="undefined") {
    for(const entry of entries) {
        new MutationObserver(schedule).observe(entry.region,{
            childList:true,attributes:true,attributeFilter:["class"]
        });
        new MutationObserver(schedule).observe(entry.card,{
            attributes:true,attributeFilter:["data-view"]
        });
    }
}
window.addEventListener("resize",schedule);
window.addEventListener("pw-overview-card-order-changed",schedule);
schedule();
})();
