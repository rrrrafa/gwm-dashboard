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

async function sbLoadCreativeImages() {
  try {
    const res = await fetch(`${SB_URL}/storage/v1/object/list/creatives`, {
      method: 'POST',
      headers: { ...sbH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: '', limit: 200 }),
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
  adName:      ["nome do anúncio","ad name"],
  campaign:    ["nome da campanha","campaign name","campaign"],
  adset:       ["nome do conjunto de anúncios","ad set name"],
  country:     ["país","country"],
  date:        ["início dos relatórios","reporting starts","date","start"],
  reach:       ["alcance","reach"],
  impressions: ["impressões","impressions"],
  frequency:   ["frequência","frequency"],
  lpv:         ["visualizações da página de destino do site","visualizações da página de destino","landing page views"],
  addCart:     ["adições ao carrinho","add to cart"],
  checkout:    ["finalizações de compra no site","finalizações de compra","checkouts iniciados","checkouts","initiate checkout"],
  purchases:   ["compras","purchases"],
  spend:       ["valor usado (brl)","valor usado","amount spent (brl)","amount spent"],
  clicks:      ["cliques no link","link clicks","cliques","clicks"],
  cpcMeta:     ["cpc (custo por clique no link)","cpc (cost per link click)","cpc (all)","custo por clique no link"],
  saves:       ["saves","pin saves"],
};

function findCol(headers, aliases) {
  const h = headers.map(x => x?.toLowerCase().trim());
  for (const a of aliases) {
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
  const byCreative={}, byCountry={}, byCampaign={}, byDay={}, byMonth={};
  let freqCount=0; // rows with frequency data for averaging

  for (const r of rows) {
    const reach=getNum(r,COL.reach), impressions=getNum(r,COL.impressions);
    const freq=getNum(r,COL.frequency);
    const lpv=getNum(r,COL.lpv), addCart=getNum(r,COL.addCart);
    const checkout=getNum(r,COL.checkout), purchases=getNum(r,COL.purchases);
    const spend=getNum(r,COL.spend), clicks=getNum(r,COL.clicks);
    const adName=getStr(r,COL.adName), campaign=getStr(r,COL.campaign);
    const adset=getStr(r,COL.adset), country=getStr(r,COL.country);
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
    };
    add(byCreative, adName,   ()=>({campaign,adset,reach:0,impressions:0,lpv:0,addCart:0,checkout:0,purchases:0,spend:0,clicks:0}));
    add(byCampaign, campaign, ()=>({reach:0,impressions:0,lpv:0,addCart:0,checkout:0,purchases:0,spend:0,clicks:0}));

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
  return { totals, byCreative, byCountry, byCampaign, byDay, byMonth, rowCount:rows.length };
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
        country:r["Billing Country"]||r["Shipping Country"]||"—",
        total:parseFloat(r["Total"]||"0")||0,
        status:r["Financial Status"]||"",
        items:[],
      };
    }
    if(r["Lineitem name"])orders[name].items.push(r["Lineitem name"]);
  }

  let totalOrders=0,totalRevenue=0;
  const byCountry={},byDay={},byProduct={},byMonth={};

  for(const o of Object.values(orders)){
    if(o.total===0)continue; // skip freebies
    totalOrders++; totalRevenue+=o.total;
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
      if(!byProduct[item])byProduct[item]={orders:0};
      byProduct[item].orders++;
    }
  }
  return { totalOrders, totalRevenue, byCountry, byDay, byMonth, byProduct,
    avgTicket:totalOrders>0?totalRevenue/totalOrders:0 };
}

function parsePinterest(text){
  const{data}=Papa.parse(text,{header:true,skipEmptyLines:true});
  const totals={impressions:0,clicks:0,saves:0,spend:0,conversions:0};
  const byPin={};
  for(const r of data){
    const impr=getNum(r,["impressions","impressões"]);
    const clicks=getNum(r,["link clicks","clicks","cliques"]);
    const saves=getNum(r,COL.saves);
    const spend=getNum(r,COL.spend);
    const conv=getNum(r,["checkouts","conversions","purchases","compras"]);
    const name=getStr(r,["ad name","pin name","nome do anúncio","name"]);
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
  return{totals,byPin};
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
          <th key={c.key} style={{...TH,textAlign:c.align||"right"}} onClick={()=>onSort(c.key)}>
            {c.label}{sort?.key===c.key?(sort.dir==="desc"?" ↓":" ↑"):""}
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
function CountryCrossover({meta,shopify,rate}){
  const[view,setView]=useState("roas"); // "roas" | "funnel"
  const rows=useMemo(()=>{
    const countries=new Set([
      ...Object.keys(meta?.byCountry||{}),
      ...Object.keys(shopify?.byCountry||{})
    ]);
    return Array.from(countries).map(c=>{
      const m=meta?.byCountry[c]||{};
      const s=shopify?.byCountry[c]||{};
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
      </div>
      {view==="roas"&&(
        <DataTable sort={sort} onSort={onSort}
          cols={[
            {key:"country",      label:"País",          align:"left", render:v=><b style={{color:T.text,fontSize:12}}>{v}</b>},
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
            {key:"country",      label:"País",        align:"left", render:v=><b style={{color:T.text,fontSize:12}}>{v}</b>},
            {key:"metaImpr",     label:"Impressões",  render:v=>fmt(v)},
            {key:"metaClicks",   label:"Cliques",     render:v=>fmt(v)},
            {key:"ctr",          label:"CTR",         render:v=>fmtPct(v), color:v=>v>=2?T.good:v>=0.5?T.warn:v>0?T.bad:T.faint},
            {key:"cpm",          label:"CPM",         render:v=>fmtR(v), color:v=>v>0&&v<30?T.good:v<60?T.warn:v>0?T.bad:T.faint},
            {key:"metaLPV",      label:"LPV",         render:v=>fmt(v)},
            {key:"metaCheckout", label:"Checkout",    render:v=>fmt(v)},
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
function SuggestionsPanel({meta,shopify,rate}){
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
              {[["month","Mês","left"],["spend","Gasto Meta","right"],["purchases","Comp. Meta","right"],
                ["shopifyOrders","Ped. Shop","right"],["revUSD","Rec. USD","right"],
                ["revBRL","Rec. BRL","right"],["roas","ROAS","right"],
                ["cpa","CPA","right"],["lpv","LPV","right"]].map(([k,l,a])=>(
                <th key={k} onClick={()=>onSort(k)} style={{
                  padding:"8px 12px",fontSize:9,fontWeight:700,color:sort.key===k?T.violet:T.muted,
                  letterSpacing:"0.1em",textTransform:"uppercase",textAlign:a||"right",cursor:"pointer",
                  background:"#faf8f5",borderBottom:`2px solid ${sort.key===k?T.violet:T.border}`,
                  whiteSpace:"nowrap",fontFamily:"'Syne',sans-serif"}}>
                  {l}{sort.key===k?(sort.dir==="asc"?" ↑":" ↓"):""}
                </th>
              ))}
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
function ConsolidatedTab({meta,shopify,rate}){
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
        <KPI label="Compras Meta"    value={fmt(meta?.totals.purchases)}            accent={T.meta} sub="atribuição Meta"/>
        <KPI label="CPA Meta"        value={fmtR(meta?.totals.cpa)}               accent={T.meta}/>
        <KPI label="LPV"             value={fmt(meta?.totals.lpv)}                 accent={T.violet}/>
        <KPI label="Custo/LPV"       value={fmtR(meta?.totals.costLpv)}           accent={T.violet}/>
        <KPI label="CVR LPV→Compra" value={fmtPct(meta?.totals.cvr)}             accent={T.violet}/>
      </div>

      <Collapsible title="Visão Mensal Consolidada" color={T.violet}>
        <MonthlyView meta={meta} shopify={shopify} rate={rate}/>
      </Collapsible>
      <Collapsible title="Tendência Diária" color={T.violet}>
        <DailyChart data={dailyData}/>
      </Collapsible>
      <Collapsible title="Atribuição Diária — Meta vs Shopify" color={T.meta}>
        <DailyAttributionTable meta={meta} shopify={shopify} rate={rate}/>
      </Collapsible>
      <Collapsible title="Meta × Shopify por País" color={T.violet}>
        <CountryCrossover meta={meta} shopify={shopify} rate={rate}/>
      </Collapsible>
      <Collapsible title="Insights & Sugestões" color={T.warn}>
        <SuggestionsPanel meta={meta} shopify={shopify} rate={rate}/>
      </Collapsible>
    </div>
  );
}


/* ─── COLLAPSIBLE SECTION ────────────────────────────────── */
function Collapsible({title, color, children, defaultOpen=true, extra=null}){
  const[open,setOpen]=useState(defaultOpen);
  return(
    <div style={{marginBottom:20}}>
      <div onClick={()=>setOpen(o=>!o)} style={{
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
            style={{width:44,height:44,objectFit:"cover",borderRadius:6,
              border:`1.5px solid ${T.border}`,display:"block"}}
            title="Clique para trocar"/>
        ):(
          <div style={{width:44,height:44,borderRadius:6,
            border:`1.5px dashed ${T.faint}`,background:"#faf8f5",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:16,opacity:0.5}}
            title="Clique para adicionar imagem">
            {uploading?"⏳":"🖼"}
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

/* ─── TAB: META ADS ──────────────────────────────────────── */
function MetaTab({meta,shopify,rate,onFile,creativeImages,onImageUpload}){
  const[sub,setSub]=useState("overview");

  const creativeRows=useMemo(()=>{
    if(!meta)return[];
    return Object.entries(meta.byCreative).map(([name,d])=>({
      name,impressions:d.impressions,lpv:d.lpv,addCart:d.addCart,
      checkout:d.checkout,purchases:d.purchases,spend:d.spend,
      cpa:d.purchases>0?d.spend/d.purchases:0,
      cvr:d.lpv>0?(d.purchases/d.lpv)*100:0,
      costLpv:d.lpv>0?d.spend/d.lpv:0,
      ctr:d.impressions>0?((d.clicks||0)/d.impressions)*100:0,
      cpm:d.impressions>0?(d.spend/d.impressions)*1000:0,
    }));
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
              <Collapsible title="Investimento & Alcance" color={T.meta}>
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
              <Collapsible title="Funil de Conversão" color={T.violet}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10}}>
                  <KPI label="Vis. Pág."    value={fmt(meta.totals.lpv)}          accent={T.violet}/>
                  <KPI label="Custo/LPV"   value={fmtR(meta.totals.costLpv)}    accent={T.violet}/>
                  <KPI label="Add Carrinho" value={fmt(meta.totals.addCart)}      accent={T.warn}/>
                  {meta.totals.hasCheckout&&<KPI label="Finalizações" value={fmt(meta.totals.checkout)} accent={T.warn}/>}
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
                {label:"Checkout",          value:meta.totals.checkout,    color:"#f97316"},
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
            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <SectionTitle color={T.meta} mb={0}>Criativos — {sC.length} anúncios</SectionTitle>
                <ExportBtn data={sC} filename="criativos.csv" cols={[
                  {key:"name",label:"Criativo"},{key:"impressions",label:"Impressões"},
                  {key:"lpv",label:"LPV"},{key:"addCart",label:"Cart"},
                  {key:"purchases",label:"Compras"},{key:"spend",label:"Gasto"},
                  {key:"cpa",label:"CPA"},{key:"costLpv",label:"R$/LPV"},
                ]}/>
              </div>
              <DataTable sort={sortC} onSort={onSC}
                emptyMsg="Exporte na aba Anúncios (não Conjuntos)"
                cols={[
                  {key:"name",       label:"Criativo",  align:"left", render:v=><CreativeImageCell adName={v} images={creativeImages||{}} onUpload={onImageUpload||(() => {})}/>},
                  {key:"impressions",label:"Impr.",      render:v=>fmt(v)},
                  {key:"lpv",        label:"LPV",        render:v=>fmt(v)},
                  {key:"addCart",    label:"Cart",       render:v=>fmt(v)},
                  {key:"purchases",  label:"Compras",    render:v=>fmt(v), color:v=>v>0?T.good:T.faint},
                  {key:"spend",      label:"Gasto",      render:v=>fmtR(v)},
                  {key:"cpa",        label:"CPA",        render:v=>v>0?fmtR(v):"—"},
                  {key:"ctr",        label:"CTR",        render:v=>fmtPct(v), color:v=>v>=2?T.good:v>=0.5?T.warn:v>0?T.bad:T.faint},
                  {key:"cpm",        label:"CPM",        render:v=>v>0?fmtR(v):"—"},
                  {key:"costLpv",    label:"R$/LPV",     render:v=>v>0?fmtR(v):"—"},
                  {key:"cvr",        label:"CVR",        render:v=>fmtPct(v)},
                ]}
                rows={sC}/>
            </div>
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
function ShopifyTab({shopify,onFile}){
  const countryRows=useMemo(()=>{
    if(!shopify)return[];
    return Object.entries(shopify.byCountry).map(([c,d])=>({
      country:c,orders:d.orders,revenue:d.revenue,avgTicket:d.orders>0?d.revenue/d.orders:0
    }));
  },[shopify]);
  const productRows=useMemo(()=>{
    if(!shopify)return[];
    return Object.entries(shopify.byProduct).map(([name,d])=>({name,orders:d.orders}));
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
                    {key:"name",   label:"Produto", align:"left", render:v=><span style={{maxWidth:300,display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:500,color:T.text}}>{v}</span>},
                    {key:"orders", label:"Vendas",  render:v=>fmt(v), color:v=>v>0?T.shopify:T.faint},
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
function CampaignTab({meta, shopify, rate, creativeImages, onImageUpload}){
  const roasGlobal = meta?.totals.spend>0&&shopify?(shopify.totalRevenue*rate)/meta.totals.spend:0;
  const[drawerOpen,setDrawerOpen]=useState(false);
  const[cfg,setCfg]=useState({
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
  });
  const setF=(k,v)=>setCfg(c=>({...c,[k]:v}));
  const[newC,setNewC]=useState("");
  const F=({label,k,multi,rows=3})=>(
    <div style={{marginBottom:13}}>
      <div style={{fontSize:9,color:T.muted,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:4,fontFamily:"'Syne',sans-serif"}}>{label}</div>
      {multi
        ?<textarea value={cfg[k]} onChange={e=>setF(k,e.target.value)} rows={rows}
           style={{width:"100%",background:"#faf8f5",border:`1px solid ${T.border}`,borderRadius:6,padding:"7px 10px",fontSize:11,resize:"vertical",lineHeight:1.6}}/>
        :<input value={cfg[k]} onChange={e=>setF(k,e.target.value)}
           style={{width:"100%",background:"#faf8f5",border:`1px solid ${T.border}`,borderRadius:6,padding:"7px 10px",fontSize:11}}/>
      }
    </div>
  );
  const COUNTRY_FLAGS={"DE":"🇩🇪","ES":"🇪🇸","FR":"🇫🇷","GB":"🇬🇧","IE":"🇮🇪","NL":"🇳🇱","US":"🇺🇸","BR":"🇧🇷","IT":"🇮🇹","PT":"🇵🇹","AU":"🇦🇺","CA":"🇨🇦"};

  return(
    <div>
      {/* Campaign summary card — clickable */}
      <div onClick={()=>setDrawerOpen(o=>!o)} style={{
        background:T.card,border:`1.5px solid ${drawerOpen?T.meta:T.border}`,
        borderRadius:12,padding:18,marginBottom:16,cursor:"pointer",
        transition:"border-color 0.15s, box-shadow 0.15s",
        boxShadow:drawerOpen?"0 0 0 3px "+T.metaL:"none",
      }}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:T.text,fontFamily:"'Syne',sans-serif",marginBottom:2}}>{cfg.campaignName}</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <span style={{fontSize:10,background:T.metaL,color:T.meta,padding:"2px 8px",borderRadius:20,fontWeight:700}}>{cfg.objective}</span>
              <span style={{fontSize:10,background:T.violetL,color:T.violet,padding:"2px 8px",borderRadius:20}}>{cfg.optimization.split("→")[0].trim()}</span>
              <span style={{fontSize:10,background:"#f0fdf4",color:T.good,padding:"2px 8px",borderRadius:20}}>{cfg.budget}</span>
              {cfg.countries.map(c=><span key={c} style={{fontSize:10,color:T.muted}}>{COUNTRY_FLAGS[c]||""}{c}</span>)}
            </div>
          </div>
          <span style={{fontSize:11,color:T.muted,fontFamily:"'Syne',sans-serif",letterSpacing:"0.06em",marginTop:2}}>
            {drawerOpen?"▲ fechar":"▼ expandir"}
          </span>
        </div>
        {/* Inline results */}
        {meta&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:8}}>
            {[
              {l:"Gasto",    v:fmtR(meta.totals.spend),        c:T.meta},
              {l:"Comp. Meta",v:fmt(meta.totals.purchases),    c:T.meta},
              {l:"CPA",     v:fmtR(meta.totals.cpa),          c:T.warn},
              {l:"ROAS",    v:fmtX(roasGlobal),               c:roasGlobal>=3?T.good:roasGlobal>=1?T.warn:roasGlobal>0?T.bad:T.faint},
              {l:"Ped. Shop",v:fmt(shopify?.totalOrders),     c:T.shopify},
              {l:"Rec. USD", v:fmtUSD(shopify?.totalRevenue), c:T.shopify},
              {l:"LPV",     v:fmt(meta.totals.lpv),           c:T.violet},
              {l:"CTR",     v:fmtPct(meta.totals.ctr),        c:T.meta},
              {l:"CPM",     v:fmtR(meta.totals.cpm),          c:T.meta},
              {l:"CPC",     v:fmtR(meta.totals.cpc),          c:T.meta},
            ].map(k=>(
              <div key={k.l} style={{background:T.bg,borderRadius:8,padding:"8px 10px",borderTop:`2px solid ${k.c}`}}>
                <div style={{fontSize:8,color:T.muted,letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:"'Syne',sans-serif",marginBottom:2}}>{k.l}</div>
                <div style={{fontSize:14,fontWeight:700,color:k.c,fontFamily:"'Syne',sans-serif"}}>{k.v||"—"}</div>
              </div>
            ))}
          </div>
        )}
        {!meta&&<div style={{fontSize:11,color:T.faint,textAlign:"center",padding:"8px 0"}}>Suba o CSV do Meta para ver resultados</div>}
      </div>

      {/* Expanded drawer */}
      {drawerOpen&&(
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:18,marginBottom:16,borderTop:`3px solid ${T.meta}`}}>
          <SectionTitle color={T.meta}>Detalhes por Criativo</SectionTitle>
          {meta?(
            <div style={{overflowX:"auto",marginBottom:16}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{background:T.bg}}>
                    {["Criativo","Impr.","LPV","Cart","Compras","Gasto","CPA","CTR","CPM"].map(h=>(
                      <th key={h} style={{padding:"7px 10px",fontSize:9,color:T.muted,letterSpacing:"0.1em",
                        textTransform:"uppercase",textAlign:h==="Criativo"?"left":"right",
                        borderBottom:`2px solid ${T.border}`,fontFamily:"'Syne',sans-serif",whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(meta.byCreative).sort((a,b)=>b[1].purchases-a[1].purchases).map(([name,d],i)=>{
                    const cpa=d.purchases>0?d.spend/d.purchases:0;
                    const cpm=d.impressions>0?(d.spend/d.impressions)*1000:0;
                    const ctr=d.impressions>0?(d.clicks/d.impressions)*100:0;
                    const shortName=name.split("|")[0].trim();
                    return(
                      <tr key={name} style={{background:i%2===0?T.card:"#faf8f5"}}>
                        <td style={{padding:"7px 10px",maxWidth:240}}>
                          <CreativeImageCell adName={name} images={creativeImages||{}} onUpload={onImageUpload||(() => {})}/>
                        </td>
                        <td style={{padding:"7px 10px",fontSize:11,textAlign:"right",color:T.muted}}>{fmt(d.impressions)}</td>
                        <td style={{padding:"7px 10px",fontSize:11,textAlign:"right",color:T.violet}}>{fmt(d.lpv)}</td>
                        <td style={{padding:"7px 10px",fontSize:11,textAlign:"right",color:T.warn}}>{fmt(d.addCart)}</td>
                        <td style={{padding:"7px 10px",fontSize:11,textAlign:"right",fontWeight:700,color:d.purchases>0?T.good:T.faint}}>{fmt(d.purchases)}</td>
                        <td style={{padding:"7px 10px",fontSize:11,textAlign:"right",color:T.meta}}>{fmtR(d.spend)}</td>
                        <td style={{padding:"7px 10px",fontSize:11,textAlign:"right",color:cpa>0?T.text:T.faint}}>{cpa>0?fmtR(cpa):"—"}</td>
                        <td style={{padding:"7px 10px",fontSize:11,textAlign:"right",color:ctr>=2?T.good:ctr>=0.5?T.warn:ctr>0?T.bad:T.faint}}>{fmtPct(ctr)}</td>
                        <td style={{padding:"7px 10px",fontSize:11,textAlign:"right",color:T.muted}}>{fmtR(cpm)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ):<div style={{fontSize:11,color:T.faint,padding:"12px 0"}}>Suba o CSV do Meta para ver criativos</div>}

          <SectionTitle color={T.shopify}>Detalhes por País</SectionTitle>
          {meta?(
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{background:T.bg}}>
                    {["País","Gasto","Comp. Meta","Ped. Shop","Rec. USD","Rec. BRL","ROAS","CPA","CPM","CTR"].map(h=>(
                      <th key={h} style={{padding:"7px 10px",fontSize:9,color:T.muted,letterSpacing:"0.1em",
                        textTransform:"uppercase",textAlign:h==="País"?"left":"right",
                        borderBottom:`2px solid ${T.border}`,fontFamily:"'Syne',sans-serif",whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(meta.byCountry).sort((a,b)=>b[1].spend-a[1].spend).map(([country,d],i)=>{
                    const sRev=shopify?.byCountry[country]?.revenue||0;
                    const sOrd=shopify?.byCountry[country]?.orders||0;
                    const revBRL=sRev*rate;
                    const roas=d.spend>0&&revBRL>0?revBRL/d.spend:0;
                    const cpa=d.purchases>0?d.spend/d.purchases:0;
                    const cpm=d.impressions>0?(d.spend/d.impressions)*1000:0;
                    const ctr=d.impressions>0?((d.clicks||0)/d.impressions)*100:0;
                    return(
                      <tr key={country} style={{background:i%2===0?T.card:"#faf8f5"}}>
                        <td style={{padding:"7px 10px",fontSize:12,fontWeight:700,color:T.text}}>{COUNTRY_FLAGS[country]||""} {country}</td>
                        <td style={{padding:"7px 10px",fontSize:11,textAlign:"right",color:T.meta}}>{fmtR(d.spend)}</td>
                        <td style={{padding:"7px 10px",fontSize:11,textAlign:"right",color:d.purchases>0?T.meta:T.faint,fontWeight:d.purchases>0?700:400}}>{fmt(d.purchases)}</td>
                        <td style={{padding:"7px 10px",fontSize:11,textAlign:"right",color:sOrd>0?T.shopify:T.faint,fontWeight:sOrd>0?700:400}}>{fmt(sOrd)}</td>
                        <td style={{padding:"7px 10px",fontSize:11,textAlign:"right",color:sRev>0?T.good:T.faint}}>{fmtUSD(sRev)}</td>
                        <td style={{padding:"7px 10px",fontSize:11,textAlign:"right",color:revBRL>0?T.good:T.faint}}>{fmtR(revBRL)}</td>
                        <td style={{padding:"7px 10px",fontSize:11,textAlign:"right",fontWeight:700,color:roas>=3?T.good:roas>=1?T.warn:roas>0?T.bad:T.faint}}>{roas>0?fmtX(roas):"—"}</td>
                        <td style={{padding:"7px 10px",fontSize:11,textAlign:"right",color:cpa>0?T.text:T.faint}}>{cpa>0?fmtR(cpa):"—"}</td>
                        <td style={{padding:"7px 10px",fontSize:11,textAlign:"right",color:T.muted}}>{fmtR(cpm)}</td>
                        <td style={{padding:"7px 10px",fontSize:11,textAlign:"right",color:ctr>=2?T.good:ctr>=0.5?T.warn:ctr>0?T.bad:T.faint}}>{fmtPct(ctr)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ):<div style={{fontSize:11,color:T.faint,padding:"12px 0"}}>Suba o CSV do Meta para ver países</div>}
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      <div>
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:18,marginBottom:14}}>
          <SectionTitle color={T.meta}>Estrutura da Campanha</SectionTitle>
          <F label="Nome da campanha" k="campaignName"/>
          <F label="Objetivo" k="objective"/>
          <F label="Otimização" k="optimization"/>
          <F label="Evento de conversão" k="event"/>
          <F label="Pixel / Dataset" k="pixel"/>
          <F label="Orçamento diário" k="budget"/>
          <F label="Modelo de atribuição" k="attribution"/>
        </div>
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:18}}>
          <SectionTitle color={T.warn}>Notas internas</SectionTitle>
          <F label="Observações" k="notes" multi rows={5}/>
        </div>
      </div>
      <div>
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:18,marginBottom:14}}>
          <SectionTitle color={T.shopify}>Público-alvo</SectionTitle>
          <div style={{marginBottom:13}}>
            <div style={{fontSize:9,color:T.muted,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:6,fontFamily:"'Syne',sans-serif"}}>Países</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:6}}>
              {cfg.countries.map(c=>(
                <span key={c} style={{fontSize:11,background:T.metaL,color:T.meta,padding:"2px 9px",borderRadius:20,
                  border:`1px solid ${T.meta}30`,display:"flex",gap:4,alignItems:"center"}}>
                  {c}
                  <button onClick={()=>setF("countries",cfg.countries.filter(x=>x!==c))}
                    style={{background:"none",border:"none",cursor:"pointer",color:"#93c5fd",fontSize:12,lineHeight:1}}>×</button>
                </span>
              ))}
              <input value={newC} onChange={e=>setNewC(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&newC.trim()){setF("countries",[...cfg.countries,newC.trim().toUpperCase()]);setNewC("");}}}
                placeholder="+ país" style={{fontSize:11,background:T.metaL,border:`1px dashed #93c5fd`,
                borderRadius:20,padding:"2px 9px",color:T.meta,width:68}}/>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:13}}>
            {[["ageMin","Idade mín."],["ageMax","Idade máx."],["gender","Gênero"]].map(([k,l])=>(
              <div key={k}>
                <div style={{fontSize:9,color:T.muted,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:4,fontFamily:"'Syne',sans-serif"}}>{l}</div>
                <input value={cfg[k]} onChange={e=>setF(k,e.target.value)}
                  style={{width:"100%",background:"#faf8f5",border:`1px solid ${T.border}`,borderRadius:6,padding:"6px 8px",fontSize:11}}/>
              </div>
            ))}
          </div>
          <F label="Lookalikes / Públicos" k="lookalikes" multi rows={4}/>
        </div>
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:18}}>
          <SectionTitle color={T.shopify}>Interesses & Posicionamento</SectionTitle>
          <F label="Direcionamento detalhado" k="interests" multi rows={5}/>
          <F label="Posicionamentos" k="placements"/>
        </div>
      </div>
    </div>
    </div>
  );
}

/* ─── MAIN ───────────────────────────────────────────────── */
export default function App(){
  const[tab,setTab]=useState("consolidated");
  const[dateFrom,setDateFrom]=useState("2026-02-03");
  const[dateTo,setDateTo]=useState("");
  const[dollarRate,setDollarRate]=useState(5.85);
  const[loading,setLoading]=useState(true);
  const[saveStatus,setSaveStatus]=useState("");

  const[metaRaw,setMetaRaw]=useState(null);
  const[shopifyRaw,setShopifyRaw]=useState(null);
  const[pintRaw,setPintRaw]=useState(null);
  const[creativeImages,setCreativeImages]=useState({});

  // Load from Supabase on mount
  useEffect(()=>{
    Promise.all([sbLoadAll(), sbLoadCreativeImages()]).then(([data, imgs])=>{
      if(data.meta)      setMetaRaw(data.meta);
      if(data.shopify)   setShopifyRaw(data.shopify);
      if(data.pinterest) setPintRaw(data.pinterest);
      setCreativeImages(imgs||{});
      setLoading(false);
    });
  },[]);

  const readRaw=(setter,type)=>file=>{
    const r=new FileReader();
    r.onload=async e=>{
      const content=e.target.result;
      setter(content);
      setSaveStatus("saving");
      await sbSave(type, content);
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
            <img src="/logo.png" alt="Gallery Wall Mockups"
              onError={e=>{e.target.style.display="none";e.target.nextSibling.style.display="flex";}}
              style={{height:22,display:"block",objectFit:"contain"}}/>
            <div style={{display:"none",alignItems:"center",gap:8}}>
              <div style={{width:26,height:26,background:T.text,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{color:"#fff",fontSize:13,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>G</span>
              </div>
              <span style={{fontSize:13,fontWeight:700,color:T.text,fontFamily:"'Syne',sans-serif"}}>Gallery Wall Mockups</span>
            </div>
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
        </div>
      </div>

      {/* Content */}
      <div style={{maxWidth:1300,margin:"0 auto",padding:"22px 24px"}}>
        {tab==="consolidated"&&<ConsolidatedTab meta={meta} shopify={shopify} rate={dollarRate}/>}
        {tab==="meta"        &&<MetaTab meta={meta} shopify={shopify} rate={dollarRate} onFile={readRaw(setMetaRaw,"meta")} creativeImages={creativeImages} onImageUpload={async(name,file)=>{const url=await sbUploadCreative(name,file);if(url)setCreativeImages(p=>({...p,[name]:url}));}}/>}
        {tab==="shopify"     &&<ShopifyTab shopify={shopify} onFile={readRaw(setShopifyRaw,"shopify")}/>}
        {tab==="pinterest"   &&<PinterestTab pinterest={pinterest} onFile={readRaw(setPintRaw,"pinterest")}/>}
        {tab==="config"      &&<CampaignTab meta={meta} shopify={shopify} rate={dollarRate} creativeImages={creativeImages} onImageUpload={async(name,file)=>{const url=await sbUploadCreative(name,file);if(url)setCreativeImages(p=>({...p,[name]:url}));}}/>}
      </div>
    </div>
  );
}
