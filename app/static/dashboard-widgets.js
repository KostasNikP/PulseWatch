(function () {
"use strict";

// One lightweight live sparkline per sensor, independent of Chart.js.
const KEY = "pulsewatch_custom_sensor_widgets_v1";
const MAX_HISTORY = 35, MIN_W = 185, MIN_H = 155, MAX_H = 640;
const GROUPS = ["cpu", "gpu", "ram", "storage", "network", "motherboard"];
const units = {Temperature:"°C",Load:"%",Clock:"MHz",Fan:"RPM",
    Power:"W",Voltage:"V",Current:"A",Control:"%",Level:"%",
    Data:"GB",SmallData:"MB",Throughput:"B/s",
    SpeedMbps:"Mbps",DataGiB:"GiB",Count:""};
const regions = {
    cpu:document.getElementById("pwCpuMiniWidgets"),
    gpu:document.getElementById("pwGpuMiniWidgets"),
    ram:document.getElementById("pwRamMiniWidgets"),
    storage:document.getElementById("pwStorageMiniWidgets"),
    network:document.getElementById("pwNetworkMiniWidgets"),
    motherboard:document.getElementById("pwMotherboardMiniWidgets")
};
const dialog = document.getElementById("pwCustomizeDialog");
const list = document.getElementById("pwCustomizeList");
const search = document.getElementById("pwCustomizeSearch");
const catalog = Object.fromEntries(GROUPS.map(g => [g,new Map()]));
const hardwareCatalog = Object.fromEntries(GROUPS.map(g => [g,new Map()]));
const metricsCatalog = Object.fromEntries(GROUPS.map(g => [g,new Map()]));
const cards = new Map();
// Live, unsaved drag/resize coordinates take precedence over the saved layout.
const freePins = new Map();
const FREE_GAP = 12;
let state = {
    selected:Object.fromEntries(GROUPS.map(g => [g,null])),
    layout:{},
    free:Object.fromEntries(GROUPS.map(g => [g,false])),
    freePriority:Object.fromEntries(GROUPS.map(g => [g,null]))
};
let draft = null, category = "cpu", inventorySig = "";
let lastSnapshot = null;
const clamp = (v,lo,hi) => Math.min(hi,Math.max(lo,v));
const el = (tag,cls,text) => {
    const node=document.createElement(tag);
    if(cls) node.className=cls;
    if(text!==undefined) node.textContent=text;
    return node;
};
function save() {
    try {localStorage.setItem(KEY,JSON.stringify(state));}
    catch(e) {console.warn("Could not save widget settings:",e);}
}
try {
    const stored=JSON.parse(localStorage.getItem(KEY)||"null");
    if(stored&&stored.selected) {
        for(const g of GROUPS) {
            if(Array.isArray(stored.selected[g]))
                state.selected[g]=stored.selected[g].filter(x=>typeof x==="string");
        }
        if(stored.layout&&typeof stored.layout==="object")state.layout=stored.layout;
        for (const g of GROUPS) {
            state.free[g] = stored.free?.[g] === true;
            if (typeof stored.freePriority?.[g] === "string")
                state.freePriority[g] = stored.freePriority[g];
        }
    }
} catch(e) {console.warn("Could not restore widgets:",e);}
function allSensors(device) {
    let result=[...(Array.isArray(device.sensors)?device.sensors:[])];
    for(const child of device.children||[])result.push(...allSensors(child));
    return result;
}
function valid(sensor) {
    return sensor && Number.isFinite(sensor.value) &&
        !/warning|critical|limit|threshold|resolution/i.test(sensor.name||"") &&
        !(sensor.type==="Temperature"&&sensor.value===0);
}
function groupOf(device) {
    if(device.category==="Cpu")return "cpu";
    if((device.category||"").startsWith("Gpu"))return "gpu";
    if(device.category==="Memory")return "ram";
    if(device.category==="Storage")return "storage";
    if(device.category==="Network")return "network";
    if(device.category==="Motherboard"||device.category==="SuperIO")return "motherboard";
    return null;
}
function defaults(group,items) {
    const chosen=[];
    function add(type,pattern) {
        const item=items.find(v=>v.type===type&&!chosen.includes(v.id)&&
            (!pattern||pattern.test(v.name)));
        if(item)chosen.push(item.id);
    }
    if(group==="cpu") {
        add("Load",/CPU Total|Total CPU/i);
        add("Temperature",/Tctl\/Tdie|CPU Core|CPU Temperature/i);
        add("Temperature",/Package|Core \(Average\)/i);
        add("Clock",/Cores \(Average\)|Average/i);
        if(!chosen.some(id=>items.find(i=>i.id===id)?.type==="Temperature"))
            add("Temperature");
    } else if(group==="gpu") {
        add("Load",/GPU Core|GPU Load/i);
        add("Temperature",/GPU Core|GPU Temperature/i);
        add("Clock",/GPU Core/i);
        add("SmallData",/GPU Memory Used|Dedicated Memory Used/i);
    } else if (group==="motherboard") {
        add("Temperature",/System|Motherboard|Chipset|CPU/i);
        add("Fan",/CPU|System|Fan/i);
        add("Voltage",/Vcore|CPU|12V/i);
        add("Temperature");
        if(chosen.length===0) add();
    } else {
        // Populate new sections with reliable local psutil data.
        const wanted = group==="ram"
            ? ["used_pct","used_gib","available_gib","total_gib"]
            : group==="storage"
                ? ["used_pct","free_gib","used_gib","total_gib"]
                : ["download_mbps","upload_mbps","received_gib","sent_gib"];
        for(const key of wanted) {
            const entry=items.find(s=>s.id===group+":metrics/"+key);
            if(entry)chosen.push(entry.id);
        }
        // Offer live hardware temperature by default only if available.
        if(group==="ram"||group==="storage")
            add("Temperature",/Temperature|Composite|Memory/i);
    }
    return chosen;
}
function number(v){return v.toLocaleString("en-US",{maximumFractionDigits:1});}
function reading(item){return number(item.value)+(units[item.type]?" "+units[item.type]:"");}
function gaugeMax(item,history) {
    if(["Load","Level","Control"].includes(item.type))return 100;
    if(item.type==="Temperature")return 110;
    if(item.type==="Clock")return item.group==="cpu"?6000:3000;
    return Math.max(1,item.value,...history)*1.2;
}
function modeOf(card,mode) {
    card.mode=mode;
    card.button.textContent=mode==="graph"?"Graph":mode==="gauge"?"Gauge":"Value";
    card.graph.hidden=mode!=="graph";
    card.gauge.hidden=mode!=="gauge";
    card.bigValue.hidden=mode!=="value";
    card.stat.hidden=mode!=="graph";
}
function createCard(item) {
    const node=el("article","pw-mini-widget");
    node.dataset.sensorId=item.id;
    const header=el("div","pw-mini-header");
    const grip=el("span","pw-mini-grip","⠿");
    grip.title="Drag to reorder or move freely";
    grip.tabIndex = 0;
    grip.setAttribute("role", "button");
    grip.setAttribute("aria-label", "Move " + item.name + " widget. Drag to position, or use arrow keys.");
    const title=el("div","pw-mini-title");
    title.append(el("strong","",item.name),el("small","",item.type));
    const buttons=el("div","pw-mini-buttons");
    const button=el("button","pw-mini-mode","Graph");
    button.type="button";
    button.title="Switch Graph / Gauge / Value";
    const hide=el("button","pw-mini-hide","×");
    hide.type="button";
    hide.title="Hide widget (re-enable in Customize Dashboard)";
    buttons.append(button,hide);
    header.append(grip,title,buttons);
    const stat=el("div","pw-mini-stat");
    const value=el("strong","pw-mini-value","--");
    const extrema=el("small","pw-mini-extrema","Min -- · Max --");
    stat.append(value,extrema);
    const graph=el("div","pw-mini-graph");
    const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
    svg.setAttribute("viewBox","0 0 300 100");
    svg.setAttribute("preserveAspectRatio","none");
    svg.setAttribute("role","img");
    svg.setAttribute("aria-label",item.name+" live history");
    const area=document.createElementNS("http://www.w3.org/2000/svg","polygon");
    area.setAttribute("class","pw-mini-area");
    const line=document.createElementNS("http://www.w3.org/2000/svg","polyline");
    line.setAttribute("class","pw-mini-line");
    svg.append(area,line);
    graph.append(svg);
    const gauge=el("div","pw-mini-gauge");
    const ring=el("div","pw-mini-ring");
    const gaugeValue=el("strong","pw-mini-gauge-value","--");
    ring.append(gaugeValue);gauge.append(ring);
    const bigValue=el("div","pw-mini-big-value","--");
    const corner=el("button","pw-mini-corner","⤡");
    corner.type="button";
    corner.title="Drag to resize freely";
    node.append(header,stat,graph,gauge,bigValue,corner);

    const previous=state.layout[item.id]||{};
    const parentWidth=regions[item.group].clientWidth||
        Math.max(MIN_W,regions[item.group].parentElement.clientWidth-54);
    node.style.width=clamp(Number(previous.width)||265,MIN_W,Math.max(MIN_W,parentWidth-2))+"px";
    node.style.height=clamp(Number(previous.height)||198,MIN_H,MAX_H)+"px";

    const card={item,node,stat,value,extrema,graph,gauge,gaugeValue,
        bigValue,line,area,button,mode:"graph",samples:[],lastTime:null};
    modeOf(card,["graph","gauge","value"].includes(previous.mode)?
        previous.mode:"graph");
    button.addEventListener("click",()=>{
        const modes=["graph","gauge","value"];
        modeOf(card,modes[(modes.indexOf(card.mode)+1)%modes.length]);
        state.layout[item.id]={...(state.layout[item.id]||{}),mode:card.mode};
        save();
    });
    hide.addEventListener("click",()=>{
        state.selected[item.group]=state.selected[item.group].filter(id=>id!==item.id);
        save();render(item.group);
    });
    // Pointer-based drag works in both WebView2 and Chrome. Move only
    // from the handle, avoiding accidental drags when using buttons.
    let moveSession = null;
    function removeMovePreview() {
        for (const other of regions[item.group].querySelectorAll(
            ".pw-mini-drop-before, .pw-mini-drop-after"
        )) {
            other.classList.remove("pw-mini-drop-before", "pw-mini-drop-after");
        }
        regions[item.group].classList.remove("pw-mini-drop-end");
    }

    grip.addEventListener("pointerdown", e => {
        if (e.button !== 0 || resizing) return;
        e.preventDefault();
        grip.setPointerCapture(e.pointerId);
        moveSession = {
            pointerId: e.pointerId, startX: e.clientX, startY: e.clientY,
            active: false, targetId: null, after: false, inside: false,
            free: isFree(item.group),
            originX: Number.parseFloat(node.style.left) || 0,
            originY: Number.parseFloat(node.style.top) || 0
        };
    });
    grip.addEventListener("pointermove", e => {
        const drag = moveSession;
        if (!drag || e.pointerId !== drag.pointerId) return;
        if (!drag.active && Math.hypot(
            e.clientX - drag.startX,
            e.clientY - drag.startY
        ) < 6) return;
        drag.active = true;
        node.classList.add("is-dragging");
        grip.classList.add("is-moving");
        removeMovePreview();

        if (drag.free) {
            const area = regions[item.group];
            const width = Math.max(MIN_W, area.clientWidth || area.parentElement.clientWidth - 54);
            const cardWidth = Number.parseFloat(node.style.width) || MIN_W;
            const x = Math.round(clamp(
                drag.originX + e.clientX - drag.startX,
                0, Math.max(0, width - cardWidth)
            ));
            const y = Math.round(clamp(
                drag.originY + e.clientY - drag.startY, 0, 10000
            ));
            freePins.set(item.group,{id:item.id,x,y});
            layoutFreeWidgets(item.group);
            return;
        }

        const hit = document.elementFromPoint(e.clientX, e.clientY);
        const region = hit && hit.closest(".pw-mini-region");
        drag.inside = region === regions[item.group];
        drag.targetId = null;
        if (!drag.inside) return;

        const target = hit.closest(".pw-mini-widget");
        if (target && target !== node) {
            drag.targetId = target.dataset.sensorId;
            const bounds = target.getBoundingClientRect();
            drag.after = e.clientX >= bounds.left + bounds.width / 2;
            target.classList.add(
                drag.after ? "pw-mini-drop-after" : "pw-mini-drop-before"
            );
        } else if (!target) {
            // Dropping in an empty area moves the card to the end.
            drag.after = true;
            regions[item.group].classList.add("pw-mini-drop-end");
        } else {
            drag.inside = false;
        }
    });
    function finishMove(commit) {
        if (!moveSession) return;
        const drag = moveSession;
        moveSession = null;
        node.classList.remove("is-dragging");
        grip.classList.remove("is-moving");
        removeMovePreview();
        if (drag.free) {
            const pin=freePins.get(item.group);
            if (commit && drag.active && pin?.id===item.id) {
                state.layout[item.id]={
                    ...(state.layout[item.id]||{}),
                    x:pin.x,y:pin.y
                };
                state.freePriority[item.group]=item.id;
                save();
            }
            freePins.delete(item.group);
            layoutFreeWidgets(item.group);
            return;
        }
        if (!commit || !drag.active || !drag.inside) return;
        moveWidget(item.group, item.id, drag.targetId, drag.after);
    }
    grip.addEventListener("pointerup", e => {
        if (moveSession && e.pointerId === moveSession.pointerId) {
            finishMove(true);
        }
    });
    grip.addEventListener("pointercancel", () => finishMove(false));
    grip.addEventListener("lostpointercapture", () => finishMove(false));

    // Keyboard support for reordering without a mouse.
    grip.addEventListener("keydown", e => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" &&
            e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        if (isFree(item.group)) {
            const pos = state.layout[item.id] || {};
            const distance = e.shiftKey ? 1 : 12;
            const dx = e.key === "ArrowRight" ? distance :
                e.key === "ArrowLeft" ? -distance : 0;
            const dy = e.key === "ArrowDown" ? distance :
                e.key === "ArrowUp" ? -distance : 0;
            const area = regions[item.group];
            const width = area.clientWidth || area.parentElement.clientWidth - 54;
            const cardWidth = Number.parseFloat(node.style.width) || MIN_W;
            const x = Math.round(clamp(
                (Number(pos.x) || 0) + dx,
                0, Math.max(0, width - cardWidth)
            ));
            const y = Math.round(Math.max(0, (Number(pos.y) || 0) + dy));
            state.layout[item.id]={...pos,x,y};
            state.freePriority[item.group]=item.id;
            layoutFreeWidgets(item.group);
            save();
            return;
        }
        const order = state.selected[item.group] || [];
        const current = order.indexOf(item.id);
        const direction = ["ArrowRight", "ArrowDown"].includes(e.key) ? 1 : -1;
        const targetId = order[current + direction];
        if (current < 0 || !targetId) return;
        moveWidget(item.group, item.id, targetId, direction > 0);
        grip.focus();
    });
    let resizing=null;
    corner.addEventListener("pointerdown",e=>{
        if(e.button!==0)return;
        e.preventDefault();e.stopPropagation();
        const box=node.getBoundingClientRect();
        resizing={id:e.pointerId,x:e.clientX,y:e.clientY,w:box.width,h:box.height};
        if (isFree(item.group)) {
            freePins.set(item.group,{
                id:item.id,
                x:Number.parseFloat(node.style.left)||0,
                y:Number.parseFloat(node.style.top)||0
            });
        }
        corner.setPointerCapture(e.pointerId);
        corner.classList.add("is-resizing");
    });
    corner.addEventListener("pointermove",e=>{
        if(!resizing||e.pointerId!==resizing.id)return;
        const parentWidth=regions[item.group].clientWidth||
            regions[item.group].parentElement.clientWidth-54;
        const usedX = isFree(item.group)
            ? (freePins.get(item.group)?.x ??
                (Number.parseFloat(node.style.left)||0)) : 0;
        node.style.width=Math.round(clamp(resizing.w+e.clientX-resizing.x,
            MIN_W,Math.max(MIN_W,parentWidth-usedX-2)))+"px";
        node.style.height=Math.round(clamp(resizing.h+e.clientY-resizing.y,
            MIN_H,MAX_H))+"px";
        if (isFree(item.group)) layoutFreeWidgets(item.group);
    });
    function finish() {
        if(!resizing)return;
        resizing=null;
        corner.classList.remove("is-resizing");
        state.layout[item.id]={...(state.layout[item.id]||{}),
            width:Math.round(node.getBoundingClientRect().width),
            height:Math.round(node.getBoundingClientRect().height)};
        if (isFree(item.group)) {
            state.freePriority[item.group]=item.id;
            freePins.delete(item.group);
            layoutFreeWidgets(item.group);
        }
        save();
    }
    corner.addEventListener("pointerup",finish);
    corner.addEventListener("pointercancel",finish);
    corner.addEventListener("lostpointercapture",finish);
    return card;
}

/* ==========================================
   OPTIONAL FREE CANVAS — INDEPENDENT X/Y
   ========================================== */

function isFree(group) {
    return state.free[group] === true;
}

function resizeFreeCanvas(group) {
    if (!isFree(group)) return;
    const region = regions[group];
    let bottom = 240;
    for (const card of cards.values()) {
        if (card.item.group !== group || !card.node.isConnected) continue;
        const node = card.node;
        const y = Number.parseFloat(node.style.top) || 0;
        const height = Number.parseFloat(node.style.height) || MIN_H;
        bottom = Math.max(bottom, y + height + 18);
    }
    region.style.height = Math.ceil(bottom) + "px";
}

// Resolve saved Free positions without rewriting the position of any
// other widget. Moving/resizing one widget takes priority; neighbors use
// the closest non-overlapping place. Sidebar width changes are temporary.
function layoutFreeWidgets(group) {
    if (!isFree(group)) return;
    const region=regions[group];
    // Hidden parent card: wait until its Widgets view becomes visible.
    if (!region.clientWidth) return;
    const width=Math.max(1,region.clientWidth);
    const active=freePins.get(group);
    const prioritized=active?.id || state.freePriority[group];
    const order=state.selected[group]||[];
    const widgets=[];
    for (let index=0;index<order.length;index++) {
        const id=order[index],card=cards.get(id);
        if (!card || !card.node.isConnected) continue;
        const node=card.node, box=node.getBoundingClientRect();
        const w=Math.min(width,Math.max(1,box.width||
            (Number.parseFloat(node.style.width)||MIN_W)));
        const h=Math.max(1,box.height||
            (Number.parseFloat(node.style.height)||MIN_H));
        const saved=state.layout[id]||{};
        const desired=active?.id===id ? active : saved;
        widgets.push({id,node,index,w,h,
            wantedX:clamp(Number(desired.x)||0,0,Math.max(0,width-w)),
            wantedY:clamp(Number(desired.y)||0,0,10000)});
    }
    widgets.sort((a,b)=>
        Number(b.id===prioritized)-Number(a.id===prioritized) ||
        a.wantedY-b.wantedY || a.wantedX-b.wantedX ||
        a.index-b.index);
    const placed=[];
    function collides(a,b) {
        return a.x < b.x+b.w+FREE_GAP &&
            a.x+a.w+FREE_GAP > b.x &&
            a.y < b.y+b.h+FREE_GAP &&
            a.y+a.h+FREE_GAP > b.y;
    }
    for(const item of widgets) {
        const xs=new Set([item.wantedX,0,Math.max(0,width-item.w)]);
        const ys=new Set([item.wantedY,0]);
        for(const p of placed) {
            xs.add(clamp(p.x+p.w+FREE_GAP,0,width-item.w));
            xs.add(clamp(p.x-item.w-FREE_GAP,0,width-item.w));
            ys.add(Math.min(10000,p.y+p.h+FREE_GAP));
            ys.add(Math.max(0,p.y-item.h-FREE_GAP));
        }
        let best=null,score=Infinity;
        for(const y of ys)for(const x of xs) {
            const candidate={...item,x,y};
            if(placed.some(p=>collides(candidate,p)))continue;
            const distance=Math.abs(x-item.wantedX)*0.8+
                Math.abs(y-item.wantedY)*1.2;
            if(distance<score ||
                (distance===score&&best&&y<best.y)) {
                best=candidate;score=distance;
            }
        }
        if(!best) {
            const bottom=placed.length?
                Math.max(...placed.map(p=>p.y+p.h)):0;
            best={...item,x:0,
                y:bottom+(placed.length?FREE_GAP:0)};
        }
        placed.push(best);
    }
    for(const p of placed) {
        p.node.style.left=Math.round(p.x)+"px";
        p.node.style.top=Math.round(p.y)+"px";
    }
    resizeFreeCanvas(group);
}

function syncFreeLayout(group) {
    const region = regions[group];
    const free = isFree(group);
    region.classList.toggle("pw-mini-free", free);
    for (const button of document.querySelectorAll(
        '[data-pw-layout-group="' + group + '"] [data-pw-mode]'
    )) {
        const selected = button.dataset.pwMode === (free ? "free" : "auto");
        button.classList.toggle("active", selected);
        button.setAttribute("aria-pressed", String(selected));
    }

    if (!free) {
        freePins.delete(group);
        region.style.removeProperty("height");
        for (const card of cards.values()) {
            if (card.item.group !== group) continue;
            card.node.style.removeProperty("left");
            card.node.style.removeProperty("top");
        }
        return;
    }

    const regionWidth = Math.max(
        MIN_W, region.clientWidth || region.parentElement.clientWidth - 54
    );
    const order = state.selected[group] || [];
    let nextY = 0;
    // Reserve existing positions before allocating newly enabled sensors.
    for (const id of order) {
        const item = state.layout[id] || {};
        const card = cards.get(id);
        if (!card || !Number.isFinite(item.x) || !Number.isFinite(item.y)) continue;
        nextY = Math.max(nextY, item.y +
            (Number.parseFloat(card.node.style.height) || MIN_H) + 12);
    }

    for (const id of order) {
        const card = cards.get(id);
        if (!card) continue;
        const node = card.node;
        const saved = state.layout[id] || {};
        if (!Number.isFinite(saved.x) || !Number.isFinite(saved.y)) {
            state.layout[id] = { ...saved, x: 0, y: nextY };
            nextY += (Number.parseFloat(node.style.height) || MIN_H) + 12;
        }
    }
    layoutFreeWidgets(group);
}

function setLayoutMode(group, mode) {
    const free = mode === "free";
    if (free === isFree(group)) return;
    const region = regions[group];

    if (free) {
        // First-time Free Layout begins exactly where the widgets
        // were arranged in Auto Layout. Old free positions are retained.
        for (const id of state.selected[group] || []) {
            const card = cards.get(id);
            if (!card) continue;
            const prior = state.layout[id] || {};
            if (!Number.isFinite(prior.x) || !Number.isFinite(prior.y)) {
                state.layout[id] = {
                    ...prior, x: card.node.offsetLeft, y: card.node.offsetTop
                };
            }
        }
    }
    state.free[group] = free;
    syncFreeLayout(group);
    save();
}

for (const group of GROUPS) {
    const toolbar = document.querySelector(
        '[data-pw-layout-group="' + group + '"]'
    );
    for (const button of toolbar.querySelectorAll("[data-pw-mode]")) {
        button.addEventListener("click", () => {
            setLayoutMode(group, button.dataset.pwMode);
        });
    }
    syncFreeLayout(group);
}

// Keep saved positions in view when the dashboard changes width.
window.addEventListener("resize", () => {
    for (const group of GROUPS) {
        if (isFree(group)) syncFreeLayout(group);
    }
});

// Change only the order array. Width, height, selected sensors and graphs
// are preserved because each widget DOM node remains mounted.
function moveWidget(group, movingId, targetId, after) {
    const order = state.selected[group];
    if (!Array.isArray(order)) return;
    const oldIndex = order.indexOf(movingId);
    if (oldIndex === -1) return;
    if (targetId === movingId) return;

    order.splice(oldIndex, 1);
    if (!targetId) {
        order.push(movingId);
    } else {
        const targetIndex = order.indexOf(targetId);
        if (targetIndex < 0) {
            order.splice(oldIndex, 0, movingId);
            return;
        }
        order.splice(targetIndex + (after ? 1 : 0), 0, movingId);
    }

    save();
    render(group);
}

function render(group) {
    const container=regions[group];
    const order=state.selected[group]||[];
    const shown=new Set(order.filter(id=>catalog[group].has(id)));
    for(const [id,card] of cards) {
        if(card.item.group===group&&!shown.has(id)) {
            card.node.remove();cards.delete(id);
        }
    }
    let position = 0;
    for(const id of order) {
        const item=catalog[group].get(id);
        if(!item)continue;
        if(!cards.has(id))cards.set(id,createCard(item));
        const node=cards.get(id).node;
        // Do not detach live DOM on every sensor refresh: that can cancel
        // the pointer capture of a widget currently being resized.
        if(container.children[position]!==node) {
            container.insertBefore(node,container.children[position]||null);
        }
        position++;
    }
    syncFreeLayout(group);
    const old=container.querySelector(".pw-mini-empty");
    if(!shown.size) {
        if(!old)container.append(el("p","pw-mini-empty",
            order.length?"Selected sensors unavailable.":"No widgets selected. Use Customize Dashboard."));
    } else if(old)old.remove();
}
function updateCard(card,item,time) {
    card.item=item;
    if(card.lastTime!==time) {
        card.samples.push(item.value);
        if(card.samples.length>MAX_HISTORY)card.samples.shift();
        card.lastTime=time;
    }
    card.value.textContent=reading(item);
    card.bigValue.textContent=reading(item);
    card.gaugeValue.textContent=reading(item);
    const values=card.samples;
    card.extrema.textContent="Min "+number(Math.min(...values))+
        " · Max "+number(Math.max(...values));
    const angle=clamp(item.value/gaugeMax(item,values)*360,0,360);
    card.gauge.style.setProperty("--pw-mini-angle",angle+"deg");
    const min=Math.min(...values),max=Math.max(...values);
    const padding=Math.max((max-min)*0.15,0.01);
    const points=values.map((v,i)=>{
        const x=values.length===1?150:i*300/(values.length-1);
        const y=90-(v-(min-padding))*80/(max-min+2*padding);
        return x.toFixed(1)+","+y.toFixed(1);
    }).join(" ");
    card.line.setAttribute("points",points);
    card.area.setAttribute("points","0,100 "+points+" 300,100");
}
// Preserve both streams of readings independently: the hardware
// helper and psutil endpoints have different update schedules.
function applyCatalog(timestamp) {
    let modified=false;
    const signatures=[];
    for(const group of GROUPS) {
        const merged=new Map([
            ...metricsCatalog[group],
            ...hardwareCatalog[group]
        ]);
        catalog[group]=merged;
        // Avoid initializing RAM, Storage and Network with only
        // intermittent hardware sensors before psutil data arrives.
        const ready = group==="cpu"||group==="gpu"||group==="motherboard" ||
            metricsCatalog[group].size>0;
        if(state.selected[group]===null && ready && merged.size) {
            state.selected[group]=defaults(group,[...merged.values()]);
            modified=true;
        }
        render(group);
        for(const id of state.selected[group]||[]) {
            const card=cards.get(id), item=merged.get(id);
            if(card&&item)updateCard(card,item,item.sampleTime??timestamp);
        }
        signatures.push([...merged.keys()].join("|"));
    }
    if(modified)save();
    // The overview display modes draw their own compact primary
    // readout, chart or gauge using the same live sensor catalog.
    try { window.PulseWatchExtraModes?.update(catalog); }
    catch(error) { console.warn("Overview display update failed:",error); }
    const signature=signatures.join("||");
    if(dialog.open&&draft&&inventorySig!==signature)renderList();
    inventorySig=signature;
}

function update(snapshot) {
    if(!snapshot||!Array.isArray(snapshot.hardware) ||
        !Number.isFinite(snapshot.timestamp) ||
        Math.abs(Date.now()/1000-snapshot.timestamp)>15)return;
    lastSnapshot=snapshot;
    for(const group of GROUPS)hardwareCatalog[group].clear();
    for(const device of snapshot.hardware) {
        const group=groupOf(device);
        if(!group)continue;
        for(const sensor of allSensors(device)) {
            if(!valid(sensor))continue;
            const id=group+":"+(sensor.id||
                [device.id||device.name,sensor.type,sensor.name].join("/"));
            hardwareCatalog[group].set(id,{
                id,group,name:sensor.name,type:sensor.type,
                value:sensor.value,deviceName:device.name,
                sampleTime:snapshot.timestamp
            });
        }
    }
    applyCatalog(snapshot.timestamp);
}

// System metrics are available without the hardware helper, including
// normal Windows PCs with no LibreHardwareMonitor sensor readings.
function updateMetrics(metrics) {
    if(!metrics||!metrics.system||!metrics.network ||
        !Number.isFinite(metrics.timestamp) ||
        Math.abs(Date.now()/1000-metrics.timestamp)>15)return;
    lastSnapshot=metrics;
    const system=metrics.system, network=metrics.network;
    for(const group of ["ram","storage","network"])
        metricsCatalog[group].clear();

    function add(group,key,name,type,value) {
        if(!Number.isFinite(value))return;
        const id=group+":metrics/"+key;
        metricsCatalog[group].set(id,{
            id,group,name,type,value,deviceName:"System Metrics",
            sampleTime:metrics.timestamp
        });
    }

    add("ram","used_pct","Memory Usage","Load",system.ram_percent);
    add("ram","total_gib","Physical RAM Total","DataGiB",system.ram_total_gib);
    add("ram","available_gib","Memory Available","DataGiB",system.ram_available_gib);
    add("ram","used_gib","Memory Used","DataGiB",
        Number.isFinite(system.ram_total_gib)&&Number.isFinite(system.ram_available_gib)
            ? Math.max(0,system.ram_total_gib-system.ram_available_gib):NaN);

    add("storage","used_pct","C: Disk Usage","Load",system.disk_percent);
    add("storage","total_gib","C: Capacity","DataGiB",system.disk_total_gib);
    add("storage","free_gib","C: Free Space","DataGiB",system.disk_free_gib);
    add("storage","used_gib","C: Used Space","DataGiB",
        Number.isFinite(system.disk_total_gib)&&Number.isFinite(system.disk_free_gib)
            ? Math.max(0,system.disk_total_gib-system.disk_free_gib):NaN);

    add("network","download_mbps","Download Speed","SpeedMbps",network.download_mbps);
    add("network","upload_mbps","Upload Speed","SpeedMbps",network.upload_mbps);
    const gib=1024**3;
    add("network","received_gib","Total Received","DataGiB",
        Number.isFinite(network.bytes_received)?network.bytes_received/gib:NaN);
    add("network","sent_gib","Total Sent","DataGiB",
        Number.isFinite(network.bytes_sent)?network.bytes_sent/gib:NaN);
    add("network","packets_received","Packets Received","Count",network.packets_received);
    add("network","packets_sent","Packets Sent","Count",network.packets_sent);

    applyCatalog(metrics.timestamp);
}
function renderList() {
    list.replaceChildren();
    const term=search.value.trim().toLocaleLowerCase();
    const items=[...catalog[category].values()]
        .filter(s=>(s.name+" "+s.type+" "+s.deviceName).toLocaleLowerCase().includes(term))
        .sort((a,b)=>a.type.localeCompare(b.type)||a.name.localeCompare(b.name));
    if(!items.length) {
        list.append(el("p","pw-customize-empty",
            lastSnapshot?"No matching sensors available.":"Waiting for sensor readings..."));
        return;
    }
    for(const item of items) {
        const label=el("label","pw-customize-row");
        const checkbox=document.createElement("input");
        checkbox.type="checkbox";
        checkbox.checked=draft[category].includes(item.id);
        const details=el("span","pw-customize-details");
        details.append(el("strong","",item.name),
            el("small","",item.type+" · "+item.deviceName));
        label.append(checkbox,details);
        checkbox.addEventListener("change",()=>{
            if(checkbox.checked&&!draft[category].includes(item.id))
                draft[category].push(item.id);
            if(!checkbox.checked)
                draft[category]=draft[category].filter(id=>id!==item.id);
            updateCustomizeCounts();
        });
        list.append(label);
    }
}

/* ==========================================
   RESET LAYOUT WITHOUT TOUCHING SENSOR SELECTIONS
   ========================================== */

const resetDialog = document.getElementById("pwLayoutResetDialog");
const resetTitle = document.getElementById("pwLayoutResetTitle");
const resetMessage = document.getElementById("pwLayoutResetMessage");
const resetImpact = document.getElementById("pwResetImpact");
const resetConfirm = document.getElementById("pwLayoutResetConfirm");
let pendingResetGroup = null;
let pendingResetKind = "layout";
const groupLabels = {
    cpu: "CPU", gpu: "GPU", ram: "RAM",
    storage: "Storage", network: "Network", motherboard:"Motherboard"
};

function requestReset(group, kind) {
    if (group !== "all" && !GROUPS.includes(group)) return;
    if (kind !== "layout" && kind !== "defaults") return;
    pendingResetGroup = group;
    pendingResetKind = kind;
    const all = group === "all";
    const target = all ? "all six sections" : groupLabels[group];

    if (kind === "defaults") {
        resetTitle.textContent = all
            ? "Restore all default widgets?"
            : "Restore " + groupLabels[group] + " defaults?";
        resetMessage.textContent = "Restore the original sensor widgets, sizes, " +
            "Graph display and Auto layout for " + target + ". " +
            "Custom sensor selections and hidden widgets in " + target + " will be replaced.";
        resetImpact.textContent = "Custom widgets and layouts in the selected " +
            (all ? "sections" : "section") + " will be reset.";
        resetConfirm.textContent = "Reset to defaults";
    } else {
        resetTitle.textContent = all
            ? "Reset all widget layouts?"
            : "Reset " + groupLabels[group] + " layout?";
        resetMessage.textContent = all
            ? "Restore widget sizes, Graph display, automatic positioning and order for all six sections."
            : "Restore sizes, Graph display, automatic positioning and order for " + groupLabels[group] + ".";
        resetImpact.textContent = "Your selected and hidden sensors will not change.";
        resetConfirm.textContent = "Reset layout";
    }

    // WebView2 permits only one modal dialog at a time.
    if (dialog.open) close();
    resetDialog.showModal();
}
function requestLayoutReset(group) {
    requestReset(group, "layout");
}
function requestDefaultsReset(group) {
    requestReset(group, "defaults");
}

function resetGroupLayout(group) {
    const selected = state.selected[group];
    if (Array.isArray(selected)) {
        const originalOrder = [...catalog[group].keys()];
        const preferredOrder = defaults(group, [...catalog[group].values()]);
        function rank(id) {
            const preferred = preferredOrder.indexOf(id);
            if (preferred >= 0) return preferred;
            const original = originalOrder.indexOf(id);
            return preferredOrder.length +
                (original < 0 ? originalOrder.length : original);
        }
        // Keep the exact set of visible sensors, even if they are
        // currently offline; only restore their display order.
        state.selected[group] = [...selected].sort((a,b) => rank(a) - rank(b));
    }

    for (const id of Object.keys(state.layout)) {
        if (id.startsWith(group + ":")) delete state.layout[id];
    }
    state.free[group] = false;
    state.freePriority[group] = null;
    freePins.delete(group);

    for (const card of cards.values()) {
        if (card.item.group !== group) continue;
        const node = card.node;
        const availableWidth = regions[group].clientWidth ||
            Math.max(MIN_W, regions[group].parentElement.clientWidth - 54);
        node.style.width = Math.min(265, Math.max(MIN_W, availableWidth - 2)) + "px";
        node.style.height = "198px";
        node.style.removeProperty("left");
        node.style.removeProperty("top");
        modeOf(card, "graph");
    }

    render(group);
}

function resetGroupToDefaults(group) {
    // Restore the factory sensor subset, not every hardware sensor.
    // A null selection is an intentional deferred reset when no live
    // readings are available; applyCatalog() initializes it on return.
    resetGroupLayout(group);
    const items = [...catalog[group].values()];
    state.selected[group] = items.length ? defaults(group, items) : null;
    render(group);
}

function closeResetDialog() {
    pendingResetGroup = null;
    pendingResetKind = "layout";
    if (resetDialog.open) resetDialog.close();
}

document.querySelectorAll("[data-pw-reset]").forEach(button => {
    button.addEventListener("click", () => {
        requestLayoutReset(button.dataset.pwReset);
    });
});
document.getElementById("pwCustomizeResetAll")
    .addEventListener("click", () => requestLayoutReset("all"));

document.querySelectorAll("[data-pw-defaults]").forEach(button => {
    button.addEventListener("click", () => {
        requestDefaultsReset(button.dataset.pwDefaults);
    });
});
document.getElementById("pwCustomizeDefaultsAll")
    .addEventListener("click", () => requestDefaultsReset("all"));

document.getElementById("pwLayoutResetCancel")
    .addEventListener("click", closeResetDialog);
resetConfirm.addEventListener("click", () => {
    if (pendingResetGroup === null) return;
    const groupsToReset = pendingResetGroup === "all"
        ? GROUPS : [pendingResetGroup];
    for (const group of groupsToReset) {
        if (pendingResetKind === "defaults") resetGroupToDefaults(group);
        else resetGroupLayout(group);
    }
    save();
    closeResetDialog();
});
resetDialog.addEventListener("close", () => {
    pendingResetGroup = null;
    pendingResetKind = "layout";
});

function close() {draft=null;if(dialog.open)dialog.close();}
function open() {
    draft=Object.fromEntries(
        GROUPS.map(group=>[group,[...(state.selected[group]||[])]])
    );
    category="cpu";search.value="";
    selectGroup();renderList();dialog.showModal();
}
function updateCustomizeCounts() {
    if (!draft) return;
    for (const button of dialog.querySelectorAll("[data-pw-group]")) {
        const group = button.dataset.pwGroup;
        button.textContent = groupLabels[group] + " (" + draft[group].length + ")";
    }
}
function selectGroup() {
    for(const button of dialog.querySelectorAll("[data-pw-group]")) {
        const active = button.dataset.pwGroup === category;
        button.classList.toggle("active",active);
        button.setAttribute("aria-pressed",String(active));
    }
    updateCustomizeCounts();
}
document.getElementById("pwCustomizeDashboard").addEventListener("click",open);
document.getElementById("pwCustomizeClose").addEventListener("click",close);
document.getElementById("pwCustomizeCancel").addEventListener("click",close);
dialog.addEventListener("close",()=>{draft=null;});
for(const button of dialog.querySelectorAll("[data-pw-group]"))
    button.addEventListener("click",()=>{
        category=button.dataset.pwGroup;search.value="";
        selectGroup();renderList();
    });
search.addEventListener("input",renderList);
document.getElementById("pwCustomizeAll").addEventListener("click",()=>{
    if(!draft)return;
    const term=search.value.trim().toLocaleLowerCase();
    for(const item of catalog[category].values())
        if((item.name+" "+item.type+" "+item.deviceName).toLocaleLowerCase().includes(term)
            &&!draft[category].includes(item.id))draft[category].push(item.id);
    renderList();
    updateCustomizeCounts();
});
document.getElementById("pwCustomizeApply").addEventListener("click",()=>{
    if(!draft)return;
    for(const group of GROUPS) {
        state.selected[group]=draft[group];render(group);
    }
    save();
    const selectedGroup=category;close();
    if(selectedGroup==="cpu")setCpuView("widgets");
    if(selectedGroup==="gpu")setGpuView("widgets");
});
window.PulseWatchWidgets={update,updateMetrics};
})();