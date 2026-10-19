(function(){
"use strict";
const KEY="pulsewatch_sidebar_collapsed_v1";
const root=document.querySelector(".app-layout");
const toggle=document.getElementById("pwSidebarToggle");
let collapsed=false;
try{collapsed=localStorage.getItem(KEY)==="true";}
catch(error){console.warn("Sidebar state unavailable:",error);}
function update(){
    root.classList.toggle("pw-sidebar-collapsed",collapsed);
    toggle.textContent=collapsed?"›":"‹";
    toggle.setAttribute("aria-label",collapsed?"Expand sidebar":"Collapse sidebar");
    toggle.title=collapsed?"Expand sidebar":"Collapse sidebar";
    toggle.setAttribute("aria-expanded",String(!collapsed));
    // Allow responsive charts to measure the new content width.
    window.dispatchEvent(new Event("resize"));
}
toggle.addEventListener("click",()=>{
    collapsed=!collapsed;
    try{localStorage.setItem(KEY,String(collapsed));}
    catch(error){console.warn("Could not save sidebar state:",error);}
    update();
});
update();
})();