(function () {
"use strict";

// Whole-card layout modes. The existing parent size and sensor settings remain untouched.
const dashboard = document.querySelector("#overview .dashboard");
if (!dashboard) return;
const ids = ["cpu", "gpu", "ram", "storage", "network", "motherboard"];
const cards = ids.map(id => dashboard.querySelector('[data-pw-card-group="' + id + '"]'))
    .filter(Boolean);
if (!cards.length) return;

const MODE_KEY = "pulsewatch_overview_parent_layout_mode_v1";
const POSITION_KEY = "pulsewatch_overview_parent_free_positions_v1";
const LAST_MOVED_KEY = "pulsewatch_overview_parent_free_last_moved_v1";
const GAP = 18;
const MOBILE = 700;
const clamp = (n, min, max) => Math.max(min, Math.min(n, Math.max(min, max)));
let positions = {};
let lastMoved = null;
let mode = "smart";
try {
    const stored = localStorage.getItem(MODE_KEY);
    // The mode is JSON encoded; older unquoted values also remain valid.
    if (stored === "free" || stored === '"free"') mode = "free";
    const lastRaw = localStorage.getItem(LAST_MOVED_KEY);
    let last = lastRaw;
    try { last = JSON.parse(lastRaw || "null"); }
    catch (error) { /* Accept older unquoted identifiers. */ }
    if (ids.includes(last)) lastMoved = last;
    const data = JSON.parse(localStorage.getItem(POSITION_KEY) || "{}");
    if (data && typeof data === "object" && !Array.isArray(data)) {
        for (const id of ids) {
            const p = data[id];
            if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
                positions[id] = {x:clamp(p.x,0,10000), y:clamp(p.y,0,10000)};
            }
        }
    }
} catch (error) { console.warn("Dashboard layout preferences could not be read:",error); }

function store(key,value) {
    try { localStorage.setItem(key,JSON.stringify(value)); }
    catch (error) { console.warn("Dashboard layout preferences could not be saved:",error); }
}

const toolbar = document.createElement("div");
toolbar.className = "pw-parent-layout-toolbar";
toolbar.innerHTML =
    '<div class="pw-parent-layout-heading">' +
      '<span>Card layout</span>' +
      '<span id="pwParentLayoutHint">Smart: cards automatically fill available gaps.</span>' +
    '</div>' +
    '<div class="pw-parent-layout-buttons" role="group" aria-label="Dashboard card layout">' +
      '<button type="button" data-pw-parent-layout-mode="smart">Smart</button>' +
      '<button type="button" data-pw-parent-layout-mode="free">Free</button>' +
      '<button type="button" id="pwResetFreePositions" title="Restore the free-placement positions">Reset positions</button>' +
    '</div>';
dashboard.before(toolbar);
const modeButtons = [...toolbar.querySelectorAll("[data-pw-parent-layout-mode]")];
const hint = toolbar.querySelector("#pwParentLayoutHint");
const reset = toolbar.querySelector("#pwResetFreePositions");

function compactScreen() {
    return window.matchMedia("(max-width:" + MOBILE + "px)").matches;
}
function metrics(card) {
    const rect = card.getBoundingClientRect();
    return {width: Math.max(1,rect.width),height:Math.max(1,rect.height)};
}
function clearCoordinates() {
    for (const card of cards) {
        card.style.removeProperty("left");
        card.style.removeProperty("top");
    }
    dashboard.style.removeProperty("height");
}
function snapshotCoordinates() {
    const parentRect = dashboard.getBoundingClientRect();
    for (const card of cards) {
        const box = card.getBoundingClientRect();
        const id = card.dataset.pwCardGroup;
        if (!positions[id]) {
            positions[id] = {
                x:Math.round(Math.max(0,box.left-parentRect.left)),
                y:Math.round(Math.max(0,box.top-parentRect.top))
            };
        }
    }
}
// Resolve card collisions without altering the stored positions when the
// sidebar is expanded or the window becomes narrower. This means the user's
// wide-screen Free layout returns when the available space returns.
function intersects(a,b) {
    return a.x < b.x + b.w + GAP &&
        a.x + a.w + GAP > b.x &&
        a.y < b.y + b.h + GAP &&
        a.y + a.h + GAP > b.y;
}
function drawFree(priorityId = lastMoved) {
    if (mode !== "free" || compactScreen()) return [];
    const width = Math.max(1,dashboard.clientWidth);
    const items = cards.map((card,index)=>{
        const id=card.dataset.pwCardGroup;
        const size=metrics(card);
        const preferred=positions[id] || {x:0,y:0};
        return {id,card,index,
            w:Math.min(size.width,width),h:size.height,
            preferred:{x:clamp(preferred.x,0,width-size.width),
                y:clamp(preferred.y,0,10000)}};
    });
    // The last card deliberately moved by the user takes precedence; other
    // cards yield to it instead of overlapping. Normal layout prioritizes
    // the user's original top-to-bottom, left-to-right arrangement.
    items.sort((a,b)=>
        Number(b.id===priorityId)-Number(a.id===priorityId) ||
        a.preferred.y-b.preferred.y ||
        a.preferred.x-b.preferred.x || a.index-b.index);
    const placed=[];
    for(const item of items) {
        const wanted=item.preferred;
        const xs=new Set([wanted.x,0,Math.max(0,width-item.w)]);
        const ys=new Set([wanted.y,0]);
        for(const p of placed) {
            xs.add(clamp(p.x+p.w+GAP,0,width-item.w));
            xs.add(clamp(p.x-item.w-GAP,0,width-item.w));
            ys.add(Math.min(10000,p.y+p.h+GAP));
            ys.add(Math.max(0,p.y-item.h-GAP));
        }
        let best=null;
        for(const y of ys) {
            for(const x of xs) {
                const proposal={id:item.id,card:item.card,
                    x,y,w:item.w,h:item.h};
                if(placed.some(p=>intersects(proposal,p)))continue;
                const score=Math.abs(x-wanted.x)*0.8+
                    Math.abs(y-wanted.y)*1.2;
                if(!best||score<best.score ||
                    (score===best.score&&y<best.y)) {
                    best={...proposal,score};
                }
            }
        }
        if(!best) {
            const bottom=placed.length ? Math.max(...placed.map(p=>p.y+p.h)) : 0;
            best={id:item.id,card:item.card,x:0,
                y:bottom+(placed.length?GAP:0),w:item.w,h:item.h};
        }
        placed.push(best);
    }
    let maxBottom=0;
    for(const p of placed) {
        p.card.style.left=Math.round(p.x)+"px";
        p.card.style.top=Math.round(p.y)+"px";
        maxBottom=Math.max(maxBottom,p.y+p.h);
    }
    dashboard.style.height=Math.ceil(maxBottom+GAP)+"px";
    return placed;
}
function smartPositions() {
    const width = dashboard.clientWidth;
    const placed = [];
    for (const card of cards) {
        const {width:cardWidth,height:cardHeight} = metrics(card);
        const w = Math.min(cardWidth,width), h = cardHeight;
        const ys = [...new Set([0,...placed.map(p=>p.y+p.h+GAP)])].sort((a,b)=>a-b);
        let selected = null;
        for (const y of ys) {
            const horizontal = placed.filter(p=>y < p.y+p.h+GAP && y+h+GAP > p.y);
            const xs = [...new Set([0,...horizontal.map(p=>p.x+p.w+GAP)])].sort((a,b)=>a-b);
            for (const x of xs) {
                if (x+w > width+1) continue;
                if (horizontal.some(p=>x < p.x+p.w+GAP && x+w+GAP > p.x)) continue;
                selected = {x,y,w,h};
                break;
            }
            if (selected) break;
        }
        if (!selected) {
            const bottom = placed.length ? Math.max(...placed.map(p=>p.y+p.h)) : 0;
            selected = {x:0,y:bottom+(placed.length?GAP:0),w,h};
        }
        card.style.left = Math.round(selected.x) + "px";
        card.style.top = Math.round(selected.y) + "px";
        placed.push(selected);
    }
    dashboard.style.height = Math.ceil(Math.max(0,...placed.map(p=>p.y+p.h))+GAP)+"px";
}
let layoutFrame = 0;
function recalculate() {
    layoutFrame = 0;
    if (compactScreen()) {
        clearCoordinates();
        return;
    }
    if (mode === "free") drawFree();
    else smartPositions();
}
function schedule() {
    if (layoutFrame) return;
    layoutFrame = requestAnimationFrame(recalculate);
}
function updateButtons() {
    for (const button of modeButtons) {
        const active = button.dataset.pwParentLayoutMode === mode;
        button.classList.toggle("active",active);
        button.setAttribute("aria-pressed",String(active));
    }
    hint.textContent = mode === "free" ?
        "Free: place cards anywhere; nearby cards move to prevent overlap." :
        "Smart: drag the ⠿ handles to reorder; gaps close automatically.";
    reset.hidden = mode !== "free";
}
function switchMode(next,save=true) {
    if (!["smart","free"].includes(next)) return;
    if (next === "free") {
        // Seed cards missing saved Free coordinates using their current
        // positions, including on startup when Free was saved previously.
        snapshotCoordinates();
        store(POSITION_KEY,positions);
    }
    mode = next;
    dashboard.classList.toggle("pw-layout-smart",mode==="smart");
    dashboard.classList.toggle("pw-layout-free",mode==="free");
    updateButtons();
    if (save) store(MODE_KEY,mode);
    schedule();
}
function resetPositions() {
    positions = {};
    lastMoved = null;
    store(LAST_MOVED_KEY,null);
    // Temporarily compute the smart arrangement to seed fresh free positions.
    dashboard.classList.remove("pw-layout-free");
    dashboard.classList.add("pw-layout-smart");
    smartPositions();
    snapshotCoordinates();
    dashboard.classList.remove("pw-layout-smart");
    dashboard.classList.add("pw-layout-free");
    store(POSITION_KEY,positions);
    drawFree();
}

for (const button of modeButtons) {
    button.addEventListener("click",()=>switchMode(button.dataset.pwParentLayoutMode));
}
reset.addEventListener("click",resetPositions);

// Free dragging uses the same handles as the already-tested order drag.
// The order handler ignores those handles while Free mode is active.
let activeDrag = null;
let scrollFrame = 0;
function stopScrolling() {
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
    scrollFrame=0;
}
function autoScroll() {
    if (!activeDrag || !activeDrag.moved) {scrollFrame=0;return;}
    const edge=65,y=activeDrag.clientY;
    if (y<edge) window.scrollBy(0,-Math.min(18,(edge-y)/3+3));
    else if (y>window.innerHeight-edge)
        window.scrollBy(0,Math.min(18,(y-(window.innerHeight-edge))/3+3));
    const drag=activeDrag;
    if (drag) {
        const scrollDelta=drag.parentTop-dashboard.getBoundingClientRect().top;
        freeMove(drag.id,drag.start.x+drag.dx,
            drag.start.y+drag.dy+scrollDelta);
    }
    scrollFrame=requestAnimationFrame(autoScroll);
}
function freeMove(id,x,y) {
    const card=cards.find(el=>el.dataset.pwCardGroup===id);
    if(!card)return;
    const width=dashboard.clientWidth;
    const cardWidth=metrics(card).width;
    positions[id]={
        x:Math.round(clamp(x,0,width-cardWidth)),
        y:Math.round(clamp(y,0,10000))
    };
    drawFree(id);
}
function finishDrag(commit,event) {
    if(!activeDrag||(event&&event.pointerId!==activeDrag.pointerId))return;
    const drag=activeDrag;
    activeDrag=null;
    stopScrolling();
    drag.card.classList.remove("pw-free-card-moving");
    document.body.classList.remove("pw-card-reordering");
    if(!commit) {
        if(drag.original) positions[drag.id]=drag.original;
        else delete positions[drag.id];
        drawFree();
    } else if(drag.moved) {
        lastMoved=drag.id;
        store(LAST_MOVED_KEY,lastMoved);
        store(POSITION_KEY,positions);
        drawFree();
    }
    schedule();
}
for (const card of cards) {
    const id=card.dataset.pwCardGroup;
    const grip=card.querySelector(".pw-card-drag-handle");
    if (!grip) continue;
    grip.addEventListener("pointerdown",event=>{
        if (mode!=="free" || compactScreen() || activeDrag) return;
        if (event.pointerType==="mouse" && event.button!==0) return;
        event.preventDefault();
        event.stopPropagation();
        const parent=dashboard.getBoundingClientRect();
        const box=card.getBoundingClientRect();
        const start={x:box.left-parent.left,y:box.top-parent.top};
        activeDrag={
            id,card,pointerId:event.pointerId,
            start,startX:event.clientX,startY:event.clientY,
            original:positions[id]?{...positions[id]}:null,
            parentTop:parent.top,dx:0,dy:0,
            clientY:event.clientY,moved:false
        };
        grip.setPointerCapture(event.pointerId);
    });
    grip.addEventListener("pointermove",event=>{
        if (!activeDrag || activeDrag.id!==id || event.pointerId!==activeDrag.pointerId) return;
        activeDrag.clientY=event.clientY;
        const dx=event.clientX-activeDrag.startX;
        const dy=event.clientY-activeDrag.startY;
        activeDrag.dx=dx;
        activeDrag.dy=dy;
        if (!activeDrag.moved && Math.hypot(dx,dy)>5) {
            activeDrag.moved=true;
            card.classList.add("pw-free-card-moving");
            document.body.classList.add("pw-card-reordering");
            scrollFrame=requestAnimationFrame(autoScroll);
        }
        if (activeDrag.moved) {
            freeMove(id,activeDrag.start.x+dx,
                activeDrag.start.y+dy+
                activeDrag.parentTop-dashboard.getBoundingClientRect().top);
        }
    });
    grip.addEventListener("pointerup",event=>finishDrag(true,event));
    grip.addEventListener("pointercancel",event=>finishDrag(false,event));
    grip.addEventListener("lostpointercapture",event=>finishDrag(false,event));
    grip.addEventListener("keydown",event=>{
        if (mode!=="free" || compactScreen() || !event.altKey) return;
        const offsets={
            ArrowLeft:[-16,0],ArrowRight:[16,0],
            ArrowUp:[0,-16],ArrowDown:[0,16]
        };
        const delta=offsets[event.key];
        if (!delta) return;
        event.preventDefault();
        const box=card.getBoundingClientRect();
        const parent=dashboard.getBoundingClientRect();
        freeMove(id,box.left-parent.left+delta[0],box.top-parent.top+delta[1]);
        lastMoved=id;
        store(LAST_MOVED_KEY,lastMoved);
        store(POSITION_KEY,positions);
    });
}
window.addEventListener("resize",schedule);
window.addEventListener("pw-overview-card-order-changed",schedule);
if (typeof ResizeObserver !== "undefined") {
    // Ignore dashboard height changes; only width changes affect card packing.
    let lastWidth=dashboard.clientWidth;
    new ResizeObserver(()=>{
        if (dashboard.clientWidth!==lastWidth) {
            lastWidth=dashboard.clientWidth;
            schedule();
        }
    }).observe(dashboard);
    const observer=new ResizeObserver(schedule);
    for (const card of cards) observer.observe(card);
}
switchMode(mode,false);
})();