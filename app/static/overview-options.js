(function(){
"use strict";
const menus=[...document.querySelectorAll(".pw-overview-options")];

function positionPopup(menu){
    if(!menu.open)return;
    const trigger=menu.querySelector("summary");
    const popup=menu.querySelector(".pw-overview-popup");
    if(!trigger||!popup)return;

    // Fixed-position popup escapes the resizable card's clipped content.
    // Pick the side with more viewport room and keep it onscreen.
    popup.style.visibility="hidden";
    popup.style.position="fixed";
    popup.style.right="auto";
    const bounds=trigger.getBoundingClientRect();
    const viewportWidth=document.documentElement.clientWidth;
    const viewportHeight=window.innerHeight;
    const desiredWidth=Math.min(205,Math.max(150,viewportWidth-16));
    popup.style.width=desiredWidth+"px";
    const popupHeight=popup.scrollHeight+2;
    const below=viewportHeight-bounds.bottom-12;
    const above=bounds.top-12;
    const showBelow=below>=popupHeight||below>=above;
    const available=showBelow?below:above;
    popup.style.maxHeight=Math.max(75,available)+"px";
    popup.style.overflowY="auto";
    const left=Math.max(8,Math.min(
        bounds.right-desiredWidth,viewportWidth-desiredWidth-8
    ));
    const top=showBelow
        ? Math.max(8,bounds.bottom+6)
        : Math.max(8,bounds.top-Math.min(popupHeight,available)-6);
    popup.style.left=Math.round(left)+"px";
    popup.style.top=Math.round(top)+"px";
    popup.style.visibility="visible";
}
for(const menu of menus){
    const card=menu.closest(".pw3-cpu-card,.pw3-gpu-card,.pw-extra-card");
    menu.addEventListener("toggle",()=>{
        card?.classList.toggle("pw-options-active",menu.open);
        if(!menu.open)return;
        for(const other of menus)if(other!==menu)other.open=false;
        requestAnimationFrame(()=>positionPopup(menu));
    });
    menu.addEventListener("click",event=>{
        if(event.target.closest("[data-pw-mode],[data-pw-reset],[data-pw-defaults]")){
            menu.open=false;
        }
    });
}
function reposition(){
    for(const menu of menus)if(menu.open)positionPopup(menu);
}
window.addEventListener("resize",reposition);
// Wheel scrolling the main page or a card must not leave a detached menu.
document.addEventListener("scroll",reposition,true);
document.addEventListener("click",event=>{
    for(const menu of menus){
        if(menu.open&&!menu.contains(event.target))menu.open=false;
    }
});
document.addEventListener("keydown",event=>{
    if(event.key==="Escape"){
        for(const menu of menus)menu.open=false;
    }
});
})();