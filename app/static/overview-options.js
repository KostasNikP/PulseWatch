(function(){
"use strict";
const menus=[...document.querySelectorAll(".pw-overview-options")];
for(const menu of menus){
    menu.addEventListener("toggle",()=>{
        if(!menu.open)return;
        for(const other of menus)if(other!==menu)other.open=false;
    });
    menu.addEventListener("click",event=>{
        if(event.target.closest("[data-pw-mode],[data-pw-reset],[data-pw-defaults]")){
            menu.open=false;
        }
    });
}
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