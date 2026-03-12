import {
  useState, useCallback, useMemo, useEffect,
  createContext, useContext, useRef
} from "react";
import * as Papa from "papaparse";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, ReferenceLine
} from "recharts";

/* ════════════════════════════════════════════════════════════
   SUPABASE
════════════════════════════════════════════════════════════ */
const SB_URL = "https://vcvtxaiksxdnczjiftap.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjdnR4YWlrc3hkbmN6amlmdGFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTQ5NDUsImV4cCI6MjA4ODgzMDk0NX0.L5q3VIZs2nbP75ssRUYsZSe5gRwBCg8q_vHFxeUVN4A";
const sbH = {"Content-Type":"application/json","apikey":SB_KEY,"Authorization":`Bearer ${SB_KEY}`};
async function sbSave(type,content){try{await fetch(`${SB_URL}/rest/v1/csv_files`,{method:"POST",headers:{...sbH,"Prefer":"resolution=merge-duplicates"},body:JSON.stringify({type,content})});}catch(e){console.warn(e);}}
async function sbDelete(type){try{await fetch(`${SB_URL}/rest/v1/csv_files?type=eq.${type}`,{method:"DELETE",headers:sbH});}catch(e){}}
async function sbLoadAll(){try{const r=await fetch(`${SB_URL}/rest/v1/csv_files?select=type,content`,{headers:sbH});if(!r.ok)return{};const rows=await r.json();const out={};for(const x of rows)out[x.type]=x.content;return out;}catch{return{};}}
async function sbUploadCreative(adName,file){try{const ext=file.name.split('.').pop();const safeKey=adName.trim().slice(0,80).replace(/[^a-zA-Z0-9 _\-\.]/g,'_');const key=encodeURIComponent(safeKey)+'.'+ext;const r=await fetch(`${SB_URL}/storage/v1/object/creatives/${key}`,{method:'POST',headers:{...sbH,'x-upsert':'true','Content-Type':file.type},body:file});if(!r.ok){console.warn(await r.text());return null;}return{url:`${SB_URL}/storage/v1/object/public/creatives/${key}`,key:safeKey};}catch(e){console.warn(e);return null;}}
async function sbLoadCreativeImages(){try{const r=await fetch(`${SB_URL}/storage/v1/object/list/creatives`,{method:'POST',headers:{...sbH,'Content-Type':'application/json'},body:JSON.stringify({prefix:'',limit:500})});if(!r.ok)return{};const files=await r.json();const map={};for(const f of files){if(!f.name)continue;const decoded=decodeURIComponent(f.name.replace(/\.[^.]+$/,''));map[decoded]=`${SB_URL}/storage/v1/object/public/creatives/${f.name}`;}return map;}catch{return{};}}
async function sbLoadExpenses(){try{const r=await fetch(`${SB_URL}/rest/v1/expenses?select=*&order=date.desc`,{headers:sbH});if(!r.ok)return[];return await r.json();}catch{return[];}}
async function sbAddExpense(exp){try{const r=await fetch(`${SB_URL}/rest/v1/expenses`,{method:"POST",headers:{...sbH,"Prefer":"return=representation"},body:JSON.stringify(exp)});if(!r.ok)return null;const rows=await r.json();return rows[0];}catch{return null;}}
async function sbDeleteExpense(id){try{await fetch(`${SB_URL}/rest/v1/expenses?id=eq.${id}`,{method:"DELETE",headers:sbH});}catch{}}
async function sbUpdateExpense(id,patch){try{await fetch(`${SB_URL}/rest/v1/expenses?id=eq.${id}`,{method:"PATCH",headers:{...sbH,"Prefer":"return=representation"},body:JSON.stringify(patch)});}catch{}}
async function sbLoadLeads(){try{const r=await fetch(`${SB_URL}/rest/v1/leads?select=*&order=date.desc`,{headers:sbH});if(!r.ok)return[];return await r.json();}catch{return[];}}
async function sbAddLead(l){try{const r=await fetch(`${SB_URL}/rest/v1/leads`,{method:"POST",headers:{...sbH,"Prefer":"return=representation"},body:JSON.stringify(l)});if(!r.ok)return null;const rows=await r.json();return rows[0];}catch{return null;}}
async function sbDeleteLead(id){try{await fetch(`${SB_URL}/rest/v1/leads?id=eq.${id}`,{method:"DELETE",headers:sbH});}catch{}}
async function sbUpdateLead(id,p){try{await fetch(`${SB_URL}/rest/v1/leads?id=eq.${id}`,{method:"PATCH",headers:{...sbH,"Prefer":"return=representation"},body:JSON.stringify(p)});}catch{}}

/* ════════════════════════════════════════════════════════════
   THEME SYSTEM
════════════════════════════════════════════════════════════ */
const ThemeCtx = createContext(null);
const useT = () => useContext(ThemeCtx);

const BASE_THEME = {
  bg:"#f5f2ee",card:"#ffffff",border:"#e8e2da",
  text:"#1a1714",muted:"#8a7f74",faint:"#c8bfb4",
  meta:"#2563eb",metaL:"#dbeafe",
  shopify:"#008060",shopifyL:"#d1fae5",
  pinterest:"#e60023",pinterestL:"#fee2e5",
  violet:"#7c3aed",violetL:"#ede9fe",
  warn:"#d97706",warnL:"#fef3c7",
  good:"#16a34a",bad:"#dc2626",
  radius:10,
  fontBody:"'Instrument Sans',sans-serif",
  fontDisplay:"'Syne',sans-serif",
  fontSize:1.0,
};

const THEME_PRESETS = {
  "Padrão": BASE_THEME,
  "Escuro": {...BASE_THEME,bg:"#18181b",card:"#27272a",border:"#3f3f46",text:"#fafafa",muted:"#a1a1aa",faint:"#52525b",metaL:"#1e3a8a",shopifyL:"#052e16",violetL:"#2e1065",warnL:"#431407",pinterestL:"#450a0a"},
  "Minimalista": {...BASE_THEME,bg:"#ffffff",card:"#f9fafb",border:"#e5e7eb",text:"#111827",muted:"#6b7280",faint:"#d1d5db",radius:6},
  "Azul Frio": {...BASE_THEME,bg:"#eef2ff",card:"#ffffff",border:"#c7d2fe",meta:"#4338ca",metaL:"#e0e7ff",violet:"#4f46e5",violetL:"#e0e7ff"},
  "Verde Neon": {...BASE_THEME,bg:"#f0fdf4",card:"#ffffff",border:"#bbf7d0",meta:"#15803d",metaL:"#dcfce7",violet:"#16a34a",violetL:"#dcfce7",good:"#15803d"},
  "Reto": {...BASE_THEME,radius:0},
  "Ultra Round": {...BASE_THEME,radius:24},
  "Quente": {...BASE_THEME,bg:"#fff7ed",card:"#ffffff",border:"#fed7aa",meta:"#ea580c",metaL:"#ffedd5",violet:"#dc2626",violetL:"#fee2e2"},
};

const FONT_OPTIONS = [
  {label:"Instrument Sans + Syne (Padrão)", body:"'Instrument Sans',sans-serif", display:"'Syne',sans-serif"},
  {label:"Inter", body:"'Inter',sans-serif", display:"'Inter',sans-serif"},
  {label:"System UI", body:"system-ui,sans-serif", display:"system-ui,sans-serif"},
  {label:"Georgia (Serifa)", body:"Georgia,serif", display:"Georgia,serif"},
  {label:"Mono", body:"'Courier New',monospace", display:"'Courier New',monospace"},
];

function lsGet(k,def){try{const v=localStorage.getItem(k);return v!=null?JSON.parse(v):def;}catch{return def;}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}

/* ════════════════════════════════════════════════════════════
   CSV MERGE
════════════════════════════════════════════════════════════ */
function mergeMetaCsv(existing,incoming){const parse=t=>{const{data,meta:m}=Papa.parse(t,{header:true,skipEmptyLines:true});return{rows:data,fields:m.fields||[]};};try{const{rows:old,fields}=parse(existing||"");const{rows:nw}=parse(incoming);const allFields=[...new Set([...fields,...(Papa.parse(incoming,{header:true,skipEmptyLines:true}).meta.fields||[])])];const map={};const key=r=>{const d=r["Início dos relatórios"]||r["Reporting starts"]||r["Date"]||"";const n=r["Nome do anúncio"]||r["Ad name"]||r["Anúncio"]||"";const co=r["País"]||r["Country"]||"";return d+"__"+n+"__"+co;};for(const r of old)map[key(r)]=r;for(const r of nw)map[key(r)]=r;return Papa.unparse(Object.values(map),{columns:allFields});}catch{return incoming;}}
function mergeShopifyCsv(existing,incoming){try{const parse=t=>Papa.parse(t,{header:true,skipEmptyLines:true});const{data:old,meta:om}=parse(existing||"");const{data:nw,meta:nm}=parse(incoming);const allFields=[...new Set([...(om.fields||[]),...(nm.fields||[])])];const map={};for(const r of old)if(r["Name"])map[r["Name"]]=r;for(const r of nw)if(r["Name"])map[r["Name"]]=r;return Papa.unparse(Object.values(map),{columns:allFields});}catch{return incoming;}}

/* ════════════════════════════════════════════════════════════
   COUNTRY DATA
════════════════════════════════════════════════════════════ */
const CDATA={GB:{flag:"🇬🇧",name:"Reino Unido",aliases:["United Kingdom","UK","England"]},DE:{flag:"🇩🇪",name:"Alemanha",aliases:["Germany"]},ES:{flag:"🇪🇸",name:"Espanha",aliases:["Spain"]},FR:{flag:"🇫🇷",name:"França",aliases:["France"]},NL:{flag:"🇳🇱",name:"Holanda",aliases:["Netherlands","Holland"]},US:{flag:"🇺🇸",name:"EUA",aliases:["United States","USA"]},IE:{flag:"🇮🇪",name:"Irlanda",aliases:["Ireland"]},IT:{flag:"🇮🇹",name:"Itália",aliases:["Italy"]},PT:{flag:"🇵🇹",name:"Portugal",aliases:["Portugal"]},AU:{flag:"🇦🇺",name:"Austrália",aliases:["Australia"]},CA:{flag:"🇨🇦",name:"Canadá",aliases:["Canada"]},BR:{flag:"🇧🇷",name:"Brasil",aliases:["Brazil"]},RO:{flag:"🇷🇴",name:"Romênia",aliases:["Romania"]},PL:{flag:"🇵🇱",name:"Polônia",aliases:["Poland"]},SE:{flag:"🇸🇪",name:"Suécia",aliases:["Sweden"]},NO:{flag:"🇳🇴",name:"Noruega",aliases:["Norway"]},DK:{flag:"🇩🇰",name:"Dinamarca",aliases:["Denmark"]},CH:{flag:"🇨🇭",name:"Suíça",aliases:["Switzerland"]},AT:{flag:"🇦🇹",name:"Áustria",aliases:["Austria"]},BE:{flag:"🇧🇪",name:"Bélgica",aliases:["Belgium"]},MX:{flag:"🇲🇽",name:"México",aliases:["Mexico"]},AR:{flag:"🇦🇷",name:"Argentina",aliases:["Argentina"]},ZA:{flag:"🇿🇦",name:"África do Sul",aliases:["South Africa"]},SG:{flag:"🇸🇬",name:"Singapura",aliases:["Singapore"]},IN:{flag:"🇮🇳",name:"Índia",aliases:["India"]},JP:{flag:"🇯🇵",name:"Japão",aliases:["Japan"]},NZ:{flag:"🇳🇿",name:"Nova Zelândia",aliases:["New Zealand"]},FI:{flag:"🇫🇮",name:"Finlândia",aliases:["Finland"]},TR:{flag:"🇹🇷",name:"Turquia",aliases:["Turkey","Türkiye"]},KR:{flag:"🇰🇷",name:"Coreia do Sul",aliases:["South Korea"]},UA:{flag:"🇺🇦",name:"Ucrânia",aliases:["Ukraine"]},VN:{flag:"🇻🇳",name:"Vietnã",aliases:["Vietnam"]},EE:{flag:"🇪🇪",name:"Estônia",aliases:["Estonia"]}};
const COUNTRY_CODE_MAP={};for(const[code,d]of Object.entries(CDATA)){COUNTRY_CODE_MAP[code]=code;for(const a of d.aliases)COUNTRY_CODE_MAP[a.toLowerCase()]=code;COUNTRY_CODE_MAP[d.name.toLowerCase()]=code;}
function normalizeCountry(raw){if(!raw||raw==="—")return"—";const up=raw.trim().toUpperCase();if(CDATA[up])return up;return COUNTRY_CODE_MAP[raw.trim().toLowerCase()]||up;}
function fmtCountry(code,mode="full"){const d=CDATA[code];if(!d)return code||"—";return mode==="flag"?d.flag+" "+code:d.flag+" "+d.name+" ("+code+")";}

/* ════════════════════════════════════════════════════════════
   COL ALIASES & HELPERS
════════════════════════════════════════════════════════════ */
const COL={
  adName:["nome do anúncio","ad name","anúncio"],campaign:["nome da campanha","campaign name","campaign"],
  adset:["nome do conjunto de anúncios","ad set name","conjunto de anúncios"],country:["país","country"],
  date:["início dos relatórios","reporting starts","date","start","dia"],reach:["alcance","reach"],
  impressions:["impressões","impressions","impressao"],frequency:["frequência","frequencia","frequency"],
  lpv:["visualizações da página de destino do site","visualizações da página de destino","landing page views","vis. pág. de destino"],
  addCart:["adições ao carrinho","add to cart","adição ao carrinho"],
  checkout:["finalizações de compra iniciadas","finalizações de compra no site","finalizações de compra","checkouts iniciados","checkouts","initiate checkout"],
  purchases:["compras","purchases","resultados"],
  spend:["valor usado (brl)","valor usado","amount spent (brl)","amount spent","quantia gasta"],
  clicks:["cliques no link","link clicks","cliques","clicks"],
  cpcMeta:["cpc (custo por clique no link)","cpc (cost per link click)","cpc (all)","cpc"],
  saves:["saves","pin saves"],
};
const ns=s=>{if(!s)return"";return s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"");};
function findCol(headers,aliases){const h=headers.map(x=>ns(x));const na=aliases.map(ns);for(const a of na){const i=h.findIndex(x=>x===a||x?.includes(a));if(i!==-1)return headers[i];}return null;}
function getNum(row,aliases){const col=findCol(Object.keys(row),aliases);if(!col)return 0;const n=parseFloat(String(row[col]||"0").replace(",",".").replace(/[^\d.-]/g,""));return isNaN(n)?0:n;}
function getStr(row,aliases){const col=findCol(Object.keys(row),aliases);return col?(row[col]||"—"):"—";}
function detectObjective(name){const n=(name||"").toLowerCase();if(/venda|sales|compra|purchase|convers|checkout/.test(n))return"Vendas";if(/tráfeg|trafeg|traffic|clique|link click|vis.*pág|landing/.test(n))return"Tráfego";if(/reconhec|awareness|alcance|reach|brand/.test(n))return"Reconhecimento";if(/engaj|engag|interact/.test(n))return"Engajamento";if(/lead/.test(n))return"Leads";return"Outro";}

/* ════════════════════════════════════════════════════════════
   FORMATTERS
════════════════════════════════════════════════════════════ */
const fmt=(n,d=0)=>n==null||isNaN(n)?"—":Number(n).toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtR=n=>!n||isNaN(n)?"—":"R$\u00a0"+Number(n).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtUSD=n=>n==null||isNaN(n)||n===0?"—":"$\u00a0"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtPct=n=>n==null||isNaN(n)?"—":Number(n).toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})+"%";
const fmtX=n=>!n||isNaN(n)||n===0?"—":Number(n).toFixed(2)+"×";
const fmtDate=s=>{if(!s)return"—";try{const d=new Date(s+"T12:00:00");return d.toLocaleDateString("pt-BR",{day:"2-digit",month:"short"});}catch{return s;}};
const fmtMonth=m=>{if(!m)return"—";const[y,mo]=m.split("-");return new Date(parseInt(y),parseInt(mo)-1,1).toLocaleDateString("pt-BR",{month:"short",year:"2-digit"});};

/* ════════════════════════════════════════════════════════════
   PARSERS
════════════════════════════════════════════════════════════ */
function parseMeta(text,dateFrom,dateTo){
  const{data}=Papa.parse(text,{header:true,skipEmptyLines:true});
  const rows=data.filter(r=>{const d=getStr(r,COL.date).slice(0,10);if(dateFrom&&d!=="—"&&d<dateFrom)return false;if(dateTo&&d!=="—"&&d>dateTo)return false;return true;});
  const totals={reach:0,impressions:0,frequency:0,lpv:0,addCart:0,checkout:0,purchases:0,spend:0,clicks:0};
  const byCreative={},byCountry={},byCampaign={},byDay={},byMonth={},byObjective={},byCampaignMonth={};
  let freqCount=0;
  for(const r of rows){
    const reach=getNum(r,COL.reach),impressions=getNum(r,COL.impressions),freq=getNum(r,COL.frequency);
    const lpv=getNum(r,COL.lpv),addCart=getNum(r,COL.addCart),checkout=getNum(r,COL.checkout);
    const purchases=getNum(r,COL.purchases),spend=getNum(r,COL.spend),clicks=getNum(r,COL.clicks);
    const cpcDirect=getNum(r,COL.cpcMeta);
    const adName=getStr(r,COL.adName),campaign=getStr(r,COL.campaign),adset=getStr(r,COL.adset);
    const country=normalizeCountry(getStr(r,COL.country));
    const dateStr=getStr(r,COL.date).slice(0,10);
    const monthStr=dateStr.slice(0,7);
    totals.reach+=reach;totals.impressions+=impressions;totals.lpv+=lpv;
    totals.addCart+=addCart;totals.checkout+=checkout;totals.purchases+=purchases;
    totals.spend+=spend;totals.clicks+=clicks;
    if(freq>0){totals.frequency+=freq;freqCount++;}
    const addTo=(map,key,init)=>{if(!key||key==="—")return;if(!map[key])map[key]=init();const m=map[key];m.reach=(m.reach||0)+reach;m.impressions=(m.impressions||0)+impressions;m.lpv=(m.lpv||0)+lpv;m.addCart=(m.addCart||0)+addCart;m.checkout=(m.checkout||0)+checkout;m.purchases=(m.purchases||0)+purchases;m.spend=(m.spend||0)+spend;m.clicks=(m.clicks||0)+clicks;if(freq>0&&impressions>0){m._freqImprSum=(m._freqImprSum||0)+freq*impressions;m._freqImprTotal=(m._freqImprTotal||0)+impressions;}if(cpcDirect>0){m._cpcSum=(m._cpcSum||0)+cpcDirect;m._cpcCount=(m._cpcCount||0)+1;}};
    addTo(byCreative,adName,()=>({campaign,adset,reach:0,impressions:0,lpv:0,addCart:0,checkout:0,purchases:0,spend:0,clicks:0}));
    addTo(byCampaign,campaign,()=>({reach:0,impressions:0,lpv:0,addCart:0,checkout:0,purchases:0,spend:0,clicks:0,dates:[]}));
    if(campaign!=="—"&&dateStr&&dateStr!=="—"&&!byCampaign[campaign].dates.includes(dateStr))byCampaign[campaign].dates.push(dateStr);
    if(campaign!=="—"&&monthStr?.length===7){const cmKey=campaign+"||"+monthStr;if(!byCampaignMonth[cmKey])byCampaignMonth[cmKey]={campaign,month:monthStr,spend:0,purchases:0,impressions:0,lpv:0,clicks:0,addCart:0};byCampaignMonth[cmKey].spend+=spend;byCampaignMonth[cmKey].purchases+=purchases;byCampaignMonth[cmKey].impressions+=impressions;byCampaignMonth[cmKey].lpv+=lpv;byCampaignMonth[cmKey].clicks+=clicks;byCampaignMonth[cmKey].addCart+=addCart;}
    const obj=detectObjective(campaign);
    addTo(byObjective,obj,()=>({reach:0,impressions:0,lpv:0,addCart:0,checkout:0,purchases:0,spend:0,clicks:0,campaigns:new Set()}));
    if(byObjective[obj]&&campaign!=="—")byObjective[obj].campaigns.add(campaign);
    if(country!=="—"){if(!byCountry[country])byCountry[country]={purchases:0,spend:0,impressions:0,lpv:0,addCart:0,checkout:0,clicks:0};byCountry[country].purchases+=purchases;byCountry[country].spend+=spend;byCountry[country].impressions+=impressions;byCountry[country].lpv+=lpv;byCountry[country].addCart+=addCart;byCountry[country].checkout+=checkout;byCountry[country].clicks+=clicks;}
    if(dateStr&&dateStr!=="—"){if(!byDay[dateStr])byDay[dateStr]={spend:0,purchases:0,impressions:0,lpv:0};byDay[dateStr].spend+=spend;byDay[dateStr].purchases+=purchases;byDay[dateStr].impressions+=impressions;byDay[dateStr].lpv+=lpv;}
    if(monthStr?.length===7){if(!byMonth[monthStr])byMonth[monthStr]={spend:0,purchases:0,impressions:0,lpv:0,addCart:0,checkout:0,clicks:0,reach:0};byMonth[monthStr].spend+=spend;byMonth[monthStr].purchases+=purchases;byMonth[monthStr].impressions+=impressions;byMonth[monthStr].lpv+=lpv;byMonth[monthStr].addCart+=addCart;byMonth[monthStr].checkout+=checkout;byMonth[monthStr].clicks+=clicks;byMonth[monthStr].reach+=reach;}
  }
  totals.costLpv=totals.lpv>0?totals.spend/totals.lpv:0;totals.cpa=totals.purchases>0?totals.spend/totals.purchases:0;totals.cvr=totals.lpv>0?(totals.purchases/totals.lpv)*100:0;totals.cpm=totals.impressions>0?(totals.spend/totals.impressions)*1000:0;totals.cpc=totals.clicks>0?totals.spend/totals.clicks:0;totals.ctr=totals.impressions>0?(totals.clicks/totals.impressions)*100:0;totals.freqAvg=freqCount>0?totals.frequency/freqCount:0;totals.hasCheckout=totals.checkout>0;
  for(const obj of Object.values(byObjective))obj.campaigns=[...obj.campaigns];
  return{totals,byCreative,byCountry,byCampaign,byCampaignMonth,byDay,byMonth,byObjective,rowCount:rows.length};
}

function parseShopify(text,dateFrom,dateTo){
  const{data}=Papa.parse(text,{header:true,skipEmptyLines:true});
  const orders={};
  for(const r of data){const name=r["Name"]||"";if(!name)continue;const created=(r["Created at"]||"").slice(0,10);if(dateFrom&&created&&created<dateFrom)continue;if(dateTo&&created&&created>dateTo)continue;if(!orders[name]){orders[name]={date:created,country:normalizeCountry(r["Billing Country"]||r["Shipping Country"]||"—"),total:parseFloat(r["Total"]||"0")||0,status:r["Financial Status"]||"",email:r["Email"]||"",customerName:r["Billing Name"]||r["Shipping Name"]||"",phone:r["Billing Phone"]||r["Shipping Phone"]||"",city:r["Billing City"]||r["Shipping City"]||"",currency:r["Currency"]||"USD",discountCode:r["Discount Code"]||"",discountAmount:parseFloat(r["Discount Amount"]||"0")||0,items:[]};}if(r["Lineitem name"])orders[name].items.push({name:r["Lineitem name"],sku:(r["Lineitem sku"]||r["SKU"]||"").trim(),qty:parseInt(r["Lineitem quantity"]||"1")||1,price:parseFloat(r["Lineitem price"]||"0")||0});}
  let totalOrders=0,totalRevenue=0;const byCountry={},byDay={},byProduct={},byMonth={};const rawOrders=[];
  for(const[orderName,o] of Object.entries(orders)){totalOrders++;totalRevenue+=o.total;rawOrders.push({name:orderName,date:o.date,customerName:o.customerName,email:o.email,phone:o.phone,country:o.country,city:o.city,total:o.total,status:o.status,currency:o.currency,discountCode:o.discountCode,discountAmount:o.discountAmount,itemsCount:o.items.reduce((s,i)=>s+i.qty,0),skus:[...new Set(o.items.map(i=>i.sku).filter(Boolean))].join(', '),itemsSummary:o.items.slice(0,3).map(i=>`${i.name.slice(0,25)}(${i.qty}×)`).join('; ')});if(!byCountry[o.country])byCountry[o.country]={orders:0,revenue:0};byCountry[o.country].orders++;byCountry[o.country].revenue+=o.total;if(o.date){if(!byDay[o.date])byDay[o.date]={orders:0,revenue:0};byDay[o.date].orders++;byDay[o.date].revenue+=o.total;const m=o.date.slice(0,7);if(!byMonth[m])byMonth[m]={orders:0,revenue:0};byMonth[m].orders++;byMonth[m].revenue+=o.total;}for(const item of o.items){const sku=(item.sku||"").trim();const key=sku||item.name;if(!byProduct[key])byProduct[key]={sku:sku||"—",name:item.name||"—",orders:0,qty:0,revenue:0};byProduct[key].orders+=1;byProduct[key].qty+=item.qty;byProduct[key].revenue+=item.price*item.qty;}}
  return{totalOrders,totalRevenue,byCountry,byDay,byMonth,byProduct,rawOrders,avgTicket:totalOrders>0?totalRevenue/totalOrders:0};
}

const PINTEREST_COUNTRY_MAP={"United States":"US","United Kingdom":"GB","Germany":"DE","Spain":"ES","France":"FR","Netherlands":"NL","Ireland":"IE","Italy":"IT","Portugal":"PT","Romania":"RO","Poland":"PL","Sweden":"SE","Norway":"NO","Denmark":"DK","Switzerland":"CH","Austria":"AT","Belgium":"BE","Canada":"CA","Australia":"AU","Brazil":"BR","Mexico":"MX","Argentina":"AR","South Africa":"ZA","Saudi Arabia":"SA","Singapore":"SG","India":"IN","Japan":"JP","New Zealand":"NZ","Finland":"FI","Turkey":"TR","South Korea":"KR","Ukraine":"UA"};
function normPinterestCountry(raw){if(!raw)return"—";const up=raw.trim().toUpperCase();if(CDATA[up])return up;return PINTEREST_COUNTRY_MAP[raw.trim()]||up.slice(0,2);}

function parsePinterest(text){
  const{data}=Papa.parse(text,{header:true,skipEmptyLines:true});
  const totals={impressions:0,clicks:0,saves:0,spend:0,conversions:0,reach:0};
  const byPin={},byCountry={},byMonth={};
  for(const r of data){
    const impr=getNum(r,["impressions","impressões"]);const clicks=getNum(r,["link clicks","pin clicks","clicks","cliques","outbound clicks"]);
    const saves=getNum(r,COL.saves);const spend=getNum(r,["spend","gasto","amount spent","valor usado"]);
    const conv=getNum(r,["total conversions (checkout)","total conversions (purchase)","checkouts","conversions","purchases","compras"]);
    const reach=getNum(r,["reach","alcance"]);
    const name=getStr(r,["ad name","pin name","nome do anúncio","name"]);
    const dateStr=getStr(r,["date","data","day","reporting starts"]).slice(0,10);
    const monthStr=dateStr.slice(0,7);
    const rawCountry=r["Targeting Value"]||r["Country"]||r["País"]||"";
    const country=normPinterestCountry(rawCountry);
    totals.impressions+=impr;totals.clicks+=clicks;totals.saves+=saves;totals.spend+=spend;totals.conversions+=conv;totals.reach+=reach;
    if(name!=="—"){if(!byPin[name])byPin[name]={impressions:0,clicks:0,saves:0,spend:0,conversions:0,reach:0};byPin[name].impressions+=impr;byPin[name].clicks+=clicks;byPin[name].saves+=saves;byPin[name].spend+=spend;byPin[name].conversions+=conv;byPin[name].reach+=reach;}
    if(country!=="—"&&country.length===2){if(!byCountry[country])byCountry[country]={impressions:0,clicks:0,spend:0,conversions:0,saves:0,reach:0};byCountry[country].impressions+=impr;byCountry[country].clicks+=clicks;byCountry[country].spend+=spend;byCountry[country].conversions+=conv;byCountry[country].saves+=saves;byCountry[country].reach+=reach;}
    if(monthStr?.length===7){if(!byMonth[monthStr])byMonth[monthStr]={impressions:0,clicks:0,saves:0,spend:0,conversions:0};byMonth[monthStr].impressions+=impr;byMonth[monthStr].clicks+=clicks;byMonth[monthStr].saves+=saves;byMonth[monthStr].spend+=spend;byMonth[monthStr].conversions+=conv;}
  }
  totals.ctr=totals.impressions>0?(totals.clicks/totals.impressions)*100:0;totals.cpa=totals.conversions>0?totals.spend/totals.conversions:0;totals.cpm=totals.impressions>0?(totals.spend/totals.impressions)*1000:0;totals.cpc=totals.clicks>0?totals.spend/totals.clicks:0;totals.saveRate=totals.impressions>0?(totals.saves/totals.impressions)*100:0;
  return{totals,byPin,byCountry,byMonth};
}

/* ════════════════════════════════════════════════════════════
   BUILD UTILS
════════════════════════════════════════════════════════════ */
function buildDailyData(metaByDay,shopifyByDay,rate){
  const all=new Set([...Object.keys(metaByDay||{}),...Object.keys(shopifyByDay||{})]);
  return Array.from(all).sort().map(d=>{
    const m=metaByDay?.[d]||{};const s=shopifyByDay?.[d]||{};
    const spend=m.spend||0;const revBRL=(s.revenue||0)*rate;
    const roas=spend>0?parseFloat((revBRL/spend).toFixed(2)):null;
    return{date:d,label:fmtDate(d),spend:spend?parseFloat(spend.toFixed(2)):null,revBRL:revBRL?parseFloat(revBRL.toFixed(2)):null,roas,orders:s.orders||0,purchases:m.purchases||0};
  });
}

function buildSuggestions(meta,shopify,rate,pinterest){
  const out=[];if(!meta)return out;
  const t=meta.totals;
  const roasG=t.spend>0&&shopify?(shopify.totalRevenue*rate)/t.spend:0;
  if(roasG>0){if(roasG>=4)out.push({type:"good",title:`ROAS ${fmtX(roasG)} — excelente`,msg:`Receita ${fmtR(shopify.totalRevenue*rate)} vs gasto ${fmtR(t.spend)}. Escale +20-30%/semana.`});else if(roasG>=2)out.push({type:"good",title:`ROAS ${fmtX(roasG)} — saudável`,msg:`Espaço para testar novos criativos e expandir países.`});else if(roasG>=1)out.push({type:"warn",title:`ROAS ${fmtX(roasG)} — apertado`,msg:`Foco em CVR antes de escalar.`});else out.push({type:"bad",title:`ROAS ${fmtX(roasG)} — abaixo do breakeven`,msg:`Pausar e revisar criativos + segmentação.`});}
  if(t.cpm>80)out.push({type:"warn",title:`CPM alto: ${fmtR(t.cpm)}`,msg:`Considere expandir países ou faixas de idade.`});
  if(t.ctr>0&&t.ctr<0.5)out.push({type:"warn",title:`CTR baixo: ${fmtPct(t.ctr)}`,msg:`Testar novos hooks, diferentes formatos ou CTAs mais diretos.`});
  if(t.lpv>0&&t.purchases>0){const cvr=(t.purchases/t.lpv)*100;if(cvr<1)out.push({type:"warn",title:`CVR LPV→Compra: ${fmtPct(cvr)}`,msg:`Revisar landing page, preço, frete ou fricção no checkout.`});else if(cvr>5)out.push({type:"good",title:`CVR forte: ${fmtPct(cvr)}`,msg:`Produto convertendo bem. Foco em volume de tráfego.`});}
  const creatives=Object.entries(meta.byCreative).map(([n,d])=>({name:n,...d,cpa:d.purchases>0?d.spend/d.purchases:9999,freq:d._freqImprTotal>0?d._freqImprSum/d._freqImprTotal:0})).filter(c=>c.spend>5);
  if(creatives.length>1){const best=[...creatives].sort((a,b)=>a.cpa-b.cpa)[0];const worst=[...creatives].sort((a,b)=>b.cpa-a.cpa)[0];if(best.purchases>0)out.push({type:"good",title:`Vencedor: ${best.name.split("|")[0].trim().slice(0,45)}`,msg:`CPA ${fmtR(best.cpa)} · ${fmt(best.purchases)} compras · gasto ${fmtR(best.spend)}.`});if(worst.purchases===0&&worst.spend>20)out.push({type:"action",title:`Pausar: ${worst.name.split("|")[0].trim().slice(0,45)}`,msg:`${fmtR(worst.spend)} gastos sem nenhuma compra.`});const fatigued=creatives.filter(c=>c.freq>3&&c.purchases===0);if(fatigued.length>0)out.push({type:"warn",title:`Fadiga criativa: ${fatigued.length} anúncio(s) com frequência > 3×`,msg:`${fatigued.map(c=>c.name.split("|")[0].trim().slice(0,30)).join(", ")}. Renovar criativos com urgência.`});}
  if(pinterest?.totals.spend>0)out.push({type:"good",title:`Pinterest ativo: ${fmt(pinterest.totals.impressions)} impressões`,msg:`Gasto $${pinterest.totals.spend.toFixed(2)} · CPM $${pinterest.totals.cpm.toFixed(2)} · ${fmt(pinterest.totals.saves)} saves (intenção futura).`});
  // DOW analysis
  if(shopify?.rawOrders?.length>0){const dow={};for(const o of shopify.rawOrders){if(!o.date)continue;const d=new Date(o.date+"T12:00:00").getDay();if(!dow[d])dow[d]={day:["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][d],orders:0,revenue:0};dow[d].orders++;dow[d].revenue+=o.total;}const bestDay=Object.values(dow).sort((a,b)=>b.orders-a.orders)[0];if(bestDay)out.push({type:"good",title:`Melhor dia: ${bestDay.day} (${bestDay.orders} pedidos)`,msg:`Shopify converte mais em ${bestDay.day}. Considere escalar budget Meta nesse dia.`});}
  return out;
}

/* ════════════════════════════════════════════════════════════
   ATTRIBUTION WINDOW INSIGHTS (NEW)
════════════════════════════════════════════════════════════ */
function AttributionWindowInsights({meta,shopify,rate}){
  const T=useT();
  const analysis=useMemo(()=>{
    if(!meta||!shopify)return null;
    const metaDays=meta.byDay||{};const shopDays=shopify.byDay||{};
    const allDays=[...new Set([...Object.keys(metaDays),...Object.keys(shopDays)])].sort();
    if(!allDays.length)return null;
    // Find gaps: days with Shopify orders but $0 Meta spend
    const gaps=[];let lastMetaDay=null;
    for(const d of allDays){
      const mSpend=metaDays[d]?.spend||0;const sOrders=shopDays[d]?.orders||0;const sRev=shopDays[d]?.revenue||0;
      if(mSpend>0)lastMetaDay=d;
      if(sOrders>0&&mSpend===0&&lastMetaDay){
        const lastDate=new Date(lastMetaDay+"T12:00:00");const curDate=new Date(d+"T12:00:00");
        const daysSinceLastSpend=Math.round((curDate-lastDate)/(1000*60*60*24));
        gaps.push({date:d,orders:sOrders,revenue:sRev,daysSinceLastSpend,lastMetaDay,likelyAttrib:daysSinceLastSpend<=14});
      }
    }
    if(!gaps.length)return null;
    const likelyHalo=gaps.filter(g=>g.likelyAttrib);const organic=gaps.filter(g=>!g.likelyAttrib);
    const haloOrders=likelyHalo.reduce((a,g)=>a+g.orders,0);
    const haloRevBRL=likelyHalo.reduce((a,g)=>a+g.revenue*rate,0);
    const organicOrders=organic.reduce((a,g)=>a+g.orders,0);
    const totalNoSpend=gaps.reduce((a,g)=>a+g.orders,0);
    const pctHalo=totalNoSpend>0?haloOrders/totalNoSpend*100:0;
    return{gaps,likelyHalo,organic,haloOrders,haloRevBRL,organicOrders,totalNoSpend,pctHalo};
  },[meta,shopify,rate]);

  if(!analysis)return(<div style={{padding:"20px",textAlign:"center",fontSize:12,color:T.faint}}>Suba Meta Ads + Shopify para análise de atribuição</div>);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10,marginBottom:4}}>
        <div style={{background:T.violetL,border:`1px solid ${T.violet}40`,borderRadius:T.radius,padding:"12px 16px"}}>
          <div style={{fontSize:9,color:T.violet,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:T.fontDisplay,marginBottom:4}}>Pedidos sem gasto Meta</div>
          <div style={{fontSize:22,fontWeight:800,color:T.text,fontFamily:T.fontDisplay}}>{analysis.totalNoSpend}</div>
          <div style={{fontSize:10,color:T.muted,marginTop:2}}>dias sem investimento Meta</div>
        </div>
        <div style={{background:`${T.warn}15`,border:`1px solid ${T.warn}40`,borderRadius:T.radius,padding:"12px 16px"}}>
          <div style={{fontSize:9,color:T.warn,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:T.fontDisplay,marginBottom:4}}>Prováv. Halo Meta (≤14d)</div>
          <div style={{fontSize:22,fontWeight:800,color:T.text,fontFamily:T.fontDisplay}}>{analysis.haloOrders}</div>
          <div style={{fontSize:10,color:T.muted,marginTop:2}}>{fmtPct(analysis.pctHalo)} dos pedidos s/ gasto</div>
        </div>
        <div style={{background:`${T.shopify}15`,border:`1px solid ${T.shopify}40`,borderRadius:T.radius,padding:"12px 16px"}}>
          <div style={{fontSize:9,color:T.shopify,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:T.fontDisplay,marginBottom:4}}>Provável Orgânico (>14d)</div>
          <div style={{fontSize:22,fontWeight:800,color:T.text,fontFamily:T.fontDisplay}}>{analysis.organicOrders}</div>
          <div style={{fontSize:10,color:T.muted,marginTop:2}}>SEO, direto, Pinterest</div>
        </div>
        <div style={{background:`${T.good}15`,border:`1px solid ${T.good}40`,borderRadius:T.radius,padding:"12px 16px"}}>
          <div style={{fontSize:9,color:T.good,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:T.fontDisplay,marginBottom:4}}>Receita Halo (BRL)</div>
          <div style={{fontSize:20,fontWeight:800,color:T.text,fontFamily:T.fontDisplay}}>{fmtR(analysis.haloRevBRL)}</div>
          <div style={{fontSize:10,color:T.muted,marginTop:2}}>não captada pelo Meta</div>
        </div>
      </div>
      <div style={{background:`${T.violet}0d`,border:`1px solid ${T.violet}30`,borderRadius:T.radius,padding:"12px 16px",fontSize:11,color:T.text,lineHeight:1.7}}>
        <b style={{color:T.violet}}>💡 O que isso significa?</b> Quando o Meta Ads registra 0 compras mas o Shopify mostra pedidos, há duas explicações: (1) <b>Efeito halo</b> — o cliente clicou em um anúncio dias antes, mas o Meta não atribui a venda porque saiu da janela (7-14 dias). (2) <b>Tráfego orgânico</b> — SEO, Pinterest, e-mail ou acesso direto. Os {analysis.haloOrders} pedidos dentro de 14 dias do último gasto Meta <i>provavelmente</i> são halo. Para capturar isso, use UTMs + Google Analytics 4 com janela de 30 dias.
      </div>
      {analysis.likelyHalo.length>0&&(
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead><tr style={{background:T.bg}}>
              {["Data","Dias desde Meta","Pedidos Shopify","Receita USD","Classificação"].map(h=>(
                <th key={h} style={{padding:"7px 12px",fontSize:9,fontWeight:700,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${T.border}`,fontFamily:T.fontDisplay}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {analysis.gaps.slice(0,12).map((g,i)=>(
                <tr key={g.date} style={{background:i%2===0?T.card:T.bg}}>
                  <td style={{padding:"7px 12px",fontWeight:600,color:T.text}}>{fmtDate(g.date)}</td>
                  <td style={{padding:"7px 12px",color:g.daysSinceLastSpend<=7?T.good:g.daysSinceLastSpend<=14?T.warn:T.muted}}>{g.daysSinceLastSpend}d (desde {fmtDate(g.lastMetaDay)})</td>
                  <td style={{padding:"7px 12px",fontWeight:700,color:T.shopify}}>{g.orders}</td>
                  <td style={{padding:"7px 12px",color:T.good}}>{fmtUSD(g.revenue)}</td>
                  <td style={{padding:"7px 12px"}}>
                    <span style={{background:g.likelyAttrib?`${T.warn}20`:`${T.shopify}15`,color:g.likelyAttrib?T.warn:T.shopify,padding:"2px 8px",borderRadius:20,fontSize:9,fontWeight:700}}>
                      {g.likelyAttrib?"⏱ Prováv. Halo Meta":"🌱 Orgânico"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   COLUMN PICKER (NEW)
════════════════════════════════════════════════════════════ */
function ColumnPicker({allCols,visible,onToggle,color}){
  const T=useT();
  const[open,setOpen]=useState(false);
  const ref=useRef(null);
  useEffect(()=>{const handler=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};document.addEventListener("mousedown",handler);return()=>document.removeEventListener("mousedown",handler);},[]);
  const hiddenCount=allCols.filter(c=>!visible[c.key]).length;
  return(
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{fontSize:9,padding:"3px 10px",borderRadius:T.radius,cursor:"pointer",border:`1px solid ${open?color:T.border}`,background:open?`${color}15`:"transparent",color:open?color:T.muted,fontFamily:T.fontDisplay,fontWeight:700,display:"flex",alignItems:"center",gap:4,letterSpacing:"0.06em"}}>
        ⚙ Colunas{hiddenCount>0?` (${hiddenCount} oculta${hiddenCount>1?"s":""})`:""}
      </button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,zIndex:400,background:T.card,border:`1px solid ${T.border}`,borderRadius:T.radius,padding:"10px 12px",boxShadow:"0 8px 24px rgba(0,0,0,0.12)",minWidth:200,animation:"fadeIn 0.15s"}}>
          <div style={{fontSize:9,fontWeight:700,color:T.muted,letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:T.fontDisplay,marginBottom:8}}>Visibilidade de Colunas</div>
          {allCols.map(c=>(
            <label key={c.key} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",cursor:"pointer",fontSize:11,color:T.text}}>
              <input type="checkbox" checked={!!visible[c.key]} onChange={()=>onToggle(c.key)} style={{accentColor:color,width:13,height:13}}/>
              <span>{c.label}</span>
            </label>
          ))}
          <div style={{borderTop:`1px solid ${T.border}`,marginTop:8,paddingTop:8,display:"flex",gap:6"}}>
            <button onClick={()=>allCols.forEach(c=>!visible[c.key]&&onToggle(c.key))} style={{fontSize:9,padding:"3px 8px",borderRadius:T.radius,cursor:"pointer",border:`1px solid ${T.border}`,background:"transparent",color:T.muted,fontFamily:T.fontDisplay}}>Mostrar tudo</button>
          </div>
        </div>
      )}
    </div>
  );
}

function useColumnVisibility(cols,storageKey){
  const[visible,setVisible]=useState(()=>{try{const s=JSON.parse(localStorage.getItem("colvis_"+storageKey)||"{}");if(Object.keys(s).length>0)return{...cols.reduce((a,c)=>({...a,[c.key]:true}),{}), ...s};}catch{}return cols.reduce((a,c)=>({...a,[c.key]:true}),{});});
  const toggle=useCallback(key=>{setVisible(v=>{const next={...v,[key]:!v[key]};localStorage.setItem("colvis_"+storageKey,JSON.stringify(next));return next;});},[storageKey]);
  const visibleCols=useMemo(()=>cols.filter(c=>visible[c.key]),[cols,visible]);
  return{visible,toggle,visibleCols};
}

/* ════════════════════════════════════════════════════════════
   THEME CUSTOMIZER (NEW)
════════════════════════════════════════════════════════════ */
function ThemeCustomizer({theme,setTheme,onClose}){
  const T=useT();
  const[local,setLocal]=useState({...theme});
  const apply=(patch)=>{const next={...local,...patch};setLocal(next);setTheme(next);lsSet("gwm_theme_v2",next);};
  const applyPreset=(name)=>{const p={...THEME_PRESETS[name]};apply(p);};
  const colorRow=(label,key)=>(
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
      <label style={{fontSize:11,color:T.muted,width:120,flexShrink:0}}>{label}</label>
      <input type="color" value={local[key]||"#000000"} onChange={e=>apply({[key]:e.target.value})} style={{width:32,height:28,border:`1px solid ${T.border}`,borderRadius:4,cursor:"pointer",padding:2}}/>
      <span style={{fontSize:10,fontFamily:"monospace",color:T.faint}}>{local[key]}</span>
    </div>
  );
  return(
    <div style={{position:"fixed",top:0,right:0,width:340,height:"100vh",background:T.card,borderLeft:`1px solid ${T.border}`,zIndex:1000,overflowY:"auto",boxShadow:"-8px 0 32px rgba(0,0,0,0.12)",display:"flex",flexDirection:"column"}}>
      <div style={{padding:"16px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:T.bg}}>
        <div style={{fontSize:13,fontWeight:800,color:T.text,fontFamily:T.fontDisplay}}>🎨 Tema & Visual</div>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:T.muted,padding:4}}>✕</button>
      </div>
      <div style={{padding:"16px 20px",flex:1}}>
        <div style={{fontSize:9,fontWeight:700,color:T.muted,letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:T.fontDisplay,marginBottom:10}}>Predefinições</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:20}}>
          {Object.keys(THEME_PRESETS).map(name=>(
            <button key={name} onClick={()=>applyPreset(name)} style={{fontSize:10,padding:"5px 12px",borderRadius:T.radius,cursor:"pointer",border:`1px solid ${T.border}`,background:T.bg,color:T.text,fontFamily:T.fontDisplay,fontWeight:600,transition:"all 0.12s"}}>{name}</button>
          ))}
        </div>
        <div style={{fontSize:9,fontWeight:700,color:T.muted,letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:T.fontDisplay,marginBottom:10}}>Tipografia</div>
        <div style={{marginBottom:8}}>
          <div style={{fontSize:11,color:T.muted,marginBottom:4}}>Família de Fonte</div>
          <select value={local.fontBody} onChange={e=>{const f=FONT_OPTIONS.find(x=>x.body===e.target.value)||FONT_OPTIONS[0];apply({fontBody:f.body,fontDisplay:f.display});}} style={{width:"100%",border:`1px solid ${T.border}`,borderRadius:T.radius,padding:"6px 10px",fontSize:11,background:T.bg,color:T.text}}>
            {FONT_OPTIONS.map(f=><option key={f.label} value={f.body}>{f.label}</option>)}
          </select>
        </div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,color:T.muted,marginBottom:6}}>Escala de Texto: {(local.fontSize||1).toFixed(1)}×</div>
          <input type="range" min="0.8" max="1.3" step="0.05" value={local.fontSize||1} onChange={e=>apply({fontSize:parseFloat(e.target.value)})} style={{width:"100%",accentColor:T.violet}}/>
        </div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,color:T.muted,marginBottom:8}}>Arredondamento de Bordas</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {[[0,"Reto"],[4,"Suave"],[10,"Arred."],[20,"Round"],[28,"Ultra"]].map(([v,l])=>(
              <button key={v} onClick={()=>apply({radius:v})} style={{fontSize:10,padding:"4px 10px",borderRadius:v,cursor:"pointer",border:`2px solid ${local.radius===v?T.violet:T.border}`,background:local.radius===v?T.violetL:T.bg,color:local.radius===v?T.violet:T.muted,fontFamily:T.fontDisplay,fontWeight:700}}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{fontSize:9,fontWeight:700,color:T.muted,letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:T.fontDisplay,marginBottom:10}}>Cores Base</div>
        {colorRow("Fundo",                "bg")}
        {colorRow("Card",                 "card")}
        {colorRow("Borda",                "border")}
        {colorRow("Texto",                "text")}
        {colorRow("Texto Secundário",     "muted")}
        <div style={{fontSize:9,fontWeight:700,color:T.muted,letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:T.fontDisplay,margin:"12px 0 10px"}}>Cores de Plataforma</div>
        {colorRow("Meta Ads (cor)",       "meta")}
        {colorRow("Meta Ads (fundo)",     "metaL")}
        {colorRow("Shopify (cor)",        "shopify")}
        {colorRow("Shopify (fundo)",      "shopifyL")}
        {colorRow("Pinterest (cor)",      "pinterest")}
        {colorRow("Destaque (violet)",    "violet")}
        <div style={{fontSize:9,fontWeight:700,color:T.muted,letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:T.fontDisplay,margin:"12px 0 10px"}}>Status</div>
        {colorRow("Bom",                  "good")}
        {colorRow("Ruim",                 "bad")}
        {colorRow("Atenção",              "warn")}
      </div>
      <div style={{padding:"14px 20px",borderTop:`1px solid ${T.border}`,background:T.bg,display:"flex",gap:8}}>
        <button onClick={()=>{apply(BASE_THEME);}} style={{flex:1,background:"transparent",border:`1px solid ${T.border}`,color:T.muted,borderRadius:T.radius,padding:"8px",fontSize:11,cursor:"pointer",fontFamily:T.fontDisplay,fontWeight:700}}>↺ Reset</button>
        <button onClick={onClose} style={{flex:2,background:T.violet,border:"none",color:"#fff",borderRadius:T.radius,padding:"8px",fontSize:11,cursor:"pointer",fontFamily:T.fontDisplay,fontWeight:700}}>✓ Aplicar</button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   GLOBAL STYLES
════════════════════════════════════════════════════════════ */
function GlobalStyles({theme}){
  return(
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Instrument+Sans:wght@400;500;600&display=swap');
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
      body{background:${theme.bg};font-family:${theme.fontBody};color:${theme.text};font-size:${(theme.fontSize||1)*14}px}
      ::-webkit-scrollbar{width:5px;height:5px}
      ::-webkit-scrollbar-thumb{background:#d6cfc5;border-radius:10px}
      input,select,textarea{font-family:inherit}
      tbody tr:hover td{background:${theme.bg}!important;transition:background 0.1s}
      @keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
      @keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
      @keyframes spin{to{transform:rotate(360deg)}}
    `}</style>
  );
}

/* ════════════════════════════════════════════════════════════
   TOOLTIP (CUSTOM)
════════════════════════════════════════════════════════════ */
function Tip({text,children}){
  const T=useT();
  const[show,setShow]=useState(false);
  const[pos,setPos]=useState({x:0,y:0});
  const ref=useRef(null);
  if(!text)return children||null;
  return(
    <span style={{position:"relative",display:"inline-flex",alignItems:"center"}} ref={ref}
      onMouseEnter={e=>{const r=ref.current?.getBoundingClientRect();setPos({x:r?r.right:e.clientX,y:r?r.top:e.clientY});setShow(true);}}
      onMouseLeave={()=>setShow(false)}>
      {children}
      <span style={{width:13,height:13,borderRadius:"50%",background:T.faint,color:T.card,fontSize:7,fontWeight:800,display:"inline-flex",alignItems:"center",justifyContent:"center",marginLeft:3,cursor:"help",flexShrink:0,lineHeight:1,fontFamily:T.fontDisplay}}>?</span>
      {show&&(
        <div style={{position:"fixed",left:pos.x+6,top:pos.y-4,zIndex:9999,background:T.text,color:T.card,borderRadius:T.radius,padding:"8px 12px",fontSize:11,maxWidth:260,lineHeight:1.6,boxShadow:"0 4px 16px rgba(0,0,0,0.2)",pointerEvents:"none",animation:"fadeIn 0.1s"}}>
          {text}
        </div>
      )}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════
   UI ATOMS
════════════════════════════════════════════════════════════ */
function UploadZone({label,sub,onFile,loaded,color,onClear}){
  const T=useT();
  const[drag,setDrag]=useState(false);
  const onDrop=useCallback(e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f)onFile(f);},[onFile]);
  return(
    <div style={{position:"relative"}}>
      <label onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={onDrop}
        style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",border:`1.5px dashed ${loaded?color:drag?"#888":T.faint}`,borderRadius:T.radius,padding:"16px 14px",cursor:"pointer",textAlign:"center",gap:5,background:loaded?`${color}0d`:drag?T.bg:T.bg,transition:"all 0.2s",minHeight:88}}>
        <input type="file" accept=".csv" style={{display:"none"}} onChange={e=>onFile(e.target.files[0])}/>
        <div style={{fontSize:15,opacity:loaded?1:0.45}}>{loaded?"✓":"↑"}</div>
        <div style={{fontSize:11,fontWeight:700,color:loaded?color:T.text,fontFamily:T.fontDisplay,letterSpacing:"0.04em"}}>{label}</div>
        <div style={{fontSize:10,color:T.muted}}>{loaded?"Carregado · clique pra trocar":sub}</div>
      </label>
      {loaded&&onClear&&(
        <button onClick={e=>{e.stopPropagation();if(window.confirm(`Limpar dados de ${label}?`))onClear();}} style={{position:"absolute",top:6,right:6,background:T.card,border:`1px solid ${T.border}`,borderRadius:20,padding:"2px 8px",fontSize:9,cursor:"pointer",color:T.bad,fontFamily:T.fontDisplay,fontWeight:700}}>✕ Limpar</button>
      )}
    </div>
  );
}

function KPI({label,value,sub,accent,large,tip}){
  const T=useT();
  return(
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:T.radius,padding:"13px 15px",borderTop:`3px solid ${accent||T.border}`}}>
      <div style={{fontSize:9,color:T.muted,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:5,fontFamily:T.fontDisplay,display:"flex",alignItems:"center",gap:4}}>
        {tip?<Tip text={tip}>{label}</Tip>:label}
      </div>
      <div style={{fontSize:large?26:18,fontWeight:700,color:T.text,fontFamily:T.fontDisplay,letterSpacing:"-0.02em",lineHeight:1}}>{value}</div>
      {sub&&<div style={{fontSize:10,color:T.faint,marginTop:4}}>{sub}</div>}
    </div>
  );
}

function SectionTitle({children,color,mb=12}){
  const T=useT();
  return(
    <div style={{fontSize:9,fontWeight:700,color:color||T.muted,letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:mb,fontFamily:T.fontDisplay,borderLeft:`3px solid ${color||T.border}`,paddingLeft:8}}>{children}</div>
  );
}

function useSortable(data,def,dir="desc"){
  const[sort,setSort]=useState({key:def,dir});
  const sorted=useMemo(()=>{if(!data?.length)return[];return[...data].sort((a,b)=>{const av=a[sort.key]??0,bv=b[sort.key]??0;return sort.dir==="desc"?bv-av:av-bv;});},[data,sort.key,sort.dir]);
  return{sorted,sort,onSort:k=>setSort(s=>({key:k,dir:s.key===k&&s.dir==="desc"?"asc":"desc"}))};
}

function DataTable({cols,rows,sort,onSort,emptyMsg,accentColor}){
  const T=useT();
  const AC=accentColor||T.violet;
  const TH={padding:"7px 10px",fontSize:9,color:T.muted,letterSpacing:"0.12em",textTransform:"uppercase",cursor:"pointer",whiteSpace:"nowrap",borderBottom:`1px solid ${T.border}`,textAlign:"right",userSelect:"none",background:T.bg,fontFamily:T.fontDisplay};
  const TD={padding:"8px 10px",fontSize:11,color:T.muted,borderBottom:`1px solid ${T.border}40`,textAlign:"right",fontVariantNumeric:"tabular-nums"};
  if(!rows?.length)return<div style={{padding:"28px",textAlign:"center",color:T.faint,fontSize:12}}>{emptyMsg||"Sem dados"}</div>;
  return(
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr>{cols.map(c=>(
          <th key={c.key} style={{...TH,textAlign:c.align||"right",color:sort?.key===c.key?AC:T.muted,borderBottom:sort?.key===c.key?`2px solid ${AC}`:`1px solid ${T.border}`}}
            onClick={()=>onSort&&onSort(c.key)}>
            <span style={{display:"inline-flex",alignItems:"center",gap:3,cursor:"pointer"}}>
              {c.tip?<Tip text={c.tip}>{c.label}</Tip>:c.label}
              {sort?.key===c.key?(sort.dir==="desc"?" ↓":" ↑"):""}
            </span>
          </th>
        ))}</tr></thead>
        <tbody>{rows.map((row,i)=>(
          <tr key={i} style={{background:i%2===0?T.card:T.bg}}>
            {cols.map(c=>(
              <td key={c.key} style={{...TD,textAlign:c.align||"right",color:c.color?c.color(row[c.key],row):TD.color}}>
                {c.render?c.render(row[c.key],row):row[c.key]??"—"}
              </td>
            ))}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function FunnelBar({label,value,max,color}){
  const T=useT();
  const pct=max>0?Math.min((value/max)*100,100):0;
  return(
    <div style={{marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
        <span style={{color:T.muted,fontSize:10}}>{label}</span>
        <span style={{fontWeight:600,color:T.text,fontVariantNumeric:"tabular-nums"}}>{fmt(value)}</span>
      </div>
      <div style={{height:5,background:T.border,borderRadius:3,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:3,transition:"width 0.4s ease"}}/>
      </div>
    </div>
  );
}

function PeriodSelector({dateFrom,dateTo,onFrom,onTo}){
  const T=useT();
  const[open,setOpen]=useState(false);
  const today=new Date();const toISO=d=>d.toISOString().slice(0,10);
  const shortcuts=[
    {label:"7d",fn:()=>{const d=new Date(today);d.setDate(d.getDate()-6);onFrom(toISO(d));onTo(toISO(today));}},
    {label:"14d",fn:()=>{const d=new Date(today);d.setDate(d.getDate()-13);onFrom(toISO(d));onTo(toISO(today));}},
    {label:"30d",fn:()=>{const d=new Date(today);d.setDate(d.getDate()-29);onFrom(toISO(d));onTo(toISO(today));}},
    {label:"Este mês",fn:()=>{const d=new Date(today.getFullYear(),today.getMonth(),1);onFrom(toISO(d));onTo(toISO(today));}},
    {label:"Mês ant.",fn:()=>{const f=new Date(today.getFullYear(),today.getMonth()-1,1);const l=new Date(today.getFullYear(),today.getMonth(),0);onFrom(toISO(f));onTo(toISO(l));}},
    {label:"Tudo",fn:()=>{onFrom("");onTo("");}},
  ];
  const activeLabel=(()=>{if(!dateFrom&&!dateTo)return"Tudo";const days=dateFrom&&dateTo?Math.round((new Date(dateTo)-new Date(dateFrom))/(864e5))+1:null;if(days===7)return"7d";if(days===14)return"14d";if(days===30)return"30d";return null;})();
  return(
    <div style={{position:"relative"}}>
      <div style={{display:"flex",alignItems:"center",gap:6,background:T.card,border:`1px solid ${T.border}`,borderRadius:T.radius,padding:"5px 10px",flexWrap:"wrap"}}>
        <span style={{fontSize:9,color:T.muted,fontFamily:T.fontDisplay,letterSpacing:"0.1em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Período</span>
        <div style={{display:"flex",gap:3}}>
          {shortcuts.map(s=>(
            <button key={s.label} onClick={s.fn} style={{fontSize:10,padding:"3px 8px",borderRadius:20,cursor:"pointer",fontFamily:T.fontDisplay,fontWeight:600,border:`1px solid ${activeLabel===s.label?T.violet:T.border}`,background:activeLabel===s.label?T.violetL:"transparent",color:activeLabel===s.label?T.violet:T.muted}}>{s.label}</button>
          ))}
        </div>
        <button onClick={()=>setOpen(o=>!o)} style={{fontSize:10,padding:"3px 8px",borderRadius:T.radius,cursor:"pointer",border:`1px solid ${open?T.violet:T.border}`,fontFamily:T.fontDisplay,background:open?T.violetL:"transparent",color:open?T.violet:T.muted,fontWeight:600}}>
          📅 {dateFrom||"início"} → {dateTo||"hoje"}
        </button>
      </div>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:200,background:T.card,border:`1px solid ${T.border}`,borderRadius:T.radius,padding:"14px 16px",boxShadow:"0 8px 24px rgba(0,0,0,0.12)",display:"flex",flexDirection:"column",gap:10,minWidth:260}}>
          <div style={{fontSize:9,fontWeight:700,color:T.muted,letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:T.fontDisplay}}>Intervalo personalizado</div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{flex:1}}><div style={{fontSize:9,color:T.faint,marginBottom:3}}>De</div><input type="date" value={dateFrom} onChange={e=>onFrom(e.target.value)} style={{width:"100%",border:`1px solid ${T.border}`,borderRadius:T.radius,padding:"5px 8px",fontSize:11,color:T.text,background:T.bg}}/></div>
            <span style={{color:T.faint,marginTop:14}}>→</span>
            <div style={{flex:1}}><div style={{fontSize:9,color:T.faint,marginBottom:3}}>Até</div><input type="date" value={dateTo} onChange={e=>onTo(e.target.value)} style={{width:"100%",border:`1px solid ${T.border}`,borderRadius:T.radius,padding:"5px 8px",fontSize:11,color:T.text,background:T.bg}}/></div>
          </div>
          <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
            <button onClick={()=>{onFrom("");onTo("");setOpen(false);}} style={{fontSize:10,color:T.muted,background:"none",border:`1px solid ${T.border}`,cursor:"pointer",padding:"4px 10px",borderRadius:T.radius}}>Limpar</button>
            <button onClick={()=>setOpen(false)} style={{fontSize:10,color:"#fff",background:T.violet,border:"none",cursor:"pointer",padding:"4px 12px",borderRadius:T.radius,fontWeight:700}}>Aplicar</button>
          </div>
        </div>
      )}
    </div>
  );
}

const ChartTip=({active,payload,label})=>{
  const T=useT();
  if(!active||!payload?.length)return null;
  return(
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:T.radius,padding:"10px 14px",fontSize:11,boxShadow:"0 4px 14px rgba(0,0,0,0.08)"}}>
      <div style={{fontWeight:700,marginBottom:5,fontFamily:T.fontDisplay,color:T.text}}>{label}</div>
      {payload.map(p=>(
        <div key={p.name} style={{display:"flex",justifyContent:"space-between",gap:16,color:p.color,marginBottom:2}}>
          <span>{p.name}</span>
          <span style={{fontWeight:600}}>{p.name==="ROAS"?fmtX(p.value):p.name.includes("R$")?fmtR(p.value):p.name.includes("$")?fmtUSD(p.value):fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

function ExportBtn({data,cols,filename}){
  const T=useT();
  const doExport=()=>{if(!data?.length)return;const headers=cols.map(c=>c.label).join(",");const rows=data.map(row=>cols.map(c=>{const v=row[c.key];const s=v==null?"":String(v);return s.includes(",")||s.includes('"')?`"${s.replace(/"/g,'""')}"`:s;}).join(","));const csv=[headers,...rows].join("\n");const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename||"export.csv";a.click();URL.revokeObjectURL(url);};
  return(
    <button onClick={e=>{e.stopPropagation();doExport();}} style={{fontSize:9,padding:"3px 9px",borderRadius:20,cursor:"pointer",border:`1px solid ${T.border}`,background:"transparent",color:T.muted,fontFamily:T.fontDisplay,fontWeight:600,letterSpacing:"0.06em",display:"flex",alignItems:"center",gap:4}}>↓ CSV</button>
  );
}

function Collapsible({title,color,children,defaultOpen=true,id=null,extra=null}){
  const T=useT();
  const sId="col_"+(id||title);
  const[open,setOpen]=useState(()=>lsGet(sId,defaultOpen));
  const toggle=()=>{setOpen(o=>{const n=!o;lsSet(sId,n);return n;});};
  return(
    <div style={{marginBottom:20}}>
      <div onClick={toggle} style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",padding:"8px 0",userSelect:"none",borderBottom:`2px solid ${open?color:T.border}`,marginBottom:open?12:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:9,fontWeight:700,color:open?color:T.muted,letterSpacing:"0.16em",textTransform:"uppercase",fontFamily:T.fontDisplay}}>{title}</span>
          {extra}
        </div>
        <span style={{fontSize:10,color:T.faint,fontFamily:T.fontDisplay,fontWeight:600,transition:"transform 0.2s",display:"inline-block",transform:open?"":"rotate(-90deg)"}}>▼</span>
      </div>
      {open&&<div style={{animation:"fadeIn 0.2s"}}>{children}</div>}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   DAILY CHART
════════════════════════════════════════════════════════════ */
function DailyChart({data}){
  const T=useT();
  const[mode,setMode]=useState("roas");
  if(!data?.length)return null;
  return(
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:T.radius,padding:"18px 20px",marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <SectionTitle color={T.violet} mb={0}>Tendência Diária</SectionTitle>
        <div style={{display:"flex",gap:4}}>
          {[["roas","ROAS"],["spend","Gasto × Rec."],["orders","Pedidos"]].map(([k,l])=>(
            <button key={k} onClick={()=>setMode(k)} style={{fontSize:10,padding:"4px 10px",borderRadius:20,cursor:"pointer",fontFamily:T.fontDisplay,fontWeight:700,border:`1px solid ${mode===k?T.violet:T.border}`,background:mode===k?T.violetL:"transparent",color:mode===k?T.violet:T.muted}}>{l}</button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={190}>
        {mode==="roas"?(
          <LineChart data={data} margin={{top:4,right:8,left:0,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
            <XAxis dataKey="label" tick={{fontSize:9,fill:T.faint}} tickLine={false} axisLine={false}/>
            <YAxis tick={{fontSize:9,fill:T.faint}} tickLine={false} axisLine={false} tickFormatter={v=>v+"×"}/>
            <Tooltip content={<ChartTip/>}/>
            <ReferenceLine y={1} stroke={T.warn} strokeDasharray="4 2" strokeWidth={1.5}/>
            <Line type="monotone" dataKey="roas" name="ROAS" stroke={T.violet} strokeWidth={2} dot={{r:3,fill:T.violet}} connectNulls/>
          </LineChart>
        ):mode==="spend"?(
          <BarChart data={data} margin={{top:4,right:8,left:0,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
            <XAxis dataKey="label" tick={{fontSize:9,fill:T.faint}} tickLine={false} axisLine={false}/>
            <YAxis tick={{fontSize:9,fill:T.faint}} tickLine={false} axisLine={false}/>
            <Tooltip content={<ChartTip/>}/><Legend wrapperStyle={{fontSize:10,paddingTop:6}}/>
            <Bar dataKey="spend" name="Gasto R$" fill={T.meta} radius={[T.radius,T.radius,0,0]}/>
            <Bar dataKey="revBRL" name="Receita R$" fill={T.shopify} radius={[T.radius,T.radius,0,0]}/>
          </BarChart>
        ):(
          <BarChart data={data} margin={{top:4,right:8,left:0,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
            <XAxis dataKey="label" tick={{fontSize:9,fill:T.faint}} tickLine={false} axisLine={false}/>
            <YAxis tick={{fontSize:9,fill:T.faint}} tickLine={false} axisLine={false}/>
            <Tooltip content={<ChartTip/>}/><Legend wrapperStyle={{fontSize:10,paddingTop:6}}/>
            <Bar dataKey="orders" name="Pedidos Shopify" fill={T.shopify} radius={[T.radius,T.radius,0,0]}/>
            <Bar dataKey="purchases" name="Compras Meta" fill={T.meta} radius={[T.radius,T.radius,0,0]}/>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   SUGGESTIONS + FEEDBACK
════════════════════════════════════════════════════════════ */
function SuggestionsPanel({meta,shopify,pinterest,rate}){
  const T=useT();
  const items=useMemo(()=>buildSuggestions(meta,shopify,rate,pinterest),[meta,shopify,pinterest,rate]);
  if(!items.length)return null;
  const icon={good:"✓",bad:"✗",warn:"⚠",action:"→"};
  const col={good:T.good,bad:T.bad,warn:T.warn,action:T.violet};
  const bg={good:T.shopifyL,bad:"#fee2e2",warn:T.warnL,action:T.violetL};
  return(
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {items.map((s,i)=>(
        <div key={i} style={{background:bg[s.type],border:`1px solid ${col[s.type]}40`,borderRadius:T.radius,padding:"10px 14px",display:"flex",gap:10,alignItems:"flex-start"}}>
          <span style={{fontSize:13,color:col[s.type],fontWeight:700,flexShrink:0,marginTop:1}}>{icon[s.type]}</span>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:T.text,marginBottom:2,fontFamily:T.fontDisplay}}>{s.title}</div>
            <div style={{fontSize:11,color:T.text,lineHeight:1.55,opacity:0.85}}>{s.msg}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function FeedbackWidget({tabName,contextData}){
  const T=useT();
  const[open,setOpen]=useState(false);const[text,setText]=useState("");const[block,setBlock]=useState("");const[copied,setCopied]=useState(false);
  const generate=()=>{const ctx=contextData?`\n\nContexto:\n${contextData}`:"";const b=`## Sugestão — GWM Dashboard\n**Aba:** ${tabName}\n\n${text}${ctx}\n\n---\n*Implemente estas mudanças no código React.*`;setBlock(b);};
  const copy=()=>{try{navigator.clipboard.writeText(block);}catch{const ta=document.createElement("textarea");ta.value=block;document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);}setCopied(true);setTimeout(()=>setCopied(false),2200);};
  return(
    <div style={{marginBottom:14}}>
      <button onClick={()=>setOpen(o=>!o)} style={{fontSize:9,padding:"3px 12px",borderRadius:20,cursor:"pointer",border:`1px solid ${open?T.violet:T.border}`,background:open?T.violetL:"transparent",color:open?T.violet:T.faint,fontFamily:T.fontDisplay,fontWeight:600,letterSpacing:"0.06em"}}>
        💬 Sugerir melhoria {open?"▲":"▼"}
      </button>
      {open&&(
        <div style={{background:T.card,border:`1.5px solid ${T.violet}`,borderRadius:T.radius,padding:16,marginTop:8,animation:"fadeIn 0.2s"}}>
          <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Descreva o que quer mudar..." rows={3} style={{width:"100%",border:`1px solid ${T.border}`,borderRadius:T.radius,padding:"8px 10px",fontSize:11,resize:"vertical",background:T.bg,lineHeight:1.6,marginBottom:8,color:T.text}}/>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <button onClick={generate} disabled={!text.trim()} style={{background:text.trim()?T.violet:"#9ca3af",color:"#fff",border:"none",borderRadius:T.radius,padding:"7px 16px",fontSize:11,fontWeight:700,cursor:text.trim()?"pointer":"default",fontFamily:T.fontDisplay}}>Gerar bloco</button>
            {block&&<button onClick={copy} style={{background:copied?T.good:"transparent",color:copied?"#fff":T.violet,border:`1px solid ${copied?T.good:T.violet}`,borderRadius:T.radius,padding:"7px 14px",fontSize:11,cursor:"pointer",fontFamily:T.fontDisplay,fontWeight:700}}>{copied?"✓ Copiado!":"📋 Copiar"}</button>}
            <button onClick={()=>{setOpen(false);setText("");setBlock("");}} style={{marginLeft:"auto",fontSize:10,color:T.faint,background:"none",border:"none",cursor:"pointer"}}>fechar</button>
          </div>
          {block&&<pre style={{marginTop:10,background:"#1c1917",color:"#f5f5f4",borderRadius:T.radius,padding:"10px 12px",fontSize:10,lineHeight:1.65,whiteSpace:"pre-wrap",wordBreak:"break-word",maxHeight:180,overflowY:"auto"}}>{block}</pre>}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   BUDGET RECOMMENDATION
════════════════════════════════════════════════════════════ */
function BudgetRecommendation({meta,shopify,pinterest,rate}){
  const T=useT();
  const roas=meta?.totals.spend>0&&shopify?(shopify.totalRevenue*rate)/meta.totals.spend:0;
  const metaRec=(()=>{if(!meta)return null;if(roas>=4)return{action:"📈 Aumentar +20%",color:T.good,detail:`ROAS ${fmtX(roas)} excelente — escale mantendo ROAS > 3×`};if(roas>=3)return{action:"📈 Aumentar +10%",color:T.good,detail:`ROAS ${fmtX(roas)} saudável — espaço para crescer`};if(roas>=1.5)return{action:"⏸ Manter",color:T.warn,detail:`ROAS ${fmtX(roas)} — otimize criativos antes de escalar`};if(roas>=1)return{action:"⚠ Reduzir −10%",color:T.warn,detail:`ROAS ${fmtX(roas)} apertado — revise criativos`};if(roas>0)return{action:"📉 Reduzir −30%",color:T.bad,detail:`ROAS ${fmtX(roas)} abaixo do breakeven — pause urgente`};return{action:"— Aguardando dados",color:T.faint,detail:"Upload Meta Ads + Shopify para receber recomendação"};})();
  const pintRec=(()=>{if(!pinterest)return null;const p=pinterest.totals;if(p.ctr>=1&&p.saves>50)return{action:"📈 Aumentar +15%",color:T.good,detail:`CTR ${fmtPct(p.ctr)} e ${fmt(p.saves)} saves`};if(p.ctr>=0.5)return{action:"⏸ Manter",color:T.warn,detail:`CTR ${fmtPct(p.ctr)} — monitore via Shopify`};if(p.spend>0)return{action:"🔍 Revisar criativos",color:T.warn,detail:`CTR ${fmtPct(p.ctr)} baixo`};return null;})();
  if(!metaRec&&!pintRec)return null;
  return(
    <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
      {metaRec&&(<div style={{flex:1,minWidth:220,background:T.card,border:`2px solid ${metaRec.color}40`,borderRadius:T.radius,padding:"14px 18px",borderLeft:`4px solid ${metaRec.color}`}}>
        <div style={{fontSize:9,color:T.meta,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:T.fontDisplay,marginBottom:6}}>Meta Ads — Budget</div>
        <div style={{fontSize:17,fontWeight:800,color:metaRec.color,fontFamily:T.fontDisplay,marginBottom:4}}>{metaRec.action}</div>
        <div style={{fontSize:11,color:T.muted,lineHeight:1.5}}>{metaRec.detail}</div>
        {meta&&<div style={{fontSize:10,color:T.faint,marginTop:8}}>Gasto: {fmtR(meta.totals.spend)} · ROAS: {roas>0?fmtX(roas):"—"}</div>}
      </div>)}
      {pintRec&&(<div style={{flex:1,minWidth:220,background:T.card,border:`2px solid ${pintRec.color}40`,borderRadius:T.radius,padding:"14px 18px",borderLeft:`4px solid ${pintRec.color}`}}>
        <div style={{fontSize:9,color:T.pinterest,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:T.fontDisplay,marginBottom:6}}>Pinterest — Budget</div>
        <div style={{fontSize:17,fontWeight:800,color:pintRec.color,fontFamily:T.fontDisplay,marginBottom:4}}>{pintRec.action}</div>
        <div style={{fontSize:11,color:T.muted,lineHeight:1.5}}>{pintRec.detail}</div>
      </div>)}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   AI INSIGHTS
════════════════════════════════════════════════════════════ */
function AIInsightsPanel({meta,shopify,pinterest,rate,openAIKey}){
  const T=useT();
  const[loading,setLoading]=useState(false);const[claudeRes,setClaudeRes]=useState("");const[gptRes,setGptRes]=useState("");const[ran,setRan]=useState(false);
  const buildPrompt=()=>{const t=meta?.totals;const roas=t?.spend>0&&shopify?(shopify.totalRevenue*rate)/t.spend:0;const top=meta?Object.entries(meta.byCountry).filter(([,d])=>d.purchases>0).sort((a,b)=>b[1].purchases-a[1].purchases).slice(0,3).map(([c,d])=>`${c}:${d.purchases}comp`).join(', '):"";return`Analise dados Gallery Wall Mockups (mockups digitais Photoshop) e dê 4-5 insights acionáveis em português brasileiro (bullets •):\n\nMeta: Gasto R$${(t?.spend||0).toFixed(0)}, Compras ${t?.purchases||0}, CPA R$${(t?.cpa||0).toFixed(0)}, ROAS ${roas.toFixed(2)}×, CTR ${(t?.ctr||0).toFixed(2)}%, CPM R$${(t?.cpm||0).toFixed(0)}, LPV ${t?.lpv||0}\nShopify: ${shopify?.totalOrders||0} pedidos, Receita $${(shopify?.totalRevenue||0).toFixed(0)}, Ticket médio $${(shopify?.avgTicket||0).toFixed(2)}\nTop países: ${top||"—"}\nPinterest: ${pinterest?`${fmt(pinterest.totals.impressions)} impr, CTR ${pinterest.totals.ctr.toFixed(2)}%, ${fmt(pinterest.totals.saves)} saves, $${pinterest.totals.spend.toFixed(0)}`:"não"}\n\nFoque em: escala, criativos, países, ROAS, 1 ação imediata.`;};
  const run=async()=>{setLoading(true);setRan(true);setClaudeRes("");setGptRes("");const prompt=buildPrompt();const cP=fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:700,messages:[{role:"user",content:prompt}]})}).then(r=>r.json()).then(d=>d.content?.[0]?.text||"Sem resposta").catch(e=>"Erro: "+e.message);const gP=openAIKey?fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+openAIKey},body:JSON.stringify({model:"gpt-4o-mini",max_tokens:700,messages:[{role:"user",content:prompt}]})}).then(r=>r.json()).then(d=>d.choices?.[0]?.message?.content||"Sem resposta").catch(e=>"Erro: "+e.message):Promise.resolve("");const[c,g]=await Promise.all([cP,gP]);setClaudeRes(c);if(openAIKey)setGptRes(g);setLoading(false);};
  return(
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:T.radius,padding:18,marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <SectionTitle color={T.violet} mb={0}>🤖 Insights de IA</SectionTitle>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:9,color:T.faint}}>Usa API Anthropic (créditos separados do claude.ai)</span>
          <button onClick={run} disabled={loading||(!meta&&!shopify)} style={{background:loading?"#9ca3af":T.violet,color:"#fff",border:"none",borderRadius:T.radius,padding:"8px 18px",fontSize:11,fontWeight:700,cursor:loading?"wait":"pointer",fontFamily:T.fontDisplay,display:"flex",alignItems:"center",gap:6}}>
            {loading&&<span style={{width:12,height:12,border:"2px solid #fff4",borderTopColor:"#fff",borderRadius:"50%",display:"inline-block",animation:"spin 0.7s linear infinite"}}/>}
            {loading?"Analisando...":ran?"↺ Reanalisar":"✦ Gerar Insights"}
          </button>
        </div>
      </div>
      {(claudeRes||gptRes)&&(
        <div style={{display:"grid",gridTemplateColumns:gptRes?"1fr 1fr":"1fr",gap:14}}>
          {claudeRes&&(<div><div style={{fontSize:9,fontWeight:700,color:T.violet,letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:T.fontDisplay,marginBottom:6,display:"flex",alignItems:"center",gap:5}}><span style={{background:T.violet,color:"#fff",fontSize:8,padding:"1px 6px",borderRadius:10}}>Claude</span>Anthropic</div><div style={{fontSize:11,color:T.text,lineHeight:1.75,background:T.violetL,borderRadius:T.radius,padding:"12px 14px",whiteSpace:"pre-wrap"}}>{claudeRes}</div></div>)}
          {gptRes&&(<div><div style={{fontSize:9,fontWeight:700,color:T.good,letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:T.fontDisplay,marginBottom:6,display:"flex",alignItems:"center",gap:5}}><span style={{background:T.good,color:"#fff",fontSize:8,padding:"1px 6px",borderRadius:10}}>GPT</span>ChatGPT</div><div style={{fontSize:11,color:T.text,lineHeight:1.75,background:T.shopifyL,borderRadius:T.radius,padding:"12px 14px",whiteSpace:"pre-wrap"}}>{gptRes}</div></div>)}
        </div>
      )}
      {!ran&&<div style={{fontSize:11,color:T.faint,textAlign:"center",padding:"16px 0"}}>Clique em "Gerar Insights" para análise automática com IA</div>}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   COUNTRY CROSSOVER
════════════════════════════════════════════════════════════ */
function CountryCrossover({meta,shopify,pinterest,rate}){
  const T=useT();
  const[view,setView]=useState("roas");
  const allCols_roas=[
    {key:"country",label:"País",align:"left",render:v=><b style={{color:T.text,whiteSpace:"nowrap"}}>{fmtCountry(v)}</b>},
    {key:"metaSpend",label:"Gasto Meta",render:v=>fmtR(v)},
    {key:"metaPurchases",label:"Comp. Meta",render:v=>fmt(v),color:v=>v>0?T.meta:T.faint},
    {key:"shopifyOrders",label:"Ped. Shopify",render:v=>fmt(v),color:v=>v>0?T.shopify:T.faint},
    {key:"shopifyRevUSD",label:"Rec. USD",render:v=>fmtUSD(v),color:v=>v>0?T.good:T.faint},
    {key:"shopifyRevBRL",label:"Rec. BRL",render:v=>fmtR(v),color:v=>v>0?T.good:T.faint},
    {key:"roasTotal",label:"ROAS Total",render:v=>fmtX(v),color:v=>v>=3?T.good:v>=1?T.warn:v>0?T.bad:T.faint},
    {key:"organic",label:"Orgânico",render:v=>v>0?fmt(v):"—",color:v=>v>0?T.shopify:T.faint},
    {key:"gap",label:"Δ",tip:"Δ + = Meta over-atribui. Δ - = orgânico ou Pinterest",render:v=>v===0?"=":(v>0?`+${v}`:`${v}`),color:v=>v===0?T.good:Math.abs(v)<=1?T.warn:T.bad},
    ...(pinterest?.byCountry&&Object.keys(pinterest.byCountry).length>0?[{key:"pintImpr",label:"🟥 Impr.",render:v=>v>0?fmt(v):"—",color:v=>v>0?T.pinterest:T.faint},{key:"pintSaves",label:"🟥 Saves",render:v=>v>0?fmt(v):"—",color:v=>v>0?T.pinterest:T.faint}]:[]),
  ];
  const allCols_funnel=[
    {key:"country",label:"País",align:"left",render:v=><b style={{color:T.text,whiteSpace:"nowrap"}}>{fmtCountry(v)}</b>},
    {key:"metaImpr",label:"Impressões",render:v=>fmt(v)},{key:"ctr",label:"CTR",render:v=>fmtPct(v),color:v=>v>=2?T.good:v>=0.5?T.warn:v>0?T.bad:T.faint},
    {key:"cpm",label:"CPM",render:v=>fmtR(v),color:v=>v>0&&v<30?T.good:v<60?T.warn:v>0?T.bad:T.faint},
    {key:"metaLPV",label:"LPV",render:v=>fmt(v)},{key:"metaPurchases",label:"Compras",render:v=>fmt(v),color:v=>v>0?T.meta:T.faint},
    {key:"cpa",label:"CPA",render:v=>v>0?fmtR(v):"—"},{key:"cvr",label:"CVR",render:v=>fmtPct(v),color:v=>v>=3?T.good:v>=1?T.warn:v>0?T.bad:T.faint},
  ];
  const curCols=view==="roas"?allCols_roas:allCols_funnel;
  const{visible:visR,toggle:togR,visibleCols:visCR}=useColumnVisibility(allCols_roas,"cross_roas");
  const{visible:visF,toggle:togF,visibleCols:visCF}=useColumnVisibility(allCols_funnel,"cross_funnel");
  const rows=useMemo(()=>{
    const countries=new Set([...Object.keys(meta?.byCountry||{}),...Object.keys(shopify?.byCountry||{}),...Object.keys(pinterest?.byCountry||{})]);
    return Array.from(countries).map(c=>{
      const m=meta?.byCountry[c]||{};const s=shopify?.byCountry[c]||{};const p=pinterest?.byCountry[c]||{};
      const revBRL=(s.revenue||0)*rate;const spend=m.spend||0;const metaP=m.purchases||0;const shopifyO=s.orders||0;
      const roas=spend>0&&revBRL>0?revBRL/spend:0;const organic=Math.max(0,shopifyO-metaP);
      const cpm=m.impressions>0?(spend/m.impressions)*1000:0;const ctr=m.impressions>0&&(m.clicks||0)>0?((m.clicks||0)/m.impressions)*100:0;
      const cpa=metaP>0?spend/metaP:0;const cvr=m.lpv>0?(metaP/m.lpv)*100:0;
      return{country:c,metaSpend:spend,metaPurchases:metaP,metaLPV:m.lpv||0,metaImpr:m.impressions||0,shopifyOrders:shopifyO,shopifyRevUSD:s.revenue||0,shopifyRevBRL:revBRL,roasTotal:roas,organic,gap:metaP-shopifyO,cpm,ctr,cpa,cvr,pintImpr:p.impressions||0,pintSaves:p.saves||0};
    }).filter(r=>r.metaSpend>0||r.shopifyOrders>0);
  },[meta,shopify,pinterest,rate]);
  const{sorted,sort,onSort}=useSortable(rows,"shopifyOrders");
  const visibleCols=view==="roas"?visCR:visCF;
  if(!rows.length)return(<div style={{background:T.metaL,borderRadius:T.radius,padding:"14px 18px",fontSize:12,color:"#1e40af",lineHeight:1.6}}>Suba Meta Ads CSV + Shopify CSV para ver o cruzamento por país.</div>);
  return(
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:T.radius,overflow:"hidden"}}>
      <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <SectionTitle color={T.violet} mb={0}>Cruzamento por País</SectionTitle>
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          <ExportBtn data={sorted} filename="paises.csv" cols={curCols}/>
          {view==="roas"?<ColumnPicker allCols={allCols_roas} visible={visR} onToggle={togR} color={T.violet}/>:<ColumnPicker allCols={allCols_funnel} visible={visF} onToggle={togF} color={T.violet}/>}
          {[["roas","ROAS & Receita"],["funnel","Funil & CPM"]].map(([k,l])=>(
            <button key={k} onClick={()=>setView(k)} style={{fontSize:10,padding:"3px 10px",borderRadius:20,cursor:"pointer",border:`1px solid ${view===k?T.violet:T.border}`,fontFamily:T.fontDisplay,fontWeight:700,background:view===k?T.violetL:"transparent",color:view===k?T.violet:T.muted}}>{l}</button>
          ))}
        </div>
      </div>
      <DataTable sort={sort} onSort={onSort} cols={visibleCols} rows={sorted} accentColor={T.violet}/>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   DAILY ATTRIBUTION TABLE
════════════════════════════════════════════════════════════ */
function DailyAttributionTable({meta,shopify,rate}){
  const T=useT();
  const[sort,setSort]=useState({key:"date",dir:"desc"});
  const onSort=k=>setSort(s=>({key:k,dir:s.key===k&&s.dir==="desc"?"asc":"desc"}));
  const allCols=[
    {key:"date",label:"Data",align:"left"},{key:"spend",label:"Gasto Meta"},{key:"metaPurchases",label:"Comp. Meta"},
    {key:"shopifyOrders",label:"Ped. Shopify"},{key:"shopifyRevUSD",label:"Rec. USD"},{key:"shopifyRevBRL",label:"Rec. BRL"},
    {key:"roas",label:"ROAS",tip:"Receita Shopify (BRL) ÷ Gasto Meta"},{key:"gap",label:"Δ",tip:"Meta compras - Shopify pedidos"},{key:"organic",label:"Orgânico Est."},
  ];
  const{visible,toggle,visibleCols}=useColumnVisibility(allCols,"daily_attrib");
  const rows=useMemo(()=>{
    if(!meta&&!shopify)return[];
    const days=new Set([...Object.keys(meta?.byDay||{}),...Object.keys(shopify?.byDay||{})]);
    return Array.from(days).map(date=>{
      const m=meta?.byDay[date]||{};const s=shopify?.byDay[date]||{};
      const revBRL=(s.revenue||0)*rate;const roas=m.spend>0&&s.revenue>0?revBRL/m.spend:null;
      return{date,spend:m.spend||0,metaPurchases:m.purchases||0,shopifyOrders:s.orders||0,shopifyRevUSD:s.revenue||0,shopifyRevBRL:revBRL,roas,gap:(m.purchases||0)-(s.orders||0),organic:Math.max(0,(s.orders||0)-(m.purchases||0))};
    });
  },[meta,shopify,rate]);
  const sorted=useMemo(()=>[...rows].sort((a,b)=>{const av=sort.key==="date"?a.date:a[sort.key];const bv=sort.key==="date"?b.date:b[sort.key];if(av==null&&bv==null)return 0;if(av==null)return 1;if(bv==null)return-1;return sort.dir==="asc"?(av>bv?1:-1):(av<bv?1:-1);}),[rows,sort]);
  if(!rows.length)return null;
  const totSpend=rows.reduce((a,r)=>a+r.spend,0),totMetaP=rows.reduce((a,r)=>a+r.metaPurchases,0),totShopifyO=rows.reduce((a,r)=>a+r.shopifyOrders,0),totRevUSD=rows.reduce((a,r)=>a+r.shopifyRevUSD,0),totRevBRL=rows.reduce((a,r)=>a+r.shopifyRevBRL,0),totOrganic=rows.reduce((a,r)=>a+r.organic,0),totROAS=totSpend>0&&totRevBRL>0?totRevBRL/totSpend:null;
  const SH=({k,label,align,tip})=>(<th onClick={()=>onSort(k)} style={{padding:"8px 12px",fontSize:9,fontWeight:700,color:sort.key===k?T.meta:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",textAlign:align||"right",cursor:"pointer",background:T.bg,borderBottom:`2px solid ${sort.key===k?T.meta:T.border}`,whiteSpace:"nowrap",fontFamily:T.fontDisplay}}>{tip?<Tip text={tip}>{label}</Tip>:label}{sort.key===k?(sort.dir==="asc"?" ↑":" ↓"):""}</th>);
  return(
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:T.radius,overflow:"hidden"}}>
      <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <SectionTitle color={T.violet} mb={0}>Atribuição Diária — Meta vs Shopify</SectionTitle>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <ColumnPicker allCols={allCols} visible={visible} onToggle={toggle} color={T.meta}/>
          <ExportBtn data={sorted} filename="atribuicao_diaria.csv" cols={allCols}/>
        </div>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr>
            {visibleCols.map(c=><SH key={c.key} k={c.key} label={c.label} align={c.key==="date"?"left":"right"} tip={c.tip}/>)}
          </tr></thead>
          <tbody>
            {sorted.map((r,i)=>{
              const show=(k)=>visibleCols.some(c=>c.key===k);
              const roasColor=r.roas==null?T.faint:r.roas>=3?T.good:r.roas>=1?T.warn:T.bad;
              return(<tr key={r.date} style={{background:i%2===0?T.card:T.bg}}>
                {show("date")&&<td style={{padding:"7px 12px",fontSize:11,fontWeight:600,color:T.text}}>{fmtDate(r.date)}</td>}
                {show("spend")&&<td style={{padding:"7px 12px",fontSize:11,textAlign:"right",color:T.meta}}>{fmtR(r.spend)}</td>}
                {show("metaPurchases")&&<td style={{padding:"7px 12px",fontSize:11,textAlign:"right",color:r.metaPurchases>0?T.meta:T.faint,fontWeight:r.metaPurchases>0?700:400}}>{fmt(r.metaPurchases)}</td>}
                {show("shopifyOrders")&&<td style={{padding:"7px 12px",fontSize:11,textAlign:"right",color:r.shopifyOrders>0?T.shopify:T.faint,fontWeight:r.shopifyOrders>0?700:400}}>{fmt(r.shopifyOrders)}</td>}
                {show("shopifyRevUSD")&&<td style={{padding:"7px 12px",fontSize:11,textAlign:"right",color:r.shopifyRevUSD>0?T.good:T.faint}}>{fmtUSD(r.shopifyRevUSD)}</td>}
                {show("shopifyRevBRL")&&<td style={{padding:"7px 12px",fontSize:11,textAlign:"right",color:r.shopifyRevBRL>0?T.good:T.faint}}>{fmtR(r.shopifyRevBRL)}</td>}
                {show("roas")&&<td style={{padding:"7px 12px",fontSize:11,textAlign:"right",color:roasColor,fontWeight:700}}>{r.roas!=null?fmtX(r.roas):"—"}</td>}
                {show("gap")&&<td style={{padding:"7px 12px",fontSize:11,textAlign:"right",color:r.gap===0?T.good:Math.abs(r.gap)<=1?T.warn:r.gap>0?T.meta:T.shopify,fontWeight:600}}>{r.gap===0?"=":(r.gap>0?`+${r.gap}`:r.gap)}</td>}
                {show("organic")&&<td style={{padding:"7px 12px",fontSize:11,textAlign:"right",color:r.organic>0?T.shopify:T.faint,fontWeight:r.organic>0?700:400}}>{r.organic>0?fmt(r.organic):"—"}</td>}
              </tr>);
            })}
          </tbody>
          <tfoot><tr style={{background:T.bg,borderTop:`2px solid ${T.border}`}}>
            {visibleCols.map(c=>{
              const s=c.key;
              const base={padding:"8px 12px",fontSize:11,textAlign:"right",fontWeight:700};
              if(s==="date")return<td key={s} style={{...base,textAlign:"left",fontSize:10,fontFamily:T.fontDisplay,color:T.text}}>TOTAL</td>;
              if(s==="spend")return<td key={s} style={{...base,color:T.meta}}>{fmtR(totSpend)}</td>;
              if(s==="metaPurchases")return<td key={s} style={{...base,color:T.meta}}>{fmt(totMetaP)}</td>;
              if(s==="shopifyOrders")return<td key={s} style={{...base,color:T.shopify}}>{fmt(totShopifyO)}</td>;
              if(s==="shopifyRevUSD")return<td key={s} style={{...base,color:T.good}}>{fmtUSD(totRevUSD)}</td>;
              if(s==="shopifyRevBRL")return<td key={s} style={{...base,color:T.good}}>{fmtR(totRevBRL)}</td>;
              if(s==="roas")return<td key={s} style={{...base,color:totROAS>=3?T.good:totROAS>=1?T.warn:T.bad}}>{totROAS?fmtX(totROAS):"—"}</td>;
              if(s==="gap"){const g=totMetaP-totShopifyO;return<td key={s} style={{...base,color:T.muted}}>{g===0?"=":(g>0?`+${g}`:g)}</td>;}
              if(s==="organic")return<td key={s} style={{...base,color:T.shopify}}>{totOrganic>0?fmt(totOrganic):"—"}</td>;
              return<td key={s} style={base}>—</td>;
            })}
          </tr></tfoot>
        </table>
        <div style={{padding:"8px 16px",fontSize:9,color:T.faint,borderTop:`1px solid ${T.border}`,background:T.bg}}>
          <b>Orgânico estimado</b> = Pedidos Shopify sem atribuição Meta (orgânico, Pinterest, SEO, e-mail). · <b>Δ positivo</b> = Meta over-atribui (usual em janelas amplas). · <b>ROAS</b> = Shopify BRL ÷ Gasto Meta.
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MONTHLY VIEW
════════════════════════════════════════════════════════════ */
function MonthlyView({meta,shopify,rate}){
  const T=useT();
  const rows=useMemo(()=>{
    const months=new Set([...Object.keys(meta?.byMonth||{}),...Object.keys(shopify?.byMonth||{})]);
    return Array.from(months).sort().map(m=>{
      const md=meta?.byMonth[m]||{};const sd=shopify?.byMonth[m]||{};
      const revBRL=(sd.revenue||0)*rate;const spend=md.spend||0;const roas=spend>0&&revBRL>0?revBRL/spend:null;
      return{month:m,label:fmtMonth(m),spend,purchases:md.purchases||0,shopifyOrders:sd.orders||0,revUSD:sd.revenue||0,revBRL,roas,cpa:md.purchases>0?spend/md.purchases:0,lpv:md.lpv||0};
    });
  },[meta,shopify,rate]);
  const{sorted,sort,onSort}=useSortable(rows,"month");
  if(!rows.length)return null;
  const tots={spend:rows.reduce((a,r)=>a+r.spend,0),purchases:rows.reduce((a,r)=>a+r.purchases,0),orders:rows.reduce((a,r)=>a+r.shopifyOrders,0),revUSD:rows.reduce((a,r)=>a+r.revUSD,0),revBRL:rows.reduce((a,r)=>a+r.revBRL,0),lpv:rows.reduce((a,r)=>a+r.lpv,0)};
  const totROAS=tots.spend>0&&tots.revBRL>0?tots.revBRL/tots.spend:null;
  return(
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:T.radius,overflow:"hidden"}}>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr>
            {[["month","Mês","left"],["spend","Gasto Meta","right"],["purchases","Comp. Meta","right"],["shopifyOrders","Ped. Shopify","right"],["revUSD","Rec. USD","right"],["revBRL","Rec. BRL","right"],["roas","ROAS","right"],["cpa","CPA","right"],["lpv","LPV","right"]].map(([k,l,a])=>(
              <th key={k} onClick={()=>onSort(k)} style={{padding:"8px 12px",fontSize:9,fontWeight:700,color:sort.key===k?T.violet:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",textAlign:a,cursor:"pointer",background:T.bg,borderBottom:`2px solid ${sort.key===k?T.violet:T.border}`,whiteSpace:"nowrap",fontFamily:T.fontDisplay}}>
                {l}{sort.key===k?(sort.dir==="asc"?" ↑":" ↓"):""}
              </th>
            ))}
          </tr></thead>
          <tbody>
            {sorted.map((r,i)=>(
              <tr key={r.month} style={{background:i%2===0?T.card:T.bg}}>
                <td style={{padding:"8px 12px",fontSize:12,fontWeight:700,color:T.text,textAlign:"left"}}>{r.label}</td>
                <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",color:T.meta}}>{fmtR(r.spend)}</td>
                <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",color:r.purchases>0?T.meta:T.faint,fontWeight:r.purchases>0?700:400}}>{fmt(r.purchases)}</td>
                <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",color:r.shopifyOrders>0?T.shopify:T.faint,fontWeight:r.shopifyOrders>0?700:400}}>{fmt(r.shopifyOrders)}</td>
                <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",color:r.revUSD>0?T.good:T.faint}}>{fmtUSD(r.revUSD)}</td>
                <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",color:r.revBRL>0?T.good:T.faint}}>{fmtR(r.revBRL)}</td>
                <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",fontWeight:700,color:r.roas==null?T.faint:r.roas>=3?T.good:r.roas>=1?T.warn:T.bad}}>{r.roas!=null?fmtX(r.roas):"—"}</td>
                <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",color:r.cpa>0?T.text:T.faint}}>{r.cpa>0?fmtR(r.cpa):"—"}</td>
                <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",color:T.violet}}>{fmt(r.lpv)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr style={{background:T.bg,borderTop:`2px solid ${T.border}`}}>
            <td style={{padding:"8px 12px",fontSize:10,fontWeight:800,color:T.text,fontFamily:T.fontDisplay}}>TOTAL</td>
            <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",fontWeight:700,color:T.meta}}>{fmtR(tots.spend)}</td>
            <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",fontWeight:700,color:T.meta}}>{fmt(tots.purchases)}</td>
            <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",fontWeight:700,color:T.shopify}}>{fmt(tots.orders)}</td>
            <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",fontWeight:700,color:T.good}}>{fmtUSD(tots.revUSD)}</td>
            <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",fontWeight:700,color:T.good}}>{fmtR(tots.revBRL)}</td>
            <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",fontWeight:700,color:totROAS>=3?T.good:totROAS>=1?T.warn:totROAS>0?T.bad:T.faint}}>{totROAS?fmtX(totROAS):"—"}</td>
            <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",fontWeight:700,color:T.muted}}>{tots.purchases>0?fmtR(tots.spend/tots.purchases):"—"}</td>
            <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",fontWeight:700,color:T.violet}}>{fmt(tots.lpv)}</td>
          </tr></tfoot>
        </table>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   OBJECTIVE PANEL
════════════════════════════════════════════════════════════ */
const OBJ_ICONS={"Vendas":"🛍","Tráfego":"🔗","Reconhecimento":"📢","Engajamento":"💬","Leads":"🎯","Outro":"📊"};
const OBJ_COLOR_KEY={"Vendas":"good","Tráfego":"meta","Reconhecimento":"violet","Engajamento":"warn","Leads":"meta","Outro":"muted"};

function ObjectivePanel({meta,shopify,rate}){
  const T=useT();
  const[activeObj,setActiveObj]=useState("all");
  const getObjColor=(name)=>T[OBJ_COLOR_KEY[name]]||T.muted;
  const objectives=useMemo(()=>{
    if(!meta?.byObjective)return[];
    return Object.entries(meta.byObjective).map(([name,d])=>{
      const cpa=d.purchases>0?d.spend/d.purchases:0,cpm=d.impressions>0?(d.spend/d.impressions)*1000:0,ctr=d.impressions>0&&d.clicks>0?(d.clicks/d.impressions)*100:0,cpc=d.clicks>0?d.spend/d.clicks:0,costLpv=d.lpv>0?d.spend/d.lpv:0;
      const spendShare=meta.totals.spend>0?d.spend/meta.totals.spend:0;const revBRL=(shopify?.totalRevenue||0)*rate*spendShare;const roas=d.spend>0&&revBRL>0?revBRL/d.spend:0;
      return{name,...d,cpa,cpm,ctr,cpc,costLpv,revBRL,roas,campCount:d.campaigns?.length||0};
    }).sort((a,b)=>b.spend-a.spend);
  },[meta,shopify,rate]);
  if(!objectives.length)return null;
  const totSpend=objectives.reduce((s,o)=>s+o.spend,0);
  const allData=activeObj==="all"?null:objectives.find(o=>o.name===activeObj);
  return(
    <div style={{marginBottom:20}}>
      <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <div onClick={()=>setActiveObj("all")} style={{flex:"0 0 auto",cursor:"pointer",padding:"10px 14px",borderRadius:T.radius,border:`2px solid ${activeObj==="all"?T.violet:T.border}`,background:activeObj==="all"?T.violetL:T.card,display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16}}>📊</span><div><div style={{fontSize:10,fontWeight:700,color:T.violet,fontFamily:T.fontDisplay}}>TOTAL</div><div style={{fontSize:12,fontWeight:700,color:T.text}}>{fmtR(totSpend)}</div></div>
        </div>
        {objectives.map(obj=>{const color=getObjColor(obj.name);const icon=OBJ_ICONS[obj.name]||"📊";const pct=totSpend>0?(obj.spend/totSpend*100).toFixed(0):0;const isActive=activeObj===obj.name;return(
          <div key={obj.name} onClick={()=>setActiveObj(isActive?"all":obj.name)} style={{flex:"0 0 auto",cursor:"pointer",padding:"10px 14px",borderRadius:T.radius,border:`2px solid ${isActive?color:T.border}`,background:isActive?color+"15":T.card,display:"flex",alignItems:"center",gap:8,minWidth:140}}>
            <span style={{fontSize:20}}>{icon}</span>
            <div style={{flex:1}}>
              <div style={{display:"flex",justifyContent:"space-between"}}><div style={{fontSize:10,fontWeight:700,color:isActive?color:T.muted,fontFamily:T.fontDisplay,letterSpacing:"0.06em"}}>{obj.name.toUpperCase()}</div><span style={{fontSize:9,color:T.faint}}>{pct}%</span></div>
              <div style={{fontSize:14,fontWeight:800,color:T.text,fontFamily:T.fontDisplay}}>{fmtR(obj.spend)}</div>
              <div style={{height:3,background:T.border,borderRadius:2,marginTop:4,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:2}}/></div>
              <div style={{fontSize:9,color:T.faint,marginTop:3}}>{obj.campCount} camp. · {fmt(obj.purchases)} compras</div>
            </div>
          </div>
        );})}
      </div>
      {allData&&(
        <div style={{background:T.card,border:`2px solid ${getObjColor(allData.name)}`,borderRadius:T.radius,padding:18,animation:"fadeIn 0.2s"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div><div style={{fontSize:18,fontWeight:800,color:T.text,fontFamily:T.fontDisplay}}>{OBJ_ICONS[allData.name]} {allData.name}</div><div style={{fontSize:10,color:T.faint,marginTop:2}}>{allData.campaigns?.join(" · ")||""}</div></div>
            <button onClick={()=>setActiveObj("all")} style={{fontSize:10,color:T.muted,background:"none",border:`1px solid ${T.border}`,borderRadius:T.radius,cursor:"pointer",padding:"4px 10px"}}>✕</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10}}>
            <KPI label="Gasto" value={fmtR(allData.spend)} accent={T.meta}/>
            <KPI label="Compras" value={fmt(allData.purchases)} accent={T.good} large/>
            <KPI label="CPA" value={fmtR(allData.cpa)} accent={T.warn}/>
            <KPI label="ROAS (est.)" value={fmtX(allData.roas)} accent={allData.roas>=3?T.good:allData.roas>=1?T.warn:T.bad}/>
            <KPI label="LPV" value={fmt(allData.lpv)} accent={T.violet}/>
            <KPI label="CPM" value={fmtR(allData.cpm)} accent={T.meta}/>
            <KPI label="CTR" value={fmtPct(allData.ctr)} accent={allData.ctr>=2?T.good:allData.ctr>=0.5?T.warn:T.bad}/>
            <KPI label="CPC" value={fmtR(allData.cpc)} accent={T.meta}/>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   CREATIVE IMAGE CELL
════════════════════════════════════════════════════════════ */
function CreativeImageCell({adName,images,onUpload}){
  const T=useT();
  const[uploading,setUploading]=useState(false);
  const shortName=adName.trim().replace(/[^a-zA-Z0-9 _\-\.]/g,'_').slice(0,80);
  const url=images[shortName]||images[adName.trim().slice(0,80)]||Object.entries(images).find(([k])=>k.startsWith(adName.trim().slice(0,40)))?.[1];
  const handleFile=async(file)=>{if(!file)return;setUploading(true);await onUpload(adName,file);setUploading(false);};
  return(
    <label style={{cursor:"pointer",flexShrink:0}}>
      <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
      {url?(
        <img src={url} alt={shortName} style={{width:48,height:48,objectFit:"cover",borderRadius:T.radius,border:`2px solid ${T.violet}`,display:"block"}} title="Clique para trocar" onError={e=>{e.target.style.display='none';}}/>
      ):(
        <div style={{width:48,height:48,borderRadius:T.radius,border:`2px dashed ${uploading?T.violet:T.faint}`,background:uploading?T.violetL:T.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1}} title="Clique para adicionar imagem">
          <span style={{fontSize:14}}>{uploading?"⏳":"🖼"}</span>
          {!uploading&&<span style={{fontSize:7,color:T.faint,letterSpacing:"0.05em"}}>ADD</span>}
        </div>
      )}
    </label>
  );
}

/* ════════════════════════════════════════════════════════════
   CREATIVES TABLE
════════════════════════════════════════════════════════════ */
function CreativesTable({rows,sort,onSort,images,onImageUpload}){
  const T=useT();
  const[expanded,setExpanded]=useState(null);
  const allCols=[
    {key:"name",label:"Criativo",align:"left"},{key:"objetivo",label:"Objetivo",align:"left"},
    {key:"reach",label:"Alcance"},{key:"impressions",label:"Impr."},{key:"freq",label:"Freq."},
    {key:"clicks",label:"Cliques"},{key:"ctr",label:"CTR"},{key:"cpm",label:"CPM"},{key:"cpc",label:"CPC"},
    {key:"lpv",label:"LPV"},{key:"addCart",label:"Cart"},{key:"purchases",label:"Compras"},
    {key:"spend",label:"Gasto"},{key:"cpa",label:"CPA"},{key:"cvr",label:"CVR"},
  ];
  const{visible,toggle,visibleCols}=useColumnVisibility(allCols,"creatives_table");
  if(!rows?.length)return(<div style={{padding:28,textAlign:"center",color:T.faint,fontSize:12}}>Exporte na aba Anúncios com Detalhamento → País</div>);
  const TH=(k,label,align="right",tip)=>(<th key={k} onClick={()=>onSort(k)} style={{padding:"8px 10px",fontSize:9,color:sort?.key===k?T.meta:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",textAlign:align,borderBottom:`2px solid ${sort?.key===k?T.meta:T.border}`,cursor:"pointer",whiteSpace:"nowrap",background:T.bg,fontFamily:T.fontDisplay,userSelect:"none"}}>
    {tip?<Tip text={tip}>{label}</Tip>:label}{sort?.key===k?(sort.dir==="asc"?" ↑":" ↓"):""}
  </th>);
  return(
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:T.radius,overflow:"hidden"}}>
      <div style={{padding:"8px 14px",background:T.violetL,borderBottom:`1px solid ${T.border}`,fontSize:10,color:T.violet,display:"flex",alignItems:"center",gap:6}}>
        <span>🖼</span><span><b>Clique no quadrado</b> ao lado do nome para subir a imagem. Clique no nome para expandir.</span>
      </div>
      <div style={{padding:"10px 14px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <SectionTitle color={T.meta} mb={0}>{rows.length} Criativos</SectionTitle>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <ColumnPicker allCols={allCols} visible={visible} onToggle={toggle} color={T.meta}/>
          <ExportBtn data={rows} filename="criativos.csv" cols={visibleCols.filter(c=>c.key!=="name").concat([{key:"name",label:"Criativo Completo"}])}/>
        </div>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr>
            {visibleCols.includes(allCols[0])||true?TH("name","Criativo","left"):null}
            {visibleCols.find(c=>c.key==="objetivo")&&TH("objetivo","Objetivo","left")}
            {visibleCols.find(c=>c.key==="reach")&&TH("reach","Alcance")}
            {visibleCols.find(c=>c.key==="impressions")&&TH("impressions","Impr.")}
            {visibleCols.find(c=>c.key==="freq")&&TH("freq","Freq.","right","Frequência média de exibição. >3× = fadiga criativa provável")}
            {visibleCols.find(c=>c.key==="clicks")&&TH("clicks","Cliques")}
            {visibleCols.find(c=>c.key==="ctr")&&TH("ctr","CTR","right","Click-through rate. >2%=ótimo, 0.5-2%=normal, <0.5%=revisar")}
            {visibleCols.find(c=>c.key==="cpm")&&TH("cpm","CPM","right","Custo por mil impressões")}
            {visibleCols.find(c=>c.key==="cpc")&&TH("cpc","CPC","right","Custo por clique")}
            {visibleCols.find(c=>c.key==="lpv")&&TH("lpv","LPV","right","Landing Page Views")}
            {visibleCols.find(c=>c.key==="addCart")&&TH("addCart","Cart")}
            {visibleCols.find(c=>c.key==="purchases")&&TH("purchases","Compras")}
            {visibleCols.find(c=>c.key==="spend")&&TH("spend","Gasto")}
            {visibleCols.find(c=>c.key==="cpa")&&TH("cpa","CPA","right","Custo por compra")}
            {visibleCols.find(c=>c.key==="cvr")&&TH("cvr","CVR","right","Conversão LPV→Compra")}
          </tr></thead>
          <tbody>
            {rows.map((row,i)=>{
              const isExp=expanded===row.name;
              const parts=row.name.split("|").map(s=>s.trim());
              const adLabel=parts[parts.length-1]||row.name;
              const hierarchy=parts.length>1?parts.slice(0,-1).join(" › "):"";
              const hasFatigue=row.freq>3;
              return(<>
                <tr key={row.name} style={{background:i%2===0?T.card:T.bg,borderBottom:isExp?`2px solid ${T.meta}`:"none"}}>
                  <td style={{padding:"8px 10px",minWidth:250,maxWidth:320}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <CreativeImageCell adName={row.name} images={images} onUpload={onImageUpload}/>
                      <div style={{minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
                          <div onClick={()=>setExpanded(isExp?null:row.name)} style={{fontWeight:700,fontSize:11,color:T.text,cursor:"pointer",wordBreak:"break-word",lineHeight:1.3}}>{adLabel}</div>
                          {hasFatigue&&<span style={{background:"#fee2e2",color:T.bad,fontSize:7,padding:"1px 5px",borderRadius:10,fontWeight:700,flexShrink:0}}>FADIGA</span>}
                        </div>
                        {hierarchy&&<div style={{fontSize:9,color:T.faint,marginTop:1,lineHeight:1.2}}>{hierarchy}</div>}
                      </div>
                    </div>
                  </td>
                  {visibleCols.find(c=>c.key==="objetivo")&&<td style={{padding:"8px 10px",fontSize:10}}><span style={{background:T.metaL,color:T.meta,padding:"1px 7px",borderRadius:20,fontWeight:700}}>{row.objetivo||"—"}</span></td>}
                  {visibleCols.find(c=>c.key==="reach")&&<td style={{padding:"8px 10px",fontSize:11,textAlign:"right",color:T.muted}}>{fmt(row.reach)}</td>}
                  {visibleCols.find(c=>c.key==="impressions")&&<td style={{padding:"8px 10px",fontSize:11,textAlign:"right",color:T.muted}}>{fmt(row.impressions)}</td>}
                  {visibleCols.find(c=>c.key==="freq")&&<td style={{padding:"8px 10px",fontSize:11,textAlign:"right",color:hasFatigue?T.bad:row.freq>2?T.warn:row.freq>0?T.good:T.faint,fontWeight:row.freq>0?700:400}}>{row.freq>0?row.freq.toFixed(2)+"×":"—"}</td>}
                  {visibleCols.find(c=>c.key==="clicks")&&<td style={{padding:"8px 10px",fontSize:11,textAlign:"right",color:T.muted}}>{row.clicks>0?fmt(row.clicks):"—"}</td>}
                  {visibleCols.find(c=>c.key==="ctr")&&<td style={{padding:"8px 10px",fontSize:11,textAlign:"right",fontWeight:700,color:row.ctr>=2?T.good:row.ctr>=0.5?T.warn:row.ctr>0?T.bad:T.faint}}>{row.ctr>0?fmtPct(row.ctr):"—"}</td>}
                  {visibleCols.find(c=>c.key==="cpm")&&<td style={{padding:"8px 10px",fontSize:11,textAlign:"right",color:T.muted}}>{row.cpm>0?fmtR(row.cpm):"—"}</td>}
                  {visibleCols.find(c=>c.key==="cpc")&&<td style={{padding:"8px 10px",fontSize:11,textAlign:"right",color:T.muted}}>{row.cpc>0?fmtR(row.cpc):"—"}</td>}
                  {visibleCols.find(c=>c.key==="lpv")&&<td style={{padding:"8px 10px",fontSize:11,textAlign:"right",color:T.violet}}>{fmt(row.lpv)}</td>}
                  {visibleCols.find(c=>c.key==="addCart")&&<td style={{padding:"8px 10px",fontSize:11,textAlign:"right",color:T.warn}}>{fmt(row.addCart)}</td>}
                  {visibleCols.find(c=>c.key==="purchases")&&<td style={{padding:"8px 10px",fontSize:11,textAlign:"right",fontWeight:700,color:row.purchases>0?T.good:T.faint}}>{fmt(row.purchases)}</td>}
                  {visibleCols.find(c=>c.key==="spend")&&<td style={{padding:"8px 10px",fontSize:11,textAlign:"right",color:T.meta}}>{fmtR(row.spend)}</td>}
                  {visibleCols.find(c=>c.key==="cpa")&&<td style={{padding:"8px 10px",fontSize:11,textAlign:"right",color:row.cpa>0?T.text:T.faint}}>{row.cpa>0?fmtR(row.cpa):"—"}</td>}
                  {visibleCols.find(c=>c.key==="cvr")&&<td style={{padding:"8px 10px",fontSize:11,textAlign:"right",color:row.cvr>=3?T.good:row.cvr>=1?T.warn:row.cvr>0?T.bad:T.faint}}>{row.cvr>0?fmtPct(row.cvr):"—"}</td>}
                </tr>
                {isExp&&(
                  <tr key={row.name+"_exp"}><td colSpan={20} style={{padding:"12px 16px",background:T.metaL}}>
                    <div style={{fontSize:9,color:T.muted,marginBottom:6,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:T.fontDisplay}}>Nome completo do anúncio</div>
                    <div style={{fontSize:10,color:T.text,fontWeight:600,wordBreak:"break-all",fontFamily:"monospace",background:T.card,padding:"6px 10px",borderRadius:T.radius,border:`1px solid ${T.border}`}}>{row.name}</div>
                  </td></tr>
                )}
              </>);
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   SETTINGS
════════════════════════════════════════════════════════════ */
function SettingsPanel({openAIKey,onSetKey}){
  const T=useT();
  const[open,setOpen]=useState(false);const[val,setVal]=useState(openAIKey||"");const save=()=>{onSetKey(val.trim());setOpen(false);};
  return(
    <div style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{fontSize:10,color:open?T.violet:T.faint,background:"none",border:`1px solid ${open?T.violet:T.border}`,cursor:"pointer",padding:"4px 10px",borderRadius:20,fontFamily:T.fontDisplay,display:"flex",alignItems:"center",gap:4,fontWeight:600}}>⚙ Config</button>
      {open&&(<div style={{position:"absolute",top:"calc(100% + 8px)",right:0,zIndex:300,background:T.card,border:`1px solid ${T.border}`,borderRadius:T.radius,padding:"16px 18px",boxShadow:"0 8px 24px rgba(0,0,0,0.12)",minWidth:300,animation:"fadeIn 0.15s"}}>
        <div style={{fontSize:9,fontWeight:700,color:T.muted,letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:T.fontDisplay,marginBottom:12}}>Configurações</div>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:9,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:5,fontFamily:T.fontDisplay}}>OpenAI API Key</div>
          <input type="password" value={val} onChange={e=>setVal(e.target.value)} placeholder="sk-..." style={{width:"100%",border:`1px solid ${T.border}`,borderRadius:T.radius,padding:"7px 10px",fontSize:11,background:T.bg,color:T.text,boxSizing:"border-box"}}/>
          <div style={{fontSize:9,color:T.faint,marginTop:4}}>Armazenada localmente. Não enviada para outros servidores.</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={save} style={{flex:1,background:T.violet,color:"#fff",border:"none",borderRadius:T.radius,padding:"8px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:T.fontDisplay}}>Salvar</button>
          <button onClick={()=>setOpen(false)} style={{fontSize:11,color:T.muted,background:"none",border:`1px solid ${T.border}`,borderRadius:T.radius,padding:"8px 14px",cursor:"pointer"}}>Cancelar</button>
        </div>
      </div>)}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   TAB: CONSOLIDADO
════════════════════════════════════════════════════════════ */
function ConsolidatedTab({meta,shopify,pinterest,rate,fee=6.8,openAIKey}){
  const T=useT();
  const dailyData=useMemo(()=>buildDailyData(meta?.byDay,shopify?.byDay,rate),[meta,shopify,rate]);
  const roasGlobal=meta?.totals.spend>0&&shopify?(shopify.totalRevenue*rate)/meta.totals.spend:0;
  const roasDays=dailyData.filter(d=>d.roas!==null);const roasAvg=roasDays.length>0?roasDays.reduce((a,b)=>a+b.roas,0)/roasDays.length:0;
  return(
    <div>
      <FeedbackWidget tabName="Consolidado"/>
      <BudgetRecommendation meta={meta} shopify={shopify} pinterest={pinterest} rate={rate}/>
      <SectionTitle color={T.violet}>Visão Geral do Período</SectionTitle>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(138px,1fr))",gap:10,marginBottom:20}}>
        <KPI label="Gasto Meta" value={fmtR(meta?.totals.spend)} accent={T.meta}/>
        <KPI label="Receita Shopify" value={fmtUSD(shopify?.totalRevenue)} accent={T.shopify} sub="em USD"/>
        <KPI label="Receita em BRL" value={fmtR((shopify?.totalRevenue||0)*rate)} accent={T.shopify}/>
        <KPI label="ROAS Global" value={fmtX(roasGlobal)} large accent={roasGlobal>=3?T.good:roasGlobal>=1?T.warn:roasGlobal>0?T.bad:T.border} tip="Receita Shopify (BRL) ÷ Gasto Meta"/>
        <KPI label="ROAS Médio/Dia" value={fmtX(roasAvg)} accent={T.violet} sub={`${roasDays.length} dias`}/>
        <KPI label="Pedidos Shopify" value={fmt(shopify?.totalOrders)} accent={T.shopify}/>
        <KPI label="Ticket Médio" value={fmtUSD(shopify?.avgTicket)} accent={T.shopify}/>
        <KPI label="Rec. Líq. BRL" value={fmtR((shopify?.totalRevenue||0)*rate*(1-fee/100))} accent={T.good} sub={`após ${fee}% Stripe`}/>
        <KPI label="Compras Meta" value={fmt(meta?.totals.purchases)} accent={T.meta} sub="atribuição Meta" tip="Compras rastreadas pelo pixel Meta. Pode divergir do Shopify."/>
        <KPI label="CPA Meta" value={fmtR(meta?.totals.cpa)} accent={T.meta}/>
        <KPI label="LPV" value={fmt(meta?.totals.lpv)} accent={T.violet} tip="Landing Page Views — visitas qualificadas na sua página"/>
        <KPI label="CVR LPV→Compra" value={fmtPct(meta?.totals.cvr)} accent={T.violet} tip=">3% é excelente, 1-3% normal, <1% precisa de atenção"/>
      </div>
      <Collapsible title="Insights de IA (Claude + ChatGPT)" color={T.violet} id="ai-insights">
        <AIInsightsPanel meta={meta} shopify={shopify} pinterest={pinterest} rate={rate} openAIKey={openAIKey}/>
      </Collapsible>
      <Collapsible title="Por Objetivo de Campanha" color={T.meta} id="obj-panel">
        <ObjectivePanel meta={meta} shopify={shopify} rate={rate}/>
      </Collapsible>
      <Collapsible title="Visão Mensal Consolidada" color={T.violet} id="monthly">
        <MonthlyView meta={meta} shopify={shopify} rate={rate}/>
      </Collapsible>
      <Collapsible title="Tendência Diária" color={T.violet} id="daily-chart">
        <DailyChart data={dailyData}/>
      </Collapsible>
      <Collapsible title="Atribuição Diária — Meta vs Shopify" color={T.meta} id="daily-attrib">
        <DailyAttributionTable meta={meta} shopify={shopify} rate={rate}/>
      </Collapsible>
      <Collapsible title="Janela de Atribuição — Vendas sem Gasto Meta" color={T.warn} id="attrib-window">
        <AttributionWindowInsights meta={meta} shopify={shopify} rate={rate}/>
      </Collapsible>
      <Collapsible title="Meta × Shopify por País" color={T.violet} id="country-cross">
        <CountryCrossover meta={meta} shopify={shopify} pinterest={pinterest} rate={rate}/>
      </Collapsible>
      <Collapsible title="Insights & Sugestões" color={T.warn} id="insights">
        <SuggestionsPanel meta={meta} shopify={shopify} pinterest={pinterest} rate={rate}/>
      </Collapsible>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   TAB: META ADS
════════════════════════════════════════════════════════════ */
function MetaTab({meta,shopify,rate,onFile,onClear,creativeImages,onImageUpload}){
  const T=useT();
  const[sub,setSub]=useState("overview");
  const creativeRows=useMemo(()=>{
    if(!meta)return[];
    return Object.entries(meta.byCreative).map(([name,d])=>{
      const cpcDirect=d._cpcCount>0?d._cpcSum/d._cpcCount:0;const clicks=d.clicks>0?d.clicks:(cpcDirect>0?Math.round(d.spend/cpcDirect):0);const cpc=cpcDirect>0?cpcDirect:(clicks>0?d.spend/clicks:0);const cpm=d.impressions>0?(d.spend/d.impressions)*1000:0;const ctr=d.impressions>0&&clicks>0?(clicks/d.impressions)*100:0;const freq=d._freqImprTotal>0?d._freqImprSum/d._freqImprTotal:0;
      return{name,objetivo:detectObjective(d.campaign||""),reach:d.reach||0,impressions:d.impressions,freq,clicks,ctr,cpm,cpc,lpv:d.lpv,addCart:d.addCart,checkout:d.checkout,purchases:d.purchases,spend:d.spend,cpa:d.purchases>0?d.spend/d.purchases:0,cvr:d.lpv>0?(d.purchases/d.lpv)*100:0};
    });
  },[meta]);
  const countryRows=useMemo(()=>{
    if(!meta)return[];
    return Object.entries(meta.byCountry).map(([country,d])=>({country,purchases:d.purchases,spend:d.spend,impressions:d.impressions,lpv:d.lpv,clicks:d.clicks||0,shopifyOrders:shopify?.byCountry[country]?.orders||0,shopifyRevUSD:shopify?.byCountry[country]?.revenue||0,shopifyRevBRL:(shopify?.byCountry[country]?.revenue||0)*rate,roas:d.spend>0&&shopify?.byCountry[country]?.revenue?(shopify.byCountry[country].revenue*rate)/d.spend:0,cpa:d.purchases>0?d.spend/d.purchases:0,cpm:d.impressions>0?(d.spend/d.impressions)*1000:0,ctr:d.impressions>0&&(d.clicks||0)>0?((d.clicks||0)/d.impressions)*100:0}));
  },[meta,shopify,rate]);
  const{sorted:sC,sort:sortC,onSort:onSC}=useSortable(creativeRows,"purchases");
  const{sorted:sCo,sort:sortCo,onSort:onSCo}=useSortable(countryRows,"shopifyOrders");
  const allCountryCols=[
    {key:"country",label:"País",align:"left",render:v=><b style={{color:T.text,whiteSpace:"nowrap"}}>{fmtCountry(v)}</b>},
    {key:"impressions",label:"Impr.",render:v=>fmt(v)},{key:"clicks",label:"Cliques",render:v=>fmt(v)},
    {key:"ctr",label:"CTR",render:v=>fmtPct(v),color:v=>v>=2?T.good:v>=0.5?T.warn:v>0?T.bad:T.faint},
    {key:"cpm",label:"CPM",render:v=>fmtR(v)},{key:"lpv",label:"LPV",render:v=>fmt(v)},
    {key:"purchases",label:"Comp. Meta",render:v=>fmt(v),color:v=>v>0?T.meta:T.faint},
    {key:"shopifyOrders",label:"Ped. Shopify",render:v=>fmt(v),color:v=>v>0?T.shopify:T.faint},
    {key:"spend",label:"Gasto",render:v=>fmtR(v)},{key:"shopifyRevUSD",label:"Rec. USD",render:v=>fmtUSD(v),color:v=>v>0?T.good:T.faint},
    {key:"roas",label:"ROAS",render:v=>fmtX(v),color:v=>v>=3?T.good:v>=1?T.warn:v>0?T.bad:T.faint},
    {key:"cpa",label:"CPA",render:v=>fmtR(v)},
  ];
  const{visible:visC,toggle:togC,visibleCols:visCo}=useColumnVisibility(allCountryCols,"meta_country");
  return(
    <div>
      <FeedbackWidget tabName="Meta Ads"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
        <UploadZone label="Meta Ads CSV" sub="Anúncios + Detalhamento País → CSV" onFile={onFile} loaded={!!meta} color={T.meta} onClear={onClear}/>
        <div style={{background:T.metaL,borderRadius:T.radius,padding:"12px 14px",fontSize:11,color:"#1e40af",lineHeight:1.85}}>
          <div style={{fontWeight:700,fontSize:9,letterSpacing:"0.12em",marginBottom:4,fontFamily:T.fontDisplay}}>COMO EXPORTAR — UM ARQUIVO SÓ</div>
          1. Gerenciador → aba <b>Anúncios</b><br/>2. Seleciona o período<br/>3. <b>Detalhamento → País</b><br/>4. Colunas: incluir <b>Objetivo</b><br/>5. <b>Exportar → CSV</b>
        </div>
      </div>
      {!meta&&<div style={{textAlign:"center",padding:"44px 0",color:T.faint,fontSize:13}}>Faça upload do CSV do Meta Ads</div>}
      {meta&&(
        <>
          <div style={{display:"flex",gap:2,marginBottom:18,background:T.bg,borderRadius:T.radius,padding:3,border:`1px solid ${T.border}`,width:"fit-content"}}>
            {["overview","funil","criativos","países","tabela"].map(s=>(
              <button key={s} onClick={()=>setSub(s)} style={{background:sub===s?T.card:"transparent",border:"none",cursor:"pointer",padding:"5px 14px",fontSize:11,fontWeight:sub===s?700:500,color:sub===s?T.meta:T.muted,borderRadius:T.radius,fontFamily:T.fontDisplay,letterSpacing:"0.05em",boxShadow:sub===s?"0 1px 3px rgba(0,0,0,0.07)":"none"}}>{s.charAt(0).toUpperCase()+s.slice(1)}</button>
            ))}
          </div>
          {sub==="overview"&&(
            <>
              <Collapsible title="Investimento & Alcance" color={T.meta} id="meta-invest">
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10}}>
                  <KPI label="Valor Gasto" value={fmtR(meta.totals.spend)} accent={T.meta}/><KPI label="Alcance" value={fmt(meta.totals.reach)} accent={T.meta}/><KPI label="Impressões" value={fmt(meta.totals.impressions)} accent={T.meta}/><KPI label="Frequência" value={meta.totals.freqAvg>0?meta.totals.freqAvg.toFixed(2)+"×":"—"} accent={T.meta} tip="Frequência média. >3× indica fadiga criativa"/><KPI label="Cliques" value={fmt(meta.totals.clicks)} accent={T.meta}/><KPI label="CTR" value={fmtPct(meta.totals.ctr)} accent={T.meta}/><KPI label="CPM" value={fmtR(meta.totals.cpm)} accent={T.meta}/><KPI label="CPC" value={fmtR(meta.totals.cpc)} accent={T.meta}/>
                </div>
              </Collapsible>
              <Collapsible title="Funil de Conversão" color={T.violet} id="meta-funil2">
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10}}>
                  <KPI label="Vis. Pág." value={fmt(meta.totals.lpv)} accent={T.violet}/><KPI label="Custo/LPV" value={fmtR(meta.totals.costLpv)} accent={T.violet}/><KPI label="Add Carrinho" value={fmt(meta.totals.addCart)} accent={T.warn}/>{meta.totals.hasCheckout&&<KPI label="Fin. Cart." value={fmt(meta.totals.checkout)} accent={T.warn}/>}<KPI label="Compras" value={fmt(meta.totals.purchases)} accent={T.good}/><KPI label="CPA" value={fmtR(meta.totals.cpa)} accent={T.good}/><KPI label="CVR" value={fmtPct(meta.totals.cvr)} accent={T.violet}/>
                </div>
              </Collapsible>
            </>
          )}
          {sub==="funil"&&(
            <div style={{maxWidth:440,background:T.card,border:`1px solid ${T.border}`,borderRadius:T.radius,padding:20}}>
              <SectionTitle color={T.meta}>Funil Visual</SectionTitle>
              {[{label:"Impressões",value:meta.totals.impressions,color:"#93c5fd"},{label:"Cliques",value:meta.totals.clicks,color:"#60a5fa"},{label:"Vis. Pág. Destino",value:meta.totals.lpv,color:T.violet},{label:"Add Carrinho",value:meta.totals.addCart,color:T.warn},{label:"Fin. Carrinho",value:meta.totals.checkout,color:"#f97316"},{label:"Compras (Meta)",value:meta.totals.purchases,color:T.good}].map(s=><FunnelBar key={s.label} {...s} max={meta.totals.impressions}/>)}
              <div style={{marginTop:14,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,borderTop:`1px solid ${T.border}`,paddingTop:14}}>
                {[{l:"Imp→LPV",v:meta.totals.impressions>0?fmtPct((meta.totals.lpv/meta.totals.impressions)*100):"—"},{l:"LPV→Cart",v:meta.totals.lpv>0?fmtPct((meta.totals.addCart/meta.totals.lpv)*100):"—"},{l:"LPV→Compra",v:meta.totals.lpv>0?fmtPct((meta.totals.purchases/meta.totals.lpv)*100):"—"}].map(r=>(<div key={r.l} style={{textAlign:"center"}}><div style={{fontSize:9,color:T.faint,marginBottom:3}}>{r.l}</div><div style={{fontSize:20,fontWeight:700,color:T.meta,fontFamily:T.fontDisplay}}>{r.v}</div></div>))}
              </div>
            </div>
          )}
          {sub==="criativos"&&<CreativesTable rows={sC} sort={sortC} onSort={onSC} images={creativeImages||{}} onImageUpload={onImageUpload||(() => {})}/>}
          {sub==="países"&&(
            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:T.radius,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <SectionTitle color={T.meta} mb={0}>Todos os Países</SectionTitle>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <ColumnPicker allCols={allCountryCols} visible={visC} onToggle={togC} color={T.meta}/>
                  <ExportBtn data={sCo} filename="meta_paises.csv" cols={visCo}/>
                </div>
              </div>
              <DataTable sort={sortCo} onSort={onSCo} cols={visCo} rows={sCo} accentColor={T.meta}/>
            </div>
          )}
          {sub==="tabela"&&(
            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:T.radius,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <SectionTitle color={T.meta} mb={0}>Por Campanha</SectionTitle>
              </div>
              <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>{[["Campanha","left"],["Objetivo","left"],["Gasto","right"],["Compras","right"],["LPV","right"],["Cart","right"],["Impr.","right"],["Cliques","right"],["CTR","right"],["CPM","right"],["CPA","right"]].map(([h,a])=>(
<th key={h} style={{padding:"8px 12px",fontSize:9,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",textAlign:a,background:T.bg,borderBottom:1px solid ${T.border},whiteSpace:"nowrap",fontFamily:T.fontDisplay}}>{h}</th>
))}</tr></thead>
<tbody>
{Object.entries(meta.byCampaign).sort((a,b)=>b[1].spend-a[1].spend).map(([name,d],i)=>{const cpm=d.impressions>0?(d.spend/d.impressions)*1000:0;const ctr=d.impressions>0&&d.clicks>0?(d.clicks/d.impressions)*100:0;return(
<tr key={name} style={{background:i%2===0?T.card:T.bg}}>
<td style={{padding:"8px 12px",fontSize:11,color:T.text,maxWidth:220,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</td>
<td style={{padding:"8px 12px",fontSize:10}}><span style={{background:T.metaL,color:T.meta,padding:"1px 8px",borderRadius:20,fontWeight:700}}>{detectObjective(name)}</span></td>
<td style={{padding:"8px 12px",fontSize:11,textAlign:"right",color:T.meta,fontWeight:700}}>{fmtR(d.spend)}</td>
<td style={{padding:"8px 12px",fontSize:11,textAlign:"right",color:d.purchases>0?T.good:T.faint,fontWeight:d.purchases>0?700:400}}>{fmt(d.purchases)}</td>
<td style={{padding:"8px 12px",fontSize:11,textAlign:"right",color:T.violet}}>{fmt(d.lpv)}</td>
<td style={{padding:"8px 12px",fontSize:11,textAlign:"right",color:T.warn}}>{fmt(d.addCart)}</td>
<td style={{padding:"8px 12px",fontSize:11,textAlign:"right",color:T.muted}}>{fmt(d.impressions)}</td>
<td style={{padding:"8px 12px",fontSize:11,textAlign:"right",color:T.muted}}>{fmt(d.clicks)}</td>
<td style={{padding:"8px 12px",fontSize:11,textAlign:"right",color:ctr>=1?T.good:ctr>=0.5?T.warn:ctr>0?T.bad:T.faint}}>{ctr>0?fmtPct(ctr):"—"}</td>
<td style={{padding:"8px 12px",fontSize:11,textAlign:"right",color:T.muted}}>{cpm>0?fmtR(cpm):"—"}</td>
<td style={{padding:"8px 12px",fontSize:11,textAlign:"right",color:d.purchases>0?T.text:T.faint}}>{d.purchases>0?fmtR(d.spend/d.purchases):"—"}</td>
</tr>
);})}
</tbody>
</table></div>
</div>
)}
</>
)}
</div>
);
}
/* ════════════════════════════════════════════════════════════
TAB: SHOPIFY
════════════════════════════════════════════════════════════ */
function ShopifyTab({shopify,onFile,onClear,productImages,onProductImageUpload}){
const T=useT();
const[sub,setSub]=useState("resumo");const[orderSearch,setOrderSearch]=useState("");
const countryRows=useMemo(()=>{if(!shopify)return[];return Object.entries(shopify.byCountry).map(([c,d])=>({country:c,orders:d.orders,revenue:d.revenue,avgTicket:d.orders>0?d.revenue/d.orders:0}));},[shopify]);
const productRows=useMemo(()=>{if(!shopify)return[];return Object.entries(shopify.byProduct).map(([key,d])=>({key,sku:d.sku||key||"—",name:d.name||"—",orders:d.orders||0,qty:d.qty||0,revenue:d.revenue||0}));},[shopify]);
const orderRows=useMemo(()=>{if(!shopify?.rawOrders)return[];const q=orderSearch.toLowerCase();return shopify.rawOrders.filter(o=>!q||o.name?.toLowerCase().includes(q)||o.customerName?.toLowerCase().includes(q)||o.email?.toLowerCase().includes(q)||o.skus?.toLowerCase().includes(q));},[shopify,orderSearch]);
const{sorted:sC,sort:sortC,onSort:onSC}=useSortable(countryRows,"revenue");
const{sorted:sP,sort:sortP,onSort:onSP}=useSortable(productRows,"orders");
const{sorted:sO,sort:sortO,onSort:onSO}=useSortable(orderRows,"total");
const allCountryCols=[{key:"country",label:"País",align:"left",render:v=><b style={{color:T.text,whiteSpace:"nowrap"}}>{fmtCountry(v)}</b>},{key:"orders",label:"Pedidos",render:v=>fmt(v),color:v=>v>0?T.shopify:T.faint},{key:"revenue",label:"Receita USD",render:v=>fmtUSD(v),color:v=>v>0?T.good:T.faint},{key:"avgTicket",label:"Ticket Médio",render:v=>fmtUSD(v)}];
const{visible:visC,toggle:togC,visibleCols:visCo}=useColumnVisibility(allCountryCols,"shop_country");
return(
<div>
<FeedbackWidget tabName="Shopify"/>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
<UploadZone label="Shopify Pedidos CSV" sub="Admin → Pedidos → Exportar → Todos" onFile={onFile} loaded={!!shopify} color={T.shopify} onClear={onClear}/>
<div style={{background:T.shopifyL,borderRadius:T.radius,padding:"12px 14px",fontSize:11,color:"#065f46",lineHeight:1.85}}>
<div style={{fontWeight:700,fontSize:9,letterSpacing:"0.12em",marginBottom:4,fontFamily:T.fontDisplay}}>COMO EXPORTAR</div>
Admin → Pedidos → <b>Exportar</b><br/>Todos os pedidos do período<br/>Formato: <b>CSV simples</b>
</div>
</div>
{!shopify&&<div style={{textAlign:"center",padding:"44px 0",color:T.faint,fontSize:13}}>Faça upload do CSV de pedidos do Shopify</div>}
{shopify&&(
<>
<div style={{display:"flex",gap:2,marginBottom:18,background:T.bg,borderRadius:T.radius,padding:3,border:1px solid ${T.border},width:"fit-content"}}>
{["resumo","países","produtos","pedidos"].map(s=>(
<button key={s} onClick={()=>setSub(s)} style={{background:sub===s?T.card:"transparent",border:"none",cursor:"pointer",padding:"5px 14px",fontSize:11,fontWeight:sub===s?700:500,color:sub===s?T.shopify:T.muted,borderRadius:T.radius,fontFamily:T.fontDisplay,boxShadow:sub===s?"0 1px 3px rgba(0,0,0,0.07)":"none"}}>
{s.charAt(0).toUpperCase()+s.slice(1)}{s==="pedidos"? (${shopify.totalOrders}):""}
</button>
))}
</div>
{sub==="resumo"&&(<>
<SectionTitle color={T.shopify}>Resumo</SectionTitle>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(138px,1fr))",gap:10,marginBottom:20}}>
<KPI label="Pedidos" value={fmt(shopify.totalOrders)} accent={T.shopify}/>
<KPI label="Receita USD" value={fmtUSD(shopify.totalRevenue)} accent={T.shopify}/>
<KPI label="Ticket Médio" value={fmtUSD(shopify.avgTicket)} accent={T.shopify}/>
</div>
</>)}
{sub==="países"&&(<>
<div style={{background:T.card,border:1px solid ${T.border},borderRadius:T.radius,overflow:"hidden",marginBottom:20}}>
<div style={{padding:"10px 14px",borderBottom:1px solid ${T.border},display:"flex",justifyContent:"space-between",alignItems:"center"}}>
<span style={{fontSize:9,color:T.shopify,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:T.fontDisplay}}>{countryRows.length} países</span>
<div style={{display:"flex",gap:6,alignItems:"center"}}>
<ColumnPicker allCols={allCountryCols} visible={visC} onToggle={togC} color={T.shopify}/>
<ExportBtn data={sC} filename="shopify_paises.csv" cols={visCo}/>
</div>
</div>
<DataTable sort={sortC} onSort={onSC} cols={visCo} rows={sC} accentColor={T.shopify}/>
</div>
</>)}
{sub==="produtos"&&productRows.length>0&&(<>
<SectionTitle color={T.shopify}>Por SKU / Produto</SectionTitle>
<div style={{background:T.shopifyL,borderRadius:T.radius,padding:"8px 14px",marginBottom:12,fontSize:10,color:"#065f46"}}>
🖼 <b>Clique no quadrado</b> para subir imagem do produto.
</div>
<div style={{background:T.card,border:1px solid ${T.border},borderRadius:T.radius,overflow:"hidden",marginBottom:20}}>
<div style={{padding:"10px 14px",borderBottom:1px solid ${T.border},display:"flex",justifyContent:"space-between",alignItems:"center"}}>
<span style={{fontSize:9,color:T.shopify,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:T.fontDisplay}}>{productRows.length} SKUs</span>
<ExportBtn data={sP} filename="produtos_sku.csv" cols={[{key:"sku",label:"SKU"},{key:"name",label:"Nome"},{key:"orders",label:"Pedidos"},{key:"qty",label:"Itens"},{key:"revenue",label:"Rec. USD"}]}/>
</div>
<DataTable sort={sortP} onSort={onSP} accentColor={T.shopify} cols={[
{key:"sku",label:"SKU / Produto",align:"left",render:(v,row)=>(
<div style={{display:"flex",alignItems:"center",gap:10}}>
<CreativeImageCell adName={"sku_"+(v!=="—"?v:row.key)} images={productImages||{}} onUpload={(name,file)=>onProductImageUpload&&onProductImageUpload(name,file)}/>
<div>
<div style={{fontFamily:"monospace",fontSize:10,color:T.meta,fontWeight:700}}>{v!=="—"?v:"—"}</div>
<div style={{fontSize:11,color:T.text,marginTop:2,maxWidth:240,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={row.name}>{row.name}</div>
</div>
</div>
)},
{key:"orders",label:"Pedidos",render:v=>fmt(v),color:v=>v>0?T.shopify:T.faint},
{key:"qty",label:"Itens",render:v=>fmt(v||0),color:v=>v>0?T.shopify:T.faint},
{key:"revenue",label:"Rec. USD",render:v=>v>0?fmtUSD(v):"—",color:v=>v>0?T.good:T.faint},
]} rows={sP}/>
</div>
</>)}
{sub==="pedidos"&&(<>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
<SectionTitle color={T.shopify} mb={0}>{orderRows.length} Pedidos</SectionTitle>
<div style={{display:"flex",gap:8,alignItems:"center"}}>
<input value={orderSearch} onChange={e=>setOrderSearch(e.target.value)} placeholder="Buscar pedido, cliente, email, SKU..." style={{border:1px solid ${T.border},borderRadius:20,padding:"6px 14px",fontSize:11,background:T.bg,color:T.text,width:280}}/>
<ExportBtn data={sO} filename="pedidos.csv" cols={[{key:"name",label:"Pedido"},{key:"date",label:"Data"},{key:"customerName",label:"Cliente"},{key:"email",label:"Email"},{key:"country",label:"País"},{key:"city",label:"Cidade"},{key:"total",label:"Total USD"},{key:"status",label:"Status"},{key:"itemsCount",label:"Qtd"},{key:"skus",label:"SKUs"}]}/>
</div>
</div>
<div style={{background:T.card,border:1px solid ${T.border},borderRadius:T.radius,overflow:"hidden"}}>
<div style={{overflowX:"auto",maxHeight:600,overflowY:"auto"}}>
<table style={{width:"100%",borderCollapse:"collapse"}}>
<thead style={{position:"sticky",top:0,zIndex:2}}>
<tr>{[["name","Pedido","left"],["date","Data","left"],["customerName","Cliente","left"],["email","Email","left"],["country","País","left"],["city","Cidade","left"],["total","Total USD","right"],["status","Status","left"],["itemsCount","Itens","right"],["skus","SKUs","left"]].map(([k,l,a])=>(
<th key={k} onClick={()=>onSO(k)} style={{padding:"8px 10px",fontSize:9,fontWeight:700,color:sortO.key===k?T.shopify:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",textAlign:a,cursor:"pointer",background:T.bg,borderBottom:2px solid ${sortO.key===k?T.shopify:T.border},whiteSpace:"nowrap",fontFamily:T.fontDisplay}}>
{l}{sortO.key===k?(sortO.dir==="asc"?" ↑":" ↓"):""}
</th>
))}</tr>
</thead>
<tbody>
{sO.map((o,i)=>(
<tr key={o.name} style={{background:i%2===0?T.card:T.bg}}>
<td style={{padding:"7px 10px",fontSize:11,fontWeight:700,color:T.text,whiteSpace:"nowrap"}}>{o.name}</td>
<td style={{padding:"7px 10px",fontSize:11,color:T.muted,whiteSpace:"nowrap"}}>{fmtDate(o.date)}</td>
<td style={{padding:"7px 10px",fontSize:11,color:T.text,maxWidth:150,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.customerName||"—"}</td>
<td style={{padding:"7px 10px",fontSize:10,color:T.muted,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.email||"—"}</td>
<td style={{padding:"7px 10px",fontSize:11,whiteSpace:"nowrap"}}>{fmtCountry(o.country)}</td>
<td style={{padding:"7px 10px",fontSize:11,color:T.muted}}>{o.city||"—"}</td>
<td style={{padding:"7px 10px",fontSize:11,textAlign:"right",fontWeight:700,color:o.total>0?T.good:T.faint}}>{fmtUSD(o.total)}</td>
<td style={{padding:"7px 10px",fontSize:10}}><span style={{background:o.status==="paid"?T.shopifyL:o.status==="refunded"?"#fee2e2":T.warnL,color:o.status==="paid"?T.shopify:o.status==="refunded"?T.bad:T.warn,padding:"1px 8px",borderRadius:20,fontWeight:700}}>{o.status||"—"}</span></td>
<td style={{padding:"7px 10px",fontSize:11,textAlign:"right",color:T.shopify}}>{o.itemsCount||0}</td>
<td style={{padding:"7px 10px",fontSize:10,color:T.muted,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.skus||"—"}</td>
</tr>
))}
{sO.length===0&&<tr><td colSpan={10} style={{padding:"28px",textAlign:"center",color:T.faint,fontSize:12}}>Nenhum pedido encontrado</td></tr>}
</tbody>
</table>
</div>
</div>
</>)}
</>
)}
</div>
);
}
/* ════════════════════════════════════════════════════════════
TAB: PINTEREST
════════════════════════════════════════════════════════════ */
function PinterestTab({pinterest,shopify,rate,onFile,onClear}){
const T=useT();
const[sub,setSub]=useState("overview");
const pinRows=useMemo(()=>{if(!pinterest)return[];return Object.entries(pinterest.byPin).map(([name,d])=>({name,...d,ctr:d.impressions>0?(d.clicks/d.impressions)*100:0,cpm:d.impressions>0?(d.spend/d.impressions)*1000:0,cpc:d.clicks>0?d.spend/d.clicks:0,saveRate:d.impressions>0?(d.saves/d.impressions)*100:0,cpa:d.conversions>0?d.spend/d.conversions:0}));},[pinterest]);
const countryRows=useMemo(()=>{if(!pinterest)return[];return Object.entries(pinterest.byCountry).map(([c,d])=>({country:c,...d,ctr:d.impressions>0?(d.clicks/d.impressions)*100:0,cpm:d.impressions>0?(d.spend/d.impressions)*1000:0,shopifyOrders:shopify?.byCountry[c]?.orders||0,shopifyRevUSD:shopify?.byCountry[c]?.revenue||0}));},[pinterest,shopify]);
const{sorted:sP,sort:sortP,onSort:onSP}=useSortable(pinRows,"impressions");
const{sorted:sCo,sort:sortCo,onSort:onSCo}=useSortable(countryRows,"impressions");
return(
<div>
<FeedbackWidget tabName="Pinterest Ads"/>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
<UploadZone label="Pinterest Ads CSV" sub="Ads Manager → Reporting → Export" onFile={onFile} loaded={!!pinterest} color={T.pinterest} onClear={onClear}/>
<div style={{background:T.pinterestL,borderRadius:T.radius,padding:"12px 14px",fontSize:11,color:"#9a1a1a",lineHeight:1.85}}>
<div style={{fontWeight:700,fontSize:9,letterSpacing:"0.12em",marginBottom:4,fontFamily:T.fontDisplay}}>COMO EXPORTAR</div>
Pinterest Ads → <b>Reporting</b><br/>Seleciona período → <b>Export data</b><br/>Inclui: Impressões, Cliques, Saves, Gasto
</div>
</div>
{!pinterest&&<div style={{textAlign:"center",padding:"44px 0",color:T.faint,fontSize:13}}>Faça upload do CSV do Pinterest Ads</div>}
{pinterest&&(
<>
<div style={{display:"flex",gap:2,marginBottom:18,background:T.bg,borderRadius:T.radius,padding:3,border:1px solid ${T.border},width:"fit-content"}}>
{["overview","funil","pins","países"].map(s=>(
<button key={s} onClick={()=>setSub(s)} style={{background:sub===s?T.card:"transparent",border:"none",cursor:"pointer",padding:"5px 14px",fontSize:11,fontWeight:sub===s?700:500,color:sub===s?T.pinterest:T.muted,borderRadius:T.radius,fontFamily:T.fontDisplay,boxShadow:sub===s?"0 1px 3px rgba(0,0,0,0.07)":"none"}}>
{s.charAt(0).toUpperCase()+s.slice(1)}
</button>
))}
</div>
{sub==="overview"&&(
<Collapsible title="Métricas Gerais" color={T.pinterest} id="pint-all">
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(138px,1fr))",gap:10,marginBottom:12}}>
<KPI label="Impressões" value={fmt(pinterest.totals.impressions)} accent={T.pinterest}/><KPI label="Cliques" value={fmt(pinterest.totals.clicks)} accent={T.pinterest}/><KPI label="CTR" value={fmtPct(pinterest.totals.ctr)} accent={T.pinterest}/><KPI label="Saves" value={fmt(pinterest.totals.saves)} accent={T.pinterest}/><KPI label="Save Rate" value={fmtPct(pinterest.totals.saveRate)} accent={T.pinterest}/><KPI label="Gasto" value={fmtUSD(pinterest.totals.spend)} accent={T.pinterest}/><KPI label="CPM" value={fmtUSD(pinterest.totals.cpm)} accent={T.pinterest}/><KPI label="Conversões" value={fmt(pinterest.totals.conversions)} accent={T.good}/><KPI label="CPA" value={fmtUSD(pinterest.totals.cpa)} accent={T.warn}/>
</div>
<div style={{background:T.pinterestL,borderRadius:T.radius,padding:"12px 16px",fontSize:11,color:"#9a1a1a",lineHeight:1.7}}>
<b>💡 Pinterest como canal:</b> Ciclo de atribuição de 7-14 dias. Saves = intenção futura. Compara "Ped. Shopify" por país com Meta para estimar impacto indireto.
</div>
</Collapsible>
)}
{sub==="funil"&&(
<div style={{maxWidth:440,background:T.card,border:1px solid ${T.border},borderRadius:T.radius,padding:20}}>
<SectionTitle color={T.pinterest}>Funil Visual</SectionTitle>
{[{label:"Impressões",value:pinterest.totals.impressions,color:"#fca5a5"},{label:"Cliques",value:pinterest.totals.clicks,color:T.pinterest},{label:"Saves",value:pinterest.totals.saves,color:T.violet},{label:"Conversões",value:pinterest.totals.conversions,color:T.good}].map(s=><FunnelBar key={s.label} {...s} max={pinterest.totals.impressions}/>)}
</div>
)}
{sub==="pins"&&(
<div style={{background:T.card,border:1px solid ${T.border},borderRadius:T.radius,overflow:"hidden"}}>
<div style={{padding:"12px 16px",borderBottom:1px solid ${T.border},display:"flex",justifyContent:"space-between",alignItems:"center"}}>
<SectionTitle color={T.pinterest} mb={0}>Pins ({pinRows.length})</SectionTitle>
<ExportBtn data={sP} filename="pinterest_pins.csv" cols={[{key:"name",label:"Pin"},{key:"impressions",label:"Impr."},{key:"clicks",label:"Cliques"},{key:"ctr",label:"CTR%"},{key:"saves",label:"Saves"},{key:"saveRate",label:"SaveRate%"},{key:"spend",label:"Gasto"},{key:"cpm",label:"CPM"},{key:"conversions",label:"Conv."}]}/>
</div>
<DataTable sort={sortP} onSort={onSP} accentColor={T.pinterest} cols={[
{key:"name",label:"Pin",align:"left",render:v=><span style={{fontWeight:600,fontSize:11,color:T.text}}>{v?.slice(0,50)||"—"}</span>},
{key:"impressions",label:"Impr.",render:v=>fmt(v)},{key:"clicks",label:"Cliques",render:v=>fmt(v)},
{key:"ctr",label:"CTR",render:v=>fmtPct(v),color:v=>v>=1?T.good:v>=0.3?T.warn:v>0?T.bad:T.faint},
{key:"saves",label:"Saves",render:v=>fmt(v),color:v=>v>0?T.pinterest:T.faint},
{key:"saveRate",label:"Save Rate",render:v=>fmtPct(v),color:v=>v>=0.5?T.good:v>0.1?T.warn:T.faint},
{key:"spend",label:"Gasto",render:v=>fmtUSD(v)},{key:"cpm",label:"CPM",render:v=>fmtUSD(v)},
{key:"conversions",label:"Conv.",render:v=>v>0?fmt(v):"—",color:v=>v>0?T.good:T.faint},
]} rows={sP}/>
</div>
)}
{sub==="países"&&(
<div style={{background:T.card,border:1px solid ${T.border},borderRadius:T.radius,overflow:"hidden"}}>
<div style={{padding:"12px 16px",borderBottom:1px solid ${T.border},display:"flex",justifyContent:"space-between",alignItems:"center"}}>
<SectionTitle color={T.pinterest} mb={0}>Por País</SectionTitle>
<ExportBtn data={sCo} filename="pint_paises.csv" cols={[{key:"country",label:"País"},{key:"impressions",label:"Impr."},{key:"clicks",label:"Cliques"},{key:"ctr",label:"CTR%"},{key:"saves",label:"Saves"},{key:"spend",label:"Gasto"},{key:"shopifyOrders",label:"Ped.Shop"},{key:"shopifyRevUSD",label:"Rec.USD"}]}/>
</div>
<DataTable sort={sortCo} onSort={onSCo} accentColor={T.pinterest} cols={[
{key:"country",label:"País",align:"left",render:v=><b style={{color:T.text,whiteSpace:"nowrap"}}>{fmtCountry(v)}</b>},
{key:"impressions",label:"Impr.",render:v=>fmt(v)},{key:"clicks",label:"Cliques",render:v=>fmt(v)},
{key:"ctr",label:"CTR",render:v=>fmtPct(v),color:v=>v>=1?T.good:v>=0.3?T.warn:v>0?T.bad:T.faint},
{key:"saves",label:"Saves",render:v=>fmt(v),color:v=>v>0?T.pinterest:T.faint},
{key:"spend",label:"Gasto USD",render:v=>fmtUSD(v)},
{key:"shopifyOrders",label:"Ped. Shopify",render:v=>v>0?fmt(v):"—",color:v=>v>0?T.shopify:T.faint},
{key:"shopifyRevUSD",label:"Rec. USD",render:v=>v>0?fmtUSD(v):"—",color:v=>v>0?T.good:T.faint},
]} rows={sCo}/>
</div>
)}
</>
)}
</div>
);
}
/* ════════════════════════════════════════════════════════════
TAB: FINANCEIRO
════════════════════════════════════════════════════════════ */
function FinanceiroTab({meta,shopify,pinterest,rate}){
const T=useT();
const[expenses,setExpenses]=useState([]);const[loading,setLoading]=useState(false);
const[form,setForm]=useState({date:new Date().toISOString().slice(0,10),category:"",description:"",amount:""});
useEffect(()=>{setLoading(true);sbLoadExpenses().then(e=>{setExpenses(e);setLoading(false);});},[]);
const catOptions=["Meta Ads","Pinterest Ads","Google Ads","Stripe/Pagamento","Software/Tools","Design","Freelancer","Outros"];
const handleAdd=async()=>{if(!form.amount||!form.category)return;const n=await sbAddExpense({...form,amount:parseFloat(form.amount)});if(n)setExpenses(prev=>[n,...prev]);setForm(f=>({...f,category:"",description:"",amount:""}));};
const handleDel=async(id)=>{if(!window.confirm("Apagar?"))return;await sbDeleteExpense(id);setExpenses(prev=>prev.filter(e=>e.id!==id));};
const totalExp=expenses.reduce((a,e)=>a+(e.amount||0),0);
const netRevBRL=(shopify?.totalRevenue||0)*rate;const metaSpend=meta?.totals.spend||0;const pintSpend=(pinterest?.totals.spend||0)*rate;const netAfterAds=netRevBRL-metaSpend-pintSpend-totalExp;
return(
<div>
<FeedbackWidget tabName="Financeiro"/>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:10,marginBottom:20}}>
<KPI label="Receita BRL" value={fmtR(netRevBRL)} accent={T.good}/><KPI label="Gasto Meta" value={fmtR(metaSpend)} accent={T.meta}/><KPI label="Gasto Pinterest" value={fmtR(pintSpend)} accent={T.pinterest}/><KPI label="Outras Despesas" value={fmtR(totalExp)} accent={T.warn}/><KPI label="Resultado Líq." value={fmtR(netAfterAds)} accent={netAfterAds>0?T.good:T.bad} large/>
</div>
<Collapsible title="Lançar Despesa" color={T.warn} id="fin-add">
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr auto",gap:10,alignItems:"end",marginBottom:16,flexWrap:"wrap"}}>
<div><div style={{fontSize:9,color:T.muted,marginBottom:4,fontFamily:T.fontDisplay}}>Data</div><input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={{width:"100%",border:1px solid ${T.border},borderRadius:T.radius,padding:"7px 10px",fontSize:11,background:T.bg,color:T.text}}/></div>
<div><div style={{fontSize:9,color:T.muted,marginBottom:4,fontFamily:T.fontDisplay}}>Categoria</div><select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={{width:"100%",border:1px solid ${T.border},borderRadius:T.radius,padding:"7px 10px",fontSize:11,background:T.bg,color:T.text}}><option value="">Selecionar…</option>{catOptions.map(c=><option key={c}>{c}</option>)}</select></div>
<div><div style={{fontSize:9,color:T.muted,marginBottom:4,fontFamily:T.fontDisplay}}>Descrição</div><input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Opcional" style={{width:"100%",border:1px solid ${T.border},borderRadius:T.radius,padding:"7px 10px",fontSize:11,background:T.bg,color:T.text}}/></div>
<div><div style={{fontSize:9,color:T.muted,marginBottom:4,fontFamily:T.fontDisplay}}>Valor (BRL)</div><input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0,00" style={{width:"100%",border:1px solid ${T.border},borderRadius:T.radius,padding:"7px 10px",fontSize:11,background:T.bg,color:T.text}}/></div>
<button onClick={handleAdd} disabled={!form.amount||!form.category} style={{background:form.amount&&form.category?T.good:"#9ca3af",color:"#fff",border:"none",borderRadius:T.radius,padding:"7px 16px",fontSize:11,fontWeight:700,cursor:form.amount&&form.category?"pointer":"default",fontFamily:T.fontDisplay,whiteSpace:"nowrap"}}>+ Adicionar</button>
</div>
</Collapsible>
{loading&&<div style={{textAlign:"center",padding:20,color:T.faint}}>Carregando…</div>}
{expenses.length>0&&(
<div style={{background:T.card,border:1px solid ${T.border},borderRadius:T.radius,overflow:"hidden"}}>
<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
<thead><tr>
{[["Data","left"],["Categoria","left"],["Descrição","left"],["Valor","right"],["","right"]].map(([h,a])=>(
<th key={h} style={{padding:"8px 12px",fontSize:9,fontWeight:700,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",textAlign:a,background:T.bg,borderBottom:1px solid ${T.border},fontFamily:T.fontDisplay}}>{h}</th>
))}
</tr></thead>
<tbody>
{expenses.map((e,i)=>(
<tr key={e.id} style={{background:i%2===0?T.card:T.bg}}>
<td style={{padding:"8px 12px",fontSize:11,color:T.muted}}>{fmtDate(e.date)}</td>
<td style={{padding:"8px 12px",fontSize:11}}><span style={{background:T.warnL,color:T.warn,padding:"1px 8px",borderRadius:20,fontSize:10,fontWeight:700}}>{e.category}</span></td>
<td style={{padding:"8px 12px",fontSize:11,color:T.muted}}>{e.description||"—"}</td>
<td style={{padding:"8px 12px",fontSize:11,textAlign:"right",fontWeight:700,color:T.bad}}>{fmtR(e.amount)}</td>
<td style={{padding:"8px 12px",textAlign:"right"}}><button onClick={()=>handleDel(e.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:T.faint,padding:"2px 6px"}}>✕</button></td>
</tr>
))}
</tbody>
<tfoot><tr style={{background:T.bg,borderTop:2px solid ${T.border}}}>
<td colSpan={3} style={{padding:"8px 12px",fontSize:10,fontWeight:800,color:T.text,fontFamily:T.fontDisplay}}>TOTAL DESPESAS</td>
<td style={{padding:"8px 12px",fontSize:11,textAlign:"right",fontWeight:700,color:T.bad}}>{fmtR(totalExp)}</td>
<td/>
</tr></tfoot>
</table></div>
</div>
)}
</div>
);
}
/* ════════════════════════════════════════════════════════════
TAB: LEADS
════════════════════════════════════════════════════════════ */
function LeadsTab(){
const T=useT();
const[leads,setLeads]=useState([]);const[loading,setLoading]=useState(false);
const[form,setForm]=useState({date:new Date().toISOString().slice(0,10),name:"",email:"",source:"",status:"Novo",notes:""});
useEffect(()=>{setLoading(true);sbLoadLeads().then(l=>{setLeads(l);setLoading(false);});},[]);
const statusOpts=["Novo","Contactado","Proposta Enviada","Negociação","Fechado","Perdido"];
const sourceOpts=["Meta Ads","Pinterest","Google","Direto","Indicação","Instagram","Outro"];
const handleAdd=async()=>{if(!form.name)return;const n=await sbAddLead(form);if(n)setLeads(prev=>[n,...prev]);setForm(f=>({...f,name:"",email:"",notes:""}));};
const handleDel=async(id)=>{if(!window.confirm("Apagar lead?"))return;await sbDeleteLead(id);setLeads(prev=>prev.filter(l=>l.id!==id));};
const handleStatus=async(id,status)=>{await sbUpdateLead(id,{status});setLeads(prev=>prev.map(l=>l.id===id?{...l,status}:l));};
const statusColor={Novo:T.meta,Contactado:T.violet,Proposta:T.warn,"Proposta Enviada":T.warn,Negociação:T.warn,Fechado:T.good,Perdido:T.bad};
return(
<div>
<FeedbackWidget tabName="Leads"/>
<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr) auto",gap:10,alignItems:"end",marginBottom:16,flexWrap:"wrap"}}>
<div><div style={{fontSize:9,color:T.muted,marginBottom:4,fontFamily:T.fontDisplay}}>Nome</div><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Nome do lead" style={{width:"100%",border:1px solid ${T.border},borderRadius:T.radius,padding:"7px 10px",fontSize:11,background:T.bg,color:T.text}}/></div>
<div><div style={{fontSize:9,color:T.muted,marginBottom:4,fontFamily:T.fontDisplay}}>Email</div><input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="email@..." style={{width:"100%",border:1px solid ${T.border},borderRadius:T.radius,padding:"7px 10px",fontSize:11,background:T.bg,color:T.text}}/></div>
<div><div style={{fontSize:9,color:T.muted,marginBottom:4,fontFamily:T.fontDisplay}}>Origem</div><select value={form.source} onChange={e=>setForm(f=>({...f,source:e.target.value}))} style={{width:"100%",border:1px solid ${T.border},borderRadius:T.radius,padding:"7px 10px",fontSize:11,background:T.bg,color:T.text}}><option value="">Origem…</option>{sourceOpts.map(s=><option key={s}>{s}</option>)}</select></div>
<div><div style={{fontSize:9,color:T.muted,marginBottom:4,fontFamily:T.fontDisplay}}>Status</div><select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={{width:"100%",border:1px solid ${T.border},borderRadius:T.radius,padding:"7px 10px",fontSize:11,background:T.bg,color:T.text}}>{statusOpts.map(s=><option key={s}>{s}</option>)}</select></div>
<button onClick={handleAdd} disabled={!form.name} style={{background:form.name?T.violet:"#9ca3af",color:"#fff",border:"none",borderRadius:T.radius,padding:"7px 16px",fontSize:11,fontWeight:700,cursor:form.name?"pointer":"default",fontFamily:T.fontDisplay}}>+ Lead</button>
</div>
{loading&&<div style={{textAlign:"center",padding:20,color:T.faint}}>Carregando…</div>}
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10,marginBottom:16}}>
{statusOpts.map(s=>{const count=leads.filter(l=>l.status===s).length;return(<div key={s} style={{background:T.card,border:1px solid ${T.border},borderRadius:T.radius,padding:"10px 14px",borderTop:3px solid ${statusColor[s]||T.border}}}><div style={{fontSize:9,color:T.muted,fontFamily:T.fontDisplay,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>{s}</div><div style={{fontSize:22,fontWeight:800,color:T.text,fontFamily:T.fontDisplay}}>{count}</div></div>);})}
</div>
{leads.length>0&&(
<div style={{background:T.card,border:1px solid ${T.border},borderRadius:T.radius,overflow:"hidden"}}>
<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
<thead><tr>{[["Data","left"],["Nome","left"],["Email","left"],["Origem","left"],["Status","left"],["","right"]].map(([h,a])=><th key={h} style={{padding:"8px 12px",fontSize:9,fontWeight:700,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",textAlign:a,background:T.bg,borderBottom:1px solid ${T.border},fontFamily:T.fontDisplay}}>{h}</th>)}</tr></thead>
<tbody>
{leads.map((l,i)=>(
<tr key={l.id} style={{background:i%2===0?T.card:T.bg}}>
<td style={{padding:"8px 12px",fontSize:11,color:T.muted,whiteSpace:"nowrap"}}>{fmtDate(l.date)}</td>
<td style={{padding:"8px 12px",fontSize:11,fontWeight:600,color:T.text}}>{l.name}</td>
<td style={{padding:"8px 12px",fontSize:11,color:T.muted}}>{l.email||"—"}</td>
<td style={{padding:"8px 12px",fontSize:11}}><span style={{background:T.metaL,color:T.meta,padding:"1px 7px",borderRadius:20,fontSize:10,fontWeight:700}}>{l.source||"—"}</span></td>
<td style={{padding:"8px 12px",fontSize:11}}>
<select value={l.status||"Novo"} onChange={e=>handleStatus(l.id,e.target.value)} style={{border:1px solid ${statusColor[l.status]||T.border},borderRadius:20,padding:"2px 8px",fontSize:10,background:T.bg,color:statusColor||T.text,cursor:"pointer",fontWeight:700}}>
{statusOpts.map(s=><option key={s}>{s}</option>)}
</select>
</td>
<td style={{padding:"8px 12px",textAlign:"right"}}><button onClick={()=>handleDel(l.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:T.faint}}>✕</button></td>
</tr>
))}
</tbody>
</table></div>
</div>
)}
</div>
);
}
/* ════════════════════════════════════════════════════════════
TAB: CAMPANHA
════════════════════════════════════════════════════════════ */
function CampanhaTab({meta,shopify,rate}){
const T=useT();
if(!meta)return(<div style={{textAlign:"center",padding:"44px 0",color:T.faint,fontSize:13}}>Suba Meta Ads CSV para ver análise de campanha</div>);
const rows=Object.entries(meta.byCampaignMonth||{}).map(([k,d])=>{const roas=d.purchases>0&&shopify?((shopify.byMonth[d.month]?.revenue||0)rate/d.spend):0;return{...d,roas,cpa:d.purchases>0?d.spend/d.purchases:0,cvr:d.lpv>0?d.purchases/d.lpv100:0,cpm:d.impressions>0?(d.spend/d.impressions)*1000:0};}).sort((a,b)=>a.campaign.localeCompare(b.campaign)||a.month.localeCompare(b.month));
if(!rows.length)return<div style={{padding:20,color:T.faint,fontSize:12,textAlign:"center"}}>Sem dados de campanha por mês</div>;
const campaigns=[...new Set(rows.map(r=>r.campaign))];
return(
<div>
<FeedbackWidget tabName="Campanha"/>
{campaigns.map(camp=>{
const campRows=rows.filter(r=>r.campaign===camp);
const totSpend=campRows.reduce((a,r)=>a+r.spend,0),totPurch=campRows.reduce((a,r)=>a+r.purchases,0),totLpv=campRows.reduce((a,r)=>a+r.lpv,0);
return(
<Collapsible key={camp} title={camp.slice(0,60)} color={T.meta} id={"camp_"+camp} defaultOpen={false}>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8,marginBottom:12}}>
<KPI label="Total Gasto" value={fmtR(totSpend)} accent={T.meta}/><KPI label="Compras" value={fmt(totPurch)} accent={T.good}/><KPI label="LPV" value={fmt(totLpv)} accent={T.violet}/><KPI label="Objetivo" value={detectObjective(camp)} accent={T.muted}/>
</div>
<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
<thead><tr>{["Mês","Gasto","Compras","LPV","Add Cart","Impr.","Cliques","CPA","CVR","CPM"].map(h=><th key={h} style={{padding:"7px 10px",fontSize:9,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",textAlign:h==="Mês"?"left":"right",background:T.bg,borderBottom:1px solid ${T.border},fontFamily:T.fontDisplay}}>{h}</th>)}</tr></thead>
<tbody>{campRows.map((r,i)=><tr key={r.month} style={{background:i%2===0?T.card:T.bg}}>
<td style={{padding:"7px 10px",fontSize:11,fontWeight:700,color:T.text}}>{fmtMonth(r.month)}</td>
<td style={{padding:"7px 10px",fontSize:11,textAlign:"right",color:T.meta}}>{fmtR(r.spend)}</td>
<td style={{padding:"7px 10px",fontSize:11,textAlign:"right",color:r.purchases>0?T.good:T.faint,fontWeight:r.purchases>0?700:400}}>{fmt(r.purchases)}</td>
<td style={{padding:"7px 10px",fontSize:11,textAlign:"right",color:T.violet}}>{fmt(r.lpv)}</td>
<td style={{padding:"7px 10px",fontSize:11,textAlign:"right",color:T.warn}}>{fmt(r.addCart)}</td>
<td style={{padding:"7px 10px",fontSize:11,textAlign:"right",color:T.muted}}>{fmt(r.impressions)}</td>
<td style={{padding:"7px 10px",fontSize:11,textAlign:"right",color:T.muted}}>{fmt(r.clicks)}</td>
<td style={{padding:"7px 10px",fontSize:11,textAlign:"right",color:r.cpa>0?T.text:T.faint}}>{r.cpa>0?fmtR(r.cpa):"—"}</td>
<td style={{padding:"7px 10px",fontSize:11,textAlign:"right",color:r.cvr>=3?T.good:r.cvr>=1?T.warn:r.cvr>0?T.bad:T.faint}}>{r.cvr>0?fmtPct(r.cvr):"—"}</td>
<td style={{padding:"7px 10px",fontSize:11,textAlign:"right",color:T.muted}}>{r.cpm>0?fmtR(r.cpm):"—"}</td>
</tr>)}</tbody>
</table></div>
</Collapsible>
);
})}
</div>
);
}
/* ════════════════════════════════════════════════════════════
CLEAR DATA MODAL
════════════════════════════════════════════════════════════ */
function ClearDataModal({onClose,onClear}){
const T=useT();
const[selected,setSelected]=useState({meta:false,shopify:false,pinterest:false});
const[monthFilter,setMonthFilter]=useState("");
const handleClear=()=>{if(!Object.values(selected).some(Boolean))return;onClear({...selected,monthFilter});onClose();};
return(
<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
<div style={{background:T.card,borderRadius:T.radius,padding:24,minWidth:360,boxShadow:"0 16px 48px rgba(0,0,0,0.2)",animation:"fadeIn 0.2s"}} onClick={e=>e.stopPropagation()}>
<div style={{fontSize:16,fontWeight:800,color:T.text,fontFamily:T.fontDisplay,marginBottom:16}}>🗑 Apagar Dados</div>
<div style={{fontSize:12,color:T.muted,marginBottom:16}}>Selecione quais dados apagar. Esta ação não pode ser desfeita.</div>
{[["meta","Meta Ads CSV",T.meta],["shopify","Shopify CSV",T.shopify],["pinterest","Pinterest CSV",T.pinterest]].map(([key,label,color])=>(
<label key={key} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",cursor:"pointer",borderBottom:1px solid ${T.border},fontSize:12,color:T.text}}>
<input type="checkbox" checked={selected[key]} onChange={()=>setSelected(s=>({...s,[key]:!s[key]}))} style={{accentColor:color,width:16,height:16}}/>
<span style={{color,fontWeight:700}}>{label}</span>
</label>
))}
<div style={{marginTop:12,marginBottom:16}}>
<div style={{fontSize:9,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:T.fontDisplay,marginBottom:6}}>Filtrar por mês (opcional)</div>
<input type="month" value={monthFilter} onChange={e=>setMonthFilter(e.target.value)} style={{width:"100%",border:1px solid ${T.border},borderRadius:T.radius,padding:"7px 10px",fontSize:11,background:T.bg,color:T.text}}/>
<div style={{fontSize:9,color:T.faint,marginTop:4}}>Se vazio, apaga todos os dados da fonte selecionada.</div>
</div>
<div style={{display:"flex",gap:8"}}>
<button onClick={handleClear} disabled={!Object.values(selected).some(Boolean)} style={{flex:1,background:Object.values(selected).some(Boolean)?T.bad:"#9ca3af",color:"#fff",border:"none",borderRadius:T.radius,padding:"10px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:T.fontDisplay}}>Apagar Selecionados</button>
<button onClick={onClose} style={{fontSize:12,color:T.muted,background:"none",border:1px solid ${T.border},borderRadius:T.radius,padding:"10px 16px",cursor:"pointer"}}>Cancelar</button>
</div>
</div>
</div>
);
}
/* ════════════════════════════════════════════════════════════
MAIN APP
════════════════════════════════════════════════════════════ */
export default function App(){
const[theme,setTheme]=useState(()=>lsGet("gwm_theme_v2",BASE_THEME));
const[showTheme,setShowTheme]=useState(false);
const[showClear,setShowClear]=useState(false);
const[tab,setTab]=useState("Consolidado");
const[metaCsv,setMetaCsv]=useState("");const[shopifyCsv,setShopifyCsv]=useState("");const[pinterestCsv,setPinterestCsv]=useState("");
const[dateFrom,setDateFrom]=useState("");const[dateTo,setDateTo]=useState("");
const[rate,setRate]=useState(lsGet("gwm_rate",5.85));
const[fee,setFee]=useState(lsGet("gwm_fee",6.8));
const[openAIKey,setOpenAIKey]=useState(()=>lsGet("gwm_oai_key",""));
const[creativeImages,setCreativeImages]=useState({});
const[loadingInit,setLoadingInit]=useState(true);
const T=theme;
// Load from Supabase on mount
useEffect(()=>{
const init=async()=>{
setLoadingInit(true);
const[stored,imgs]=await Promise.all([sbLoadAll(),sbLoadCreativeImages()]);
if(stored.meta)setMetaCsv(stored.meta);
if(stored.shopify)setShopifyCsv(stored.shopify);
if(stored.pinterest)setPinterestCsv(stored.pinterest);
setCreativeImages(imgs);
setLoadingInit(false);
};
init();
},[]);
// Persist rate/fee
useEffect(()=>{lsSet("gwm_rate",rate);},[rate]);
useEffect(()=>{lsSet("gwm_fee",fee);},[fee]);
useEffect(()=>{lsSet("gwm_oai_key",openAIKey);},[openAIKey]);
const handleMetaFile=useCallback(async(file)=>{
const text=await file.text();
const merged=mergeMetaCsv(metaCsv,text);
setMetaCsv(merged);
sbSave("meta",merged);
},[metaCsv]);
const handleShopifyFile=useCallback(async(file)=>{
const text=await file.text();
const merged=mergeShopifyCsv(shopifyCsv,text);
setShopifyCsv(merged);
sbSave("shopify",merged);
},[shopifyCsv]);
const handlePinterestFile=useCallback(async(file)=>{
const text=await file.text();
const merged=mergeShopifyCsv(pinterestCsv,text);
setPinterestCsv(merged);
sbSave("pinterest",merged);
},[pinterestCsv]);
const handleImageUpload=useCallback(async(adName,file)=>{
const result=await sbUploadCreative(adName,file);
if(result){setCreativeImages(prev=>({...prev,[result.key]:result.url,[adName.trim().slice(0,80)]:result.url}));}
},[]);
const handleClearData=useCallback(({meta,shopify,pinterest,monthFilter})=>{
if(meta){setMetaCsv("");sbDelete("meta");}
if(shopify){setShopifyCsv("");sbDelete("shopify");}
if(pinterest){setPinterestCsv("");sbDelete("pinterest");}
},[]);
const meta=useMemo(()=>metaCsv?parseMeta(metaCsv,dateFrom,dateTo):null,[metaCsv,dateFrom,dateTo]);
const shopify=useMemo(()=>shopifyCsv?parseShopify(shopifyCsv,dateFrom,dateTo):null,[shopifyCsv,dateFrom,dateTo]);
const pinterest=useMemo(()=>pinterestCsv?parsePinterest(pinterestCsv):null,[pinterestCsv]);
const TABS=["Consolidado","Meta Ads","Shopify","Pinterest","Financeiro","Leads","Campanha"];
const TAB_COLORS={"Consolidado":T.violet,"Meta Ads":T.meta,"Shopify":T.shopify,"Pinterest":T.pinterest,"Financeiro":T.good,"Leads":T.violet,"Campanha":T.meta};
const TAB_DOTS={"Meta Ads":!!meta,"Shopify":!!shopify,"Pinterest":!!pinterest};
return(
<ThemeCtx.Provider value={T}>
<GlobalStyles theme={T}/>
<div style={{minHeight:"100vh",background:T.bg,fontFamily:T.fontBody}}>
{/* HEADER /}
<div style={{background:T.card,borderBottom:1px solid ${T.border},padding:"0 24px",position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 8px rgba(0,0,0,0.05)"}}>
<div style={{maxWidth:1400,margin:"0 auto"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:10,paddingBottom:6,flexWrap:"wrap",gap:8}}>
<div style={{display:"flex",alignItems:"center",gap:16}}>
<div style={{fontFamily:T.fontDisplay,fontWeight:800,fontSize:15,color:T.text,letterSpacing:"-0.02em"}}>
gallery<span style={{color:T.violet}}>.</span>wall
<span style={{fontSize:9,color:T.faint,fontWeight:400,marginLeft:8,letterSpacing:"0.06em",textTransform:"uppercase"}}>PERFORMANCE DASHBOARD</span>
</div>
</div>
<div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
<div style={{display:"flex",alignItems:"center",gap:6,background:T.bg,border:1px solid ${T.border},borderRadius:T.radius,padding:"4px 10px"}}>
<span style={{fontSize:9,color:T.muted,fontFamily:T.fontDisplay,letterSpacing:"0.1em",textTransform:"uppercase"}}>US$1 =</span>
<span style={{fontSize:9,color:T.faint,fontFamily:T.fontDisplay}}>R$</span>
<input type="number" value={rate} step="0.05" min="1" onChange={e=>setRate(parseFloat(e.target.value)||5.85)} style={{width:52,border:"none",background:"transparent",fontSize:13,fontWeight:700,color:T.text,outline:"none",fontFamily:T.fontDisplay}}/>
</div>
{meta&&<span style={{fontSize:9,background:T.metaL,color:T.meta,padding:"3px 10px",borderRadius:20,fontWeight:700}}>Meta: {fmt(meta.rowCount)} linhas</span>}
{shopify&&<span style={{fontSize:9,background:T.shopifyL,color:T.shopify,padding:"3px 10px",borderRadius:20,fontWeight:700}}>Shopify: {shopify.totalOrders} pedidos</span>}
<button onClick={()=>setShowClear(true)} style={{fontSize:9,padding:"4px 10px",borderRadius:20,cursor:"pointer",border:1px solid ${T.border},background:"transparent",color:T.bad,fontFamily:T.fontDisplay,fontWeight:700}}>🗑</button>
<button onClick={()=>setShowTheme(s=>!s)} style={{fontSize:10,color:showTheme?T.violet:T.muted,background:"none",border:1px solid ${showTheme?T.violet:T.border},cursor:"pointer",padding:"4px 10px",borderRadius:20,fontFamily:T.fontDisplay,display:"flex",alignItems:"center",gap:4,fontWeight:600}}>🎨 Tema</button>
<SettingsPanel openAIKey={openAIKey} onSetKey={setOpenAIKey}/>
</div>
</div>
{/ NAV */}
<div style={{display:"flex",gap:2,paddingBottom:0,overflowX:"auto"}}>
{TABS.map(t=>{
const active=tab===t;const color=TAB_COLORS[t]||T.violet;const hasDot=TAB_DOTS[t];
return(
<button key={t} onClick={()=>setTab(t)} style={{background:"none",border:"none",padding:"8px 14px",cursor:"pointer",fontSize:11,fontWeight:active?700:500,color:active?color:T.muted,fontFamily:T.fontDisplay,letterSpacing:"0.04em",borderBottom:active?2.5px solid ${color}:"2.5px solid transparent",transition:"all 0.15s",whiteSpace:"nowrap",position:"relative"}}>
{t}
{hasDot&&<span style={{position:"absolute",top:6,right:6,width:5,height:5,borderRadius:"50%",background:color}}/>}
</button>
);
})}
</div>
</div>
</div>
    {/* TOOLBAR */}
    <div style={{background:T.bg,borderBottom:`1px solid ${T.border}`,padding:"8px 24px",position:"sticky",top:53,zIndex:90}}>
      <div style={{maxWidth:1400,margin:"0 auto",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <PeriodSelector dateFrom={dateFrom} dateTo={dateTo} onFrom={setDateFrom} onTo={setDateTo}/>
        <div style={{display:"flex",alignItems:"center",gap:6,background:T.card,border:`1px solid ${T.border}`,borderRadius:T.radius,padding:"5px 10px"}}>
          <span style={{fontSize:9,color:T.faint,fontFamily:T.fontDisplay,textTransform:"uppercase",letterSpacing:"0.1em"}}>Taxa Stripe</span>
          <input type="number" value={fee} step="0.1" min="0" max="20" onChange={e=>setFee(parseFloat(e.target.value)||0)} style={{width:38,border:"none",background:"transparent",fontSize:12,fontWeight:700,color:T.text,outline:"none",fontFamily:T.fontDisplay}}/>
          <span style={{fontSize:9,color:T.faint}}>%</span>
        </div>
      </div>
    </div>

    {/* MAIN */}
    <div style={{maxWidth:1400,margin:"0 auto",padding:"24px 24px"}}>
      {loadingInit&&<div style={{textAlign:"center",padding:"60px 0",color:T.faint,fontSize:13}}>Carregando dados...</div>}
      {!loadingInit&&(
        <div style={{animation:"slideIn 0.2s"}}>
          {tab==="Consolidado"&&<ConsolidatedTab meta={meta} shopify={shopify} pinterest={pinterest} rate={rate} fee={fee} openAIKey={openAIKey}/>}
          {tab==="Meta Ads"&&<MetaTab meta={meta} shopify={shopify} rate={rate} onFile={handleMetaFile} onClear={()=>{setMetaCsv("");sbDelete("meta");}} creativeImages={creativeImages} onImageUpload={handleImageUpload}/>}
          {tab==="Shopify"&&<ShopifyTab shopify={shopify} onFile={handleShopifyFile} onClear={()=>{setShopifyCsv("");sbDelete("shopify");}} productImages={creativeImages} onProductImageUpload={handleImageUpload}/>}
          {tab==="Pinterest"&&<PinterestTab pinterest={pinterest} shopify={shopify} rate={rate} onFile={handlePinterestFile} onClear={()=>{setPinterestCsv("");sbDelete("pinterest");}}/>}
          {tab==="Financeiro"&&<FinanceiroTab meta={meta} shopify={shopify} pinterest={pinterest} rate={rate}/>}
          {tab==="Leads"&&<LeadsTab/>}
          {tab==="Campanha"&&<CampanhaTab meta={meta} shopify={shopify} rate={rate}/>}
        </div>
      )}
    </div>
  </div>

  {showTheme&&<ThemeCustomizer theme={theme} setTheme={setTheme} onClose={()=>setShowTheme(false)}/>}
  {showClear&&<ClearDataModal onClose={()=>setShowClear(false)} onClear={handleClearData}/>}
</ThemeCtx.Provider>
);
}
