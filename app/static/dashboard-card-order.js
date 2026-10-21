(function () {
"use strict";

// Move entire overview cards without rebuilding charts or sensor widgets.
const STORAGE_KEY = "pulsewatch_overview_parent_order_v1";
const dashboard = document.querySelector("#overview .dashboard");
if (!dashboard) return;

const groups = [
    ["cpu", ".pw3-cpu-card", ".pw3-cpu-title"],
    ["gpu", ".pw3-gpu-card", ".pw3-gpu-header > div:first-child"],
    ["ram", ".pw-ram-card", ".pw-extra-heading"],
    ["storage", ".pw-storage-card", ".pw-extra-heading"],
    ["network", ".pw-network-card", ".pw-extra-heading"],
    ["motherboard", ".pw-motherboard-card", ".pw-extra-heading"]
];
const defaults = groups.map(group => group[0]);
const cards = new Map();
for (const [id, selector] of groups) {
    const card = dashboard.querySelector(selector);
    if (card) {
        card.dataset.pwCardGroup = id;
        cards.set(id, card);
    }
}
if (!cards.size) return;
const validIds = defaults.filter(id => cards.has(id));

function normalized(ids) {
    const seen = new Set();
    const result = [];
    if (Array.isArray(ids)) for (const id of ids) {
        if (cards.has(id) && !seen.has(id)) {
            result.push(id);
            seen.add(id);
        }
    }
    for (const id of validIds) if (!seen.has(id)) result.push(id);
    return result;
}
let order = validIds.slice();
try {
    order = normalized(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
} catch (error) {
    console.warn("Saved card order could not be loaded:", error);
}
function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(order)); }
    catch (error) { console.warn("Card order could not be saved:", error); }
}
const moveButtons = new Map();
const handles = new Map();
const announcer = document.createElement("div");
announcer.className = "pw-card-reorder-status";
announcer.setAttribute("role", "status");
announcer.setAttribute("aria-live", "polite");
dashboard.before(announcer);

function updateControls() {
    for (const id of validIds) {
        const index = order.indexOf(id);
        const handle = handles.get(id);
        if (handle) {
            handle.title = "Drag to move " + id.toUpperCase() + " card. Alt + Up/Down also moves it.";
            handle.setAttribute("aria-label", "Reorder " + id.toUpperCase() +
                " card, position " + (index + 1) + " of " + order.length);
        }
        const buttons = moveButtons.get(id);
        if (buttons) {
            buttons.earlier.disabled = index <= 0;
            buttons.later.disabled = index >= order.length - 1;
        }
    }
}
function applyOrder() {
    // Moving the existing DOM nodes preserves listeners and live charts.
    for (const id of order) dashboard.appendChild(cards.get(id));
    updateControls();
    window.dispatchEvent(new Event("resize"));
}
function changed() {
    persist();
    applyOrder();
    window.dispatchEvent(new CustomEvent("pw-overview-card-order-changed", {
        detail: { order: order.slice() }
    }));
}
function announce(id) {
    announcer.textContent = id.toUpperCase() + " moved to position " +
        (order.indexOf(id) + 1) + " of " + order.length + ".";
}
function moveTo(id, target, after) {
    if (id === target || !cards.has(id) || !cards.has(target)) return false;
    const next = order.filter(current => current !== id);
    const index = next.indexOf(target) + (after ? 1 : 0);
    next.splice(index, 0, id);
    if (next.every((value, i) => value === order[i])) return false;
    order = next;
    changed();
    announce(id);
    return true;
}
function moveBy(id, offset) {
    const from = order.indexOf(id);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= order.length) return;
    const next = order.slice();
    next.splice(from, 1);
    next.splice(to, 0, id);
    order = next;
    changed();
    announce(id);
}
function resetOrder() {
    order = validIds.slice();
    changed();
    announcer.textContent = "Dashboard card order restored to default.";
}

let session = null;
let autoScrollFrame = 0;
function clearDrop() {
    for (const card of cards.values()) {
        card.classList.remove("pw-card-drop-before", "pw-card-drop-after");
    }
}
function pickTarget(x, y) {
    const element = document.elementFromPoint(x, y);
    const hovered = element && element.closest("[data-pw-card-group]");
    if (hovered && hovered.parentElement === dashboard) {
        if (hovered === cards.get(session.id)) return null;
        return hovered;
    }
    const bounds = dashboard.getBoundingClientRect();
    if (x < bounds.left - 25 || x > bounds.right + 25 ||
        y < bounds.top - 90 || y > bounds.bottom + 90) return null;

    let nearest = null;
    let distance = Infinity;
    for (const card of cards.values()) {
        if (card === cards.get(session.id)) continue;
        const rect = card.getBoundingClientRect();
        const dx = Math.max(rect.left - x, 0, x - rect.right);
        const dy = Math.max(rect.top - y, 0, y - rect.bottom);
        const score = dx * dx + dy * dy;
        if (score < distance) {
            distance = score;
            nearest = card;
        }
    }
    return nearest;
}
function updateDrop() {
    if (!session || !session.active) return;
    clearDrop();
    session.target = null;
    const target = pickTarget(session.x, session.y);
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const fullRow = rect.width > dashboard.getBoundingClientRect().width * 0.72;
    const before = fullRow ?
        session.y < rect.top + rect.height / 2 :
        session.x < rect.left + rect.width / 2;
    session.target = target.dataset.pwCardGroup;
    session.after = !before;
    target.classList.add(before ? "pw-card-drop-before" : "pw-card-drop-after");
}
function stopScrolling() {
    if (autoScrollFrame) cancelAnimationFrame(autoScrollFrame);
    autoScrollFrame = 0;
}
function scrollWhileDragging() {
    if (!session || !session.active) {
        autoScrollFrame = 0;
        return;
    }
    const edge = 70;
    const y = session.y;
    let speed = 0;
    if (y < edge) speed = -Math.max(4, (edge - y) / 4);
    else if (y > window.innerHeight - edge)
        speed = Math.max(4, (y - (window.innerHeight - edge)) / 4);
    if (speed) {
        window.scrollBy(0, speed);
        updateDrop();
    }
    autoScrollFrame = requestAnimationFrame(scrollWhileDragging);
}
function stopDrag(commit) {
    if (!session) return;
    const drag = session;
    session = null;
    stopScrolling();
    clearDrop();
    cards.get(drag.id).classList.remove("pw-card-is-dragging");
    document.body.classList.remove("pw-card-reordering");
    if (commit && drag.active && drag.target) {
        moveTo(drag.id, drag.target, drag.after);
    }
}

for (const [id, , headingSelector] of groups) {
    const card = cards.get(id);
    if (!card) continue;
    const heading = card.querySelector(headingSelector);
    const title = heading && heading.querySelector("h3");
    if (!title) continue;

    const grip = document.createElement("button");
    grip.type = "button";
    grip.className = "pw-card-drag-handle";
    grip.innerHTML = '<span aria-hidden="true">⠿</span>';
    title.after(grip);
    handles.set(id, grip);

    grip.addEventListener("pointerdown", event => {
        // In Free layout the layout controller uses this same drag handle.
        if (dashboard.classList.contains("pw-layout-free")) return;
        if (session || (event.pointerType === "mouse" && event.button !== 0)) return;
        event.preventDefault();
        event.stopPropagation();
        for (const menu of dashboard.querySelectorAll(".pw-overview-options[open]"))
            menu.open = false;
        session = {
            id, pointerId: event.pointerId,
            startX: event.clientX, startY: event.clientY,
            x: event.clientX, y: event.clientY,
            active: false, target: null, after: false
        };
        grip.setPointerCapture(event.pointerId);
    });
    grip.addEventListener("pointermove", event => {
        if (!session || session.id !== id || session.pointerId !== event.pointerId) return;
        session.x = event.clientX;
        session.y = event.clientY;
        if (!session.active && Math.hypot(
            session.x - session.startX, session.y - session.startY
        ) >= 7) {
            session.active = true;
            card.classList.add("pw-card-is-dragging");
            document.body.classList.add("pw-card-reordering");
            autoScrollFrame = requestAnimationFrame(scrollWhileDragging);
        }
        updateDrop();
    });
    grip.addEventListener("pointerup", event => {
        if (session && session.id === id && session.pointerId === event.pointerId)
            stopDrag(true);
    });
    grip.addEventListener("pointercancel", event => {
        if (session && session.id === id && session.pointerId === event.pointerId)
            stopDrag(false);
    });
    grip.addEventListener("lostpointercapture", event => {
        if (session && session.id === id && session.pointerId === event.pointerId)
            stopDrag(false);
    });
    grip.addEventListener("keydown", event => {
        if (dashboard.classList.contains("pw-layout-free")) return;
        if (!event.altKey) return;
        if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
            event.preventDefault();
            moveBy(id, -1);
        } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
            event.preventDefault();
            moveBy(id, 1);
        }
    });

    const popup = card.querySelector(".pw-overview-popup");
    if (popup) {
        const toolbar = document.createElement("div");
        toolbar.className = "pw-card-order-controls";
        const label = document.createElement("span");
        label.textContent = "Card position";
        const earlier = document.createElement("button");
        earlier.type = "button";
        earlier.textContent = "Move earlier ↑";
        const later = document.createElement("button");
        later.type = "button";
        later.textContent = "Move later ↓";
        earlier.addEventListener("click", () => moveBy(id, -1));
        later.addEventListener("click", () => moveBy(id, 1));
        toolbar.append(label, earlier, later);
        popup.appendChild(toolbar);
        moveButtons.set(id, { earlier, later });
    }
}
const footer = document.querySelector(".pw-customize-footer-left");
if (footer) {
    const reset = document.createElement("button");
    reset.type = "button";
    reset.id = "pwResetCardOrder";
    reset.textContent = "Reset card order";
    reset.title = "Restore CPU, GPU, RAM, Storage, Network, Motherboard order";
    reset.addEventListener("click", resetOrder);
    footer.prepend(reset);
}
applyOrder();
})();