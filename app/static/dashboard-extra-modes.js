(function(){
"use strict";

// Gauge / Graph / Compact / Widgets presentation for the five
// additional hardware/system cards. Raw data comes from the existing
// /api/metrics and /api/sensors backed widget catalog.
const GROUPS=["ram","storage","network","motherboard"];
const MODES=["gauge","graph","compact","widgets"];
const UNIT={Temperature:"°C",Load:"%",Clock:"MHz",Fan:"RPM",Power:"W",
    Voltage:"V",Current:"A",Control:"%",Level:"%",Data:"GB",
    SmallData:"MB",Throughput:"B/s",SpeedMbps:"Mbps",DataGiB:"GiB",Count:""};
const storePrefix="pulsewatch_extra_mode_";
const panels={};
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const format=(item)=>item.value.toLocaleString("en-US",{maximumFractionDigits:1})+
    (UNIT[item.type]?" "+UNIT[item.type]:"");
for(const group of GROUPS){
    const card=document.querySelector(".pw-"+group+"-card");
    if(!card)continue;
    const root=card.querySelector(".pw-extra-primary");
    const buttons=[...card.querySelectorAll("[data-pw-extra-view]")];
    let mode="widgets";
    try {
        const saved=localStorage.getItem(storePrefix+group);
        if(MODES.includes(saved))mode=saved;
    }catch(error){console.warn("Overview mode settings unavailable:",error);}
    const name=document.createElement("span");
    name.className="pw-extra-primary-label";
    const value=document.createElement("strong");
    value.className="pw-extra-primary-value";
    const chart=document.createElementNS("http://www.w3.org/2000/svg","svg");
    chart.setAttribute("viewBox","0 0 320 120");
    chart.setAttribute("preserveAspectRatio","none");
    chart.setAttribute("aria-label",group+" live history");
    const line=document.createElementNS("http://www.w3.org/2000/svg","polyline");
    line.setAttribute("class","pw-extra-primary-line");
    chart.append(line);
    const gauge=document.createElement("div");
    gauge.className="pw-extra-primary-ring";
    const gaugeValue=document.createElement("strong");
    gauge.append(gaugeValue);
    const values=document.createElement("div");
    values.className="pw-extra-primary-details";
    root.append(name,value,chart,gauge,values);
    const panel={group,card,root,buttons,mode,name,value,chart,line,
        gauge,gaugeValue,values,history:[],lastTime:null};
    panels[group]=panel;
    function setMode(next){
        if(!MODES.includes(next))return;
        panel.mode=next;
        card.dataset.view=next;
        root.hidden=next==="widgets";
        root.className="pw-extra-primary pw-extra-mode-"+next;
        for(const button of buttons){
            const active=button.dataset.pwExtraView===next;
            button.classList.toggle("active",active);
            button.setAttribute("aria-pressed",String(active));
        }
        try{localStorage.setItem(storePrefix+group,next);}
        catch(error){console.warn("Could not save overview mode:",error);}
    }
    for(const button of buttons)
        button.addEventListener("click",()=>setMode(button.dataset.pwExtraView));
    setMode(mode);
}
function priority(group,entries){
    const primaryId=group==="ram"?"ram:metrics/used_pct":
        group==="storage"?"storage:metrics/used_pct":
        group==="network"?"network:metrics/download_mbps":null;
    const direct=entries.find(s=>s.id===primaryId);
    if(direct)return direct;
    return entries.find(s=>s.type==="Temperature") ||
        entries.find(s=>s.type==="Load") ||entries[0]||null;
}
function update(catalog){
    for(const group of GROUPS){
        const panel=panels[group];
        if(!panel||!catalog[group])continue;
        const entries=[...catalog[group].values()];
        const first=priority(group,entries);
        if(!first){
            panel.name.textContent="Waiting for compatible sensors";
            panel.value.textContent="--";
            panel.gaugeValue.textContent="--";
            panel.line.setAttribute("points","");
            panel.values.replaceChildren();
            continue;
        }
        panel.name.textContent=first.name;
        panel.value.textContent=format(first);
        panel.gaugeValue.textContent=format(first);
        const maximum=first.type==="Load"||first.type==="Level"?100:
            first.type==="Temperature"?110:
            Math.max(1,first.value*1.4);
        panel.gauge.style.setProperty("--pw-primary-angle",
            clamp(first.value/maximum*360,0,360)+"deg");
        const time=first.sampleTime;
        if(panel.lastTime!==time){
            panel.lastTime=time;
            panel.history.push(first.value);
            if(panel.history.length>48)panel.history.shift();
        }
        const history=panel.history;
        const min=Math.min(...history),max=Math.max(...history);
        const pad=Math.max(.01,(max-min)*.13);
        const points=history.map((v,i)=>{
            const x=history.length<2?160:i*320/(history.length-1);
            const y=106-(v-min+pad)*86/(max-min+2*pad);
            return x.toFixed(1)+","+y.toFixed(1);
        }).join(" ");
        panel.line.setAttribute("points",points);
        panel.values.replaceChildren();
        for(const item of entries.slice(0,panel.mode==="compact"?4:3)){
            const sub=document.createElement("div");
            sub.className="pw-extra-primary-reading";
            const label=document.createElement("span");
            label.textContent=item.name;
            const reading=document.createElement("strong");
            reading.textContent=format(item);
            sub.append(label,reading);
            panel.values.append(sub);
        }
    }
}
window.PulseWatchExtraModes={update};
})();