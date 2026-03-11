import { useState, useCallback, useMemo, useEffect } from "react";
import * as Papa from "papaparse";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, ReferenceLine
} from "recharts";
/* ─── SUPABASE ───────────────────────────────────────────── */
const SB_URL = "https://vcvtxaiksxdnczjiftap.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjdnR4YWlrc3hkbmN6amlmdGFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTQ5NDUsImV4cCI6MjA4ODgzMDk0NX0.L5q3VIZs2nbP75ssRUYsZSe5gRwBCg8q_vHFxeUVN4A";
const sbH = { "Content-Type":"application/json", "apikey":SB_KEY, "Authorization":`Bearer ${SB_KEY}` };
async function sbSave(type, content) {
  try {
    await fetch(`${SB_URL}/rest/v1/csv_files`, {
      method:"POST",
      headers:{ ...sbH, "Prefer":"resolution=merge-duplicates" },
      body:JSON.stringify({ type, content }),
    });
  } catch(e) { console.warn("sbSave error", e); }
}
async function sbLoadAll() {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/csv_files?select=type,content`, { headers: sbH });
    if (!res.ok) return {};
    const rows = await res.json();
    const out = {};
    for (const r of rows) out[r.type] = r.content;
    return out;
  } catch(e) { return {}; }
}


/* ─── SUPABASE STORAGE ───────────────────────────────────── */
async function sbUploadCreative(adName, file) {
  try {
    const ext = file.name.split('.').pop();
    const key = encodeURIComponent(adName.trim().slice(0,80)) + '.' + ext;
    const res = await fetch(`${SB_URL}/storage/v1/object/creatives/${key}`, {
      method: 'POST',
      headers: { ...sbH, 'x-upsert': 'true', 'Content-Type': file.type },
      body: file,
    });
    if (!res.ok) { const e=await res.text(); console.warn('upload err', e); return null; }
    return `${SB_URL}/storage/v1/object/public/creatives/${key}`;
  } catch(e) { console.warn('sbUploadCreative', e); return null; }
}

async function sbLoadCreativeImages(prefix="") {
  try {
    const res = await fetch(`${SB_URL}/storage/v1/object/list/creatives`, {
      method: 'POST',
      headers: { ...sbH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix, limit: 500 }),
    });
    if (!res.ok) return {};
    const files = await res.json();
    const map = {};
    for (const f of files) {
      if (!f.name) continue;
      const decoded = decodeURIComponent(f.name.replace(/\.[^.]+$/, ''));
      map[decoded] = `${SB_URL}/storage/v1/object/public/creatives/${f.name}`;
    }
    return map;
  } catch(e) { return {}; }
}

const LOGO_SRC = "data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCADIAyADASIAAhEBAxEB/8QAHQABAAIDAQEBAQAAAAAAAAAAAAgJBQYHBAMCAf/EAFkQAAEDAwIDAwUHDQ0GBgIDAAEAAgMEBQYHEQgSIRMxQSJRYXGyFDI2N3SBkQkVFhgjQlJicnWCobQzOFVWdpKUlaKxs8TTJENTg8HSFyZzk8LRJzSj4fD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AmWiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiL4XCto7dRS1twq4KSlhbzSzTyBjGDzlx6AIPuij5qXxWYLjj30eMQTZRWtOxfC7saVp/9Qgl36LSD513DErzFkWKWjIIIXwQ3OhhrI43kFzGyxteGnbpuA7ZBk0REBFjcjv8AZMbtj7nf7rR2yjZ3zVMwjbv5hv3n0DqVwXIuLTDoMnobRjdnrr3Ty1TIZ61zvc7A1zti6NrhzPPX74MQSMREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEXnuNdRW2ilrrjWU9HSwt5pJ55BHGwecuPQBcH1D4rdP8dqfcdggqsnqGvAkfTHsqdo367SOHlHbu5WkHzoJAIvjQ1DKuigq4w5rJo2yNDu8Bw3G/0r7ICItcznOsRwig92ZTfqK2MI3YyR+8sn5EY3c75gUGxouKaYcROO6hamjD7HZLgymfTySxV9Q9redzBuR2Y3IaRvsd9+7oF2tAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREEf+JzXu8aZXWLH7JjQmq6inEzLjWc3ucbkjlY0bc7ht18obdOhUNM+1BzLO633TlN/q7hs7mjhc7lhj/Jjbs1vrA386stz/E7Nm+KVuOX2ljnpaqMtDi0F0L9vJkYfBzT1B/6KrO7UU1sutXbqkATUs74JAPwmuLT+sIPMrRtFvicwn+T1B+zxqrlWjaLfE5hP8nqD9njQbaopcRHErlOLZRcsPxnH22uopHmM3GvYXvkHg+KMgN5T4OdzA+ZStXLeKDBbZmukl5fUUkbrlaqSWuoKgNHaRvjbzlgPmeGlpHd1B7wCAr1yvJ8hyu5uuWSXmtulUd9pKmUu5R5mjuaPQAAvhjXwjtnyuL2wseshjXwjtnyuL2wgtjREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAWt6mT5fTYTcJsEo6GsyBrR7lhqztG7yhzeIHNy77bkDfbdbIiCr3VPLdQMiyGpps+udylrqSUsfR1P3NlO8d4bENmt+YdfStOUmPqglipqLUCxX+CJsclzoHxTkD374XABx9PLI0epoUZ0FsmN/B22/JIvYC968GN/B22/JIvYC96DgfFxkesGN2dtbgkMcOPMpua419NGH1cD+Z2/Q78sfL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MaBsGgDoAB4L6oiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgL51VPBV00tLVQxzwTMLJIpGhzXtI2IIPQgjwX0RBGXVThJsF5qprlg10Fhnfu40NQwyUpd+K4eVGPR5Q8wC4Xf+GTWC1SOEOP090jB27SirY3A/ovLXfqVhyIK14dBNX5X8rcFuQO+3lvjaPpLgtosHCrq1cpGitobXZmHvdV1zX7D1Rc/VWAIgi3hHB3YaSSOozDJqu5kdTTUMYgj9ReeZzh6g0qQmE4TieFUHuLFrDRWuIgB7oY/ukm34bzu5/wCkStgRAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREH//2Q==";

async function sbLoadExpenses() {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/expenses?select=*&order=date.desc`, { headers: sbH });
    if (!res.ok) return [];
    return await res.json();
  } catch(e) { return []; }
}
async function sbAddExpense(exp) {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/expenses`, {
      method: "POST",
      headers: { ...sbH, "Prefer": "return=representation" },
      body: JSON.stringify(exp),
    });
    if (!res.ok) { console.warn(await res.text()); return null; }
    const rows = await res.json();
    return rows[0];
  } catch(e) { return null; }
}
async function sbDeleteExpense(id) {
  try {
    await fetch(`${SB_URL}/rest/v1/expenses?id=eq.${id}`, {
      method: "DELETE", headers: sbH,
    });
  } catch(e) {}
}
async function sbUpdateExpense(id, patch) {
  try {
    await fetch(`${SB_URL}/rest/v1/expenses?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...sbH, "Prefer": "return=representation" },
      body: JSON.stringify(patch),
    });
  } catch(e) {}
}

async function sbLoadLeads(){
  try{
    const res=await fetch(`${SB_URL}/rest/v1/leads?select=*&order=date.desc`,{headers:sbH});
    if(!res.ok)return[];
    return await res.json();
  }catch{return[];}
}
async function sbAddLead(lead){
  try{
    const res=await fetch(`${SB_URL}/rest/v1/leads`,{
      method:"POST",headers:{...sbH,"Prefer":"return=representation"},
      body:JSON.stringify(lead),
    });
    if(!res.ok){console.warn(await res.text());return null;}
    const rows=await res.json(); return rows[0];
  }catch{return null;}
}
async function sbDeleteLead(id){
  try{ await fetch(`${SB_URL}/rest/v1/leads?id=eq.${id}`,{method:"DELETE",headers:sbH}); }catch{}
}
async function sbUpdateLead(id,patch){
  try{ await fetch(`${SB_URL}/rest/v1/leads?id=eq.${id}`,{
    method:"PATCH",headers:{...sbH,"Prefer":"return=representation"},body:JSON.stringify(patch),
  }); }catch{}
}

/* ─── CSV MERGE ──────────────────────────────────────────── */
function mergeMetaCsv(existing, incoming){
  // Parse both, deduplicate by date+ad+country key, return merged CSV
  const parseRows=(text)=>{
    const{data,meta:m}=Papa.parse(text,{header:true,skipEmptyLines:true});
    return{rows:data,fields:m.fields||[]};
  };
  try{
    const {rows:oldRows,fields}=parseRows(existing||"");
    const {rows:newRows}=parseRows(incoming);
    const allFields=[...new Set([...fields,...(Papa.parse(incoming,{header:true,skipEmptyLines:true}).meta.fields||[])])];
    const map={};
    const key=r=>{
      const d=r["Início dos relatórios"]||r["Reporting starts"]||r["Date"]||"";
      const n=r["Nome do anúncio"]||r["Ad name"]||r["Anúncio"]||"";
      const co=r["País"]||r["Country"]||"";
      return d+"__"+n+"__"+co;
    };
    for(const r of oldRows) map[key(r)]=r;
    for(const r of newRows) map[key(r)]=r; // newer overwrites older for same key
    const merged=Object.values(map);
    return Papa.unparse(merged,{columns:allFields});
  }catch(e){ return incoming; } // fallback: just use new
}

function mergeShopifyCsv(existing, incoming){
  try{
    const parse=(t)=>Papa.parse(t,{header:true,skipEmptyLines:true});
    const {data:oldRows,meta:om}=parse(existing||"");
    const {data:newRows,meta:nm}=parse(incoming);
    const allFields=[...new Set([...(om.fields||[]),...(nm.fields||[])])];
    const map={};
    for(const r of oldRows) if(r["Name"])map[r["Name"]]=r;
    for(const r of newRows) if(r["Name"])map[r["Name"]]=r;
    return Papa.unparse(Object.values(map),{columns:allFields});
  }catch(e){ return incoming; }
}


/* ─── SESSION PERSISTENCE ────────────────────────────────── */
const LS_KEY = "gwm_session_v2";
function lsGet(key, def){
  try{ const v=localStorage.getItem(key); return v!=null?JSON.parse(v):def; }
  catch{ return def; }
}
function lsSet(key, val){
  try{ localStorage.setItem(key, JSON.stringify(val)); }catch{}
}


/* ─── COUNTRY DATA ───────────────────────────────────────── */
const CDATA={
  GB:{flag:"🇬🇧",name:"Reino Unido",   aliases:["United Kingdom","UK","England"]},
  DE:{flag:"🇩🇪",name:"Alemanha",      aliases:["Germany"]},
  ES:{flag:"🇪🇸",name:"Espanha",       aliases:["Spain"]},
  FR:{flag:"🇫🇷",name:"França",        aliases:["France"]},
  NL:{flag:"🇳🇱",name:"Holanda",       aliases:["Netherlands","Holland"]},
  US:{flag:"🇺🇸",name:"EUA",           aliases:["United States","USA"]},
  IE:{flag:"🇮🇪",name:"Irlanda",       aliases:["Ireland"]},
  IT:{flag:"🇮🇹",name:"Itália",        aliases:["Italy"]},
  PT:{flag:"🇵🇹",name:"Portugal",      aliases:["Portugal"]},
  AU:{flag:"🇦🇺",name:"Austrália",     aliases:["Australia"]},
  CA:{flag:"🇨🇦",name:"Canadá",        aliases:["Canada"]},
  BR:{flag:"🇧🇷",name:"Brasil",        aliases:["Brazil"]},
  RO:{flag:"🇷🇴",name:"Romênia",       aliases:["Romania"]},
  PL:{flag:"🇵🇱",name:"Polônia",       aliases:["Poland"]},
  SE:{flag:"🇸🇪",name:"Suécia",        aliases:["Sweden"]},
  NO:{flag:"🇳🇴",name:"Noruega",       aliases:["Norway"]},
  DK:{flag:"🇩🇰",name:"Dinamarca",     aliases:["Denmark"]},
  CH:{flag:"🇨🇭",name:"Suíça",         aliases:["Switzerland"]},
  AT:{flag:"🇦🇹",name:"Áustria",       aliases:["Austria"]},
  BE:{flag:"🇧🇪",name:"Bélgica",       aliases:["Belgium"]},
  MX:{flag:"🇲🇽",name:"México",        aliases:["Mexico"]},
  AR:{flag:"🇦🇷",name:"Argentina",     aliases:["Argentina"]},
  ZA:{flag:"🇿🇦",name:"África do Sul", aliases:["South Africa"]},
  SG:{flag:"🇸🇬",name:"Singapura",     aliases:["Singapore"]},
  IN:{flag:"🇮🇳",name:"Índia",         aliases:["India"]},
  JP:{flag:"🇯🇵",name:"Japão",         aliases:["Japan"]},
  NZ:{flag:"🇳🇿",name:"Nova Zelândia", aliases:["New Zealand"]},
};

// Build reverse map: full name → ISO code
const COUNTRY_NAME_TO_CODE={};
for(const[code,d] of Object.entries(CDATA)){
  COUNTRY_NAME_TO_CODE[code]=code; // code → code
  for(const a of d.aliases) COUNTRY_NAME_TO_CODE[a.toLowerCase()]=code;
  COUNTRY_NAME_TO_CODE[d.name.toLowerCase()]=code;
}

function normalizeCountry(raw){
  if(!raw||raw==="—")return"—";
  const up=raw.trim().toUpperCase();
  if(CDATA[up])return up; // already ISO
  const lo=raw.trim().toLowerCase();
  return COUNTRY_NAME_TO_CODE[lo]||raw.trim().toUpperCase();
}

function fmtCountry(code,mode="full"){
  const d=CDATA[code];
  if(!d)return code||"—";
  if(mode==="flag")return d.flag+" "+code;
  return d.flag+" "+d.name+" ("+code+")";
}


/* ─── TOKENS ─────────────────────────────────────────────── */
const T = {
  bg:"#f5f2ee", card:"#ffffff", border:"#e8e2da",
  text:"#1a1714", muted:"#8a7f74", faint:"#c8bfb4",
  meta:"#2563eb", metaL:"#dbeafe",
  shopify:"#008060", shopifyL:"#d1fae5",
  pinterest:"#e60023", pinterestL:"#fee2e5",
  violet:"#7c3aed", violetL:"#ede9fe",
  warn:"#d97706", warnL:"#fef3c7",
  good:"#16a34a", bad:"#dc2626",
};

const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Instrument+Sans:wght@400;500;600&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{background:${T.bg};font-family:'Instrument Sans',sans-serif;color:${T.text}}
    ::-webkit-scrollbar{width:5px;height:5px}
    ::-webkit-scrollbar-thumb{background:#d6cfc5;border-radius:10px}
    input,select,textarea{font-family:inherit}
    tbody tr:hover td{background:#faf8f5!important}
  `}</style>
);

/* ─── COL ALIASES ────────────────────────────────────────── */
const COL = {
  adName:      ["nome do anúncio","ad name","anúncio"],
  campaign:    ["nome da campanha","campaign name","campaign"],
  adset:       ["nome do conjunto de anúncios","ad set name","conjunto de anúncios"],
  country:     ["país","country"],
  date:        ["início dos relatórios","reporting starts","date","start","dia"],
  reach:       ["alcance","reach"],
  impressions: ["impressões","impressions","impressao"],
  frequency:   ["frequência","frequencia","frequency"],
  lpv:         ["visualizações da página de destino do site","visualizações da página de destino","landing page views","vis. pág. de destino"],
  addCart:     ["adições ao carrinho","add to cart","adição ao carrinho"],
  checkout:    ["finalizações de compra iniciadas","finalizações de compra no site","finalizações de compra","checkouts iniciados","checkouts","initiate checkout","finalização de compra"],
  purchases:   ["compras","purchases","resultados"],
  spend:       ["valor usado (brl)","valor usado","amount spent (brl)","amount spent","quantia gasta"],
  clicks:      ["cliques no link","link clicks","cliques","clicks"],
  cpcMeta:     ["cpc (custo por clique no link)","cpc (cost per link click)","cpc (all)","custo por clique no link","cpc"],
  saves:       ["saves","pin saves"],
};

function normalizeStr(s){
  if(!s)return"";
  return s.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,""); // remove accents
}
function findCol(headers, aliases) {
  const h = headers.map(x => normalizeStr(x));
  const normAliases = aliases.map(normalizeStr);
  for (const a of normAliases) {
    const i = h.findIndex(x => x === a || x?.includes(a));
    if (i !== -1) return headers[i];
  }
  return null;
}
function getNum(row, aliases) {
  const col = findCol(Object.keys(row), aliases);
  if (!col) return 0;
  const n = parseFloat(String(row[col]||"0").replace(",",".").replace(/[^\d.-]/g,""));
  return isNaN(n) ? 0 : n;
}
function getStr(row, aliases) {
  const col = findCol(Object.keys(row), aliases);
  return col ? (row[col]||"—") : "—";
}

/* ─── OBJECTIVE DETECTION ───────────────────────────────── */
function detectObjective(campaignName) {
  const n = (campaignName||"").toLowerCase();
  if(/venda|sales|compra|purchase|convers|checkout/.test(n)) return "Vendas";
  if(/tráfeg|trafeg|traffic|clique|link click|vis.*pág|landing/.test(n)) return "Tráfego";
  if(/reconhec|awareness|alcance|reach|brand/.test(n)) return "Reconhecimento";
  if(/engaj|engag|interact/.test(n)) return "Engajamento";
  if(/lead/.test(n)) return "Leads";
  return "Outro";
}

/* ─── FORMATTERS ─────────────────────────────────────────── */
const fmt    = (n,d=0) => n==null||isNaN(n) ? "—" : Number(n).toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtR   = (n) => !n||isNaN(n) ? "—" : "R$\u00a0"+Number(n).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtUSD = (n) => n==null||isNaN(n)||n===0 ? "—" : "$\u00a0"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtPct = (n) => n==null||isNaN(n) ? "—" : Number(n).toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})+"%";
const fmtX   = (n) => !n||isNaN(n)||n===0 ? "—" : Number(n).toFixed(2)+"×";
const fmtDate= (s) => { if(!s)return"—"; try{ const d=new Date(s+"T12:00:00"); return d.toLocaleDateString("pt-BR",{day:"2-digit",month:"short"}); }catch{ return s; } };

/* ─── PARSERS ────────────────────────────────────────────── */
function parseMeta(text, dateFrom, dateTo) {
  const { data } = Papa.parse(text, { header:true, skipEmptyLines:true });
  const rows = data.filter(r => {
    const d = getStr(r, COL.date).slice(0,10);
    if (dateFrom && d !== "—" && d < dateFrom) return false;
    if (dateTo   && d !== "—" && d > dateTo)   return false;
    return true;
  });

  const totals = { reach:0,impressions:0,frequency:0,lpv:0,addCart:0,checkout:0,purchases:0,spend:0,clicks:0 };
  const byCreative={}, byCountry={}, byCampaign={}, byDay={}, byMonth={}, byObjective={}, byCampaignMonth={};
  let freqCount=0; // rows with frequency data for averaging

  for (const r of rows) {
    const reach=getNum(r,COL.reach), impressions=getNum(r,COL.impressions);
    const freq=getNum(r,COL.frequency);
    const lpv=getNum(r,COL.lpv), addCart=getNum(r,COL.addCart);
    const checkout=getNum(r,COL.checkout), purchases=getNum(r,COL.purchases);
    const spend=getNum(r,COL.spend), clicks=getNum(r,COL.clicks);
    const cpcDirect=getNum(r,COL.cpcMeta); // CPC direto do Meta (mais confiável)
    const adName=getStr(r,COL.adName), campaign=getStr(r,COL.campaign);
    const adset=getStr(r,COL.adset), country=normalizeCountry(getStr(r,COL.country));
    const dateStr=getStr(r,COL.date).slice(0,10);
    const monthStr=dateStr.slice(0,7); // "2026-02"

    totals.reach+=reach; totals.impressions+=impressions; totals.lpv+=lpv;
    totals.addCart+=addCart; totals.checkout+=checkout;
    totals.purchases+=purchases; totals.spend+=spend; totals.clicks+=clicks;
    if(freq>0){ totals.frequency+=freq; freqCount++; }

    const add=(map,key,init)=>{
      if(!key||key==="—")return;
      if(!map[key])map[key]=init();
      const m=map[key];
      m.reach=(m.reach||0)+reach; m.impressions=(m.impressions||0)+impressions;
      m.lpv=(m.lpv||0)+lpv; m.addCart=(m.addCart||0)+addCart;
      m.checkout=(m.checkout||0)+checkout; m.purchases=(m.purchases||0)+purchases;
      m.spend=(m.spend||0)+spend; m.clicks=(m.clicks||0)+clicks;
      // frequency: weighted avg by impressions
      if(freq>0&&impressions>0){
        m._freqImprSum=(m._freqImprSum||0)+freq*impressions;
        m._freqImprTotal=(m._freqImprTotal||0)+impressions;
      }
      // CPC: take best non-zero value seen
      if(cpcDirect>0) m._cpcSum=(m._cpcSum||0)+cpcDirect, m._cpcCount=(m._cpcCount||0)+1;
    };
    add(byCreative, adName,   ()=>({campaign,adset,reach:0,impressions:0,lpv:0,addCart:0,checkout:0,purchases:0,spend:0,clicks:0}));
    add(byCampaign, campaign, ()=>({reach:0,impressions:0,lpv:0,addCart:0,checkout:0,purchases:0,spend:0,clicks:0,dates:[]}));
    if(campaign!=="—"&&dateStr&&dateStr!=="—"){
      if(!byCampaign[campaign].dates.includes(dateStr)) byCampaign[campaign].dates.push(dateStr);
    }
    // Campaign × Month
    if(campaign!=="—"&&monthStr&&monthStr.length===7){
      const cmKey=campaign+"||"+monthStr;
      if(!byCampaignMonth[cmKey])byCampaignMonth[cmKey]={campaign,month:monthStr,spend:0,purchases:0,impressions:0,lpv:0,clicks:0,addCart:0};
      byCampaignMonth[cmKey].spend+=spend; byCampaignMonth[cmKey].purchases+=purchases;
      byCampaignMonth[cmKey].impressions+=impressions; byCampaignMonth[cmKey].lpv+=lpv;
      byCampaignMonth[cmKey].clicks+=clicks; byCampaignMonth[cmKey].addCart+=addCart;
    }
    const obj=detectObjective(campaign);
    add(byObjective, obj, ()=>({reach:0,impressions:0,lpv:0,addCart:0,checkout:0,purchases:0,spend:0,clicks:0,campaigns:new Set()}));
    if(byObjective[obj]&&campaign!=="—") byObjective[obj].campaigns.add(campaign);

    if(country!=="—"){
      if(!byCountry[country])byCountry[country]={purchases:0,spend:0,impressions:0,lpv:0,addCart:0,checkout:0,clicks:0};
      byCountry[country].purchases+=purchases; byCountry[country].spend+=spend;
      byCountry[country].impressions+=impressions; byCountry[country].lpv+=lpv;
      byCountry[country].addCart+=addCart; byCountry[country].checkout+=checkout;
      byCountry[country].clicks+=clicks;
    }
    if(dateStr&&dateStr!=="—"){
      if(!byDay[dateStr])byDay[dateStr]={spend:0,purchases:0,impressions:0,lpv:0};
      byDay[dateStr].spend+=spend; byDay[dateStr].purchases+=purchases;
      byDay[dateStr].impressions+=impressions; byDay[dateStr].lpv+=lpv;
    }
    if(monthStr&&monthStr!=="—"&&monthStr.length===7){
      if(!byMonth[monthStr])byMonth[monthStr]={spend:0,purchases:0,impressions:0,lpv:0,addCart:0,checkout:0,clicks:0,reach:0};
      byMonth[monthStr].spend+=spend; byMonth[monthStr].purchases+=purchases;
      byMonth[monthStr].impressions+=impressions; byMonth[monthStr].lpv+=lpv;
      byMonth[monthStr].addCart+=addCart; byMonth[monthStr].checkout+=checkout;
      byMonth[monthStr].clicks+=clicks; byMonth[monthStr].reach+=reach;
    }
  }
  totals.costLpv=totals.lpv>0?totals.spend/totals.lpv:0;
  totals.cpa=totals.purchases>0?totals.spend/totals.purchases:0;
  totals.cvr=totals.lpv>0?(totals.purchases/totals.lpv)*100:0;
  totals.cpm=totals.impressions>0?(totals.spend/totals.impressions)*1000:0;
  totals.cpc=totals.clicks>0?totals.spend/totals.clicks:0;
  totals.ctr=totals.impressions>0?(totals.clicks/totals.impressions)*100:0;
  totals.freqAvg=freqCount>0?totals.frequency/freqCount:0;
  totals.hasCheckout=totals.checkout>0;
  // Convert campaigns Sets to arrays for serialization
  for(const obj of Object.values(byObjective)) obj.campaigns=[...obj.campaigns];
  return { totals, byCreative, byCountry, byCampaign, byCampaignMonth, byDay, byMonth, byObjective, rowCount:rows.length };
}

function parseShopify(text, dateFrom, dateTo) {
  const { data } = Papa.parse(text, { header:true, skipEmptyLines:true });
  const orders={};
  for (const r of data) {
    const name=r["Name"]||""; if(!name)continue;
    const created=(r["Created at"]||"").slice(0,10);
    if(dateFrom && created && created < dateFrom) continue;
    if(dateTo   && created && created > dateTo)   continue;
    if(!orders[name]){
      orders[name]={
        date:created,
        country:normalizeCountry(r["Billing Country"]||r["Shipping Country"]||"—"),
        total:parseFloat(r["Total"]||"0")||0,
        status:r["Financial Status"]||"",
        items:[],
      };
    }
    if(r["Lineitem name"]){
      orders[name].items.push({name:r["Lineitem name"],sku:r["Lineitem sku"]||r["SKU"]||"",qty:parseInt(r["Lineitem quantity"]||"1")||1,price:parseFloat(r["Lineitem price"]||"0")||0});
    }
  }

  let totalOrders=0,totalRevenue=0;
  const byCountry={},byDay={},byProduct={},byMonth={};

  for(const o of Object.values(orders)){
    // Count ALL fulfilled orders (including $0 / 100% coupon / free downloads)
    totalOrders++;
    totalRevenue+=o.total; // $0 orders add 0 to revenue — correct
    if(!byCountry[o.country])byCountry[o.country]={orders:0,revenue:0};
    byCountry[o.country].orders++; byCountry[o.country].revenue+=o.total;
    if(o.date){
      if(!byDay[o.date])byDay[o.date]={orders:0,revenue:0};
      byDay[o.date].orders++; byDay[o.date].revenue+=o.total;
      const m=o.date.slice(0,7);
      if(!byMonth[m])byMonth[m]={orders:0,revenue:0};
      byMonth[m].orders++; byMonth[m].revenue+=o.total;
    }
    for(const item of o.items){
      const key=item.name;
      if(!byProduct[key])byProduct[key]={orders:0,qty:0,revenue:0,skus:new Set()};
      byProduct[key].orders++; byProduct[key].qty+=item.qty; byProduct[key].revenue+=item.price*item.qty;
      if(item.sku) byProduct[key].skus.add(item.sku);
    }
  }
  // Convert sku Sets to arrays
  for(const p of Object.values(byProduct)) p.skus=[...p.skus];
  return { totalOrders, totalRevenue, byCountry, byDay, byMonth, byProduct,
    avgTicket:totalOrders>0?totalRevenue/totalOrders:0 };
}

// Pinterest country name → ISO code mapping
const PINTEREST_COUNTRY_MAP={
  "United States":"US","U.S.":"US","USA":"US",
  "United Kingdom":"GB","UK":"GB",
  "Germany":"DE","Spain":"ES","France":"FR",
  "Netherlands":"NL","Ireland":"IE","Italy":"IT",
  "Portugal":"PT","Romania":"RO","Poland":"PL",
  "Sweden":"SE","Norway":"NO","Denmark":"DK",
  "Switzerland":"CH","Austria":"AT","Belgium":"BE",
  "Canada":"CA","Australia":"AU","Brazil":"BR",
  "Mexico":"MX","Argentina":"AR","South Africa":"ZA","SA":"ZA",
  "Saudi Arabia":"SA","Singapore":"SG","India":"IN",
  "Japan":"JP","New Zealand":"NZ",
};
function normalizePinterestCountry(raw){
  if(!raw)return"—";
  const up=raw.trim().toUpperCase();
  if(CDATA[up])return up;
  return PINTEREST_COUNTRY_MAP[raw.trim()]||raw.trim().toUpperCase().slice(0,2);
}

function parsePinterest(text){
  const{data}=Papa.parse(text,{header:true,skipEmptyLines:true});
  const totals={impressions:0,clicks:0,saves:0,spend:0,conversions:0};
  const byPin={}, byCountry={};
  for(const r of data){
    const impr=getNum(r,["impressions","impressões"]);
    const clicks=getNum(r,["link clicks","pin clicks","clicks","cliques","outbound clicks"]);
    const saves=getNum(r,COL.saves);
    const spend=getNum(r,["spend","gasto","amount spent","valor usado"]);
    const conv=getNum(r,["total conversions (checkout)","total conversions (purchase)","checkouts","conversions","purchases","compras"]);
    const name=getStr(r,["ad name","pin name","nome do anúncio","name"]);
    // Country from "Targeting Value" col (country-level report) or "Country" col
    const rawCountry=r["Targeting Value"]||r["Country"]||r["País"]||"";
    const country=normalizePinterestCountry(rawCountry);
    if(country!=="—"&&country.length===2){
      if(!byCountry[country])byCountry[country]={impressions:0,clicks:0,spend:0,conversions:0};
      byCountry[country].impressions+=impr;
      byCountry[country].clicks+=clicks;
      byCountry[country].spend+=spend;
      byCountry[country].conversions+=conv;
    }
    totals.impressions+=impr;totals.clicks+=clicks;totals.saves+=saves;
    totals.spend+=spend;totals.conversions+=conv;
    if(name!=="—"){
      if(!byPin[name])byPin[name]={impressions:0,clicks:0,saves:0,spend:0,conversions:0};
      byPin[name].impressions+=impr;byPin[name].clicks+=clicks;
      byPin[name].saves+=saves;byPin[name].spend+=spend;byPin[name].conversions+=conv;
    }
  }
  totals.ctr=totals.impressions>0?(totals.clicks/totals.impressions)*100:0;
  totals.cpa=totals.conversions>0?totals.spend/totals.conversions:0;
  return{totals,byPin,byCountry};
}

/* ─── DAILY CHART DATA ───────────────────────────────────── */
function buildDailyData(metaByDay, shopifyByDay, rate){
  const all=new Set([...Object.keys(metaByDay||{}),...Object.keys(shopifyByDay||{})]);
  return Array.from(all).sort().map(d=>{
    const m=metaByDay?.[d]||{};
    const s=shopifyByDay?.[d]||{};
    const spend=m.spend||0;
    const revBRL=(s.revenue||0)*rate;
    const roas=spend>0?parseFloat((revBRL/spend).toFixed(2)):null;
    return{
      date:d, label:fmtDate(d),
      spend:spend?parseFloat(spend.toFixed(2)):null,
      revBRL:revBRL?parseFloat(revBRL.toFixed(2)):null,
      roas, orders:s.orders||0, purchases:m.purchases||0,
    };
  });
}

/* ─── SUGGESTIONS ────────────────────────────────────────── */
function buildSuggestions(meta, shopify, rate){
  const out=[];
  if(!meta)return out;
  const t=meta.totals;
  const roasG=t.spend>0&&shopify?(shopify.totalRevenue*rate)/t.spend:0;

  // ROAS global
  if(roasG>0){
    if(roasG>=4)      out.push({type:"good",  title:`ROAS ${fmtX(roasG)} — excelente`,      msg:`Receita ${fmtR(shopify.totalRevenue*rate)} vs gasto ${fmtR(t.spend)}. Escale gradualmente +20-30%/semana mantendo ROAS acima de 3×.`});
    else if(roasG>=2) out.push({type:"good",  title:`ROAS ${fmtX(roasG)} — campanha saudável`,msg:`Receita ${fmtR(shopify.totalRevenue*rate)} vs gasto ${fmtR(t.spend)}. Margem confortável para testar novos criativos.`});
    else if(roasG>=1) out.push({type:"warn",  title:`ROAS ${fmtX(roasG)} — positivo mas apertado`,msg:`Receita ${fmtR(shopify.totalRevenue*rate)} vs gasto ${fmtR(t.spend)}. Foco em CVR ou aumentar ticket médio antes de escalar.`});
    else              out.push({type:"bad",   title:`ROAS ${fmtX(roasG)} — abaixo do breakeven`,msg:`Receita ${fmtR(shopify.totalRevenue*rate)} vs gasto ${fmtR(t.spend)}. Pausar e revisar criativos + segmentação.`});
  }

  // CPM alert
  if(t.cpm>0){
    if(t.cpm>80) out.push({type:"warn",title:`CPM alto: ${fmtR(t.cpm)}`,msg:`Custo por mil impressões acima de R$80. Público muito concorrido ou segmentação estreita. Considere expandir países ou faixas de idade.`});
    else if(t.cpm<20) out.push({type:"good",title:`CPM eficiente: ${fmtR(t.cpm)}`,msg:`Boa eficiência de entrega. CTR ${fmtPct(t.ctr)} — se baixo, o problema está no criativo, não no público.`});
  }

  // CTR
  if(t.ctr>0&&t.ctr<0.5)
    out.push({type:"warn",title:`CTR baixo: ${fmtPct(t.ctr)}`,msg:`Menos de 0.5% dos usuários clicam. Testar novos hooks visuais, diferentes formatos (vídeo vs imagem) ou CTAs mais diretos.`});

  // CVR LPV→Compra
  if(t.lpv>0&&t.purchases>0){
    const cvr=(t.purchases/t.lpv)*100;
    if(cvr<1) out.push({type:"warn",title:`CVR LPV→Compra: ${fmtPct(cvr)}`,msg:`Só ${fmtPct(cvr)} das visitas viram compra. Revisar landing page, preço, frete ou fricção no checkout.`});
    else if(cvr>5) out.push({type:"good",title:`CVR forte: ${fmtPct(cvr)} LPV→Compra`,msg:`Produto e página convertendo bem. Foco em aumentar volume de tráfego qualificado.`});
  }

  // Abandono de checkout
  if(t.checkout>0&&t.purchases>0){
    const cvr=(t.purchases/t.checkout)*100;
    if(cvr<40) out.push({type:"warn",title:`${fmtPct(100-cvr)} de abandono no checkout`,msg:`Apenas ${fmtPct(cvr)} dos checkouts viram compra. Causas comuns: frete, método de pagamento, processo longo.`});
  }

  // Criativos
  const creatives=Object.entries(meta.byCreative)
    .map(([n,d])=>({name:n,...d,cpa:d.purchases>0?d.spend/d.purchases:9999}))
    .filter(c=>c.spend>5);
  if(creatives.length>1){
    const best=[...creatives].sort((a,b)=>a.cpa-b.cpa)[0];
    const worst=[...creatives].sort((a,b)=>b.cpa-a.cpa)[0];
    const bestShort=best.name.split("|")[0].trim().slice(0,45);
    const worstShort=worst.name.split("|")[0].trim().slice(0,45);
    if(best.purchases>0)
      out.push({type:"good",title:`Vencedor: ${bestShort}`,msg:`CPA ${fmtR(best.cpa)} · ${fmt(best.purchases)} compras · gasto ${fmtR(best.spend)}. Teste variações — ângulos diferentes, thumbnails, textos.`});
    if(worst.purchases===0&&worst.spend>20)
      out.push({type:"action",title:`Pausar: ${worstShort}`,msg:`${fmtR(worst.spend)} gastos sem nenhuma compra. Realoque budget para o criativo vencedor.`});
  }

  // Países
  const countries=Object.entries(meta.byCountry)
    .filter(([,d])=>d.spend>5)
    .map(([c,d])=>({
      c,...d,
      sOrders:shopify?.byCountry[c]?.orders||0,
      sRev:shopify?.byCountry[c]?.revenue||0,
      roas:d.spend>0&&shopify?.byCountry[c]?.revenue?(shopify.byCountry[c].revenue*rate)/d.spend:0,
    }));
  if(countries.length){
    const bestC=countries.filter(x=>x.roas>0).sort((a,b)=>b.roas-a.roas)[0];
    const worstC=countries.filter(x=>x.sOrders===0&&x.spend>20).sort((a,b)=>b.spend-a.spend)[0];
    const organicC=countries.filter(x=>x.sOrders>x.purchases).sort((a,b)=>(b.sOrders-b.purchases)-(a.sOrders-a.purchases))[0];
    if(bestC?.roas>2)
      out.push({type:"action",title:`Escalar: ${bestC.c} (ROAS ${fmtX(bestC.roas)})`,msg:`${bestC.sOrders} pedidos Shopify · gasto ${fmtR(bestC.spend)}. Melhor país — aumentar orçamento ou criar conjunto dedicado.`});
    if(worstC)
      out.push({type:"warn",title:`Revisar ${worstC.c}`,msg:`${fmtR(worstC.spend)} gastos, 0 pedidos Shopify. Pode ser delay de atribuição (aguardar 7 dias) ou público errado.`});
    if(organicC&&organicC.sOrders-organicC.purchases>=2)
      out.push({type:"good",title:`${organicC.c} tem tráfego orgânico forte`,msg:`${organicC.sOrders} pedidos Shopify vs ${organicC.purchases} atribuídos ao Meta. ${organicC.sOrders-organicC.purchases} vendas orgânicas/Pinterest/direto.`});
  }

  // Orgânico geral
  if(shopify&&meta){
    const totalOrganic=Math.max(0,shopify.totalOrders-t.purchases);
    const organicPct=shopify.totalOrders>0?(totalOrganic/shopify.totalOrders)*100:0;
    if(organicPct>30)
      out.push({type:"good",title:`${fmtPct(organicPct)} das vendas são orgânicas`,msg:`${totalOrganic} de ${shopify.totalOrders} pedidos sem atribuição Meta. Forte presença orgânica — considere investir em SEO/Pinterest.`});
  }

  // Pinterest
  if(pinterest){
    const ptotal=pinterest.totals;
    if(ptotal.spend>0&&ptotal.impressions>0){
      const cpm=ptotal.impressions>0?(ptotal.spend/ptotal.impressions)*1000:0;
      out.push({type:"good",title:`Pinterest ativo: ${fmt(ptotal.impressions)} impressões`,msg:`Gasto $${ptotal.spend.toFixed(2)} · CPM $${cpm.toFixed(2)} · ${fmt(ptotal.clicks)} cliques. Sem vendas atribuídas ainda — canal de topo de funil e brand awareness. Monitore tráfego orgânico via Shopify vs Meta Δ.`});
    }
    if(ptotal.spend>0&&ptotal.conversions===0){
      out.push({type:"info",title:"Pinterest sem conversões diretas",msg:`Normal em fase inicial. Pinterest influencia compras com delay maior que Meta (~7-14 dias). Compare "Ped. Shop" vs "Comp. Meta" por país na aba Consolidado para identificar impacto indireto.`});
    }
  }

  return out;
}

/* ─── UI ATOMS ───────────────────────────────────────────── */
function UploadZone({label,sub,onFile,loaded,color}){
  const[drag,setDrag]=useState(false);
  const onDrop=useCallback(e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f)onFile(f);},[onFile]);
  return(
    <label onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={onDrop}
      style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
        border:`1.5px dashed ${loaded?color:drag?"#888":"#d6cfc5"}`,borderRadius:10,
        padding:"16px 14px",cursor:"pointer",textAlign:"center",gap:5,
        background:loaded?`${color}0d`:drag?"#ede8e0":"#faf8f5",transition:"all 0.2s",minHeight:88}}>
      <input type="file" accept=".csv" style={{display:"none"}} onChange={e=>onFile(e.target.files[0])}/>
      <div style={{fontSize:15,opacity:loaded?1:0.45}}>{loaded?"✓":"↑"}</div>
      <div style={{fontSize:11,fontWeight:700,color:loaded?color:"#4a3f35",fontFamily:"'Syne',sans-serif",letterSpacing:"0.04em"}}>{label}</div>
      <div style={{fontSize:10,color:"#9a8f84"}}>{loaded?"Carregado · clique pra trocar":sub}</div>
    </label>
  );
}

function KPI({label,value,sub,accent,large}){
  return(
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"13px 15px",borderTop:`3px solid ${accent||T.border}`}}>
      <div style={{fontSize:9,color:T.muted,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:5,fontFamily:"'Syne',sans-serif"}}>{label}</div>
      <div style={{fontSize:large?26:18,fontWeight:700,color:T.text,fontFamily:"'Syne',sans-serif",letterSpacing:"-0.02em",lineHeight:1}}>{value}</div>
      {sub&&<div style={{fontSize:10,color:T.faint,marginTop:4}}>{sub}</div>}
    </div>
  );
}

function SectionTitle({children,color,mb=12}){
  return(
    <div style={{fontSize:9,fontWeight:700,color:color||T.muted,letterSpacing:"0.16em",
      textTransform:"uppercase",marginBottom:mb,fontFamily:"'Syne',sans-serif",
      borderLeft:`3px solid ${color||T.border}`,paddingLeft:8}}>{children}</div>
  );
}

function useSortable(data,def,dir="desc"){
  const[sort,setSort]=useState({key:def,dir});
  const sorted=useMemo(()=>{
    if(!data?.length)return[];
    return[...data].sort((a,b)=>{const av=a[sort.key]??0,bv=b[sort.key]??0;return sort.dir==="desc"?bv-av:av-bv;});
  },[data,sort.key,sort.dir]);
  return{sorted,sort,onSort:k=>setSort(s=>({key:k,dir:s.key===k&&s.dir==="desc"?"asc":"desc"}))};
}

function DataTable({cols,rows,sort,onSort,emptyMsg}){
  const TH={padding:"7px 10px",fontSize:9,color:T.muted,letterSpacing:"0.12em",
    textTransform:"uppercase",cursor:"pointer",whiteSpace:"nowrap",
    borderBottom:`1px solid ${T.border}`,textAlign:"right",userSelect:"none",
    background:T.bg,fontFamily:"'Syne',sans-serif"};
  const TD={padding:"8px 10px",fontSize:11,color:"#4a3f35",
    borderBottom:`1px solid #f0ebe4`,textAlign:"right",fontVariantNumeric:"tabular-nums"};
  if(!rows?.length)return<div style={{padding:"28px",textAlign:"center",color:T.faint,fontSize:12}}>{emptyMsg||"Sem dados"}</div>;
  return(
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr>{cols.map(c=>(
          <th key={c.key} style={{...TH,textAlign:c.align||"right",
            color:sort?.key===c.key?T.violet:T.muted,
            borderBottom:sort?.key===c.key?`2px solid ${T.violet}`:`1px solid ${T.border}`}}
            onClick={()=>onSort(c.key)}>
            <span style={{display:"inline-flex",alignItems:"center",gap:3,cursor:c.tip?"help":"pointer"}}
              title={c.tip||""}>
              {c.icon&&<span style={{opacity:0.6}}>{c.icon}</span>}
              {c.label}
              {sort?.key===c.key?(sort.dir==="desc"?" ↓":" ↑"):""}
              {c.tip&&<span style={{width:11,height:11,borderRadius:"50%",background:T.faint,color:"#fff",
                fontSize:7,fontWeight:700,display:"inline-flex",alignItems:"center",justifyContent:"center",
                flexShrink:0,lineHeight:1,opacity:0.7}}>?</span>}
            </span>
          </th>
        ))}</tr></thead>
        <tbody>{rows.map((row,i)=>(
          <tr key={i} style={{background:i%2===0?"#fffcf9":T.card}}>
            {cols.map(c=>(
              <td key={c.key} style={{...TD,textAlign:c.align||"right",
                color:c.color?c.color(row[c.key],row):"#4a3f35"}}>
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
  const pct=max>0?Math.min((value/max)*100,100):0;
  return(
    <div style={{marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
        <span style={{color:T.muted,fontSize:10}}>{label}</span>
        <span style={{fontWeight:600,color:T.text,fontVariantNumeric:"tabular-nums"}}>{fmt(value)}</span>
      </div>
      <div style={{height:5,background:"#ede8e0",borderRadius:3,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:3,transition:"width 0.4s ease"}}/>
      </div>
    </div>
  );
}

function PeriodSelector({dateFrom,dateTo,onFrom,onTo}){
  const[open,setOpen]=useState(false);

  const today=new Date();
  const toISO=d=>d.toISOString().slice(0,10);

  const shortcuts=[
    {label:"7d",    fn:()=>{ const d=new Date(today); d.setDate(d.getDate()-6); onFrom(toISO(d)); onTo(toISO(today)); }},
    {label:"14d",   fn:()=>{ const d=new Date(today); d.setDate(d.getDate()-13); onFrom(toISO(d)); onTo(toISO(today)); }},
    {label:"30d",   fn:()=>{ const d=new Date(today); d.setDate(d.getDate()-29); onFrom(toISO(d)); onTo(toISO(today)); }},
    {label:"Este mês", fn:()=>{ const d=new Date(today.getFullYear(),today.getMonth(),1); onFrom(toISO(d)); onTo(toISO(today)); }},
    {label:"Mês ant.", fn:()=>{
      const first=new Date(today.getFullYear(),today.getMonth()-1,1);
      const last=new Date(today.getFullYear(),today.getMonth(),0);
      onFrom(toISO(first)); onTo(toISO(last));
    }},
    {label:"Tudo",  fn:()=>{ onFrom(""); onTo(""); }},
  ];

  const activeLabel=(()=>{
    if(!dateFrom&&!dateTo) return "Tudo";
    const days=dateFrom&&dateTo?Math.round((new Date(dateTo)-new Date(dateFrom))/(1000*60*60*24))+1:null;
    if(days===7)  return "7d";
    if(days===14) return "14d";
    if(days===30) return "30d";
    return null;
  })();

  return(
    <div style={{position:"relative"}}>
      <div style={{display:"flex",alignItems:"center",gap:6,background:T.card,
        border:`1px solid ${T.border}`,borderRadius:8,padding:"5px 10px",flexWrap:"wrap"}}>
        {/* Shortcuts */}
        <span style={{fontSize:9,color:T.muted,fontFamily:"'Syne',sans-serif",
          letterSpacing:"0.1em",textTransform:"uppercase",whiteSpace:"nowrap",marginRight:2}}>Período</span>
        <div style={{display:"flex",gap:3}}>
          {shortcuts.map(s=>(
            <button key={s.label} onClick={s.fn} style={{
              fontSize:10,padding:"3px 8px",borderRadius:20,cursor:"pointer",
              fontFamily:"'Syne',sans-serif",fontWeight:600,letterSpacing:"0.04em",
              border:`1px solid ${activeLabel===s.label?T.violet:T.border}`,
              background:activeLabel===s.label?T.violetL:"transparent",
              color:activeLabel===s.label?T.violet:T.muted,
              transition:"all 0.12s",whiteSpace:"nowrap",
            }}>{s.label}</button>
          ))}
        </div>
        {/* Calendar toggle */}
        <button onClick={()=>setOpen(o=>!o)} style={{
          fontSize:10,padding:"3px 8px",borderRadius:6,cursor:"pointer",
          border:`1px solid ${open?T.violet:T.border}`,fontFamily:"'Syne',sans-serif",
          background:open?T.violetL:"transparent",color:open?T.violet:T.muted,
          display:"flex",alignItems:"center",gap:4,fontWeight:600,
        }}>
          📅 {dateFrom||"início"} → {dateTo||"hoje"}
        </button>
      </div>
      {/* Date inputs pop-up */}
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:200,
          background:T.card,border:`1px solid ${T.border}`,borderRadius:10,
          padding:"14px 16px",boxShadow:"0 8px 24px rgba(0,0,0,0.12)",
          display:"flex",flexDirection:"column",gap:10,minWidth:260}}>
          <div style={{fontSize:9,fontWeight:700,color:T.muted,letterSpacing:"0.12em",
            textTransform:"uppercase",fontFamily:"'Syne',sans-serif"}}>Intervalo personalizado</div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{flex:1}}>
              <div style={{fontSize:9,color:T.faint,marginBottom:3}}>De</div>
              <input type="date" value={dateFrom} onChange={e=>onFrom(e.target.value)}
                style={{width:"100%",border:`1px solid ${T.border}`,borderRadius:6,
                  padding:"5px 8px",fontSize:11,color:T.text,background:T.bg}}/>
            </div>
            <span style={{color:T.faint,marginTop:14}}>→</span>
            <div style={{flex:1}}>
              <div style={{fontSize:9,color:T.faint,marginBottom:3}}>Até</div>
              <input type="date" value={dateTo} onChange={e=>onTo(e.target.value)}
                style={{width:"100%",border:`1px solid ${T.border}`,borderRadius:6,
                  padding:"5px 8px",fontSize:11,color:T.text,background:T.bg}}/>
            </div>
          </div>
          <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
            <button onClick={()=>{onFrom("");onTo("");setOpen(false);}}
              style={{fontSize:10,color:T.muted,background:"none",border:`1px solid ${T.border}`,
                cursor:"pointer",padding:"4px 10px",borderRadius:6,fontFamily:"'Syne',sans-serif"}}>
              Limpar
            </button>
            <button onClick={()=>setOpen(false)}
              style={{fontSize:10,color:"#fff",background:T.violet,border:"none",
                cursor:"pointer",padding:"4px 12px",borderRadius:6,fontFamily:"'Syne',sans-serif",fontWeight:700}}>
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── DAILY CHART ────────────────────────────────────────── */
const ChartTip=({active,payload,label})=>{
  if(!active||!payload?.length)return null;
  return(
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,
      padding:"10px 14px",fontSize:11,boxShadow:"0 4px 14px rgba(0,0,0,0.08)"}}>
      <div style={{fontWeight:700,marginBottom:5,fontFamily:"'Syne',sans-serif"}}>{label}</div>
      {payload.map(p=>(
        <div key={p.name} style={{display:"flex",justifyContent:"space-between",gap:16,color:p.color,marginBottom:2}}>
          <span>{p.name}</span>
          <span style={{fontWeight:600}}>
            {p.name==="ROAS"?fmtX(p.value):p.name.includes("R$")?fmtR(p.value):p.name.includes("$")?fmtUSD(p.value):fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

function DailyChart({data}){
  const[mode,setMode]=useState("roas");
  if(!data?.length)return null;
  const hasBoth=data.some(d=>d.spend>0)&&data.some(d=>d.orders>0);

  return(
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"18px 20px",marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <SectionTitle color={T.violet} mb={0}>Tendência Diária</SectionTitle>
        <div style={{display:"flex",gap:4}}>
          {[["roas","ROAS por dia"],["spend","Gasto × Receita"],["orders","Pedidos"]].map(([k,l])=>(
            <button key={k} onClick={()=>setMode(k)} style={{
              fontSize:10,padding:"4px 10px",borderRadius:20,cursor:"pointer",fontFamily:"'Syne',sans-serif",
              fontWeight:700,letterSpacing:"0.06em",border:`1px solid ${mode===k?T.violet:T.border}`,
              background:mode===k?T.violetL:"transparent",color:mode===k?T.violet:T.muted,
            }}>{l}</button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={190}>
        {mode==="roas"?(
          <LineChart data={data} margin={{top:4,right:8,left:0,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe4" vertical={false}/>
            <XAxis dataKey="label" tick={{fontSize:9,fill:T.faint}} tickLine={false} axisLine={false}/>
            <YAxis tick={{fontSize:9,fill:T.faint}} tickLine={false} axisLine={false} tickFormatter={v=>v+"×"}/>
            <Tooltip content={<ChartTip/>}/>
            <ReferenceLine y={1} stroke={T.warn} strokeDasharray="4 2" strokeWidth={1.5}/>
            <Line type="monotone" dataKey="roas" name="ROAS" stroke={T.violet} strokeWidth={2} dot={{r:3,fill:T.violet}} connectNulls/>
          </LineChart>
        ):mode==="spend"?(
          <BarChart data={data} margin={{top:4,right:8,left:0,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe4" vertical={false}/>
            <XAxis dataKey="label" tick={{fontSize:9,fill:T.faint}} tickLine={false} axisLine={false}/>
            <YAxis tick={{fontSize:9,fill:T.faint}} tickLine={false} axisLine={false}/>
            <Tooltip content={<ChartTip/>}/>
            <Legend wrapperStyle={{fontSize:10,paddingTop:6}}/>
            <Bar dataKey="spend"  name="Gasto R$"    fill={T.meta}    radius={[2,2,0,0]}/>
            <Bar dataKey="revBRL" name="Receita R$"  fill={T.shopify} radius={[2,2,0,0]}/>
          </BarChart>
        ):(
          <BarChart data={data} margin={{top:4,right:8,left:0,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe4" vertical={false}/>
            <XAxis dataKey="label" tick={{fontSize:9,fill:T.faint}} tickLine={false} axisLine={false}/>
            <YAxis tick={{fontSize:9,fill:T.faint}} tickLine={false} axisLine={false}/>
            <Tooltip content={<ChartTip/>}/>
            <Legend wrapperStyle={{fontSize:10,paddingTop:6}}/>
            <Bar dataKey="orders"    name="Pedidos Shopify" fill={T.shopify} radius={[2,2,0,0]}/>
            <Bar dataKey="purchases" name="Compras Meta"    fill={T.meta}    radius={[2,2,0,0]}/>
          </BarChart>
        )}
      </ResponsiveContainer>
      {mode==="roas"&&!hasBoth&&(
        <div style={{fontSize:10,color:T.faint,textAlign:"center",marginTop:4}}>
          Suba os dois CSVs (Meta + Shopify) para ver ROAS por dia
        </div>
      )}
    </div>
  );
}

/* ─── COUNTRY CROSSOVER ──────────────────────────────────── */
function CountryCrossover({meta,shopify,pinterest,rate}){
  const[view,setView]=useState("roas"); // "roas" | "funnel"
  const rows=useMemo(()=>{
    const countries=new Set([
      ...Object.keys(meta?.byCountry||{}),
      ...Object.keys(shopify?.byCountry||{}),
      ...Object.keys(pinterest?.byCountry||{})
    ]);
    return Array.from(countries).map(c=>{
      const m=meta?.byCountry[c]||{};
      const s=shopify?.byCountry[c]||{};
      const p=pinterest?.byCountry[c]||{};
      const revUSD=s.revenue||0;
      const revBRL=revUSD*rate;
      const metaP=m.purchases||0;
      const shopifyO=s.orders||0;
      const spend=m.spend||0;
      // ROAS total = toda receita Shopify do país / gasto Meta
      const roasTotal=spend>0&&revBRL>0?revBRL/spend:0;
      // ROAS atribuído = receita proporcional às compras que Meta reclama
      // Assume que min(metaP, shopifyO) pedidos foram via Meta, resto é orgânico
      const metaAttributed=Math.min(metaP, shopifyO);
      const roasAtrib=spend>0&&shopifyO>0&&metaAttributed>0?(metaAttributed/shopifyO)*revBRL/spend:0;
      const organic=Math.max(0, shopifyO-metaP);
      const cpm=m.impressions>0?(spend/m.impressions)*1000:0;
      const ctr=m.impressions>0?(m.clicks||0)/m.impressions*100:0;
      const cpa=metaP>0?spend/metaP:0;
      const cvr=m.lpv>0?(metaP/m.lpv)*100:0;
      return{
        country:c,
        metaSpend:spend, metaPurchases:metaP, metaLPV:m.lpv||0, metaAddCart:m.addCart||0,
        metaCheckout:m.checkout||0, metaImpr:m.impressions||0, metaClicks:m.clicks||0,
        shopifyOrders:shopifyO, shopifyRevUSD:revUSD, shopifyRevBRL:revBRL,
        roasTotal, roasAtrib, organic,
        cpm, ctr, cpa, cvr,
        gap:metaP-shopifyO,
      };
    }).filter(r=>r.metaSpend>0||r.shopifyOrders>0);
  },[meta,shopify,rate]);

  const{sorted,sort,onSort}=useSortable(rows,"shopifyOrders");

  if(!rows.length)return(
    <div style={{background:T.metaL,borderRadius:10,padding:"14px 18px",fontSize:12,color:"#1e40af",lineHeight:1.6,marginBottom:20}}>
      Suba Meta Ads CSV + Shopify CSV para ver o cruzamento por país.
    </div>
  );

  return(
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden",marginBottom:20}}>
      <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <SectionTitle color={T.violet} mb={0}>Cruzamento por País</SectionTitle>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
        <ExportBtn data={sorted} filename="paises.csv" cols={[
          {key:"country",label:"País"},{key:"metaSpend",label:"Gasto Meta"},
          {key:"metaPurchases",label:"Compras Meta"},{key:"shopifyOrders",label:"Pedidos Shop"},
          {key:"shopifyRevUSD",label:"Receita USD"},{key:"shopifyRevBRL",label:"Receita BRL"},
          {key:"roasTotal",label:"ROAS Total"},{key:"roasAtrib",label:"ROAS Atrib"},
          {key:"organic",label:"Orgânico"},{key:"gap",label:"Δ"},
        ]}/>
          {[["roas","ROAS & Receita"],["funnel","Funil & CPM"]].map(([k,l])=>(
            <button key={k} onClick={()=>setView(k)} style={{
              fontSize:10,padding:"3px 10px",borderRadius:20,cursor:"pointer",
              border:`1px solid ${view===k?T.violet:T.border}`,fontFamily:"'Syne',sans-serif",fontWeight:700,
              background:view===k?T.violetL:"transparent",color:view===k?T.violet:T.muted}}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {view==="roas"&&(
        <DataTable sort={sort} onSort={onSort}
          cols={[
            {key:"country",      label:"País",          align:"left", render:v=><span style={{fontWeight:700,fontSize:11,color:T.text,whiteSpace:"nowrap"}}>{fmtCountry(v)}</span>},
            {key:"metaSpend",    label:"Gasto Meta",    render:v=>fmtR(v)},
            {key:"metaPurchases",label:"Comp. Meta",    render:v=>fmt(v), color:v=>v>0?T.meta:T.faint},
            {key:"shopifyOrders",label:"Ped. Shop",     render:v=>fmt(v), color:v=>v>0?T.shopify:T.faint},
            {key:"shopifyRevUSD",label:"Rec. USD",      render:v=>fmtUSD(v), color:v=>v>0?T.good:T.faint},
            {key:"shopifyRevBRL",label:"Rec. BRL",      render:v=>fmtR(v), color:v=>v>0?T.good:T.faint},
            {key:"roasTotal",    label:"ROAS Total",    render:v=>fmtX(v), color:v=>v>=3?T.good:v>=1?T.warn:v>0?T.bad:T.faint},
            {key:"roasAtrib",    label:"ROAS Atrib.",   render:v=>v>0?fmtX(v):"—", color:v=>v>=3?T.good:v>=1?T.warn:v>0?T.bad:T.faint},
            {key:"organic",      label:"Orgânico",      render:v=>v>0?fmt(v):"—", color:v=>v>0?T.shopify:T.faint},
            {key:"gap",          label:"Δ",             render:v=>v===0?"=":(v>0?`+${v}`:`${v}`), color:v=>v===0?T.good:Math.abs(v)<=1?T.warn:T.bad},
          ]}
          rows={sorted}/>
      )}
      {view==="funnel"&&(
        <DataTable sort={sort} onSort={onSort}
          cols={[
            {key:"country",      label:"País",        align:"left", tip:"País (ISO 2 letras)", render:v=><span style={{fontWeight:700,fontSize:11,color:T.text,whiteSpace:"nowrap"}}>{fmtCountry(v)}</span>},
            {key:"metaImpr",     label:"Impressões",  render:v=>fmt(v)},
            {key:"metaClicks",   label:"Cliques",     render:v=>fmt(v)},
            {key:"ctr",          label:"CTR",         render:v=>fmtPct(v), color:v=>v>=2?T.good:v>=0.5?T.warn:v>0?T.bad:T.faint},
            {key:"cpm",          label:"CPM",         render:v=>fmtR(v), color:v=>v>0&&v<30?T.good:v<60?T.warn:v>0?T.bad:T.faint},
            {key:"metaLPV",      label:"LPV",         render:v=>fmt(v)},
            {key:"metaCheckout", label:"Fin. Carrinho",    render:v=>fmt(v)},
            {key:"metaPurchases",label:"Compras",     render:v=>fmt(v), color:v=>v>0?T.meta:T.faint},
            {key:"cpa",          label:"CPA",         render:v=>v>0?fmtR(v):"—"},
            {key:"cvr",          label:"CVR",         render:v=>fmtPct(v), color:v=>v>=3?T.good:v>=1?T.warn:v>0?T.bad:T.faint},
          ]}
          rows={sorted}/>
      )}
      <div style={{padding:"8px 16px",fontSize:10,color:T.faint,borderTop:`1px solid ${T.border}`,lineHeight:1.6}}>
        <b style={{color:T.violet}}>ROAS Atrib.</b> = receita proporcional às compras que o Meta atribui ÷ gasto (estimativa conservadora). &nbsp;
        <b style={{color:T.shopify}}>Orgânico</b> = pedidos Shopify acima da atribuição Meta. &nbsp;
        <b>Δ positivo</b> = Meta reporta mais que Shopify (over-attribution normal).
      </div>
    </div>
  );
}

/* ─── SUGGESTIONS PANEL ──────────────────────────────────── */
function SuggestionsPanel({meta,shopify,pinterest,rate}){
  const items=useMemo(()=>buildSuggestions(meta,shopify,rate),[meta,shopify,rate]);
  if(!items.length)return null;
  const icon={good:"✓",bad:"✗",warn:"⚠",action:"→"};
  const col={good:T.good,bad:T.bad,warn:T.warn,action:T.violet};
  const bg={good:T.shopifyL,bad:"#fee2e2",warn:T.warnL,action:T.violetL};
  return(
    <div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {items.map((s,i)=>(
          <div key={i} style={{background:bg[s.type],border:`1px solid ${col[s.type]}40`,borderRadius:9,padding:"10px 14px",display:"flex",gap:10,alignItems:"flex-start"}}>
            <span style={{fontSize:13,color:col[s.type],fontWeight:700,flexShrink:0,marginTop:1}}>{icon[s.type]}</span>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:T.text,marginBottom:2,fontFamily:"'Syne',sans-serif"}}>{s.title}</div>
              <div style={{fontSize:11,color:"#4a4035",lineHeight:1.55}}>{s.msg}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


/* ─── DAILY ATTRIBUTION TABLE ────────────────────────────── */
function DailyAttributionTable({meta, shopify, rate}){
  const[sort,setSort]=useState({key:"date",dir:"desc"});
  const onSort=k=>setSort(s=>({key:k,dir:s.key===k&&s.dir==="desc"?"asc":"desc"}));

  const rows = useMemo(()=>{
    if(!meta&&!shopify) return [];
    const days = new Set([
      ...Object.keys(meta?.byDay||{}),
      ...Object.keys(shopify?.byDay||{}),
    ]);
    return Array.from(days).map(date=>{
      const m = meta?.byDay[date]||{spend:0,purchases:0};
      const s = shopify?.byDay[date]||{orders:0,revenue:0};
      const revBRL = s.revenue * rate;
      const roas = m.spend>0 && s.revenue>0 ? revBRL/m.spend : null;
      const gap = m.purchases - s.orders; // positive = meta over-attr; negative = organic
      const organic = Math.max(0, s.orders - m.purchases); // orders not attributed to Meta
      return { date, spend:m.spend, metaPurchases:m.purchases,
               shopifyOrders:s.orders, shopifyRevUSD:s.revenue,
               shopifyRevBRL:revBRL, roas, gap, organic };
    });
  },[meta,shopify,rate]);

  const sorted = useMemo(()=>[...rows].sort((a,b)=>{
    const v = k => a[k]??0;
    const av=sort.key==="date"?a.date:a[sort.key];
    const bv=sort.key==="date"?b.date:b[sort.key];
    if(av==null&&bv==null)return 0; if(av==null)return 1; if(bv==null)return -1;
    return sort.dir==="asc"?(av>bv?1:-1):(av<bv?1:-1);
  }),[rows,sort]);

  if(!rows.length) return null;

  const totSpend    = rows.reduce((a,r)=>a+r.spend,0);
  const totMetaP    = rows.reduce((a,r)=>a+r.metaPurchases,0);
  const totShopifyO = rows.reduce((a,r)=>a+r.shopifyOrders,0);
  const totRevUSD   = rows.reduce((a,r)=>a+r.shopifyRevUSD,0);
  const totRevBRL   = rows.reduce((a,r)=>a+r.shopifyRevBRL,0);
  const totOrganic  = rows.reduce((a,r)=>a+r.organic,0);
  const totROAS     = totSpend>0&&totRevBRL>0?totRevBRL/totSpend:null;

  const SH = ({k,label,align})=>(
    <th onClick={()=>onSort(k)} style={{padding:"8px 12px",fontSize:9,fontWeight:700,
      color:sort.key===k?T.meta:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",
      textAlign:align||"right",cursor:"pointer",background:"#faf8f5",
      borderBottom:`2px solid ${sort.key===k?T.meta:T.border}`,whiteSpace:"nowrap",fontFamily:"'Syne',sans-serif"}}>
      {label}{sort.key===k?(sort.dir==="asc"?" ↑":" ↓"):""}
    </th>
  );

  return(
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden",marginBottom:20}}>
      <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <SectionTitle color={T.violet} mb={0}>Atribuição Diária — Meta vs Shopify</SectionTitle>
        <span style={{fontSize:10,color:T.faint}}>Orgânico = pedidos Shopify sem atribuição Meta · Δ = compras Meta − pedidos Shopify</span>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr>
              <SH k="date"          label="Data"            align="left"/>
              <SH k="spend"         label="Gasto Meta"/>
              <SH k="metaPurchases" label="Compras Meta"  />
              <SH k="shopifyOrders" label="Pedidos Shop"  />
              <SH k="shopifyRevUSD" label="Receita USD"   />
              <SH k="shopifyRevBRL" label="Receita BRL"   />
              <SH k="roas"          label="ROAS"          />
              <SH k="gap"           label="Δ"             />
              <SH k="organic"       label="Orgânico est." />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r,i)=>{
              const roasColor = r.roas==null?T.faint:r.roas>=3?T.good:r.roas>=1?T.warn:T.bad;
              const gapColor  = r.gap===0?T.good:Math.abs(r.gap)<=1?T.warn:r.gap>0?T.meta:T.shopify;
              return(
                <tr key={r.date} style={{background:i%2===0?T.card:"#faf8f5"}}>
                  <td style={{padding:"7px 12px",fontSize:11,fontWeight:600,color:T.text,whiteSpace:"nowrap"}}>{fmtDate(r.date)}</td>
                  <td style={{padding:"7px 12px",fontSize:11,textAlign:"right",color:T.meta}}>{fmtR(r.spend)}</td>
                  <td style={{padding:"7px 12px",fontSize:11,textAlign:"right",color:r.metaPurchases>0?T.meta:T.faint,fontWeight:r.metaPurchases>0?700:400}}>{fmt(r.metaPurchases)}</td>
                  <td style={{padding:"7px 12px",fontSize:11,textAlign:"right",color:r.shopifyOrders>0?T.shopify:T.faint,fontWeight:r.shopifyOrders>0?700:400}}>{fmt(r.shopifyOrders)}</td>
                  <td style={{padding:"7px 12px",fontSize:11,textAlign:"right",color:r.shopifyRevUSD>0?T.good:T.faint}}>{fmtUSD(r.shopifyRevUSD)}</td>
                  <td style={{padding:"7px 12px",fontSize:11,textAlign:"right",color:r.shopifyRevBRL>0?T.good:T.faint}}>{fmtR(r.shopifyRevBRL)}</td>
                  <td style={{padding:"7px 12px",fontSize:11,textAlign:"right",color:roasColor,fontWeight:700}}>{r.roas!=null?fmtX(r.roas):"—"}</td>
                  <td style={{padding:"7px 12px",fontSize:11,textAlign:"right",color:gapColor,fontWeight:600}}>{r.gap===0?"=":(r.gap>0?`+${r.gap}`:r.gap)}</td>
                  <td style={{padding:"7px 12px",fontSize:11,textAlign:"right",color:r.organic>0?T.shopify:T.faint,fontWeight:r.organic>0?700:400}}>{r.organic>0?fmt(r.organic):"—"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{background:"#f0ece5",borderTop:`2px solid ${T.border}`}}>
              <td style={{padding:"8px 12px",fontSize:10,fontWeight:800,color:T.text,fontFamily:"'Syne',sans-serif"}}>TOTAL</td>
              <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",fontWeight:700,color:T.meta}}>{fmtR(totSpend)}</td>
              <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",fontWeight:700,color:T.meta}}>{fmt(totMetaP)}</td>
              <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",fontWeight:700,color:T.shopify}}>{fmt(totShopifyO)}</td>
              <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",fontWeight:700,color:T.good}}>{fmtUSD(totRevUSD)}</td>
              <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",fontWeight:700,color:T.good}}>{fmtR(totRevBRL)}</td>
              <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",fontWeight:700,color:totROAS>=3?T.good:totROAS>=1?T.warn:T.bad}}>{totROAS?fmtX(totROAS):"—"}</td>
              <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",fontWeight:700,color:T.muted}}>{totMetaP-totShopifyO===0?"=":(totMetaP-totShopifyO>0?`+${totMetaP-totShopifyO}`:totMetaP-totShopifyO)}</td>
              <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",fontWeight:700,color:T.shopify}}>{totOrganic>0?fmt(totOrganic):"—"}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div style={{padding:"8px 16px",fontSize:10,color:T.faint,borderTop:`1px solid ${T.border}`,lineHeight:1.6}}>
        <b style={{color:T.shopify}}>Orgânico estimado</b> = pedidos Shopify acima do que o Meta atribui — origem provável: orgânico, Pinterest, busca direta. &nbsp;
        <b style={{color:T.meta}}>Δ positivo</b> = Meta reporta mais que Shopify registra (over-attribution normal ~20%). &nbsp;
        <b style={{color:T.good}}>ROAS</b> = receita Shopify convertida em BRL ÷ gasto Meta no mesmo dia.
      </div>
    </div>
  );
}


/* ─── METRIC TOOLTIP ─────────────────────────────────────── */
const METRIC_TIPS={
  "ROAS":"Return on Ad Spend — Receita BRL ÷ Gasto Meta. Acima de 3× é bom para produtos digitais.",
  "CPA":"Custo Por Aquisição — gasto ÷ compras atribuídas pelo Meta.",
  "CTR":"Click-Through Rate — cliques no link ÷ impressões × 100. Acima de 1% é saudável.",
  "CPM":"Custo por Mil Impressões — mede custo de alcance. Menor = audiência mais barata.",
  "LPV":"Landing Page Views — pessoas que clicaram E a página carregou. Mais preciso que cliques.",
  "CVR":"Conversion Rate — compras ÷ LPV × 100. Mede eficiência da página de destino.",
  "Freq.":"Frequência — média de vezes que a mesma pessoa viu seu anúncio. Acima de 3× pode cansar a audiência.",
  "Alcance":"Número de pessoas únicas que viram o anúncio (diferente de impressões).",
  "Fin. Carrinho":"Finalizações de carrinho iniciadas (checkout initiation) — usuários que clicaram em 'comprar'.",
  "ROAS Real":"ROAS calculado com TODOS os gastos (mídia + despesas manuais) ÷ receita líquida Shopify.",
  "Rec. Líq.":"Receita Shopify após descontar as taxas da Stripe (processing + currency conversion).",
};
function MetricTip({term}){
  const[show,setShow]=useState(false);
  const tip=METRIC_TIPS[term];
  if(!tip)return null;
  return(
    <span style={{position:"relative",display:"inline-flex",alignItems:"center",marginLeft:3}}>
      <span onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}
        style={{width:13,height:13,borderRadius:"50%",background:T.faint,color:"#fff",
          fontSize:8,fontWeight:700,display:"inline-flex",alignItems:"center",
          justifyContent:"center",cursor:"help",flexShrink:0,lineHeight:1}}>?</span>
      {show&&(
        <div style={{position:"absolute",bottom:"120%",left:"50%",transform:"translateX(-50%)",
          background:"#1c1917",color:"#fff",fontSize:10,lineHeight:1.5,padding:"7px 10px",
          borderRadius:7,width:220,zIndex:999,pointerEvents:"none",boxShadow:"0 4px 12px rgba(0,0,0,0.3)"}}>
          <b style={{display:"block",marginBottom:3,fontSize:9,opacity:0.7,textTransform:"uppercase",letterSpacing:"0.08em"}}>{term}</b>
          {tip}
        </div>
      )}
    </span>
  );
}


/* ─── COLLAPSIBLE SECTION ────────────────────────────────── */
function Collapsible({title, color, children, defaultOpen=true, id=null, extra=null}){
  const storageId = "col_"+(id||title);
  const[open,setOpen]=useState(()=>lsGet(storageId, defaultOpen));

  const toggle=()=>{
    setOpen(o=>{
      const next=!o;
      lsSet(storageId, next);
      return next;
    });
  };

  return(
    <div style={{marginBottom:20}}>
      <div onClick={toggle} style={{
        display:"flex",justifyContent:"space-between",alignItems:"center",
        cursor:"pointer",padding:"8px 0",userSelect:"none",
        borderBottom:`2px solid ${open?color:T.border}`,marginBottom:open?12:0,
        transition:"border-color 0.15s",
      }}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:9,fontWeight:700,color:open?color:T.muted,
            letterSpacing:"0.16em",textTransform:"uppercase",
            fontFamily:"'Syne',sans-serif"}}>{title}</span>
          {extra}
        </div>
        <span style={{fontSize:10,color:T.faint,fontFamily:"'Syne',sans-serif",fontWeight:600,
          transition:"transform 0.2s",display:"inline-block",transform:open?"":"rotate(-90deg)"}}>
          ▼
        </span>
      </div>
      {open&&<div>{children}</div>}
    </div>
  );
}

/* ─── EXPORT CSV BUTTON ──────────────────────────────────── */
function ExportBtn({data, cols, filename}){
  const doExport=()=>{
    if(!data?.length)return;
    const headers=cols.map(c=>c.label).join(",");
    const rows=data.map(row=>
      cols.map(c=>{
        const v=row[c.key];
        const str=v==null?"":String(v);
        return str.includes(",")||str.includes('"')?`"${str.replace(/"/g,'""')}"`:str;
      }).join(",")
    );
    const csv=[headers,...rows].join("\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=filename||"export.csv"; a.click();
    URL.revokeObjectURL(url);
  };
  return(
    <button onClick={e=>{e.stopPropagation();doExport();}} style={{
      fontSize:9,padding:"3px 9px",borderRadius:20,cursor:"pointer",
      border:`1px solid ${T.border}`,background:"transparent",color:T.muted,
      fontFamily:"'Syne',sans-serif",fontWeight:600,letterSpacing:"0.06em",
      display:"flex",alignItems:"center",gap:4,
    }}>↓ CSV</button>
  );
}


/* ─── OBJECTIVE PANEL ────────────────────────────────────── */
const OBJ_ICONS = {"Vendas":"🛍","Tráfego":"🔗","Reconhecimento":"📢","Engajamento":"💬","Leads":"🎯","Outro":"📊"};
const OBJ_COLOR = {"Vendas":T.good,"Tráfego":T.meta,"Reconhecimento":"#7c3aed","Engajamento":T.warn,"Leads":"#0891b2","Outro":T.muted};

function ObjectivePanel({meta, shopify, rate}){
  const[activeObj,setActiveObj]=useState("all");

  const objectives=useMemo(()=>{
    if(!meta?.byObjective)return[];
    return Object.entries(meta.byObjective)
      .map(([name,d])=>{
        const cpa=d.purchases>0?d.spend/d.purchases:0;
        const cpm=d.impressions>0?(d.spend/d.impressions)*1000:0;
        const ctr=d.impressions>0&&d.clicks>0?(d.clicks/d.impressions)*100:0;
        const cpc=d.clicks>0?d.spend/d.clicks:0;
        const costLpv=d.lpv>0?d.spend/d.lpv:0;
        // For Vendas: try to get Shopify revenue for campaigns in this obj
        // We approximate: (obj spend / total spend) * total shopify revenue
        const spendShare=meta.totals.spend>0?d.spend/meta.totals.spend:0;
        const revBRL=(shopify?.totalRevenue||0)*rate*spendShare;
        const roas=d.spend>0&&revBRL>0?revBRL/d.spend:0;
        return { name, ...d, cpa, cpm, ctr, cpc, costLpv, revBRL, roas,
          campCount:d.campaigns?.length||0 };
      })
      .sort((a,b)=>b.spend-a.spend);
  },[meta,shopify,rate]);

  if(!objectives.length) return null;

  const allData = activeObj==="all" ? null : objectives.find(o=>o.name===activeObj);
  const totSpend = objectives.reduce((s,o)=>s+o.spend,0);

  return(
    <div style={{marginBottom:20}}>
      {/* Objective cards — click to filter */}
      <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <div onClick={()=>setActiveObj("all")} style={{
          flex:"0 0 auto",cursor:"pointer",padding:"10px 14px",borderRadius:10,
          border:`2px solid ${activeObj==="all"?T.violet:T.border}`,
          background:activeObj==="all"?T.violetL:T.card,
          display:"flex",alignItems:"center",gap:8,transition:"all 0.15s",
        }}>
          <span style={{fontSize:16}}>📊</span>
          <div>
            <div style={{fontSize:10,fontWeight:700,color:T.violet,fontFamily:"'Syne',sans-serif"}}>TOTAL</div>
            <div style={{fontSize:12,fontWeight:700,color:T.text}}>{fmtR(totSpend)}</div>
          </div>
        </div>
        {objectives.map(obj=>{
          const color=OBJ_COLOR[obj.name]||T.muted;
          const icon=OBJ_ICONS[obj.name]||"📊";
          const pct=totSpend>0?(obj.spend/totSpend*100).toFixed(0):0;
          const isActive=activeObj===obj.name;
          return(
            <div key={obj.name} onClick={()=>setActiveObj(isActive?"all":obj.name)} style={{
              flex:"0 0 auto",cursor:"pointer",padding:"10px 14px",borderRadius:10,
              border:`2px solid ${isActive?color:T.border}`,
              background:isActive?color+"15":T.card,
              display:"flex",alignItems:"center",gap:8,transition:"all 0.15s",
              minWidth:140,
            }}>
              <span style={{fontSize:20}}>{icon}</span>
              <div style={{flex:1}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{fontSize:10,fontWeight:700,color:isActive?color:T.muted,
                    fontFamily:"'Syne',sans-serif",letterSpacing:"0.06em"}}>{obj.name.toUpperCase()}</div>
                  <span style={{fontSize:9,color:T.faint}}>{pct}%</span>
                </div>
                <div style={{fontSize:14,fontWeight:800,color:T.text,fontFamily:"'Syne',sans-serif"}}>{fmtR(obj.spend)}</div>
                <div style={{height:3,background:"#e8e2da",borderRadius:2,marginTop:4,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:2}}/>
                </div>
                <div style={{fontSize:9,color:T.faint,marginTop:3}}>
                  {obj.campCount} campanha{obj.campCount!==1?"s":""} · {fmt(obj.purchases)} compras
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail for selected objective */}
      {allData&&(
        <div style={{background:T.card,border:`2px solid ${OBJ_COLOR[allData.name]||T.border}`,
          borderRadius:12,padding:18,animation:"fadeIn 0.2s ease"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div>
              <div style={{fontSize:18,fontWeight:800,color:T.text,fontFamily:"'Syne',sans-serif"}}>
                {OBJ_ICONS[allData.name]} {allData.name}
              </div>
              <div style={{fontSize:10,color:T.faint,marginTop:2}}>
                {allData.campaigns?.join(" · ")||""}
              </div>
            </div>
            <button onClick={()=>setActiveObj("all")} style={{
              fontSize:10,color:T.muted,background:"none",
              border:`1px solid ${T.border}`,borderRadius:6,
              cursor:"pointer",padding:"4px 10px",fontFamily:"'Syne',sans-serif"}}>
              ✕ fechar
            </button>
          </div>

          {allData.name==="Vendas"?(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10}}>
              <KPI label="Gasto"       value={fmtR(allData.spend)}       accent={T.meta}/>
              <KPI label="Compras"     value={fmt(allData.purchases)}    accent={T.good} large/>
              <KPI label="CPA"         value={fmtR(allData.cpa)}         accent={T.warn}/>
              <KPI label="ROAS (est.)" value={fmtX(allData.roas)}       accent={allData.roas>=3?T.good:allData.roas>=1?T.warn:T.bad}
                sub="receita Shopify proporcional"/>
              <KPI label="LPV"         value={fmt(allData.lpv)}          accent={T.violet}/>
              <KPI label="Custo/LPV"   value={fmtR(allData.costLpv)}    accent={T.violet}/>
              <KPI label="Fin. Carrinho"    value={fmt(allData.checkout)}     accent={T.warn}/>
              <KPI label="Add Cart"    value={fmt(allData.addCart)}      accent={T.warn}/>
              <KPI label="CPM"         value={fmtR(allData.cpm)}         accent={T.meta}/>
            </div>
          ):(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10}}>
              <KPI label="Gasto"       value={fmtR(allData.spend)}       accent={T.meta}/>
              <KPI label="Cliques"     value={fmt(allData.clicks)}       accent={T.meta} large/>
              <KPI label="CPC"         value={fmtR(allData.cpc)}         accent={T.meta}/>
              <KPI label="CTR"         value={fmtPct(allData.ctr)}       accent={allData.ctr>=2?T.good:allData.ctr>=0.5?T.warn:T.bad}/>
              <KPI label="CPM"         value={fmtR(allData.cpm)}         accent={T.meta}/>
              <KPI label="LPV"         value={fmt(allData.lpv)}          accent={T.violet}/>
              <KPI label="Custo/LPV"   value={fmtR(allData.costLpv)}    accent={T.violet}/>
              <KPI label="Alcance"     value={fmt(allData.reach)}        accent={T.muted}/>
              <KPI label="Impressões"  value={fmt(allData.impressions)}  accent={T.muted}/>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


/* ─── MONTHLY VIEW ───────────────────────────────────────── */
function MonthlyView({meta,shopify,rate}){
  const rows=useMemo(()=>{
    const months=new Set([
      ...Object.keys(meta?.byMonth||{}),
      ...Object.keys(shopify?.byMonth||{}),
    ]);
    return Array.from(months).sort().map(m=>{
      const md=meta?.byMonth[m]||{};
      const sd=shopify?.byMonth[m]||{};
      const revBRL=(sd.revenue||0)*rate;
      const spend=md.spend||0;
      const roas=spend>0&&revBRL>0?revBRL/spend:null;
      const [yr,mo]=m.split("-");
      const label=new Date(parseInt(yr),parseInt(mo)-1,1).toLocaleDateString("pt-BR",{month:"short",year:"2-digit"});
      return{month:m,label,spend,purchases:md.purchases||0,
        shopifyOrders:sd.orders||0,revUSD:sd.revenue||0,revBRL,roas,
        cpa:md.purchases>0?spend/md.purchases:0,
        lpv:md.lpv||0,checkout:md.checkout||0};
    });
  },[meta,shopify,rate]);

  const{sorted,sort,onSort}=useSortable(rows,"month");

  if(!rows.length)return null;

  const totSpend=rows.reduce((a,r)=>a+r.spend,0);
  const totPurch=rows.reduce((a,r)=>a+r.purchases,0);
  const totOrders=rows.reduce((a,r)=>a+r.shopifyOrders,0);
  const totRevUSD=rows.reduce((a,r)=>a+r.revUSD,0);
  const totRevBRL=rows.reduce((a,r)=>a+r.revBRL,0);
  const totROAS=totSpend>0&&totRevBRL>0?totRevBRL/totSpend:null;

  return(
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden",marginBottom:20}}>

      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr>
              {(()=>{const MTIPS={"M\u00eas": "", "Gasto Meta": "Total gasto no Meta Ads no per\u00edodo", "Comp. Meta": "Compras atribu\u00eddas pelo Meta (pixel). Pode incluir view-through attribution", "Ped. Shop": "Pedidos reais registrados no Shopify (inclui org\u00e2nico, Pinterest, direto)", "Rec. USD": "Receita bruta em d\u00f3lares (Shopify)", "Rec. BRL": "Receita bruta convertida para BRL usando a cota\u00e7\u00e3o configurada", "ROAS": "Return on Ad Spend \u2014 Rec. BRL \u00f7 Gasto Meta. Acima de 3\u00d7 \u00e9 saud\u00e1vel", "CPA": "Custo Por Aquisi\u00e7\u00e3o \u2014 gasto \u00f7 compras Meta atribu\u00eddas", "LPV": "Landing Page Views \u2014 cliques que carregaram a p\u00e1gina"};return [["month","Mês","left"],["spend","Gasto Meta","right"],["purchases","Comp. Meta","right"],["shopifyOrders","Ped. Shop","right"],["revUSD","Rec. USD","right"],["revBRL","Rec. BRL","right"],["roas","ROAS","right"],["cpa","CPA","right"],["lpv","LPV","right"]].map(([k,l,a])=>{const tip=MTIPS[l]||"";return(<th key={k} onClick={()=>onSort(k)} title={tip||undefined} style={{padding:"8px 12px",fontSize:9,fontWeight:700,color:sort.key===k?T.violet:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",textAlign:a||"right",cursor:tip?"help":"pointer",background:"#faf8f5",borderBottom:`2px solid ${sort.key===k?T.violet:T.border}`,whiteSpace:"nowrap",fontFamily:"'Syne',sans-serif"}}><span style={{display:"inline-flex",alignItems:"center",gap:3}}>{l}{sort.key===k?(sort.dir==="asc"?" ↑":" ↓"):""}{tip&&<span style={{width:11,height:11,borderRadius:"50%",background:T.faint,color:"#fff",fontSize:7,fontWeight:700,display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0,lineHeight:1,opacity:0.7}}>?</span>}</span></th>);});})()} 
            </tr>
          </thead>
          <tbody>
            {sorted.map((r,i)=>(
              <tr key={r.month} style={{background:i%2===0?T.card:"#faf8f5"}}>
                <td style={{padding:"8px 12px",fontSize:12,fontWeight:700,color:T.text,textAlign:"left",whiteSpace:"nowrap"}}>{r.label}</td>
                <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",color:T.meta}}>{fmtR(r.spend)}</td>
                <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",color:r.purchases>0?T.meta:T.faint,fontWeight:r.purchases>0?700:400}}>{fmt(r.purchases)}</td>
                <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",color:r.shopifyOrders>0?T.shopify:T.faint,fontWeight:r.shopifyOrders>0?700:400}}>{fmt(r.shopifyOrders)}</td>
                <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",color:r.revUSD>0?T.good:T.faint}}>{fmtUSD(r.revUSD)}</td>
                <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",color:r.revBRL>0?T.good:T.faint}}>{fmtR(r.revBRL)}</td>
                <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",fontWeight:700,
                  color:r.roas==null?T.faint:r.roas>=3?T.good:r.roas>=1?T.warn:T.bad}}>
                  {r.roas!=null?fmtX(r.roas):"—"}
                </td>
                <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",color:r.cpa>0?T.text:T.faint}}>{r.cpa>0?fmtR(r.cpa):"—"}</td>
                <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",color:T.violet}}>{fmt(r.lpv)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{background:"#f0ece5",borderTop:`2px solid ${T.border}`}}>
              <td style={{padding:"8px 12px",fontSize:10,fontWeight:800,color:T.text,fontFamily:"'Syne',sans-serif"}}>TOTAL</td>
              <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",fontWeight:700,color:T.meta}}>{fmtR(totSpend)}</td>
              <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",fontWeight:700,color:T.meta}}>{fmt(totPurch)}</td>
              <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",fontWeight:700,color:T.shopify}}>{fmt(totOrders)}</td>
              <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",fontWeight:700,color:T.good}}>{fmtUSD(totRevUSD)}</td>
              <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",fontWeight:700,color:T.good}}>{fmtR(totRevBRL)}</td>
              <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",fontWeight:700,
                color:totROAS>=3?T.good:totROAS>=1?T.warn:totROAS>0?T.bad:T.faint}}>
                {totROAS?fmtX(totROAS):"—"}
              </td>
              <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",fontWeight:700,color:T.muted}}>
                {totPurch>0?fmtR(totSpend/totPurch):"—"}
              </td>
              <td style={{padding:"8px 12px",fontSize:11,textAlign:"right",fontWeight:700,color:T.violet}}>
                {fmt(rows.reduce((a,r)=>a+r.lpv,0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* ─── TAB: CONSOLIDADO ───────────────────────────────────── */
function ConsolidatedTab({meta,shopify,pinterest,rate,fee=6.8}){
  const dailyData=useMemo(()=>buildDailyData(meta?.byDay,shopify?.byDay,rate),[meta,shopify,rate]);
  const roasGlobal=meta?.totals.spend>0&&shopify?(shopify.totalRevenue*rate)/meta.totals.spend:0;
  const roasDays=dailyData.filter(d=>d.roas!==null);
  const roasAvg=roasDays.length>0?roasDays.reduce((a,b)=>a+b.roas,0)/roasDays.length:0;

  return(
    <div>
      <SectionTitle color={T.violet}>Visão Geral do Período</SectionTitle>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(138px,1fr))",gap:10,marginBottom:20}}>
        <KPI label="Gasto Meta"      value={fmtR(meta?.totals.spend)}              accent={T.meta}/>
        <KPI label="Receita Shopify" value={fmtUSD(shopify?.totalRevenue)}          accent={T.shopify} sub="em USD"/>
        <KPI label="Receita em BRL"  value={fmtR((shopify?.totalRevenue||0)*rate)}  accent={T.shopify}/>
        <KPI label="ROAS Global"     value={fmtX(roasGlobal)} large
          accent={roasGlobal>=3?T.good:roasGlobal>=1?T.warn:roasGlobal>0?T.bad:T.border}/>
        <KPI label="ROAS Médio/Dia"  value={fmtX(roasAvg)}   accent={T.violet}     sub={`${roasDays.length} dias`}/>
        <KPI label="Pedidos Shopify" value={fmt(shopify?.totalOrders)}              accent={T.shopify}/>
        <KPI label="Ticket Médio"    value={fmtUSD(shopify?.avgTicket)}             accent={T.shopify}/>
        <KPI label="Rec. Líq. BRL" value={fmtR((shopify?.totalRevenue||0)*rate*(1-fee/100))}
          accent={T.good} sub={`após ${fee}% Stripe`}/>
        <KPI label="Compras Meta"    value={fmt(meta?.totals.purchases)}            accent={T.meta} sub="atribuição Meta"/>
        <KPI label="CPA Meta"        value={fmtR(meta?.totals.cpa)}               accent={T.meta}/>
        <KPI label="LPV"             value={fmt(meta?.totals.lpv)}                 accent={T.violet}/>
        <KPI label="Custo/LPV"       value={fmtR(meta?.totals.costLpv)}           accent={T.violet}/>
        <KPI label="CVR LPV→Compra" value={fmtPct(meta?.totals.cvr)}             accent={T.violet}/>
      </div>

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
      <Collapsible title="Meta × Shopify por País" color={T.violet} id="country-cross">
        <CountryCrossover meta={meta} shopify={shopify} pinterest={pinterest} rate={rate}/>
      </Collapsible>
      <Collapsible title="Insights & Sugestões" color={T.warn} id="insights">
        <SuggestionsPanel meta={meta} shopify={shopify} pinterest={pinterest} rate={rate}/>
      </Collapsible>
    </div>
  );
}


/* ─── CREATIVE IMAGE CELL ────────────────────────────────── */
function CreativeImageCell({adName, images, onUpload}){
  const[uploading,setUploading]=useState(false);
  const shortName=adName.trim().slice(0,80);
  const url=images[shortName];

  const handleFile=async(file)=>{
    if(!file)return;
    setUploading(true);
    await onUpload(shortName, file);
    setUploading(false);
  };

  return(
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      {/* Thumbnail or placeholder */}
      <label style={{cursor:"pointer",flexShrink:0}}>
        <input type="file" accept="image/*" style={{display:"none"}}
          onChange={e=>handleFile(e.target.files[0])}/>
        {url?(
          <img src={url} alt={shortName}
            style={{width:48,height:48,objectFit:"cover",borderRadius:7,
              border:`2px solid ${T.violet}`,display:"block",flexShrink:0}}
            title="Clique para trocar imagem"/>
        ):(
          <div style={{width:48,height:48,borderRadius:7,flexShrink:0,
            border:`2px dashed ${uploading?T.violet:T.faint}`,
            background:uploading?T.violetL:"#faf8f5",
            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
            gap:1}}
            title="Clique para adicionar imagem do criativo">
            <span style={{fontSize:14}}>{uploading?"⏳":"🖼"}</span>
            {!uploading&&<span style={{fontSize:7,color:T.faint,letterSpacing:"0.05em"}}>ADD</span>}
          </div>
        )}
      </label>
      {/* Name */}
      <span style={{maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",
        whiteSpace:"nowrap",fontSize:11,fontWeight:600,color:T.text}}
        title={adName}>
        {adName.split("|")[0].trim()}
      </span>
    </div>
  );
}

/* ─── CREATIVES TABLE ────────────────────────────────────── */
function CreativesTable({rows, sort, onSort, images, onImageUpload}){
  const[expanded,setExpanded]=useState(null); // expanded row name

  if(!rows?.length) return(
    <div style={{padding:28,textAlign:"center",color:T.faint,fontSize:12}}>
      Exporte na aba Anúncios (não Conjuntos)
    </div>
  );

  const TH=(k,label,align="right")=>(
    <th key={k} onClick={()=>onSort(k)} style={{
      padding:"8px 10px",fontSize:9,color:sort?.key===k?T.meta:T.muted,
      letterSpacing:"0.1em",textTransform:"uppercase",textAlign:align,
      borderBottom:`2px solid ${sort?.key===k?T.meta:T.border}`,
      cursor:"pointer",whiteSpace:"nowrap",background:"#faf8f5",
      fontFamily:"'Syne',sans-serif",userSelect:"none",
    }}>{label}{sort?.key===k?(sort.dir==="asc"?" ↑":" ↓"):""}</th>
  );

  return(
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden"}}>
      {/* Upload hint */}
      <div style={{padding:"8px 14px",background:T.violetL,borderBottom:`1px solid ${T.border}`,
        fontSize:10,color:T.violet,display:"flex",alignItems:"center",gap:6}}>
        <span>🖼</span>
        <span><b>Clique no quadrado</b> ao lado do nome para subir a imagem do criativo. Clique no nome para expandir.</span>
      </div>
      {/* Header */}
      <div style={{padding:"10px 14px",borderBottom:`1px solid ${T.border}`,
        display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <SectionTitle color={T.meta} mb={0}>{rows.length} Criativos</SectionTitle>
        <ExportBtn data={rows} filename="criativos.csv" cols={[
          {key:"name",label:"Criativo"},{key:"reach",label:"Alcance"},
          {key:"impressions",label:"Impressões"},{key:"freq",label:"Frequência"},
          {key:"clicks",label:"Cliques"},{key:"ctr",label:"CTR%"},
          {key:"cpm",label:"CPM"},{key:"cpc",label:"CPC"},
          {key:"lpv",label:"LPV"},{key:"addCart",label:"Cart"},
          {key:"purchases",label:"Compras"},{key:"spend",label:"Gasto"},
          {key:"cpa",label:"CPA"},{key:"cvr",label:"CVR%"},
        ]}/>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr>
              {TH("name","Criativo","left")}
              {TH("reach","Alcance")}
              {TH("impressions","Impr.")}
              {TH("freq","Freq.")}
              {TH("clicks","Cliques")}
              {TH("ctr","CTR")}
              {TH("cpm","CPM")}
              {TH("cpc","CPC")}
              {TH("lpv","LPV")}
              {TH("addCart","Cart")}
              {TH("purchases","Compras")}
              {TH("spend","Gasto")}
              {TH("cpa","CPA")}
              {TH("cvr","CVR")}
            </tr>
          </thead>
          <tbody>
            {rows.map((row,i)=>{
              const isExp=expanded===row.name;
              // Parse name: Meta exports as "Campaign | Adset | Ad"
              const parts=row.name.split("|").map(s=>s.trim());
              const adLabel=parts[parts.length-1]; // last segment = ad name
              const hierarchy=parts.length>1?parts.slice(0,-1).join(" › "):"";
              return(
                <>
                  <tr key={row.name} style={{background:i%2===0?"#fffcf9":T.card,
                    borderBottom:isExp?`2px solid ${T.meta}`:"none"}}>
                    {/* Name cell */}
                    <td style={{padding:"8px 10px",minWidth:220,maxWidth:300}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <CreativeImageCell adName={row.name} images={images} onUpload={onImageUpload}/>
                        <div style={{minWidth:0}}>
                          <div onClick={()=>setExpanded(isExp?null:row.name)}
                            style={{fontWeight:700,fontSize:11,color:T.text,cursor:"pointer",
                              wordBreak:"break-word",lineHeight:1.3,
                              textDecoration:isExp?"underline":"none",
                              textDecorationColor:T.meta}}>
                            {adLabel}
                          </div>
                          {hierarchy&&<div style={{fontSize:9,color:T.faint,marginTop:2,lineHeight:1.2}}>{hierarchy}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{padding:"8px 10px",fontSize:11,textAlign:"right",color:T.muted}}>{fmt(row.reach)}</td>
                    <td style={{padding:"8px 10px",fontSize:11,textAlign:"right",color:T.muted}}>{fmt(row.impressions)}</td>
                    <td style={{padding:"8px 10px",fontSize:11,textAlign:"right",
                      color:row.freq>3?T.bad:row.freq>2?T.warn:row.freq>0?T.good:T.faint,fontWeight:row.freq>0?700:400}}>
                      {row.freq>0?row.freq.toFixed(2)+"×":"—"}
                    </td>
                    <td style={{padding:"8px 10px",fontSize:11,textAlign:"right",color:T.muted}}>{row.clicks>0?fmt(row.clicks):"—"}</td>
                    <td style={{padding:"8px 10px",fontSize:11,textAlign:"right",fontWeight:700,
                      color:row.ctr>=2?T.good:row.ctr>=0.5?T.warn:row.ctr>0?T.bad:T.faint}}>
                      {row.ctr>0?fmtPct(row.ctr):"—"}
                    </td>
                    <td style={{padding:"8px 10px",fontSize:11,textAlign:"right",color:T.muted}}>{row.cpm>0?fmtR(row.cpm):"—"}</td>
                    <td style={{padding:"8px 10px",fontSize:11,textAlign:"right",color:T.muted}}>{row.cpc>0?fmtR(row.cpc):"—"}</td>
                    <td style={{padding:"8px 10px",fontSize:11,textAlign:"right",color:T.violet}}>{fmt(row.lpv)}</td>
                    <td style={{padding:"8px 10px",fontSize:11,textAlign:"right",color:T.warn}}>{fmt(row.addCart)}</td>
                    <td style={{padding:"8px 10px",fontSize:11,textAlign:"right",fontWeight:700,
                      color:row.purchases>0?T.good:T.faint}}>{fmt(row.purchases)}</td>
                    <td style={{padding:"8px 10px",fontSize:11,textAlign:"right",color:T.meta}}>{fmtR(row.spend)}</td>
                    <td style={{padding:"8px 10px",fontSize:11,textAlign:"right",
                      color:row.cpa>0?T.text:T.faint}}>{row.cpa>0?fmtR(row.cpa):"—"}</td>
                    <td style={{padding:"8px 10px",fontSize:11,textAlign:"right",
                      color:row.cvr>=3?T.good:row.cvr>=1?T.warn:row.cvr>0?T.bad:T.faint}}>
                      {row.cvr>0?fmtPct(row.cvr):"—"}
                    </td>
                  </tr>
                  {/* Expanded detail row */}
                  {isExp&&(
                    <tr key={row.name+"_exp"} style={{background:T.metaL}}>
                      <td colSpan={14} style={{padding:"12px 16px"}}>
                        <div style={{fontSize:9,color:T.muted,marginBottom:6,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"'Syne',sans-serif"}}>Nome completo</div>
                        <div style={{fontSize:11,color:T.text,fontWeight:600,wordBreak:"break-all",marginBottom:10,fontFamily:"monospace",background:"#fff",padding:"6px 10px",borderRadius:6,border:`1px solid ${T.border}`}}>{row.name}</div>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8}}>
                          {[
                            {l:"Alcance",    v:fmt(row.reach),           c:T.meta},
                            {l:"Impressões", v:fmt(row.impressions),     c:T.meta},
                            {l:"Frequência", v:row.freq>0?row.freq.toFixed(2)+"×":"—", c:row.freq>3?T.bad:row.freq>2?T.warn:T.good},
                            {l:"Cliques",    v:row.clicks>0?fmt(row.clicks):"—", c:T.meta},
                            {l:"CTR",        v:row.ctr>0?fmtPct(row.ctr):"—",   c:row.ctr>=2?T.good:row.ctr>=0.5?T.warn:T.bad},
                            {l:"CPM",        v:row.cpm>0?fmtR(row.cpm):"—",    c:T.muted},
                            {l:"CPC",        v:row.cpc>0?fmtR(row.cpc):"—",    c:T.muted},
                            {l:"LPV",        v:fmt(row.lpv),             c:T.violet},
                            {l:"Add Cart",   v:fmt(row.addCart),         c:T.warn},
                            {l:"Compras",    v:fmt(row.purchases),       c:T.good},
                            {l:"Gasto",      v:fmtR(row.spend),         c:T.meta},
                            {l:"CPA",        v:row.cpa>0?fmtR(row.cpa):"—", c:T.text},
                            {l:"CVR",        v:row.cvr>0?fmtPct(row.cvr):"—", c:row.cvr>=3?T.good:T.warn},
                          ].map(k=>(
                            <div key={k.l} style={{background:"#fff",borderRadius:7,padding:"7px 10px",borderTop:`2px solid ${k.c}`}}>
                              <div style={{fontSize:8,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"'Syne',sans-serif",marginBottom:2}}>{k.l}</div>
                              <div style={{fontSize:13,fontWeight:700,color:k.c,fontFamily:"'Syne',sans-serif"}}>{k.v}</div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


/* ─── TAB: META ADS ──────────────────────────────────────── */
function MetaTab({meta,shopify,rate,fee=6.8,onFile,creativeImages,onImageUpload}){
  const[sub,setSub]=useState("overview");

  const creativeRows=useMemo(()=>{
    if(!meta)return[];
    return Object.entries(meta.byCreative).map(([name,d])=>{
      // CPC: prefer direct from Meta export, fallback to spend/clicks
      const cpcDirect=d._cpcCount>0?d._cpcSum/d._cpcCount:0;
      // clicks: derive from CPC if zero (spend/cpc)
      const clicks=d.clicks>0?d.clicks:(cpcDirect>0?Math.round(d.spend/cpcDirect):0);
      const cpc=cpcDirect>0?cpcDirect:(clicks>0?d.spend/clicks:0);
      const cpm=d.impressions>0?(d.spend/d.impressions)*1000:0;
      const ctr=d.impressions>0&&clicks>0?(clicks/d.impressions)*100:0;
      const freq=d._freqImprTotal>0?d._freqImprSum/d._freqImprTotal:0;
      return {
        name,                     // full name — display handled in render
        reach:d.reach||0,
        impressions:d.impressions,
        freq,
        clicks,
        ctr, cpm, cpc,
        lpv:d.lpv, addCart:d.addCart,
        checkout:d.checkout, purchases:d.purchases, spend:d.spend,
        cpa:d.purchases>0?d.spend/d.purchases:0,
        cvr:d.lpv>0?(d.purchases/d.lpv)*100:0,
        costLpv:d.lpv>0?d.spend/d.lpv:0,
      };
    });
  },[meta]);

  const countryRows=useMemo(()=>{
    if(!meta)return[];
    return Object.entries(meta.byCountry).filter(([,d])=>d.purchases>0)
      .map(([country,d])=>({
        country,purchases:d.purchases,spend:d.spend,impressions:d.impressions,lpv:d.lpv,
        shopifyOrders:shopify?.byCountry[country]?.orders||0,
        shopifyRevUSD:shopify?.byCountry[country]?.revenue||0,
        shopifyRevBRL:(shopify?.byCountry[country]?.revenue||0)*rate,
        roas:d.spend>0&&shopify?.byCountry[country]?.revenue?(shopify.byCountry[country].revenue*rate)/d.spend:0,
        cpa:d.purchases>0?d.spend/d.purchases:0,
      }));
  },[meta,shopify,rate]);

  const{sorted:sC,sort:sortC,onSort:onSC}=useSortable(creativeRows,"purchases");
  const{sorted:sCo,sort:sortCo,onSort:onSCo}=useSortable(countryRows,"purchases");

  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
        <UploadZone label="Meta Ads CSV" sub="Anúncios + Detalhamento País → CSV" onFile={onFile} loaded={!!meta} color={T.meta}/>
        <div style={{background:T.metaL,borderRadius:10,padding:"12px 14px",fontSize:11,color:"#1e40af",lineHeight:1.85}}>
          <div style={{fontWeight:700,fontSize:9,letterSpacing:"0.12em",marginBottom:4,fontFamily:"'Syne',sans-serif"}}>COMO EXPORTAR — UM ARQUIVO SÓ</div>
          1. Gerenciador → aba <b>Anúncios</b><br/>
          2. Seleciona o período<br/>
          3. <b>Detalhamento → País</b><br/>
          4. <b>Exportar → CSV</b>
        </div>
      </div>

      {!meta&&<div style={{textAlign:"center",padding:"44px 0",color:T.faint,fontSize:13}}>Faça upload do CSV do Meta Ads</div>}
      {meta&&(
        <>
          <div style={{display:"flex",gap:2,marginBottom:18,background:T.bg,borderRadius:8,padding:3,border:`1px solid ${T.border}`,width:"fit-content"}}>
            {["overview","funil","criativos","países"].map(s=>(
              <button key={s} onClick={()=>setSub(s)} style={{
                background:sub===s?T.card:"transparent",border:"none",cursor:"pointer",
                padding:"5px 14px",fontSize:11,fontWeight:sub===s?700:500,
                color:sub===s?T.meta:T.muted,borderRadius:6,transition:"all 0.15s",
                fontFamily:"'Syne',sans-serif",letterSpacing:"0.05em",
                boxShadow:sub===s?"0 1px 3px rgba(0,0,0,0.07)":"none"}}>
                {s.charAt(0).toUpperCase()+s.slice(1)}
              </button>
            ))}
          </div>

          {sub==="overview"&&(
            <>
              <Collapsible title="Investimento & Alcance" color={T.meta} id="meta-invest">
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10}}>
                  <KPI label="Valor Gasto"   value={fmtR(meta.totals.spend)}      accent={T.meta}/>
                  <KPI label="Alcance"       value={fmt(meta.totals.reach)}        accent={T.meta}/>
                  <KPI label="Impressões"    value={fmt(meta.totals.impressions)}  accent={T.meta}/>
                  <KPI label="Frequência"    value={meta.totals.freqAvg>0?meta.totals.freqAvg.toFixed(2)+"×":"—"}  accent={T.meta}
                    sub="média de exibições/pessoa"/>
                  <KPI label="Cliques"       value={fmt(meta.totals.clicks)}       accent={T.meta}/>
                  <KPI label="CTR"           value={fmtPct(meta.totals.ctr)}       accent={T.meta}
                    sub={meta.totals.ctr>=2?"bom":meta.totals.ctr>=0.5?"ok":"baixo"}/>
                  <KPI label="CPM"           value={fmtR(meta.totals.cpm)}         accent={T.meta}
                    sub="custo/1000 impr."/>
                  <KPI label="CPC"           value={fmtR(meta.totals.cpc)}         accent={T.meta}
                    sub="custo/clique"/>
                </div>
              </Collapsible>
              <Collapsible title="Funil de Conversão" color={T.violet} id="meta-funil">
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10}}>
                  <KPI label="Vis. Pág."    value={fmt(meta.totals.lpv)}          accent={T.violet}/>
                  <KPI label="Custo/LPV"   value={fmtR(meta.totals.costLpv)}    accent={T.violet}/>
                  <KPI label="Add Carrinho" value={fmt(meta.totals.addCart)}      accent={T.warn}/>
                  {meta.totals.hasCheckout&&<KPI label="Fin. Carrinho" value={fmt(meta.totals.checkout)} accent={T.warn}/>}
                  <KPI label="Compras"     value={fmt(meta.totals.purchases)}    accent={T.good}/>
                  <KPI label="CPA"         value={fmtR(meta.totals.cpa)}        accent={T.good}/>
                  <KPI label="CVR LPV→Comp" value={fmtPct(meta.totals.cvr)}     accent={T.violet}/>
                </div>
              </Collapsible>
            </>
          )}

          {sub==="funil"&&(
            <div style={{maxWidth:440,background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:20}}>
              <SectionTitle color={T.meta}>Funil Visual</SectionTitle>
              {[
                {label:"Impressões",        value:meta.totals.impressions, color:"#93c5fd"},
                {label:"Cliques",           value:meta.totals.clicks,      color:"#60a5fa"},
                {label:"Vis. Pág. Destino", value:meta.totals.lpv,         color:T.violet},
                {label:"Add Carrinho",      value:meta.totals.addCart,     color:T.warn},
                {label:"Fin. Carrinho",          value:meta.totals.checkout,    color:"#f97316"},
                {label:"Compras (Meta)",    value:meta.totals.purchases,   color:T.good},
              ].map(s=><FunnelBar key={s.label} {...s} max={meta.totals.impressions}/>)}
              <div style={{marginTop:14,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,borderTop:`1px solid ${T.border}`,paddingTop:14}}>
                {[
                  {l:"Imp→LPV",    v:meta.totals.impressions>0?fmtPct((meta.totals.lpv/meta.totals.impressions)*100):"—"},
                  {l:"LPV→Cart",   v:meta.totals.lpv>0?fmtPct((meta.totals.addCart/meta.totals.lpv)*100):"—"},
                  {l:"LPV→Compra", v:meta.totals.lpv>0?fmtPct((meta.totals.purchases/meta.totals.lpv)*100):"—"},
                ].map(r=>(
                  <div key={r.l} style={{textAlign:"center"}}>
                    <div style={{fontSize:9,color:T.faint,marginBottom:3,letterSpacing:"0.06em"}}>{r.l}</div>
                    <div style={{fontSize:20,fontWeight:700,color:T.meta,fontFamily:"'Syne',sans-serif"}}>{r.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sub==="criativos"&&(
            <CreativesTable
              rows={sC} sort={sortC} onSort={onSC}
              images={creativeImages||{}}
              onImageUpload={onImageUpload||(() => {})}
            />
          )}

          {sub==="países"&&(
            countryRows.length===0
              ?<div style={{background:T.metaL,borderRadius:10,padding:"14px 18px",fontSize:12,color:"#1e40af"}}>
                Sem compras no período. Certifique que exportou com <b>Detalhamento → País</b>.
               </div>
              :<div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden"}}>
                <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`}}>
                  <SectionTitle color={T.meta} mb={0}>Países com Compras</SectionTitle>
                </div>
                <DataTable sort={sortCo} onSort={onSCo}
                  cols={[
                    {key:"country",       label:"País",         align:"left", render:v=><b style={{color:T.text}}>{v}</b>},
                    {key:"impressions",   label:"Impr.",        render:v=>fmt(v)},
                    {key:"lpv",           label:"LPV",          render:v=>fmt(v)},
                    {key:"purchases",     label:"Compras Meta", render:v=>fmt(v), color:v=>v>0?T.meta:T.faint},
                    {key:"shopifyOrders", label:"Pedidos Shop", render:v=>fmt(v), color:v=>v>0?T.shopify:T.faint},
                    {key:"spend",         label:"Gasto",        render:v=>fmtR(v)},
                    {key:"shopifyRevUSD", label:"Receita USD",  render:v=>fmtUSD(v), color:v=>v>0?T.good:T.faint},
                    {key:"roas",          label:"ROAS",         render:v=>fmtX(v), color:v=>v>=3?T.good:v>=1?T.warn:v>0?T.bad:T.faint},
                    {key:"cpa",           label:"CPA",          render:v=>fmtR(v)},
                  ]}
                  rows={sCo}/>
               </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── TAB: SHOPIFY ───────────────────────────────────────── */
function ShopifyTab({shopify,onFile,productImages,onProductImageUpload}){
  const countryRows=useMemo(()=>{
    if(!shopify)return[];
    return Object.entries(shopify.byCountry).map(([c,d])=>({
      country:c,orders:d.orders,revenue:d.revenue,avgTicket:d.orders>0?d.revenue/d.orders:0
    }));
  },[shopify]);
  const productRows=useMemo(()=>{
    if(!shopify)return[];
    return Object.entries(shopify.byProduct).map(([name,d])=>({
      name,orders:d.orders,qty:d.qty||0,revenue:d.revenue||0,skus:d.skus||[]
    }));
  },[shopify]);
  const{sorted:sC,sort:sortC,onSort:onSC}=useSortable(countryRows,"revenue");
  const{sorted:sP,sort:sortP,onSort:onSP}=useSortable(productRows,"orders");

  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
        <UploadZone label="Shopify Pedidos CSV" sub="Admin → Pedidos → Exportar → Todos" onFile={onFile} loaded={!!shopify} color={T.shopify}/>
        <div style={{background:T.shopifyL,borderRadius:10,padding:"12px 14px",fontSize:11,color:"#065f46",lineHeight:1.85}}>
          <div style={{fontWeight:700,fontSize:9,letterSpacing:"0.12em",marginBottom:4,fontFamily:"'Syne',sans-serif"}}>COMO EXPORTAR</div>
          Admin → Pedidos → <b>Exportar</b><br/>
          Seleciona <b>Todos os pedidos</b> do período<br/>
          Formato: <b>CSV simples</b>
        </div>
      </div>

      {!shopify&&<div style={{textAlign:"center",padding:"44px 0",color:T.faint,fontSize:13}}>Faça upload do CSV de pedidos do Shopify</div>}
      {shopify&&(
        <>
          <SectionTitle color={T.shopify}>Resumo</SectionTitle>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(138px,1fr))",gap:10,marginBottom:20}}>
            <KPI label="Pedidos"      value={fmt(shopify.totalOrders)}       accent={T.shopify}/>
            <KPI label="Receita USD"  value={fmtUSD(shopify.totalRevenue)}   accent={T.shopify}/>
            <KPI label="Ticket Médio" value={fmtUSD(shopify.avgTicket)}      accent={T.shopify}/>
          </div>
          {countryRows.length>0&&(
            <>
              <SectionTitle color={T.shopify}>Por País</SectionTitle>
              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden",marginBottom:20}}>
                <DataTable sort={sortC} onSort={onSC}
                  cols={[
                    {key:"country",   label:"País",         align:"left", render:v=><b style={{color:T.text}}>{v}</b>},
                    {key:"orders",    label:"Pedidos",      render:v=>fmt(v), color:v=>v>0?T.shopify:T.faint},
                    {key:"revenue",   label:"Receita USD",  render:v=>fmtUSD(v), color:v=>v>0?T.good:T.faint},
                    {key:"avgTicket", label:"Ticket Médio", render:v=>fmtUSD(v)},
                  ]}
                  rows={sC}/>
              </div>
            </>
          )}
          {productRows.length>0&&(
            <>
              <SectionTitle color={T.shopify}>Por Produto</SectionTitle>
              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden"}}>
                <DataTable sort={sortP} onSort={onSP}
                  cols={[
                    {key:"name", label:"Produto", align:"left", render:(v,row)=>(
                      <div style={{display:"flex",alignItems:"center",gap:9}}>
                        <CreativeImageCell adName={"prod_"+v} images={productImages||{}} onUpload={onProductImageUpload||((n,f)=>{})}/>
                        <div>
                          <div title={v} style={{maxWidth:280,overflow:"hidden",textOverflow:"ellipsis",
                            whiteSpace:"nowrap",fontWeight:600,fontSize:11,color:T.text}}>{v}</div>
                          {row.skus?.length>0&&(
                            <div style={{fontSize:9,color:T.faint,marginTop:1}}>{row.skus.join(" · ")}</div>
                          )}
                        </div>
                      </div>
                    )},
                    {key:"orders",  label:"Pedidos", render:v=>fmt(v),   color:v=>v>0?T.shopify:T.faint},
                    {key:"qty",     label:"Itens",   render:v=>fmt(v||0), color:v=>v>0?T.shopify:T.faint},
                    {key:"revenue", label:"Rec. USD",render:v=>v>0?fmtUSD(v):"—", color:v=>v>0?T.good:T.faint},
                  ]}
                  rows={sP}/>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ─── TAB: PINTEREST ─────────────────────────────────────── */
function PinterestTab({pinterest,onFile}){
  const rows=useMemo(()=>{
    if(!pinterest)return[];
    return Object.entries(pinterest.byPin).map(([name,d])=>({
      name,...d,ctr:d.impressions>0?(d.clicks/d.impressions)*100:0
    }));
  },[pinterest]);
  const{sorted,sort,onSort}=useSortable(rows,"conversions");

  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
        <UploadZone label="Pinterest Ads CSV" sub="Ads Manager → Reporting → Export CSV" onFile={onFile} loaded={!!pinterest} color={T.pinterest}/>
        <div style={{background:T.pinterestL,borderRadius:10,padding:"12px 14px",fontSize:11,color:"#9a1a1a",lineHeight:1.85}}>
          <div style={{fontWeight:700,fontSize:9,letterSpacing:"0.12em",marginBottom:4,fontFamily:"'Syne',sans-serif"}}>COMO EXPORTAR</div>
          Pinterest Ads → <b>Reporting</b><br/>
          Seleciona período → <b>Export data</b><br/>
          Inclui: Impressões, Cliques, Saves, Gasto, Conversões
        </div>
      </div>
      {!pinterest&&<div style={{textAlign:"center",padding:"44px 0",color:T.faint,fontSize:13}}>Faça upload do CSV do Pinterest Ads</div>}
      {pinterest&&(
        <>
          <SectionTitle color={T.pinterest}>Resumo</SectionTitle>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(138px,1fr))",gap:10,marginBottom:18}}>
            <KPI label="Impressões"  value={fmt(pinterest.totals.impressions)} accent={T.pinterest}/>
            <KPI label="Cliques"     value={fmt(pinterest.totals.clicks)}      accent={T.pinterest}/>
            <KPI label="Saves"       value={fmt(pinterest.totals.saves)}       accent={T.pinterest}/>
            <KPI label="CTR"         value={fmtPct(pinterest.totals.ctr)}      accent={T.pinterest}/>
            <KPI label="Gasto"       value={fmtUSD(pinterest.totals.spend)}    accent={T.pinterest}/>
            <KPI label="Conversões"  value={fmt(pinterest.totals.conversions)} accent={T.good}/>
            <KPI label="CPA"         value={fmtUSD(pinterest.totals.cpa)}      accent={T.warn}/>
          </div>
          <SectionTitle color={T.pinterest}>Pins — {sorted.length}</SectionTitle>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden"}}>
            <DataTable sort={sort} onSort={onSort}
              cols={[
                {key:"name",       label:"Pin",      align:"left", render:v=><span style={{maxWidth:220,display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:600,fontSize:11,color:T.text}}>{v}</span>},
                {key:"impressions",label:"Impr.",    render:v=>fmt(v)},
                {key:"clicks",     label:"Cliques",  render:v=>fmt(v)},
                {key:"saves",      label:"Saves",    render:v=>fmt(v)},
                {key:"ctr",        label:"CTR",      render:v=>fmtPct(v)},
                {key:"spend",      label:"Gasto",    render:v=>fmtUSD(v)},
                {key:"conversions",label:"Conv.",    render:v=>fmt(v), color:v=>v>0?T.good:T.faint},
              ]}
              rows={sorted}/>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── TAB: CAMPANHA CONFIG ───────────────────────────────── */
function CampaignCard({name,data,shopify,rate,monthData,expanded,onToggle,creativeImages,onImageUpload}){
  const months=Object.keys(monthData).sort();
  const revBRL=(shopify?.totalRevenue||0)*rate;
  const roas=data.spend>0&&revBRL>0?revBRL/data.spend:0;
  const cpa=data.purchases>0?data.spend/data.purchases:0;
  const cpm=data.impressions>0?(data.spend/data.impressions)*1000:0;
  const ctr=data.impressions>0&&data.clicks>0?(data.clicks/data.impressions)*100:0;
  const cpc=data.clicks>0?data.spend/data.clicks:0;
  const days=data.dates?.length||1;
  const dailyAvg=data.spend/days;

  return(
    <div style={{background:"#fff",border:`1.5px solid ${expanded?"#2563eb":"#e8e2da"}`,borderRadius:12,
      marginBottom:12,overflow:"hidden",boxShadow:expanded?"0 0 0 3px #dbeafe":"none",transition:"all 0.15s"}}>
      {/* Header card */}
      <div onClick={onToggle} style={{padding:"14px 18px",cursor:"pointer",userSelect:"none"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:800,color:"#1a1714",fontFamily:"'Syne',sans-serif",marginBottom:6}}>{name}</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
              <span style={{fontSize:10,background:"#dbeafe",color:"#2563eb",padding:"2px 8px",borderRadius:20,fontWeight:700}}>
                {detectObjective(name)}
              </span>
              <span style={{fontSize:10,color:"#8a7f74",background:"#f0fdf4",padding:"2px 8px",borderRadius:20}}>
                {days} dias ativos
              </span>
              <span style={{fontSize:10,color:"#16a34a",fontWeight:700,background:"#f0fdf4",padding:"2px 8px",borderRadius:20}}>
                ~{fmtR(dailyAvg)}/dia méd.
              </span>
            </div>
          </div>
          <span style={{fontSize:10,color:"#8a7f74",fontFamily:"'Syne',sans-serif",fontWeight:600,marginLeft:12,flexShrink:0}}>
            {expanded?"▲ fechar":"▼ expandir"}
          </span>
        </div>
        {/* Mini KPIs always visible */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))",gap:7,marginTop:12}}>
          {[
            {l:"Gasto",      v:fmtR(data.spend),      c:"#2563eb"},
            {l:"Comp. Meta", v:fmt(data.purchases),   c:"#2563eb"},
            {l:"CPA",        v:cpa>0?fmtR(cpa):"—",  c:"#d97706"},
            {l:"ROAS",       v:roas>0?fmtX(roas):"—", c:roas>=3?"#16a34a":roas>=1?"#d97706":"#dc2626"},
            {l:"LPV",        v:fmt(data.lpv),          c:"#7c3aed"},
            {l:"CTR",        v:ctr>0?fmtPct(ctr):"—", c:ctr>=1?"#16a34a":ctr>=0.5?"#d97706":"#dc2626"},
            {l:"CPM",        v:cpm>0?fmtR(cpm):"—",  c:"#8a7f74"},
            {l:"CPC",        v:cpc>0?fmtR(cpc):"—",  c:"#8a7f74"},
          ].map(k=>(
            <div key={k.l} style={{background:"#f5f2ee",borderRadius:7,padding:"7px 9px",borderTop:`2px solid ${k.c}`}}>
              <div style={{fontSize:7,color:"#8a7f74",letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:"'Syne',sans-serif",marginBottom:1}}>{k.l}</div>
              <div style={{fontSize:13,fontWeight:700,color:k.c,fontFamily:"'Syne',sans-serif"}}>{k.v||"—"}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Expanded: by month */}
      {expanded&&months.length>0&&(
        <div style={{borderTop:"1px solid #e8e2da",padding:"14px 18px",background:"#faf8f5"}}>
          <div style={{fontSize:9,color:"#8a7f74",letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"'Syne',sans-serif",marginBottom:10}}>Por Mês</div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead>
                <tr>
                  {["Mês","Gasto","Comp.","LPV","Add Cart","CPM","CPC","CTR"].map(h=>(
                    <th key={h} style={{padding:"5px 8px",fontSize:9,color:"#8a7f74",letterSpacing:"0.1em",textTransform:"uppercase",
                      textAlign:h==="Mês"?"left":"right",borderBottom:"1px solid #e8e2da",fontFamily:"'Syne',sans-serif",whiteSpace:"nowrap"}}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {months.map((m,i)=>{
                  const d=monthData[m];
                  const mCpm=d.impressions>0?(d.spend/d.impressions)*1000:0;
                  const mCpc=d.clicks>0?d.spend/d.clicks:0;
                  const mCtr=d.impressions>0&&d.clicks>0?(d.clicks/d.impressions)*100:0;
                  const[yr,mo]=m.split("-");
                  const label=new Date(parseInt(yr),parseInt(mo)-1,1).toLocaleDateString("pt-BR",{month:"short",year:"2-digit"});
                  return(
                    <tr key={m} style={{background:i%2===0?"#fff":"#f5f2ee"}}>
                      <td style={{padding:"6px 8px",fontWeight:700,color:"#1a1714",whiteSpace:"nowrap"}}>{label}</td>
                      <td style={{padding:"6px 8px",textAlign:"right",color:"#2563eb",fontWeight:600}}>{fmtR(d.spend)}</td>
                      <td style={{padding:"6px 8px",textAlign:"right",color:d.purchases>0?"#2563eb":"#c8bfb4",fontWeight:d.purchases>0?700:400}}>{fmt(d.purchases)}</td>
                      <td style={{padding:"6px 8px",textAlign:"right",color:"#7c3aed"}}>{fmt(d.lpv)}</td>
                      <td style={{padding:"6px 8px",textAlign:"right",color:"#d97706"}}>{fmt(d.addCart)}</td>
                      <td style={{padding:"6px 8px",textAlign:"right",color:"#8a7f74"}}>{mCpm>0?fmtR(mCpm):"—"}</td>
                      <td style={{padding:"6px 8px",textAlign:"right",color:"#8a7f74"}}>{mCpc>0?fmtR(mCpc):"—"}</td>
                      <td style={{padding:"6px 8px",textAlign:"right",color:mCtr>=1?"#16a34a":mCtr>=0.5?"#d97706":mCtr>0?"#dc2626":"#c8bfb4"}}>{mCtr>0?fmtPct(mCtr):"—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function CampaignTab({meta, shopify, rate, creativeImages, onImageUpload}){
  const[expandedCampaigns,setExpandedCampaigns]=useState({});
  const[filterMonth,setFilterMonth]=useState("all");
  const[showConfig,setShowConfig]=useState(false);
  const[cfg,setCfg]=useState(()=>lsGet("gwm_campaign_cfg",{
    campaignName:"Vendas | Fev26",
    objective:"Vendas",
    optimization:"Maximizar conversões → Checkout",
    event:"Iniciar finalização da compra",
    pixel:"a (ID: 1255075166468968)",
    budget:"R$ 50,00/dia",
    attribution:"Padrão Meta",
    countries:["DE","ES","FR","GB","IE","NL","US"],
    ageMin:"23",ageMax:"50",gender:"Todos",
    lookalikes:"Semelhante 1% – leads\nSemelhante 1% – client list GWM jan/26\nmailing prospects.csv",
    interests:"Artes visuais\nImpressão sob demanda\nEtsy · Freelancer\nArts, Artists, Artwork\nGraphic designer (campo/empregador/cargo)",
    placements:"Automático (Advantage+)",
    notes:"",
  }));
  const setF=(k,v)=>{setCfg(p=>{const n={...p,[k]:v};lsSet("gwm_campaign_cfg",n);return n;});};
  const[newC,setNewC]=useState("");

  // Derive available months from byCampaignMonth
  const allMonths=useMemo(()=>{
    if(!meta)return[];
    const ms=new Set();
    Object.values(meta.byCampaignMonth||{}).forEach(d=>ms.add(d.month));
    return [...ms].sort();
  },[meta]);

  // Campaign data grouped, filtered by month
  const campaignList=useMemo(()=>{
    if(!meta)return[];
    return Object.entries(meta.byCampaign).map(([name,data])=>{
      // month data for this campaign
      const monthData={};
      Object.entries(meta.byCampaignMonth||{}).forEach(([k,d])=>{
        if(d.campaign===name){
          if(filterMonth==="all"||d.month===filterMonth) monthData[d.month]=d;
        }
      });
      // If filtering by month, recalculate totals
      let displayData=data;
      if(filterMonth!=="all"){
        const md=monthData[filterMonth];
        if(md) displayData={...data,...md,dates:data.dates?.filter(dt=>dt.startsWith(filterMonth))||[]};
      }
      return{name,data:displayData,monthData};
    }).sort((a,b)=>b.data.spend-a.data.spend);
  },[meta,filterMonth]);

  const toggleCampaign=(name)=>setExpandedCampaigns(p=>({...p,[name]:!p[name]}));

  const F=({label,k,multi,rows=3})=>(
    <div style={{marginBottom:13}}>
      <div style={{fontSize:9,color:"#8a7f74",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:4,fontFamily:"'Syne',sans-serif"}}>{label}</div>
      {multi
        ?<textarea value={cfg[k]} onChange={e=>setF(k,e.target.value)} rows={rows}
           style={{width:"100%",background:"#faf8f5",border:"1px solid #e8e2da",borderRadius:6,padding:"7px 10px",fontSize:11,resize:"vertical",lineHeight:1.6}}/>
        :<input value={cfg[k]} onChange={e=>setF(k,e.target.value)}
           style={{width:"100%",background:"#faf8f5",border:"1px solid #e8e2da",borderRadius:6,padding:"7px 10px",fontSize:11}}/>
      }
    </div>
  );

  return(
    <div>
      {/* Month filter */}
      {allMonths.length>0&&(
        <div style={{display:"flex",gap:6,marginBottom:18,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:9,color:"#8a7f74",fontFamily:"'Syne',sans-serif",letterSpacing:"0.1em",textTransform:"uppercase",marginRight:4}}>Período</span>
          {[["all","Todos"],...allMonths.map(m=>{const[yr,mo]=m.split("-");const l=new Date(parseInt(yr),parseInt(mo)-1,1).toLocaleDateString("pt-BR",{month:"short",year:"2-digit"});return[m,l];})].map(([k,l])=>(
            <button key={k} onClick={()=>setFilterMonth(k)} style={{
              fontSize:10,padding:"4px 12px",borderRadius:20,cursor:"pointer",fontFamily:"'Syne',sans-serif",fontWeight:700,
              border:`1px solid ${filterMonth===k?"#2563eb":"#e8e2da"}`,
              background:filterMonth===k?"#dbeafe":"transparent",color:filterMonth===k?"#2563eb":"#8a7f74"}}>
              {l}
            </button>
          ))}
          <button onClick={()=>setExpandedCampaigns(p=>{const all={};campaignList.forEach(({name})=>all[name]=true);return all;})}
            style={{marginLeft:"auto",fontSize:9,padding:"4px 10px",borderRadius:20,cursor:"pointer",border:"1px solid #e8e2da",background:"transparent",color:"#8a7f74",fontFamily:"'Syne',sans-serif"}}>
            expandir tudo
          </button>
          <button onClick={()=>setExpandedCampaigns({})}
            style={{fontSize:9,padding:"4px 10px",borderRadius:20,cursor:"pointer",border:"1px solid #e8e2da",background:"transparent",color:"#8a7f74",fontFamily:"'Syne',sans-serif"}}>
            colapsar tudo
          </button>
        </div>
      )}

      {/* Campaign cards */}
      {!meta&&<div style={{textAlign:"center",padding:"44px 0",color:"#c8bfb4",fontSize:13}}>Suba o CSV do Meta Ads na aba Meta Ads para ver campanhas aqui</div>}
      {campaignList.map(({name,data,monthData})=>(
        <CampaignCard key={name} name={name} data={data} shopify={shopify} rate={rate}
          monthData={monthData} expanded={!!expandedCampaigns[name]}
          onToggle={()=>toggleCampaign(name)}
          creativeImages={creativeImages} onImageUpload={onImageUpload}/>
      ))}

      {/* Config section (collapsible) */}
      <div style={{marginTop:24}}>
        <div onClick={()=>setShowConfig(o=>!o)} style={{
          display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",
          padding:"10px 0",borderBottom:"2px solid #7c3aed",marginBottom:showConfig?16:0}}>
          <span style={{fontSize:9,fontWeight:700,color:"#7c3aed",letterSpacing:"0.16em",textTransform:"uppercase",fontFamily:"'Syne',sans-serif"}}>
            Config. da Campanha Ativa
          </span>
          <span style={{fontSize:10,color:"#c8bfb4",fontWeight:600}}>{showConfig?"▲":"▼"}</span>
        </div>
        {showConfig&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <div>
              <div style={{background:"#fff",border:"1px solid #e8e2da",borderRadius:12,padding:18,marginBottom:14}}>
                <div style={{fontSize:9,fontWeight:700,color:"#7c3aed",letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:"'Syne',sans-serif",marginBottom:14,borderBottom:"1px solid #e8e2da",paddingBottom:8}}>Estrutura da Campanha</div>
                <F label="Nome da Campanha" k="campaignName"/>
                <F label="Objetivo" k="objective"/>
                <F label="Otimização" k="optimization"/>
                <F label="Evento de conversão" k="event"/>
                <F label="Pixel / Dataset" k="pixel"/>
                <F label="Orçamento diário" k="budget"/>
                <F label="Modelo de atribuição" k="attribution"/>
              </div>
              <div style={{background:"#fff",border:"1px solid #e8e2da",borderRadius:12,padding:18}}>
                <div style={{fontSize:9,fontWeight:700,color:"#d97706",letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:"'Syne',sans-serif",marginBottom:14,borderBottom:"1px solid #e8e2da",paddingBottom:8}}>Notas internas</div>
                <F label="Observações" k="notes" multi rows={5}/>
              </div>
            </div>
            <div>
              <div style={{background:"#fff",border:"1px solid #e8e2da",borderRadius:12,padding:18,marginBottom:14}}>
                <div style={{fontSize:9,fontWeight:700,color:"#008060",letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:"'Syne',sans-serif",marginBottom:14,borderBottom:"1px solid #e8e2da",paddingBottom:8}}>Público-alvo</div>
                <div style={{marginBottom:13}}>
                  <div style={{fontSize:9,color:"#8a7f74",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:6,fontFamily:"'Syne',sans-serif"}}>Países</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:6}}>
                    {cfg.countries.map(co=>(
                      <span key={co} style={{fontSize:11,background:"#dbeafe",color:"#2563eb",padding:"2px 9px",borderRadius:20,
                        border:"1px solid #2563eb30",display:"flex",gap:4,alignItems:"center"}}>
                        {(CDATA[co]?.flag||"")} {co}
                        <button onClick={()=>setF("countries",cfg.countries.filter(x=>x!==co))}
                          style={{background:"none",border:"none",cursor:"pointer",color:"#93c5fd",fontSize:12,lineHeight:1}}>×</button>
                      </span>
                    ))}
                    <input value={newC} onChange={e=>setNewC(e.target.value)}
                      onKeyDown={e=>{if(e.key==="Enter"&&newC.trim()){setF("countries",[...cfg.countries,newC.trim().toUpperCase()]);setNewC("");}}}
                      placeholder="+ país" style={{fontSize:11,background:"#dbeafe",border:"1px dashed #93c5fd",
                      borderRadius:20,padding:"2px 9px",color:"#2563eb",width:68}}/>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:13}}>
                  {[["ageMin","Idade mín."],["ageMax","Idade máx."],["gender","Gênero"]].map(([k,l])=>(
                    <div key={k}>
                      <div style={{fontSize:9,color:"#8a7f74",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:4,fontFamily:"'Syne',sans-serif"}}>{l}</div>
                      <input value={cfg[k]} onChange={e=>setF(k,e.target.value)}
                        style={{width:"100%",background:"#faf8f5",border:"1px solid #e8e2da",borderRadius:6,padding:"6px 8px",fontSize:11}}/>
                    </div>
                  ))}
                </div>
                <F label="Lookalikes / Públicos" k="lookalikes" multi rows={4}/>
              </div>
              <div style={{background:"#fff",border:"1px solid #e8e2da",borderRadius:12,padding:18}}>
                <div style={{fontSize:9,fontWeight:700,color:"#008060",letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:"'Syne',sans-serif",marginBottom:14,borderBottom:"1px solid #e8e2da",paddingBottom:8}}>Interesses & Posicionamento</div>
                <F label="Direcionamento detalhado" k="interests" multi rows={5}/>
                <F label="Posicionamentos" k="placements"/>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


/* ─── LEADS PANEL ────────────────────────────────────────── */
const LEAD_STATUSES=["novo","respondido","convertido","descartado"];
const STATUS_COLORS={novo:"#f59e0b",respondido:"#2563eb",convertido:"#16a34a",descartado:"#9ca3af"};

function LeadsPanel(){
  const[leads,setLeads]=useState([]);
  const[loading,setLoading]=useState(true);
  const[form,setForm]=useState({date:new Date().toISOString().slice(0,10),name:"",email:"",country:"",source:"Shopify",message:"",notes:""});
  const[saving,setSaving]=useState(false);
  const[sqlNotice,setSqlNotice]=useState(false);

  useEffect(()=>{
    sbLoadLeads().then(rows=>{
      setLeads(rows||[]);
      setLoading(false);
    }).catch(()=>{setSqlNotice(true);setLoading(false);});
  },[]);

  const addLead=async()=>{
    if(!form.name&&!form.email)return;
    setSaving(true);
    const row=await sbAddLead({...form,status:"novo"});
    if(row)setLeads(p=>[row,...p]);
    else setSqlNotice(true);
    setForm(f=>({...f,name:"",email:"",country:"",message:"",notes:""}));
    setSaving(false);
  };
  const updateStatus=async(id,status)=>{
    await sbUpdateLead(id,{status});
    setLeads(p=>p.map(l=>l.id===id?{...l,status}:l));
  };
  const deleteLead=async(id)=>{
    await sbDeleteLead(id);
    setLeads(p=>p.filter(l=>l.id!==id));
  };

  const statCounts=LEAD_STATUSES.reduce((m,s)=>({...m,[s]:leads.filter(l=>l.status===s).length}),{});

  return(
    <div>
      {sqlNotice&&(
        <div style={{background:"#fef3c7",border:"1px solid #f59e0b",borderRadius:10,padding:"12px 16px",marginBottom:16}}>
          <div style={{fontWeight:700,fontSize:11,marginBottom:6,color:"#92400e"}}>⚠ Crie a tabela no Supabase primeiro</div>
          <pre style={{fontSize:10,color:"#78350f",background:"#fff7ed",padding:"8px 10px",borderRadius:6,overflowX:"auto",lineHeight:1.6}}>{`create table leads (
  id serial primary key,
  date text, name text, email text,
  country text, source text,
  message text, notes text,
  status text default 'novo',
  created_at timestamp default now()
);
alter table leads enable row level security;
create policy "public rw" on leads for all using (true) with check (true);`}</pre>
        </div>
      )}

      {/* Status strip */}
      <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap"}}>
        {LEAD_STATUSES.map(s=>(
          <div key={s} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:9,
            padding:"8px 14px",borderLeft:`3px solid ${s==="novo"?"#f59e0b":s==="respondido"?"#2563eb":s==="convertido"?T.good:T.faint}`}}>
            <div style={{fontSize:9,color:T.muted,textTransform:"uppercase",letterSpacing:"0.1em",fontFamily:"'Syne',sans-serif"}}>{s}</div>
            <div style={{fontSize:20,fontWeight:700,color:T.text,fontFamily:"'Syne',sans-serif"}}>{statCounts[s]||0}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"340px 1fr",gap:16,alignItems:"start"}}>
        {/* Form */}
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:18}}>
          <SectionTitle color={T.warn}>Registrar Lead / Mensagem</SectionTitle>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div>
              <div style={{fontSize:9,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:3,fontFamily:"'Syne',sans-serif"}}>Data</div>
              <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}
                style={{width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"6px 8px",fontSize:11,boxSizing:"border-box"}}/>
            </div>
            <div>
              <div style={{fontSize:9,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:3,fontFamily:"'Syne',sans-serif"}}>Origem</div>
              <select value={form.source} onChange={e=>setForm(f=>({...f,source:e.target.value}))}
                style={{width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"6px 8px",fontSize:11,boxSizing:"border-box"}}>
                {["Shopify","Email","Instagram","WhatsApp","Site","Outro"].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {[["name","Nome"],["email","Email"],["country","País"]].map(([k,l])=>(
            <div key={k} style={{marginBottom:8}}>
              <div style={{fontSize:9,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:3,fontFamily:"'Syne',sans-serif"}}>{l}</div>
              <input value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
                style={{width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"6px 8px",fontSize:11,boxSizing:"border-box"}}/>
            </div>
          ))}
          <div style={{marginBottom:8}}>
            <div style={{fontSize:9,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:3,fontFamily:"'Syne',sans-serif"}}>Mensagem</div>
            <textarea value={form.message} onChange={e=>setForm(f=>({...f,message:e.target.value}))}
              rows={3} style={{width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"6px 8px",fontSize:11,resize:"vertical",boxSizing:"border-box"}}/>
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:9,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:3,fontFamily:"'Syne',sans-serif"}}>Notas internas</div>
            <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
              rows={2} style={{width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"6px 8px",fontSize:11,resize:"vertical",boxSizing:"border-box"}}/>
          </div>
          <button onClick={addLead} disabled={saving||(!form.name&&!form.email)}
            style={{width:"100%",background:T.warn,color:"#fff",border:"none",borderRadius:8,
              padding:"10px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Syne',sans-serif"}}>
            {saving?"Salvando...":"+ Adicionar Lead"}
          </button>
        </div>

        {/* List */}
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden"}}>
          <div style={{padding:"10px 14px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <SectionTitle color={T.warn} mb={0}>{leads.length} Leads / Mensagens</SectionTitle>
            <ExportBtn data={leads} filename="leads.csv" cols={[
              {key:"date",label:"Data"},{key:"name",label:"Nome"},{key:"email",label:"Email"},
              {key:"country",label:"País"},{key:"source",label:"Origem"},{key:"status",label:"Status"},
              {key:"message",label:"Mensagem"},{key:"notes",label:"Notas"},
            ]}/>
          </div>
          {loading?<div style={{padding:28,textAlign:"center",color:T.faint,fontSize:12}}>Carregando...</div>:(
            leads.length===0
              ?<div style={{padding:36,textAlign:"center",color:T.faint,fontSize:12}}>Nenhum lead registrado ainda.</div>
              :<div style={{maxHeight:580,overflowY:"auto"}}>
                {leads.map((l,i)=>(
                  <div key={l.id} style={{padding:"12px 14px",borderBottom:`1px solid ${T.border}`,
                    background:i%2===0?"#fffcf9":T.card}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:6}}>
                      <div>
                        <span style={{fontWeight:700,fontSize:12,color:T.text}}>{l.name||"—"}</span>
                        {l.email&&<span style={{fontSize:10,color:T.muted,marginLeft:8}}>{l.email}</span>}
                        <div style={{fontSize:10,color:T.faint,marginTop:2}}>
                          {l.date} · {l.source}{l.country?" · "+(CDATA[normalizeCountry(l.country)]?.flag||"")+" "+l.country:""}
                        </div>
                      </div>
                      <div style={{display:"flex",gap:4,alignItems:"center",flexShrink:0}}>
                        <select value={l.status||"novo"} onChange={e=>updateStatus(l.id,e.target.value)}
                          style={{fontSize:9,padding:"2px 6px",borderRadius:20,border:`1px solid ${T.border}`,
                            background:l.status==="convertido"?"#dcfce7":l.status==="descartado"?"#f3f4f6":l.status==="respondido"?"#dbeafe":"#fef3c7",
                            cursor:"pointer",fontFamily:"'Syne',sans-serif",fontWeight:700}}>
                          {LEAD_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
                        </select>
                        <button onClick={()=>deleteLead(l.id)}
                          style={{background:"none",border:"none",cursor:"pointer",color:T.faint,fontSize:12}}>🗑</button>
                      </div>
                    </div>
                    {l.message&&<div style={{fontSize:11,color:T.text,background:T.bg,borderRadius:6,padding:"6px 9px",marginBottom:l.notes?6:0,lineHeight:1.5}}>{l.message}</div>}
                    {l.notes&&<div style={{fontSize:10,color:T.muted,fontStyle:"italic",marginTop:3}}>{l.notes}</div>}
                  </div>
                ))}
              </div>
          )}
        </div>
      </div>
    </div>
  );
}


/* ─── TAB: FINANCEIRO ────────────────────────────────────── */
const DEFAULT_CATEGORIES=["Mídia Meta","Mídia Pinterest","Mídia Google","Ferramenta","Freelancer","Operacional","Outro"];
const CAT_COLORS=["#2563eb","#7c3aed","#d97706","#16a34a","#dc2626","#0891b2","#9333ea","#ea580c"];

function FinancialTab({meta,shopify,rate,fee=6.8}){
  const[expenses,setExpenses]=useState([]);
  const[loadingExp,setLoadingExp]=useState(true);
  const[view,setView]=useState(lsGet("gwm_fin_view","resumo"));
  const[form,setForm]=useState({date:new Date().toISOString().slice(0,10),category:"Mídia Meta",name:"",amount:""});
  const[categories,setCategories]=useState(()=>lsGet("gwm_categories",DEFAULT_CATEGORIES));
  const[newCat,setNewCat]=useState("");
  const[saving,setSaving]=useState(false);
  const[editId,setEditId]=useState(null);
  const[editVal,setEditVal]=useState("");

  useEffect(()=>{ sbLoadExpenses().then(rows=>{setExpenses(rows||[]);setLoadingExp(false);}); },[]);

  const setViewP=(v)=>{setView(v);lsSet("gwm_fin_view",v);};

  const addExpense=async()=>{
    if(!form.name||!form.amount||isNaN(parseFloat(form.amount)))return;
    setSaving(true);
    const row=await sbAddExpense({date:form.date,category:form.category,name:form.name,amount:parseFloat(form.amount)});
    if(row)setExpenses(prev=>[row,...prev]);
    setForm(f=>({...f,name:"",amount:""}));
    setSaving(false);
  };
  const deleteExpense=async(id)=>{ await sbDeleteExpense(id); setExpenses(prev=>prev.filter(e=>e.id!==id)); };
  const saveEdit=async(id)=>{ const v=parseFloat(editVal); if(isNaN(v))return; await sbUpdateExpense(id,{amount:v}); setExpenses(prev=>prev.map(e=>e.id===id?{...e,amount:v}:e)); setEditId(null); };
  const addCategory=()=>{
    if(!newCat.trim())return;
    const u=[...categories,newCat.trim()]; setCategories(u); lsSet("gwm_categories",u); setNewCat("");
  };

  // ── Computations ──────────────────────────────────
  const metaSpend=meta?.totals.spend||0;
  const shopifyRevBRL=(shopify?.totalRevenue||0)*rate;
  const shopifyRevNet=shopifyRevBRL*(1-fee/100); // after Stripe fees
  const totalManualExp=expenses.reduce((s,e)=>s+parseFloat(e.amount||0),0);
  const totalExp=metaSpend+totalManualExp;
  const roasReal=totalExp>0&&shopifyRevNet>0?shopifyRevNet/totalExp:0;
  const profit=shopifyRevNet-totalExp;

  const byCat={};
  if(metaSpend>0) byCat["Mídia Meta"]=(byCat["Mídia Meta"]||0)+metaSpend;
  for(const e of expenses){ const c=e.category||"Outro"; byCat[c]=(byCat[c]||0)+parseFloat(e.amount||0); }

  // monthly chart data
  const byMonth={};
  if(meta?.byMonth) for(const[m,d] of Object.entries(meta.byMonth)){
    if(!byMonth[m])byMonth[m]={exp:0,revenue:0};
    byMonth[m].exp+=(d.spend||0);
  }
  if(shopify?.byMonth) for(const[m,d] of Object.entries(shopify.byMonth)){
    if(!byMonth[m])byMonth[m]={exp:0,revenue:0};
    byMonth[m].revenue+=(d.revenue||0)*rate;
  }
  for(const e of expenses){
    const m=(e.date||"").slice(0,7); if(!m)continue;
    if(!byMonth[m])byMonth[m]={exp:0,revenue:0};
    byMonth[m].exp+=parseFloat(e.amount||0);
  }
  const chartData=Object.entries(byMonth).sort(([a],[b])=>a<b?-1:1).map(([m,d])=>{
    const[yr,mo]=m.split("-");
    const label=new Date(parseInt(yr),parseInt(mo)-1,1).toLocaleDateString("pt-BR",{month:"short",year:"2-digit"});
    return{label,exp:+d.exp.toFixed(2),revenue:+d.revenue.toFixed(2),
      roas:d.exp>0&&d.revenue>0?+(d.revenue/d.exp).toFixed(2):null};
  });

  return(
    <div>
      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12,marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",gap:7,background:T.card,
          border:`1px solid ${T.border}`,borderRadius:9,padding:"10px 14px"}}>
          <div>
            <div style={{fontSize:8,color:T.muted,letterSpacing:"0.12em",textTransform:"uppercase",
              fontFamily:"'Syne',sans-serif",marginBottom:2}}>Taxa Stripe</div>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <input type="number" step="0.1" min="0" max="25" value={fee}
                onChange={e=>setFeeLocal(parseFloat(e.target.value)||0)}
                style={{width:48,border:`1px solid ${T.border}`,borderRadius:5,padding:"3px 7px",
                  fontSize:13,fontWeight:700,color:T.text,background:T.bg,textAlign:"right"}}/>
              <span style={{fontSize:11,color:T.muted}}>%</span>
            </div>
          </div>
        </div>
        <KPI label="Receita Bruta (BRL)" value={fmtR(shopifyRevBRL)} accent={T.shopify}/>
        <KPI label="Receita Líq. (BRL)" value={fmtR(shopifyRevNet)} accent={T.good}
          sub={`após ${fee}% Stripe`} large/>
        <KPI label="Gasto Total" value={fmtR(totalExp)} accent={T.meta}
          sub={`Mídia ${fmtR(metaSpend)} + Outros ${fmtR(totalManualExp)}`}/>
        <KPI label="ROAS Real" value={roasReal>0?fmtX(roasReal):"—"} large
          accent={roasReal>=3?T.good:roasReal>=1?T.warn:roasReal>0?T.bad:T.border}
          sub="receita ÷ todos os gastos"/>
        <KPI label="Lucro Bruto Est." value={profit!==0?fmtR(profit):"—"}
          accent={profit>0?T.good:profit<0?T.bad:T.border}/>
        <KPI label="Margem" value={shopifyRevBRL>0?fmtPct((profit/shopifyRevBRL)*100):"—"}
          accent={profit>0?T.good:T.bad}/>
      </div>

      {/* Chart */}
      {chartData.length>0&&(
        <Collapsible title="Receita × Gasto por Mês" color={T.violet}>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"16px 20px"}}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{top:4,right:8,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe4" vertical={false}/>
                <XAxis dataKey="label" tick={{fontSize:10,fill:T.faint}} tickLine={false} axisLine={false}/>
                <YAxis tick={{fontSize:9,fill:T.faint}} tickLine={false} axisLine={false} tickFormatter={v=>"R$"+Math.round(v)}/>
                <Tooltip content={<ChartTip/>}/>
                <Legend wrapperStyle={{fontSize:10,paddingTop:8}}/>
                <Bar dataKey="revenue" name="Receita R$" fill={T.shopify} radius={[3,3,0,0]}/>
                <Bar dataKey="exp"     name="Gasto R$"   fill={T.meta}    radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
            {chartData.some(d=>d.roas)&&(
              <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
                {chartData.map(d=>(
                  <div key={d.label} style={{textAlign:"center",background:T.bg,borderRadius:8,padding:"6px 12px",
                    borderTop:`2px solid ${d.roas>=3?T.good:d.roas>=1?T.warn:d.roas>0?T.bad:T.border}`}}>
                    <div style={{fontSize:9,color:T.muted,marginBottom:2}}>{d.label}</div>
                    <div style={{fontSize:13,fontWeight:700,fontFamily:"'Syne',sans-serif",
                      color:d.roas>=3?T.good:d.roas>=1?T.warn:d.roas>0?T.bad:T.faint}}>
                      {d.roas?fmtX(d.roas):"—"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Collapsible>
      )}

      {/* Breakdown */}
      <Collapsible title="Breakdown por Categoria" color={T.meta}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(175px,1fr))",gap:10}}>
          {Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([cat,amt],i)=>(
            <div key={cat} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:9,
              padding:"10px 13px",borderLeft:`3px solid ${CAT_COLORS[i%CAT_COLORS.length]}`}}>
              <div style={{fontSize:9,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"'Syne',sans-serif",marginBottom:4}}>{cat}</div>
              <div style={{fontSize:16,fontWeight:700,color:T.text,fontFamily:"'Syne',sans-serif"}}>{fmtR(amt)}</div>
              <div style={{fontSize:10,color:T.faint,marginTop:2}}>{totalExp>0?fmtPct((amt/totalExp)*100)+" do total":""}</div>
            </div>
          ))}
        </div>
      </Collapsible>

      {/* Main area */}
      <div style={{display:"flex",gap:4,marginBottom:14,alignItems:"center"}}>
        <span style={{fontSize:9,color:T.muted,fontFamily:"'Syne',sans-serif",letterSpacing:"0.1em",textTransform:"uppercase",marginRight:4}}>Gastos Manuais</span>
        {[["resumo","Resumo"],["tabela","Tabela"]].map(([k,l])=>(
          <button key={k} onClick={()=>setViewP(k)} style={{fontSize:10,padding:"4px 12px",borderRadius:20,cursor:"pointer",
            border:`1px solid ${view===k?T.violet:T.border}`,fontFamily:"'Syne',sans-serif",fontWeight:700,
            background:view===k?T.violetL:"transparent",color:view===k?T.violet:T.muted}}>{l}</button>
        ))}
        <ExportBtn data={expenses} filename="gastos.csv" cols={[
          {key:"date",label:"Data"},{key:"category",label:"Categoria"},{key:"name",label:"Nome"},{key:"amount",label:"Valor"},
        ]}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"360px 1fr",gap:16,alignItems:"start"}}>
        {/* Form */}
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:18}}>
          <SectionTitle color={T.meta}>Adicionar Gasto</SectionTitle>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <div>
              <div style={{fontSize:9,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4,fontFamily:"'Syne',sans-serif"}}>Data</div>
              <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}
                style={{width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"7px 9px",fontSize:11,boxSizing:"border-box"}}/>
            </div>
            <div>
              <div style={{fontSize:9,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4,fontFamily:"'Syne',sans-serif"}}>Categoria</div>
              <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}
                style={{width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"7px 9px",fontSize:11,boxSizing:"border-box"}}>
                {categories.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:9,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4,fontFamily:"'Syne',sans-serif"}}>Nome / Descrição</div>
            <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
              placeholder="ex: Canva Pro, Freelancer design..."
              style={{width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"7px 9px",fontSize:11,boxSizing:"border-box"}}/>
          </div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:9,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4,fontFamily:"'Syne',sans-serif"}}>Valor (R$)</div>
            <input type="number" step="0.01" min="0" value={form.amount}
              onChange={e=>setForm(f=>({...f,amount:e.target.value}))}
              onKeyDown={e=>e.key==="Enter"&&addExpense()}
              placeholder="0,00"
              style={{width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"7px 9px",fontSize:11,boxSizing:"border-box"}}/>
          </div>
          <button onClick={addExpense} disabled={saving||!form.name||!form.amount}
            style={{width:"100%",background:saving||!form.name||!form.amount?"#9ca3af":T.meta,
              color:"#fff",border:"none",borderRadius:8,padding:"10px",fontSize:12,
              fontWeight:700,cursor:"pointer",fontFamily:"'Syne',sans-serif",transition:"background 0.15s"}}>
            {saving?"Salvando...":"+ Adicionar Gasto"}
          </button>
          <div style={{marginTop:16,borderTop:`1px solid ${T.border}`,paddingTop:14}}>
            <SectionTitle color={T.muted}>Categorias</SectionTitle>
            <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
              {categories.map(c=>(
                <span key={c} style={{fontSize:10,background:T.bg,color:T.text,padding:"2px 9px",
                  borderRadius:20,border:`1px solid ${T.border}`,display:"flex",gap:4,alignItems:"center"}}>
                  {c}
                  {!DEFAULT_CATEGORIES.includes(c)&&(
                    <button onClick={()=>{const u=categories.filter(x=>x!==c);setCategories(u);lsSet("gwm_categories",u);}}
                      style={{background:"none",border:"none",cursor:"pointer",color:T.faint,fontSize:11,lineHeight:1,padding:0}}>×</button>
                  )}
                </span>
              ))}
            </div>
            <div style={{display:"flex",gap:6}}>
              <input value={newCat} onChange={e=>setNewCat(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&addCategory()}
                placeholder="Nova categoria..."
                style={{flex:1,background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"6px 9px",fontSize:11}}/>
              <button onClick={addCategory}
                style={{background:T.violet,color:"#fff",border:"none",borderRadius:6,
                  padding:"6px 14px",fontSize:12,cursor:"pointer",fontWeight:700}}>+</button>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div>
          {view==="resumo"&&(
            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:18}}>
              <SectionTitle color={T.violet}>Por Categoria</SectionTitle>
              {loadingExp?<div style={{color:T.faint,fontSize:12}}>Carregando...</div>:
                Object.keys(byCat).length===0
                  ?<div style={{color:T.faint,fontSize:12}}>Nenhum gasto ainda.</div>
                  :Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([cat,amt],i)=>(
                    <div key={cat} style={{marginBottom:14}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,alignItems:"center"}}>
                        <span style={{fontSize:11,color:T.text,fontWeight:600}}>{cat}</span>
                        <span style={{fontSize:12,fontWeight:700,color:T.meta,fontFamily:"'Syne',sans-serif"}}>{fmtR(amt)}</span>
                      </div>
                      <div style={{height:6,background:"#ede8e0",borderRadius:3,overflow:"hidden"}}>
                        <div style={{height:"100%",borderRadius:3,
                          width:`${totalExp>0?(amt/totalExp)*100:0}%`,
                          background:CAT_COLORS[i%CAT_COLORS.length],transition:"width 0.4s"}}/>
                      </div>
                      <div style={{fontSize:9,color:T.faint,marginTop:2}}>
                        {expenses.filter(e=>e.category===cat).length} lançamentos · {fmtPct(totalExp>0?(amt/totalExp)*100:0)} do total
                      </div>
                    </div>
                  ))
              }
            </div>
          )}
          {view==="tabela"&&(
            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"10px 14px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <SectionTitle color={T.violet} mb={0}>{expenses.length} Lançamentos</SectionTitle>
                <ExportBtn data={expenses} filename="gastos.csv" cols={[
                  {key:"date",label:"Data"},{key:"category",label:"Categoria"},{key:"name",label:"Nome"},{key:"amount",label:"Valor"},
                ]}/>
              </div>
              {loadingExp?<div style={{padding:20,color:T.faint,fontSize:12}}>Carregando...</div>:(
                expenses.length===0
                  ?<div style={{padding:28,textAlign:"center",color:T.faint,fontSize:12}}>Nenhum lançamento ainda</div>
                  :<div style={{overflowX:"auto",maxHeight:560,overflowY:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse"}}>
                      <thead style={{position:"sticky",top:0}}>
                        <tr>
                          {["Data","Categoria","Nome","Valor",""].map(h=>(
                            <th key={h} style={{padding:"7px 10px",fontSize:9,color:T.muted,letterSpacing:"0.1em",
                              textTransform:"uppercase",textAlign:h==="Valor"?"right":"left",
                              borderBottom:`1px solid ${T.border}`,fontFamily:"'Syne',sans-serif",
                              background:"#faf8f5",whiteSpace:"nowrap"}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.map((e,i)=>(
                          <tr key={e.id} style={{background:i%2===0?"#fffcf9":T.card}}>
                            <td style={{padding:"7px 10px",fontSize:11,color:T.muted,whiteSpace:"nowrap"}}>{e.date}</td>
                            <td style={{padding:"7px 10px",fontSize:11}}>
                              <span style={{background:T.metaL,color:T.meta,padding:"1px 8px",borderRadius:20,fontSize:10}}>{e.category}</span>
                            </td>
                            <td style={{padding:"7px 10px",fontSize:11,color:T.text,maxWidth:200}}>
                              <span style={{display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.name}</span>
                            </td>
                            <td style={{padding:"7px 10px",fontSize:11,textAlign:"right",fontWeight:700,color:T.meta}}>
                              {editId===e.id?(
                                <input type="number" autoFocus value={editVal}
                                  onChange={ev=>setEditVal(ev.target.value)}
                                  onKeyDown={ev=>{if(ev.key==="Enter")saveEdit(e.id);if(ev.key==="Escape")setEditId(null);}}
                                  onBlur={()=>saveEdit(e.id)}
                                  style={{width:80,border:`1px solid ${T.violet}`,borderRadius:4,padding:"2px 5px",fontSize:11,textAlign:"right"}}/>
                              ):fmtR(parseFloat(e.amount||0))}
                            </td>
                            <td style={{padding:"7px 6px",textAlign:"right",whiteSpace:"nowrap"}}>
                              <button onClick={()=>{setEditId(e.id);setEditVal(e.amount);}}
                                style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:T.muted,marginRight:2}}
                                title="Editar">✏️</button>
                              <button onClick={()=>deleteExpense(e.id)}
                                style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:T.faint}}
                                title="Excluir">🗑</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{background:"#f0ece5",borderTop:`2px solid ${T.border}`}}>
                          <td colSpan={3} style={{padding:"8px 10px",fontSize:10,fontWeight:700,fontFamily:"'Syne',sans-serif",color:T.text}}>TOTAL MANUAL</td>
                          <td style={{padding:"8px 10px",fontSize:12,fontWeight:700,textAlign:"right",color:T.meta,fontFamily:"'Syne',sans-serif"}}>{fmtR(totalManualExp)}</td>
                          <td/>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


/* ─── MAIN ───────────────────────────────────────────────── */
export default function App(){
  const _sess=lsGet(LS_KEY,{});
  const[tab,setTabRaw]=useState(_sess.tab||"consolidated");
  const[dateFrom,setDateFromRaw]=useState(_sess.dateFrom||"2026-02-03");
  const[dateTo,setDateToRaw]=useState(_sess.dateTo||"");
  const[dollarRate,setDollarRateRaw]=useState(_sess.dollarRate||5.85);
  const[stripeFee,setStripeFeeRaw]=useState(_sess.stripeFee||6.8); // Stripe fee %
  const setStripeFee=(v)=>{setStripeFeeRaw(v);persist({stripeFee:v});};
  const[loading,setLoading]=useState(true);
  const[saveStatus,setSaveStatus]=useState("");

  // Wrap setters to also persist session
  const persist=(patch)=>lsSet(LS_KEY,{...lsGet(LS_KEY,{}), ...patch});
  const setTab=(v)=>{setTabRaw(v);persist({tab:v});};
  const setDateFrom=(v)=>{setDateFromRaw(v);persist({dateFrom:v});};
  const setDateTo=(v)=>{setDateToRaw(v);persist({dateTo:v});};
  const setDollarRate=(v)=>{setDollarRateRaw(v);persist({dollarRate:v});};

  const[metaRaw,setMetaRaw]=useState(null);
  const[shopifyRaw,setShopifyRaw]=useState(null);
  const[pintRaw,setPintRaw]=useState(null);
  const[creativeImages,setCreativeImages]=useState({});
  const[productImages,setProductImages]=useState({});

  // Load from Supabase on mount
  useEffect(()=>{
    Promise.all([sbLoadAll(), sbLoadCreativeImages(), sbLoadCreativeImages("prod_")]).then(([data, imgs, pImgs])=>{
      if(data.meta)      setMetaRaw(data.meta);
      if(data.shopify)   setShopifyRaw(data.shopify);
      if(data.pinterest) setPintRaw(data.pinterest);
      setCreativeImages(imgs||{});
      setProductImages(pImgs||{});
      setLoading(false);
    });
  },[]);

  const readRaw=(setter,type)=>file=>{
    const r=new FileReader();
    r.onload=async e=>{
      const incoming=e.target.result;
      setSaveStatus("saving");
      // Load existing from Supabase, merge, then save merged
      const existing=(await sbLoadAll())[type]||"";
      let merged=incoming;
      if(existing){
        if(type==="meta")    merged=mergeMetaCsv(existing,incoming);
        if(type==="shopify") merged=mergeShopifyCsv(existing,incoming);
      }
      setter(merged);
      await sbSave(type, merged);
      setSaveStatus("saved");
      setTimeout(()=>setSaveStatus(""),2500);
    };
    r.readAsText(file,"UTF-8");
  };

  const meta     =useMemo(()=>metaRaw    ?parseMeta(metaRaw,dateFrom,dateTo)       :null,[metaRaw,dateFrom,dateTo]);
  const shopify  =useMemo(()=>shopifyRaw ?parseShopify(shopifyRaw,dateFrom,dateTo) :null,[shopifyRaw,dateFrom,dateTo]);
  const pinterest=useMemo(()=>pintRaw    ?parsePinterest(pintRaw)                  :null,[pintRaw]);

  const TABS=[
    {id:"consolidated",label:"Consolidado", color:T.violet,  dot:!!(meta||shopify)},
    {id:"meta",        label:"Meta Ads",    color:T.meta,    dot:!!meta},
    {id:"shopify",     label:"Shopify",     color:T.shopify, dot:!!shopify},
    {id:"pinterest",   label:"Pinterest",   color:T.pinterest,dot:!!pinterest},
    {id:"financeiro",  label:"Financeiro",  color:T.good,    dot:!!(meta||shopify)},
    {id:"leads",       label:"Leads",       color:T.warn,    dot:false},
    {id:"config",      label:"Campanha",    color:T.violet,  dot:false},
  ];

  if(loading) return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}>
      <GlobalStyles/>
      <div style={{width:28,height:28,background:T.text,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <span style={{color:"#fff",fontSize:14,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>G</span>
      </div>
      <div style={{fontSize:12,color:T.muted,fontFamily:"'Syne',sans-serif",letterSpacing:"0.1em"}}>CARREGANDO DADOS...</div>
    </div>
  );

  return(
    <div style={{minHeight:"100vh",background:T.bg}}>
      <GlobalStyles/>
      {saveStatus&&<div style={{position:"fixed",bottom:20,right:20,zIndex:999,background:saveStatus==="saved"?T.good:T.warn,color:"#fff",padding:"8px 16px",borderRadius:20,fontSize:11,fontWeight:700,fontFamily:"'Syne',sans-serif",boxShadow:"0 4px 12px rgba(0,0,0,0.15)"}}>
        {saveStatus==="saving"?"Salvando...":"✓ Salvo no Supabase"}
      </div>}

      {/* Header */}
      <div style={{background:T.card,borderBottom:`1px solid ${T.border}`,position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
        <div style={{maxWidth:1300,margin:"0 auto",padding:"0 24px",display:"flex",alignItems:"stretch",justifyContent:"space-between",height:52}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <img src={LOGO_SRC} alt="Gallery Wall Mockups" style={{height:22,display:"block",objectFit:"contain"}}/>
            <div style={{fontSize:9,color:T.faint,letterSpacing:"0.1em",textTransform:"uppercase",borderLeft:`1px solid ${T.border}`,paddingLeft:10}}>Performance Dashboard</div>
          </div>
          <div style={{display:"flex",alignItems:"stretch"}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{
                background:"none",border:"none",cursor:"pointer",padding:"0 15px",
                fontSize:11,fontWeight:tab===t.id?700:500,
                color:tab===t.id?t.color:T.muted,
                borderBottom:`2.5px solid ${tab===t.id?t.color:"transparent"}`,
                transition:"all 0.15s",display:"flex",alignItems:"center",gap:5,
                fontFamily:"'Syne',sans-serif",letterSpacing:"0.04em",whiteSpace:"nowrap",
              }}>
                {t.label}
                {t.dot&&<span style={{width:4,height:4,borderRadius:"50%",background:t.color,flexShrink:0}}/>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sub-header: period + rate */}
      <div style={{background:"#ece7e0",borderBottom:`1px solid ${T.border}`,padding:"7px 24px"}}>
        <div style={{maxWidth:1300,margin:"0 auto",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <PeriodSelector dateFrom={dateFrom} dateTo={dateTo} onFrom={setDateFrom} onTo={setDateTo}/>
          <div style={{display:"flex",alignItems:"center",gap:6,background:T.card,
            border:`1px solid ${T.border}`,borderRadius:8,padding:"6px 12px"}}>
            <span style={{fontSize:10,color:T.muted,fontFamily:"'Syne',sans-serif",letterSpacing:"0.1em",textTransform:"uppercase"}}>US$1 =</span>
            <span style={{fontSize:10,color:T.muted}}>R$</span>
            <input type="number" step="0.01" min="1" value={dollarRate}
              onChange={e=>setDollarRate(parseFloat(e.target.value)||5.85)}
              style={{width:56,border:`1px solid ${T.border}`,borderRadius:5,padding:"3px 7px",
                fontSize:11,color:T.text,background:T.bg,textAlign:"right"}}/>
            <span style={{fontSize:10,color:T.faint}}>cotação p/ ROAS</span>
          </div>
          {meta&&<span style={{fontSize:10,color:T.muted,background:T.metaL,padding:"4px 10px",borderRadius:20,border:`1px solid ${T.meta}30`}}>
            Meta: {meta.rowCount} linhas
          </span>}
          {shopify&&<span style={{fontSize:10,color:"#065f46",background:T.shopifyL,padding:"4px 10px",borderRadius:20,border:`1px solid ${T.shopify}30`}}>
            Shopify: {shopify.totalOrders} pedidos
          </span>}
          <button onClick={()=>{try{localStorage.removeItem(LS_KEY);}catch{}window.location.reload();}}
            style={{fontSize:9,color:T.faint,background:"none",border:`1px solid ${T.border}`,
              cursor:"pointer",padding:"4px 10px",borderRadius:20,fontFamily:"'Syne',sans-serif",
              marginLeft:"auto",letterSpacing:"0.06em"}}
            title="Resetar posição de todos os widgets">
            ↺ layout
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{maxWidth:1300,margin:"0 auto",padding:"22px 24px"}}>
        {tab==="consolidated"&&<ConsolidatedTab meta={meta} shopify={shopify} pinterest={pinterest} rate={dollarRate} fee={stripeFee}/>}
        {tab==="meta"        &&<MetaTab meta={meta} shopify={shopify} rate={dollarRate} fee={stripeFee} onFile={readRaw(setMetaRaw,"meta")} creativeImages={creativeImages} onImageUpload={async(name,file)=>{const url=await sbUploadCreative(name,file);if(url)setCreativeImages(p=>({...p,[name]:url}));}}/>}
        {tab==="shopify"     &&<ShopifyTab shopify={shopify} onFile={readRaw(setShopifyRaw,"shopify")}
          productImages={productImages}
          onProductImageUpload={async(name,file)=>{const url=await sbUploadCreative(name,file);if(url)setProductImages(p=>({...p,[name]:url}));}}/>}
        {tab==="pinterest"   &&<PinterestTab pinterest={pinterest} onFile={readRaw(setPintRaw,"pinterest")}/>}
        {tab==="financeiro"  &&<FinancialTab meta={meta} shopify={shopify} rate={dollarRate} fee={stripeFee}/>}
        {tab==="leads"       &&<div style={{maxWidth:1100}}><LeadsPanel/></div>}
        {tab==="config"      &&<CampaignTab meta={meta} shopify={shopify} rate={dollarRate} creativeImages={creativeImages} onImageUpload={async(name,file)=>{const url=await sbUploadCreative(name,file);if(url)setCreativeImages(p=>({...p,[name]:url}));}}/>}
      </div>
    </div>
  );
}
