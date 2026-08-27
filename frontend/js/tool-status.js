(()=>{'use strict';
/**
 * Nexauren tool availability/status engine.
 *
 * Supported statuses:
 * active      -> tool can be opened
 * scheduled   -> tool is active until maintenanceAt
 * maintenance -> tool is blocked until availableAt
 * disabled    -> tool is blocked until availableAt (or indefinitely when omitted)
 *
 * Timestamps are absolute milliseconds since epoch. The UI countdown is
 * calculated from Date.now(), so refreshing the page never resets it.
 */
const STATUS={ACTIVE:'active',SCHEDULED:'scheduled',MAINTENANCE:'maintenance',DISABLED:'disabled'};
const asTime=v=>{const n=Number(v);return Number.isFinite(n)&&n>0?n:null};
const getStatus=t=>{
  const status=String(t?.status||STATUS.ACTIVE).toLowerCase();
  const maintenanceAt=asTime(t?.maintenanceAt);
  const availableAt=asTime(t?.availableAt);
  const now=Date.now();
  if(status===STATUS.SCHEDULED&&maintenanceAt&&now>=maintenanceAt)return availableAt&&now>=availableAt?STATUS.ACTIVE:STATUS.MAINTENANCE;
  if((status===STATUS.MAINTENANCE||status===STATUS.DISABLED)&&availableAt&&now>=availableAt)return STATUS.ACTIVE;
  return Object.values(STATUS).includes(status)?status:STATUS.ACTIVE;
};
const formatRemaining=ms=>{if(ms<=0)return '0 seconds';const total=Math.ceil(ms/1000),days=Math.floor(total/86400),hours=Math.floor(total%86400/3600),minutes=Math.floor(total%3600/60),seconds=total%60;const parts=[];if(days)parts.push(`${days} day${days===1?'':'s'}`);if(hours)parts.push(`${hours} hour${hours===1?'':'s'}`);if(minutes)parts.push(`${minutes} minute${minutes===1?'':'s'}`);if(!days&&!hours&&!minutes||seconds)parts.push(`${seconds} second${seconds===1?'':'s'}`);return parts.slice(0,2).join(' ')};
const getInfo=t=>{const status=getStatus(t),maintenanceAt=asTime(t?.maintenanceAt),availableAt=asTime(t?.availableAt);if(status===STATUS.SCHEDULED&&maintenanceAt)return{status,message:`This tool will be under maintenance in ${formatRemaining(maintenanceAt-Date.now())}.`,blocked:false,target:maintenanceAt};if(status===STATUS.MAINTENANCE)return{status,message:availableAt?`Under maintenance — ${formatRemaining(availableAt-Date.now())} remaining.`:'Under maintenance',blocked:true,target:availableAt};if(status===STATUS.DISABLED)return{status,message:availableAt?`Disabled — ${formatRemaining(availableAt-Date.now())} remaining.`:'Disabled',blocked:true,target:availableAt};return{status:STATUS.ACTIVE,message:'',blocked:false,target:null}};
const decorate=(root=document)=>{root.querySelectorAll('[data-tool-status]').forEach(el=>{let raw={};try{raw=JSON.parse(el.dataset.toolStatus||'{}')}catch{}const info=getInfo(raw);el.dataset.status=info.status;el.classList.toggle('is-blocked',info.blocked);el.textContent=info.message;el.hidden=!info.message});root.querySelectorAll('[data-tool-open]').forEach(btn=>{let raw={};try{raw=JSON.parse(btn.dataset.toolOpen||'{}')}catch{}const info=getInfo(raw);btn.disabled=info.blocked;btn.dataset.status=info.status;btn.textContent=info.blocked?(info.status===STATUS.MAINTENANCE?'Under maintenance':'Disabled'):'Open Tool';});};
const canOpen=t=>!getInfo(t).blocked;
const start=()=>{decorate();setInterval(decorate,1000);document.addEventListener('click',e=>{const link=e.target.closest?.('[data-tool-url]');if(!link)return;let raw={};try{raw=JSON.parse(link.dataset.toolUrl||'{}')}catch{}if(!canOpen(raw)){e.preventDefault();e.stopPropagation();}});};
window.NexaurenToolStatus={STATUS,getStatus,getInfo,formatRemaining,canOpen,decorate};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
