import { useState, useCallback, useMemo } from "react";
import * as Papa from "papaparse";

const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #c8bfb4; border-radius: 10px; }
    input, textarea, select { font-family: inherit; }
    tbody tr:hover td { background: #faf8f5 !important; }
  `}</style>
);

const T = {
  bg: "#f5f2ee",
  card: "#ffffff",
  border: "#e8e2da",
  text: "#1a1714",
  muted: "#8a7f74",
  faint: "#b8b0a6",
  meta: "#2563eb",
  metaLight: "#dbeafe",
  shopify: "#008060",
  shopifyLight: "#d1fae5",
  pinterest: "#e60023",
  pinterestLight: "#fee2e5",
  consolidated: "#7c3aed",
  consolidatedLight: "#ede9fe",
  warn: "#d97706",
  warnLight: "#fef3c7",
  good: "#16a34a",
  bad: "#dc2626",
};

/* ── Exact column names from Meta PT-BR export ── */
const COL = {
  adName: ["nome do anúncio"],
  campaign: ["nome da campanha"],
  adset: ["nome do conjunto de anúncios"],
  country: ["país", "country"],
  reach: ["alcance", "reach"],
  impressions: ["impressões", "impressions"],
  lpv: [
    "visualizações da página de destino do site",
    "visualizações da página de destino",
    "landing page views",
  ],
  costLpv: [
    "custo por visualização da página de destino (brl)",
    "custo por visualização da página de destino",
  ],
  addCart: ["adições ao carrinho"],
  checkout: ["checkouts"],
  purchases: ["compras", "purchases"],
  spend: ["valor usado (brl)", "valor usado", "amount spent (brl)"],
  cpa: ["custo por compra (brl)", "custo por compra"],
  clicks: ["cliques no link", "link clicks", "cliques"],
  // Shopify
  sessions: ["sessions", "sessões"],
  cartAdds: ["added to cart", "cart additions"],
  checkoutSh: ["reached checkout", "checkout"],
  // Pinterest
  saves: ["saves", "pin saves"],
};

function findCol(headers, aliases) {
  const h = headers.map((x) => x?.toLowerCase().trim());
  for (const alias of aliases) {
    const idx = h.findIndex((x) => x === alias || x?.includes(alias));
    if (idx !== -1) return headers[idx];
  }
  return null;
}
function getNum(row, aliases) {
  const col = findCol(Object.keys(row), aliases);
  if (!col) return 0;
  const n = parseFloat(
    String(row[col] || "0")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "")
  );
  return isNaN(n) ? 0 : n;
}
function getStr(row, aliases) {
  const col = findCol(Object.keys(row), aliases);
  return col ? row[col] || "—" : "—";
}

const fmt = (n, d = 0) =>
  n == null || isNaN(n)
    ? "—"
    : Number(n).toLocaleString("pt-BR", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      });
const fmtR = (n) =>
  !n || isNaN(n)
    ? "—"
    : "R$ " +
      Number(n).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
const fmtD = (n, sym = "$") =>
  !n || isNaN(n)
    ? "—"
    : sym +
      " " +
      Number(n).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
const fmtPct = (n) =>
  n == null || isNaN(n)
    ? "—"
    : Number(n).toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }) + "%";
const fmtX = (n) =>
  !n || isNaN(n) || n === 0 ? "—" : Number(n).toFixed(2) + "×";

/* ── Parse Meta CSV (anúncio + país no mesmo arquivo) ── */
function parseMeta(text) {
  const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
  const totals = {
    reach: 0,
    impressions: 0,
    lpv: 0,
    addCart: 0,
    checkout: 0,
    purchases: 0,
    spend: 0,
    clicks: 0,
  };
  const byCreative = {},
    byCountry = {},
    byCampaign = {},
    byAdset = {};

  for (const r of data) {
    const reach = getNum(r, COL.reach);
    const impressions = getNum(r, COL.impressions);
    const lpv = getNum(r, COL.lpv);
    const addCart = getNum(r, COL.addCart);
    const checkout = getNum(r, COL.checkout);
    const purchases = getNum(r, COL.purchases);
    const spend = getNum(r, COL.spend);
    const clicks = getNum(r, COL.clicks);
    const adName = getStr(r, COL.adName);
    const campaign = getStr(r, COL.campaign);
    const adset = getStr(r, COL.adset);
    const country = getStr(r, COL.country);

    totals.reach += reach;
    totals.impressions += impressions;
    totals.lpv += lpv;
    totals.addCart += addCart;
    totals.checkout += checkout;
    totals.purchases += purchases;
    totals.spend += spend;
    totals.clicks += clicks;

    const add = (map, key, init) => {
      if (!key || key === "—") return;
      if (!map[key]) map[key] = init();
      const m = map[key];
      m.reach += reach;
      m.impressions += impressions;
      m.lpv += lpv;
      m.addCart += addCart;
      m.checkout += checkout;
      m.purchases += purchases;
      m.spend += spend;
    };
    add(byCreative, adName, () => ({
      reach: 0,
      impressions: 0,
      lpv: 0,
      addCart: 0,
      checkout: 0,
      purchases: 0,
      spend: 0,
      campaign,
      adset,
    }));
    add(byCampaign, campaign, () => ({
      reach: 0,
      impressions: 0,
      lpv: 0,
      addCart: 0,
      checkout: 0,
      purchases: 0,
      spend: 0,
    }));
    add(byAdset, adset, () => ({
      reach: 0,
      impressions: 0,
      lpv: 0,
      addCart: 0,
      checkout: 0,
      purchases: 0,
      spend: 0,
      campaign,
    }));

    // Country — aggregate all, filter by purchases later
    if (country !== "—") {
      if (!byCountry[country])
        byCountry[country] = {
          purchases: 0,
          spend: 0,
          impressions: 0,
          lpv: 0,
          addCart: 0,
        };
      byCountry[country].purchases += purchases;
      byCountry[country].spend += spend;
      byCountry[country].impressions += impressions;
      byCountry[country].lpv += lpv;
      byCountry[country].addCart += addCart;
    }
  }
  totals.costLpv = totals.lpv > 0 ? totals.spend / totals.lpv : 0;
  totals.cpa = totals.purchases > 0 ? totals.spend / totals.purchases : 0;
  totals.cvr = totals.lpv > 0 ? (totals.purchases / totals.lpv) * 100 : 0;
  return {
    totals,
    byCreative,
    byCountry,
    byCampaign,
    byAdset,
    rowCount: data.length,
  };
}

function parseShopifyOrders(text) {
  const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
  let orders = 0,
    revenue = 0;
  const byCountry = {};
  for (const r of data) {
    const name = r["Name"] || r["name"] || "";
    if (!name) continue;
    const amt =
      parseFloat(String(r["Total"] || r["total"] || "0").replace(",", ".")) ||
      0;
    const country =
      r["Shipping Country"] ||
      r["Billing Country"] ||
      r["shipping_country"] ||
      "—";
    orders++;
    revenue += amt;
    if (!byCountry[country]) byCountry[country] = { orders: 0, revenue: 0 };
    byCountry[country].orders++;
    byCountry[country].revenue += amt;
  }
  return { orders, revenue, byCountry };
}

function parsePinterest(text) {
  const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
  const totals = {
    impressions: 0,
    clicks: 0,
    saves: 0,
    spend: 0,
    conversions: 0,
  };
  const byPin = {};
  for (const r of data) {
    const impr = getNum(r, ["impressions", "impressões"]);
    const clicks = getNum(r, ["link clicks", "clicks", "cliques"]);
    const saves = getNum(r, COL.saves);
    const spend = getNum(r, COL.spend);
    const conv = getNum(r, [
      "checkouts",
      "conversions",
      "purchases",
      "compras",
    ]);
    const pinName = getStr(r, [
      "ad name",
      "pin name",
      "name",
      "nome do anúncio",
    ]);
    totals.impressions += impr;
    totals.clicks += clicks;
    totals.saves += saves;
    totals.spend += spend;
    totals.conversions += conv;
    if (pinName !== "—") {
      if (!byPin[pinName])
        byPin[pinName] = {
          impressions: 0,
          clicks: 0,
          saves: 0,
          spend: 0,
          conversions: 0,
        };
      byPin[pinName].impressions += impr;
      byPin[pinName].clicks += clicks;
      byPin[pinName].saves += saves;
      byPin[pinName].spend += spend;
      byPin[pinName].conversions += conv;
    }
  }
  totals.ctr =
    totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  totals.cpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
  return { totals, byPin, rowCount: data.length };
}

/* ── Shared UI ── */
function UploadZone({ label, sub, onFile, loaded, color }) {
  const [drag, setDrag] = useState(false);
  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDrag(false);
      const f = e.dataTransfer.files[0];
      if (f) onFile(f);
    },
    [onFile]
  );
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        border: `1.5px dashed ${loaded ? color : drag ? "#888" : "#d6cfc5"}`,
        borderRadius: 10,
        padding: "20px 16px",
        cursor: "pointer",
        textAlign: "center",
        gap: 6,
        background: loaded ? `${color}0a` : drag ? "#eee8e0" : "#faf8f5",
        transition: "all 0.2s",
      }}
    >
      <input
        type="file"
        accept=".csv"
        style={{ display: "none" }}
        onChange={(e) => onFile(e.target.files[0])}
      />
      <div style={{ fontSize: 18 }}>{loaded ? "✓" : "↑"}</div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: loaded ? color : "#4a3f35",
          fontFamily: "'Syne',sans-serif",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 10, color: "#9a8f84" }}>
        {loaded ? "Carregado · clique pra trocar" : sub}
      </div>
    </label>
  );
}

function KPI({ label, value, sub, accent }) {
  return (
    <div
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        padding: "14px 16px",
        borderTop: `3px solid ${accent || T.border}`,
      }}
    >
      <div
        style={{
          fontSize: 9,
          color: T.muted,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          marginBottom: 5,
          fontFamily: "'Syne',sans-serif",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: T.text,
          fontFamily: "'Syne',sans-serif",
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: T.faint, marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

function SectionTitle({ children, color }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: color || T.muted,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        marginBottom: 14,
        fontFamily: "'Syne',sans-serif",
        borderLeft: `3px solid ${color || T.border}`,
        paddingLeft: 10,
      }}
    >
      {children}
    </div>
  );
}

function useSortable(data, def, dir = "desc") {
  const [sort, setSort] = useState({ key: def, dir });
  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => {
      const av = a[sort.key] ?? 0,
        bv = b[sort.key] ?? 0;
      return sort.dir === "desc" ? bv - av : av - bv;
    });
  }, [data, sort.key, sort.dir]);
  const onSort = (k) =>
    setSort((s) => ({
      key: k,
      dir: s.key === k && s.dir === "desc" ? "asc" : "desc",
    }));
  return { sorted, sort, onSort };
}

function DataTable({ cols, rows, sort, onSort, emptyMsg }) {
  const th = {
    padding: "8px 12px",
    fontSize: 9,
    color: T.muted,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    cursor: "pointer",
    whiteSpace: "nowrap",
    borderBottom: `1px solid ${T.border}`,
    textAlign: "right",
    userSelect: "none",
    background: T.bg,
    fontFamily: "'Syne',sans-serif",
  };
  const td = {
    padding: "9px 12px",
    fontSize: 12,
    color: "#4a3f35",
    borderBottom: `1px solid #f0ebe4`,
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
  };
  if (!rows.length)
    return (
      <div
        style={{
          padding: "32px 0",
          textAlign: "center",
          color: T.faint,
          fontSize: 13,
        }}
      >
        {emptyMsg || "Sem dados"}
      </div>
    );
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th
                key={c.key}
                style={{ ...th, textAlign: c.align || "right" }}
                onClick={() => onSort(c.key)}
              >
                {c.label}
                {sort.key === c.key ? (sort.dir === "desc" ? " ↓" : " ↑") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              style={{ background: i % 2 === 0 ? "#fffcf9" : T.card }}
            >
              {cols.map((c) => (
                <td
                  key={c.key}
                  style={{
                    ...td,
                    textAlign: c.align || "right",
                    color: c.color ? c.color(row[c.key], row) : td.color,
                  }}
                >
                  {c.render ? c.render(row[c.key], row) : row[c.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ icon, msg, sub }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        padding: "40px 20px",
        color: T.faint,
      }}
    >
      <div style={{ fontSize: 36, opacity: 0.4 }}>{icon || "◎"}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: T.muted }}>{msg}</div>
      {sub && (
        <div
          style={{
            fontSize: 12,
            textAlign: "center",
            maxWidth: 340,
            lineHeight: 1.6,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

/* ── META TAB ── */
function MetaTab({ meta, onMetaFile }) {
  const [subTab, setSubTab] = useState("overview");

  const creativeRows = useMemo(() => {
    if (!meta) return [];
    return Object.entries(meta.byCreative).map(([name, d]) => ({
      name,
      adset: d.adset,
      impressions: d.impressions,
      lpv: d.lpv,
      addCart: d.addCart,
      checkout: d.checkout,
      purchases: d.purchases,
      spend: d.spend,
      cpa: d.purchases > 0 ? d.spend / d.purchases : 0,
      cvr: d.lpv > 0 ? (d.purchases / d.lpv) * 100 : 0,
      cartRate: d.lpv > 0 ? (d.addCart / d.lpv) * 100 : 0,
    }));
  }, [meta]);

  // Countries — only with purchases
  const countryRows = useMemo(() => {
    if (!meta) return [];
    return Object.entries(meta.byCountry)
      .filter(([, d]) => d.purchases > 0)
      .map(([country, d]) => ({
        country,
        purchases: d.purchases,
        spend: d.spend,
        lpv: d.lpv,
        addCart: d.addCart,
        cpa: d.purchases > 0 ? d.spend / d.purchases : 0,
      }));
  }, [meta]);

  const campaignRows = useMemo(() => {
    if (!meta) return [];
    return Object.entries(meta.byCampaign).map(([name, d]) => ({
      name,
      impressions: d.impressions,
      lpv: d.lpv,
      addCart: d.addCart,
      checkout: d.checkout,
      purchases: d.purchases,
      spend: d.spend,
      cpa: d.purchases > 0 ? d.spend / d.purchases : 0,
    }));
  }, [meta]);

  const {
    sorted: sC,
    sort: sortC,
    onSort: oSC,
  } = useSortable(creativeRows, "purchases");
  const {
    sorted: sCo,
    sort: sortCo,
    onSort: oSCo,
  } = useSortable(countryRows, "purchases");
  const {
    sorted: sCa,
    sort: sortCa,
    onSort: oSCa,
  } = useSortable(campaignRows, "spend");

  const SUB = ["overview", "funil", "criativos", "países", "campanhas"];

  const roasColor = (v) => (v >= 3 ? T.good : v >= 1 ? T.warn : T.bad);

  return (
    <div>
      {/* Upload */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <UploadZone
          label="Meta Ads CSV"
          sub="Aba Anúncios → Detalhamento → País → Exportar CSV"
          onFile={onMetaFile}
          loaded={!!meta}
          color={T.meta}
        />
        <div
          style={{
            background: T.metaLight,
            borderRadius: 10,
            padding: "14px 18px",
            fontSize: 11,
            color: "#1e40af",
            lineHeight: 1.8,
          }}
        >
          <strong
            style={{
              display: "block",
              marginBottom: 6,
              fontSize: 10,
              letterSpacing: "0.1em",
              fontFamily: "'Syne',sans-serif",
            }}
          >
            COMO EXPORTAR
          </strong>
          1. Aba <b>Anúncios</b> (não Conjuntos)
          <br />
          2. Selecione o período completo
          <br />
          3. <b>Detalhamento → País</b>
          <br />
          4. Exportar → CSV
          <br />
          <span style={{ color: "#3b82f6", fontSize: 10 }}>
            Um arquivo só com tudo — criativo + país + métricas
          </span>
        </div>
      </div>

      {!meta && (
        <EmptyState
          icon="ƒ"
          msg="Faça upload do CSV do Meta Ads"
          sub="Exportar da aba Anúncios com Detalhamento → País ativado"
        />
      )}

      {meta && (
        <>
          {/* Sub tabs */}
          <div
            style={{
              display: "flex",
              gap: 2,
              marginBottom: 24,
              background: T.bg,
              borderRadius: 8,
              padding: 4,
              border: `1px solid ${T.border}`,
              width: "fit-content",
            }}
          >
            {SUB.map((s) => (
              <button
                key={s}
                onClick={() => setSubTab(s)}
                style={{
                  background: subTab === s ? T.card : "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "6px 14px",
                  fontSize: 11,
                  fontWeight: subTab === s ? 700 : 500,
                  color: subTab === s ? T.meta : T.muted,
                  borderRadius: 6,
                  transition: "all 0.15s",
                  fontFamily: "'Syne',sans-serif",
                  letterSpacing: "0.06em",
                  boxShadow:
                    subTab === s ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {subTab === "overview" && (
            <>
              <SectionTitle color={T.meta}>Investimento & Alcance</SectionTitle>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill,minmax(145px,1fr))",
                  gap: 10,
                  marginBottom: 22,
                }}
              >
                <KPI
                  label="Valor Gasto"
                  value={fmtR(meta.totals.spend)}
                  accent={T.meta}
                />
                <KPI
                  label="Impressões"
                  value={fmt(meta.totals.impressions)}
                  accent={T.meta}
                />
                <KPI
                  label="Alcance"
                  value={fmt(meta.totals.reach)}
                  accent={T.meta}
                />
              </div>
              <SectionTitle color={T.meta}>Funil</SectionTitle>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill,minmax(145px,1fr))",
                  gap: 10,
                  marginBottom: 22,
                }}
              >
                <KPI
                  label="Vis. Pág. Destino"
                  value={fmt(meta.totals.lpv)}
                  accent="#7c3aed"
                />
                <KPI
                  label="Custo / LPV"
                  value={fmtR(meta.totals.costLpv)}
                  accent="#7c3aed"
                />
                <KPI
                  label="Add Carrinho"
                  value={fmt(meta.totals.addCart)}
                  accent={T.warn}
                />
                <KPI
                  label="Checkouts"
                  value={fmt(meta.totals.checkout)}
                  accent={T.warn}
                />
                <KPI
                  label="Compras Meta"
                  value={fmt(meta.totals.purchases)}
                  accent={T.good}
                />
                <KPI
                  label="CPA Médio"
                  value={fmtR(meta.totals.cpa)}
                  accent={T.good}
                />
                <KPI
                  label="CVR (LPV→Compra)"
                  value={fmtPct(meta.totals.cvr)}
                  accent={T.shopify}
                />
              </div>
            </>
          )}

          {subTab === "funil" && (
            <div
              style={{
                maxWidth: 480,
                background: T.card,
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                padding: 24,
              }}
            >
              <SectionTitle color={T.meta}>
                Funil Completo — período selecionado
              </SectionTitle>
              {[
                {
                  l: "Impressões",
                  v: meta.totals.impressions,
                  color: "#93c5fd",
                },
                {
                  l: "Vis. Pág. Destino",
                  v: meta.totals.lpv,
                  color: "#7c3aed",
                },
                { l: "Add Carrinho", v: meta.totals.addCart, color: T.warn },
                {
                  l: "Checkout Iniciado",
                  v: meta.totals.checkout,
                  color: "#f97316",
                },
                { l: "Compras", v: meta.totals.purchases, color: T.good },
              ].map((s, i, arr) => {
                const prev = arr[i - 1]?.v;
                const pct = prev && prev > 0 ? (s.v / prev) * 100 : null;
                return (
                  <div
                    key={s.l}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 0",
                      borderBottom: `1px solid ${T.border}`,
                    }}
                  >
                    <div
                      style={{
                        width: 4,
                        height: 32,
                        background: s.color,
                        borderRadius: 2,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 9,
                          color: T.muted,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                        }}
                      >
                        {s.l}
                      </div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 700,
                          color: T.text,
                          fontFamily: "'Syne',sans-serif",
                        }}
                      >
                        {fmt(s.v)}
                      </div>
                    </div>
                    {pct != null && (
                      <div
                        style={{
                          fontSize: 11,
                          color: pct > 30 ? T.good : pct > 10 ? T.warn : T.bad,
                          background:
                            pct > 30
                              ? T.shopifyLight
                              : pct > 10
                              ? T.warnLight
                              : "#fee2e2",
                          padding: "2px 8px",
                          borderRadius: 20,
                          fontWeight: 600,
                        }}
                      >
                        {fmtPct(pct)}
                      </div>
                    )}
                  </div>
                );
              })}
              <div
                style={{
                  marginTop: 16,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 12,
                }}
              >
                {[
                  {
                    l: "Imp → LPV",
                    v:
                      meta.totals.impressions > 0
                        ? fmtPct(
                            (meta.totals.lpv / meta.totals.impressions) * 100
                          )
                        : "—",
                  },
                  {
                    l: "LPV → Cart",
                    v:
                      meta.totals.lpv > 0
                        ? fmtPct((meta.totals.addCart / meta.totals.lpv) * 100)
                        : "—",
                  },
                  {
                    l: "LPV → Compra",
                    v:
                      meta.totals.lpv > 0
                        ? fmtPct(
                            (meta.totals.purchases / meta.totals.lpv) * 100
                          )
                        : "—",
                  },
                ].map((r) => (
                  <div key={r.l} style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: 9,
                        color: T.faint,
                        letterSpacing: "0.1em",
                        marginBottom: 4,
                      }}
                    >
                      {r.l}
                    </div>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: T.meta,
                        fontFamily: "'Syne',sans-serif",
                      }}
                    >
                      {r.v}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {subTab === "criativos" && (
            <div
              style={{
                background: T.card,
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "14px 18px",
                  borderBottom: `1px solid ${T.border}`,
                  fontSize: 11,
                  color: T.muted,
                  fontFamily: "'Syne',sans-serif",
                  letterSpacing: "0.08em",
                }}
              >
                {sC.length} CRIATIVOS · clique na coluna para ordenar
              </div>
              <DataTable
                sort={sortC}
                onSort={oSC}
                cols={[
                  {
                    key: "name",
                    label: "Criativo",
                    align: "left",
                    render: (v) => (
                      <span
                        style={{
                          maxWidth: 220,
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontSize: 12,
                          color: T.text,
                          fontWeight: 500,
                        }}
                      >
                        {v}
                      </span>
                    ),
                  },
                  { key: "impressions", label: "Impr.", render: (v) => fmt(v) },
                  { key: "lpv", label: "LPV", render: (v) => fmt(v) },
                  { key: "addCart", label: "Add Cart", render: (v) => fmt(v) },
                  {
                    key: "cartRate",
                    label: "Cart Rate",
                    render: (v) => fmtPct(v),
                    color: (v) => (v > 10 ? T.good : v > 3 ? T.warn : T.faint),
                  },
                  { key: "checkout", label: "Checkout", render: (v) => fmt(v) },
                  {
                    key: "purchases",
                    label: "Compras",
                    render: (v) => fmt(v),
                    color: (v) => (v > 0 ? T.good : T.faint),
                  },
                  { key: "spend", label: "Gasto", render: (v) => fmtR(v) },
                  { key: "cpa", label: "CPA", render: (v) => fmtR(v) },
                  { key: "cvr", label: "CVR", render: (v) => fmtPct(v) },
                ]}
                rows={sC}
              />
            </div>
          )}

          {subTab === "países" && (
            <div
              style={{
                background: T.card,
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "14px 18px",
                  borderBottom: `1px solid ${T.border}`,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: T.muted,
                    fontFamily: "'Syne',sans-serif",
                    letterSpacing: "0.08em",
                    marginBottom: 4,
                  }}
                >
                  PAÍSES COM CONVERSÃO · {sCo.length} países
                </div>
                <div style={{ fontSize: 11, color: T.warn }}>
                  Só aparecem países que tiveram ao menos 1 compra
                </div>
              </div>
              {sCo.length === 0 ? (
                <EmptyState
                  icon="🌍"
                  msg="Nenhuma compra registrada ainda"
                  sub="Países aparecem aqui assim que houver conversão no período exportado"
                />
              ) : (
                <DataTable
                  sort={sortCo}
                  onSort={oSCo}
                  cols={[
                    {
                      key: "country",
                      label: "País",
                      align: "left",
                      render: (v) => (
                        <span
                          style={{
                            fontWeight: 700,
                            color: T.text,
                            fontSize: 14,
                          }}
                        >
                          {v}
                        </span>
                      ),
                    },
                    {
                      key: "impressions",
                      label: "Impr.",
                      render: (v) => fmt(v),
                    },
                    { key: "lpv", label: "LPV", render: (v) => fmt(v) },
                    {
                      key: "addCart",
                      label: "Add Cart",
                      render: (v) => fmt(v),
                    },
                    {
                      key: "purchases",
                      label: "Compras",
                      render: (v) => fmt(v),
                      color: (v) => (v > 0 ? T.good : T.faint),
                    },
                    {
                      key: "spend",
                      label: "Gasto Meta",
                      render: (v) => fmtR(v),
                    },
                    { key: "cpa", label: "CPA", render: (v) => fmtR(v) },
                  ]}
                  rows={sCo}
                />
              )}
            </div>
          )}

          {subTab === "campanhas" && (
            <div
              style={{
                background: T.card,
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "14px 18px",
                  borderBottom: `1px solid ${T.border}`,
                  fontSize: 11,
                  color: T.muted,
                  fontFamily: "'Syne',sans-serif",
                  letterSpacing: "0.08em",
                }}
              >
                {sCa.length} CAMPANHAS
              </div>
              <DataTable
                sort={sortCa}
                onSort={oSCa}
                cols={[
                  {
                    key: "name",
                    label: "Campanha",
                    align: "left",
                    render: (v) => (
                      <span
                        style={{
                          maxWidth: 260,
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontWeight: 500,
                          color: T.text,
                        }}
                      >
                        {v}
                      </span>
                    ),
                  },
                  { key: "impressions", label: "Impr.", render: (v) => fmt(v) },
                  { key: "lpv", label: "LPV", render: (v) => fmt(v) },
                  { key: "addCart", label: "Add Cart", render: (v) => fmt(v) },
                  {
                    key: "purchases",
                    label: "Compras",
                    render: (v) => fmt(v),
                    color: (v) => (v > 0 ? T.good : T.faint),
                  },
                  { key: "spend", label: "Gasto", render: (v) => fmtR(v) },
                  { key: "cpa", label: "CPA", render: (v) => fmtR(v) },
                ]}
                rows={sCa}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── SHOPIFY TAB ── */
function ShopifyTab({ shopifyOrders, onOrdersFile }) {
  const o = shopifyOrders;
  const countryRows = useMemo(() => {
    if (!o) return [];
    return Object.entries(o.byCountry).map(([c, d]) => ({
      country: c,
      orders: d.orders,
      revenue: d.revenue,
      avgTicket: d.orders > 0 ? d.revenue / d.orders : 0,
    }));
  }, [o]);
  const { sorted, sort, onSort } = useSortable(countryRows, "revenue");

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <UploadZone
          label="Shopify — Pedidos CSV"
          sub="Admin → Pedidos → Exportar → Todos os pedidos"
          onFile={onOrdersFile}
          loaded={!!o}
          color={T.shopify}
        />
        <div
          style={{
            background: T.shopifyLight,
            borderRadius: 10,
            padding: "14px 18px",
            fontSize: 11,
            color: "#065f46",
            lineHeight: 1.8,
          }}
        >
          <strong
            style={{
              display: "block",
              marginBottom: 6,
              fontSize: 10,
              letterSpacing: "0.1em",
              fontFamily: "'Syne',sans-serif",
            }}
          >
            COMO EXPORTAR
          </strong>
          Admin → <b>Pedidos</b> → selecione o período
          <br />→ <b>Exportar</b> → Pedidos atuais → CSV
          <br />
          <span style={{ color: T.shopify, fontSize: 10 }}>
            Inclui país de entrega, valor total, data
          </span>
        </div>
      </div>
      {!o && <EmptyState icon="🛍" msg="Faça upload dos pedidos do Shopify" />}
      {o && (
        <>
          <SectionTitle color={T.shopify}>Resumo Shopify</SectionTitle>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(145px,1fr))",
              gap: 10,
              marginBottom: 22,
            }}
          >
            <KPI
              label="Total de Pedidos"
              value={fmt(o.orders)}
              accent={T.shopify}
            />
            <KPI
              label="Receita Total"
              value={fmtD(o.revenue, "$")}
              accent={T.shopify}
            />
            <KPI
              label="Ticket Médio"
              value={o.orders > 0 ? fmtD(o.revenue / o.orders, "$") : "—"}
              accent={T.shopify}
            />
          </div>
          {sorted.length > 0 && (
            <>
              <SectionTitle color={T.shopify}>Pedidos por País</SectionTitle>
              <div
                style={{
                  background: T.card,
                  border: `1px solid ${T.border}`,
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                <DataTable
                  sort={sort}
                  onSort={onSort}
                  cols={[
                    {
                      key: "country",
                      label: "País",
                      align: "left",
                      render: (v) => (
                        <span style={{ fontWeight: 700, color: T.text }}>
                          {v}
                        </span>
                      ),
                    },
                    {
                      key: "orders",
                      label: "Pedidos",
                      render: (v) => fmt(v),
                      color: (v) => (v > 0 ? T.shopify : T.faint),
                    },
                    {
                      key: "revenue",
                      label: "Receita (USD)",
                      render: (v) => fmtD(v, "$"),
                      color: (v) => (v > 0 ? T.good : T.faint),
                    },
                    {
                      key: "avgTicket",
                      label: "Ticket Médio",
                      render: (v) => fmtD(v, "$"),
                    },
                  ]}
                  rows={sorted}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ── PINTEREST TAB ── */
function PinterestTab({ pinterest, onPinterestFile }) {
  const pinRows = useMemo(() => {
    if (!pinterest) return [];
    return Object.entries(pinterest.byPin).map(([name, d]) => ({
      name,
      impressions: d.impressions,
      clicks: d.clicks,
      saves: d.saves,
      spend: d.spend,
      conversions: d.conversions,
      ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
      cpa: d.conversions > 0 ? d.spend / d.conversions : 0,
    }));
  }, [pinterest]);
  const { sorted, sort, onSort } = useSortable(pinRows, "conversions");

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <UploadZone
          label="Pinterest Ads CSV"
          sub="Ads Manager → Reporting → Export CSV"
          onFile={onPinterestFile}
          loaded={!!pinterest}
          color={T.pinterest}
        />
        <div
          style={{
            background: T.pinterestLight,
            borderRadius: 10,
            padding: "14px 18px",
            fontSize: 11,
            color: "#9a1a1a",
            lineHeight: 1.8,
          }}
        >
          <strong
            style={{
              display: "block",
              marginBottom: 6,
              fontSize: 10,
              letterSpacing: "0.1em",
              fontFamily: "'Syne',sans-serif",
            }}
          >
            COMO EXPORTAR
          </strong>
          Pinterest Ads → <b>Reporting</b>
          <br />→ selecione período → <b>Export data</b> → CSV
          <br />
          <span style={{ color: T.pinterest, fontSize: 10 }}>
            Inclua: Impressões, Cliques, Saves, Gasto, Checkouts
          </span>
        </div>
      </div>
      {!pinterest && (
        <EmptyState icon="📌" msg="Faça upload do CSV do Pinterest Ads" />
      )}
      {pinterest && (
        <>
          <SectionTitle color={T.pinterest}>Resumo Pinterest</SectionTitle>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))",
              gap: 10,
              marginBottom: 22,
            }}
          >
            <KPI
              label="Impressões"
              value={fmt(pinterest.totals.impressions)}
              accent={T.pinterest}
            />
            <KPI
              label="Cliques"
              value={fmt(pinterest.totals.clicks)}
              accent={T.pinterest}
            />
            <KPI
              label="Saves"
              value={fmt(pinterest.totals.saves)}
              accent={T.pinterest}
            />
            <KPI
              label="CTR"
              value={fmtPct(pinterest.totals.ctr)}
              accent={T.pinterest}
            />
            <KPI
              label="Gasto"
              value={fmtD(pinterest.totals.spend)}
              accent={T.pinterest}
            />
            <KPI
              label="Conversões"
              value={fmt(pinterest.totals.conversions)}
              accent={T.good}
            />
            <KPI
              label="CPA"
              value={fmtD(pinterest.totals.cpa)}
              accent={T.warn}
            />
          </div>
          {sorted.length > 0 && (
            <>
              <SectionTitle color={T.pinterest}>
                Pins — {sorted.length}
              </SectionTitle>
              <div
                style={{
                  background: T.card,
                  border: `1px solid ${T.border}`,
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                <DataTable
                  sort={sort}
                  onSort={onSort}
                  cols={[
                    {
                      key: "name",
                      label: "Pin",
                      align: "left",
                      render: (v) => (
                        <span
                          style={{
                            maxWidth: 200,
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontWeight: 500,
                            color: T.text,
                          }}
                        >
                          {v}
                        </span>
                      ),
                    },
                    {
                      key: "impressions",
                      label: "Impr.",
                      render: (v) => fmt(v),
                    },
                    { key: "clicks", label: "Cliques", render: (v) => fmt(v) },
                    { key: "saves", label: "Saves", render: (v) => fmt(v) },
                    { key: "ctr", label: "CTR", render: (v) => fmtPct(v) },
                    { key: "spend", label: "Gasto", render: (v) => fmtD(v) },
                    {
                      key: "conversions",
                      label: "Conversões",
                      render: (v) => fmt(v),
                      color: (v) => (v > 0 ? T.good : T.faint),
                    },
                  ]}
                  rows={sorted}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ── CAMPAIGN CONFIG TAB ── */
const DEFAULT_CFG = {
  campaignName: "Vendas | Fev26",
  objective: "Vendas",
  optimization: "Maximizar conversões",
  event: "Iniciar finalização da compra",
  pixel: "a (pixel ID: 1255075166468968)",
  budget: "R$ 50,00/dia",
  attribution: "Padrão",
  advantagePlus: true,
  countries: [
    "🇩🇪 Alemanha",
    "🇪🇸 Espanha",
    "🇫🇷 França",
    "🇬🇧 Reino Unido",
    "🇮🇪 Irlanda",
    "🇳🇱 Países Baixos",
    "🇺🇸 Estados Unidos",
  ],
  ageMin: "23",
  ageMax: "50",
  gender: "Todos",
  lookalikes:
    "Semelhante (1%) – leads\nSemelhante (1%) – client list gallery wall mockups jan/26\nmailing – prospects.csv",
  interests:
    "Artes visuais (arte)\nImpressão sob demanda\nEtsy\nFreelancer (carreiras)\nArts, Artists, Artwork\nCampo de estudo: Graphic designer\nEmpregadores: Freelancer, Cargo: Designer, Photographer, Graphic designer, Graphic Designer/Illustrator, Art director, Graphic design, Freelance Graphic Designer ou Owner/Photographer",
  placements: "Automático (Advantage+)",
  notes:
    "Criada em 3/fev/2026. Advantage+ Sales ativo. Evento: Initiate Checkout (não Purchase — monitorar se isso afeta volume de dados).",
};

function CampaignConfigTab() {
  const [cfg, setCfg] = useState(DEFAULT_CFG);
  const [newCountry, setNewCountry] = useState("");
  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));
  const F = ({ label, k, multi, rows = 3 }) => (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          fontSize: 9,
          color: T.muted,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginBottom: 5,
          fontFamily: "'Syne',sans-serif",
        }}
      >
        {label}
      </div>
      {multi ? (
        <textarea
          value={cfg[k]}
          onChange={(e) => set(k, e.target.value)}
          rows={rows}
          style={{
            width: "100%",
            background: "#faf8f5",
            border: `1px solid ${T.border}`,
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: 12,
            resize: "vertical",
            lineHeight: 1.6,
          }}
        />
      ) : (
        <input
          value={cfg[k]}
          onChange={(e) => set(k, e.target.value)}
          style={{
            width: "100%",
            background: "#faf8f5",
            border: `1px solid ${T.border}`,
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: 12,
          }}
        />
      )}
    </div>
  );
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      <div>
        <div
          style={{
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: 20,
            marginBottom: 16,
          }}
        >
          <SectionTitle color={T.meta}>Estrutura</SectionTitle>
          <F label="Nome da campanha" k="campaignName" />
          <F label="Objetivo" k="objective" />
          <F label="Otimização" k="optimization" />
          <F label="Evento de conversão" k="event" />
          <F label="Pixel / Conjunto de dados" k="pixel" />
          <F label="Orçamento diário" k="budget" />
          <F label="Atribuição" k="attribution" />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: 9,
                color: T.muted,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontFamily: "'Syne',sans-serif",
              }}
            >
              Advantage+ Sales
            </div>
            <button
              onClick={() => set("advantagePlus", !cfg.advantagePlus)}
              style={{
                background: cfg.advantagePlus ? T.metaLight : "#f3f4f6",
                border: "none",
                cursor: "pointer",
                padding: "4px 14px",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                color: cfg.advantagePlus ? T.meta : "#888",
                fontFamily: "'Syne',sans-serif",
              }}
            >
              {cfg.advantagePlus ? "ATIVADO" : "DESATIVADO"}
            </button>
          </div>
          <F label="Posicionamentos" k="placements" />
        </div>
        <div
          style={{
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: 20,
          }}
        >
          <SectionTitle color={T.warn}>Notas Internas</SectionTitle>
          <F label="Observações" k="notes" multi rows={5} />
        </div>
      </div>
      <div>
        <div
          style={{
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: 20,
            marginBottom: 16,
          }}
        >
          <SectionTitle color={T.shopify}>Público</SectionTitle>
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 9,
                color: T.muted,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: 8,
                fontFamily: "'Syne',sans-serif",
              }}
            >
              Países
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginBottom: 8,
              }}
            >
              {cfg.countries.map((c) => (
                <span
                  key={c}
                  style={{
                    fontSize: 11,
                    background: T.metaLight,
                    color: T.meta,
                    padding: "3px 10px",
                    borderRadius: 20,
                    border: `1px solid #bfdbfe`,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {c}
                  <button
                    onClick={() =>
                      set(
                        "countries",
                        cfg.countries.filter((x) => x !== c)
                      )
                    }
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#93c5fd",
                      fontSize: 12,
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                value={newCountry}
                onChange={(e) => setNewCountry(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newCountry.trim()) {
                    set("countries", [...cfg.countries, newCountry.trim()]);
                    setNewCountry("");
                  }
                }}
                placeholder="+ País"
                style={{
                  fontSize: 11,
                  background: "#f0f9ff",
                  border: `1px dashed #93c5fd`,
                  borderRadius: 20,
                  padding: "3px 10px",
                  color: T.meta,
                  width: 100,
                }}
              />
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 10,
              marginBottom: 14,
            }}
          >
            {[
              ["Idade mín.", "ageMin"],
              ["Idade máx.", "ageMax"],
              ["Gênero", "gender"],
            ].map(([l, k]) => (
              <div key={k}>
                <div
                  style={{
                    fontSize: 9,
                    color: T.muted,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    marginBottom: 5,
                    fontFamily: "'Syne',sans-serif",
                  }}
                >
                  {l}
                </div>
                <input
                  value={cfg[k]}
                  onChange={(e) => set(k, e.target.value)}
                  style={{
                    width: "100%",
                    background: "#faf8f5",
                    border: `1px solid ${T.border}`,
                    borderRadius: 6,
                    padding: "6px 10px",
                    fontSize: 12,
                  }}
                />
              </div>
            ))}
          </div>
          <F
            label="Públicos Lookalike / Personalizados"
            k="lookalikes"
            multi
            rows={4}
          />
        </div>
        <div
          style={{
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: 20,
          }}
        >
          <SectionTitle color={T.shopify}>
            Interesses / Direcionamento Detalhado
          </SectionTitle>
          <F label="Interesses" k="interests" multi rows={7} />
        </div>
      </div>
    </div>
  );
}

/* ── CONSOLIDADO TAB ── */
function ConsolidatedTab({ meta, shopifyOrders, pinterest }) {
  const [shopifyRevUSD, setShopifyRevUSD] = useState("");
  const [usdBrl, setUsdBrl] = useState("5.85");

  const metaSpend = meta?.totals.spend ?? 0;
  const pintSpend = pinterest?.totals.spend ?? 0;
  const totalSpend = metaSpend + pintSpend;

  // ROAS calculado pelo Shopify
  const shopifyRevNum =
    parseFloat(String(shopifyRevUSD).replace(",", ".")) || 0;
  const usdBrlNum = parseFloat(String(usdBrl).replace(",", ".")) || 5.85;
  const shopifyRevBRL = shopifyRevNum * usdBrlNum;
  const roas =
    totalSpend > 0 && shopifyRevBRL > 0 ? shopifyRevBRL / totalSpend : 0;
  const roasColor =
    roas >= 3 ? T.good : roas >= 1 ? T.warn : roas > 0 ? T.bad : T.faint;

  const hasData = meta || shopifyOrders || pinterest;

  // Auto-insights
  const insights = [];
  if (meta) {
    const topC = Object.entries(meta.byCreative).sort(
      ([, a], [, b]) => b.purchases - a.purchases
    )[0];
    if (topC && topC[1].purchases > 0)
      insights.push({
        t: "info",
        m: `Top criativo: "${topC[0].slice(0, 55)}…" — ${fmt(
          topC[1].purchases
        )} compras · CPA ${fmtR(topC[1].spend / topC[1].purchases)}`,
      });
    const topCountry = Object.entries(meta.byCountry)
      .filter(([, d]) => d.purchases > 0)
      .sort(([, a], [, b]) => b.purchases - a.purchases)[0];
    if (topCountry)
      insights.push({
        t: "info",
        m: `País top: ${topCountry[0]} — ${fmt(
          topCountry[1].purchases
        )} compras · gasto ${fmtR(topCountry[1].spend)}`,
      });
    if (meta.totals.cvr < 1 && meta.totals.lpv > 20)
      insights.push({
        t: "warn",
        m: `CVR baixo (${fmtPct(
          meta.totals.cvr
        )}) — menos de 1% dos visitantes compram. Revisar página de destino.`,
      });
    if (meta.totals.addCart > 0 && meta.totals.purchases > 0) {
      const cartConv = (meta.totals.purchases / meta.totals.addCart) * 100;
      if (cartConv < 5)
        insights.push({
          t: "warn",
          m: `Alto abandono de carrinho — só ${fmtPct(
            cartConv
          )} dos que adicionam finalizam compra`,
        });
    }
    // Check if Cozinha is eating too much budget vs results
    const cozinha =
      meta.byCreative[
        Object.keys(meta.byCreative).find((k) => k.includes("Cozinha")) || ""
      ];
    const jantar =
      meta.byCreative[
        Object.keys(meta.byCreative).find((k) => k.includes("Sala Jantar")) ||
          ""
      ];
    if (cozinha && jantar && cozinha.spend > 0 && jantar.spend > 0) {
      const cpaCoz =
        cozinha.purchases > 0 ? cozinha.spend / cozinha.purchases : 999;
      const cpaJan =
        jantar.purchases > 0 ? jantar.spend / jantar.purchases : 999;
      if (cpaCoz > cpaJan * 1.5 && jantar.purchases > 0)
        insights.push({
          t: "bad",
          m: `Sala Jantar tem CPA ${fmtR(cpaJan)} vs Cozinha ${fmtR(
            cpaCoz
          )} — Cozinha está consumindo ${fmtPct(
            (cozinha.spend / metaSpend) * 100
          )} do budget com CPA mais alto`,
        });
    }
  }
  if (roas > 0) {
    if (roas >= 3)
      insights.push({
        t: "good",
        m: `ROAS Global ${fmtX(
          roas
        )} — acima de 3× é saudável para produto digital`,
      });
    else if (roas >= 1)
      insights.push({
        t: "warn",
        m: `ROAS Global ${fmtX(
          roas
        )} — positivo mas abaixo de 3×. Escalar com cautela.`,
      });
    else
      insights.push({
        t: "bad",
        m: `ROAS Global ${fmtX(
          roas
        )} — abaixo de 1×. Receita não cobre o gasto em ads.`,
      });
  }

  const iconMap = { good: "✓", bad: "✗", warn: "⚠", info: "→" };
  const colorMap = { good: T.good, bad: T.bad, warn: T.warn, info: T.meta };
  const bgMap = {
    good: T.shopifyLight,
    bad: "#fee2e2",
    warn: T.warnLight,
    info: T.metaLight,
  };

  return (
    <div>
      {!hasData && (
        <EmptyState icon="◎" msg="Faça upload de pelo menos um arquivo" />
      )}
      {hasData && (
        <>
          {/* ROAS manual input */}
          <div
            style={{
              background: T.card,
              border: `2px solid ${roas > 0 ? roasColor : T.border}`,
              borderRadius: 12,
              padding: 20,
              marginBottom: 24,
            }}
          >
            <SectionTitle color={T.consolidated}>
              ROAS Global — calculado pelo Shopify
            </SectionTitle>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr auto",
                gap: 12,
                alignItems: "end",
                marginBottom: 16,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 9,
                    color: T.muted,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    marginBottom: 6,
                    fontFamily: "'Syne',sans-serif",
                  }}
                >
                  Receita Shopify (USD)
                </div>
                <input
                  value={shopifyRevUSD}
                  onChange={(e) => setShopifyRevUSD(e.target.value)}
                  placeholder="ex: 79.96"
                  style={{
                    width: "100%",
                    background: "#faf8f5",
                    border: `1px solid ${T.border}`,
                    borderRadius: 6,
                    padding: "8px 12px",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                />
              </div>
              <div>
                <div
                  style={{
                    fontSize: 9,
                    color: T.muted,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    marginBottom: 6,
                    fontFamily: "'Syne',sans-serif",
                  }}
                >
                  Cotação USD → BRL
                </div>
                <input
                  value={usdBrl}
                  onChange={(e) => setUsdBrl(e.target.value)}
                  placeholder="ex: 5.85"
                  style={{
                    width: "100%",
                    background: "#faf8f5",
                    border: `1px solid ${T.border}`,
                    borderRadius: 6,
                    padding: "8px 12px",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                />
              </div>
              <div style={{ textAlign: "center", paddingBottom: 2 }}>
                <div
                  style={{
                    fontSize: 9,
                    color: T.muted,
                    letterSpacing: "0.1em",
                    marginBottom: 4,
                    fontFamily: "'Syne',sans-serif",
                  }}
                >
                  ROAS GLOBAL
                </div>
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 800,
                    color: roas > 0 ? roasColor : T.faint,
                    fontFamily: "'Syne',sans-serif",
                  }}
                >
                  {roas > 0 ? fmtX(roas) : "—"}
                </div>
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: 10,
              }}
            >
              <KPI
                label="Gasto Total Ads"
                value={fmtR(totalSpend)}
                accent={T.consolidated}
              />
              <KPI label="Gasto Meta" value={fmtR(metaSpend)} accent={T.meta} />
              <KPI
                label="Receita (USD)"
                value={shopifyRevNum > 0 ? fmtD(shopifyRevNum, "$") : "—"}
                accent={T.shopify}
              />
              <KPI
                label="Receita (BRL)"
                value={shopifyRevBRL > 0 ? fmtR(shopifyRevBRL) : "—"}
                accent={T.shopify}
              />
            </div>
          </div>

          {/* Canais */}
          <SectionTitle color={T.consolidated}>Canais</SectionTitle>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${
                [meta, pinterest].filter(Boolean).length || 1
              },1fr)`,
              gap: 12,
              marginBottom: 24,
            }}
          >
            {meta && (
              <div
                style={{
                  background: T.card,
                  border: `2px solid ${T.meta}25`,
                  borderRadius: 12,
                  padding: 18,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: T.meta,
                      fontFamily: "'Syne',sans-serif",
                    }}
                  >
                    Meta Ads
                  </span>
                  <span
                    style={{ fontSize: 12, fontWeight: 700, color: T.meta }}
                  >
                    {fmtR(meta.totals.spend)}
                  </span>
                </div>
                {[
                  ["Impressões", fmt(meta.totals.impressions)],
                  ["LPV", fmt(meta.totals.lpv)],
                  ["Add Cart", fmt(meta.totals.addCart)],
                  ["Compras", fmt(meta.totals.purchases)],
                  ["CPA", fmtR(meta.totals.cpa)],
                  ["CVR", fmtPct(meta.totals.cvr)],
                ].map(([l, v]) => (
                  <div
                    key={l}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "5px 0",
                      borderBottom: `1px solid ${T.border}`,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: T.muted }}>{l}</span>
                    <span style={{ fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
            )}
            {pinterest && (
              <div
                style={{
                  background: T.card,
                  border: `2px solid ${T.pinterest}25`,
                  borderRadius: 12,
                  padding: 18,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: T.pinterest,
                      fontFamily: "'Syne',sans-serif",
                    }}
                  >
                    Pinterest
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: T.pinterest,
                    }}
                  >
                    {fmtD(pinterest.totals.spend)}
                  </span>
                </div>
                {[
                  ["Impressões", fmt(pinterest.totals.impressions)],
                  ["Cliques", fmt(pinterest.totals.clicks)],
                  ["Saves", fmt(pinterest.totals.saves)],
                  ["CTR", fmtPct(pinterest.totals.ctr)],
                  ["Conversões", fmt(pinterest.totals.conversions)],
                ].map(([l, v]) => (
                  <div
                    key={l}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "5px 0",
                      borderBottom: `1px solid ${T.border}`,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: T.muted }}>{l}</span>
                    <span style={{ fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {insights.length > 0 && (
            <>
              <SectionTitle color={T.consolidated}>
                Insights & Alertas
              </SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {insights.map((ins, i) => (
                  <div
                    key={i}
                    style={{
                      background: bgMap[ins.t],
                      border: `1px solid ${colorMap[ins.t]}30`,
                      borderRadius: 8,
                      padding: "10px 14px",
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        color: colorMap[ins.t],
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {iconMap[ins.t]}
                    </span>
                    <span
                      style={{ fontSize: 12, color: T.text, lineHeight: 1.5 }}
                    >
                      {ins.m}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ── MAIN APP ── */
export default function App() {
  const [tab, setTab] = useState("meta");
  const [meta, setMeta] = useState(null);
  const [shopifyOrders, setShopifyOrders] = useState(null);
  const [pinterest, setPinterest] = useState(null);

  const readCsv = (fn) => (file) => {
    const r = new FileReader();
    r.onload = (e) => fn(e.target.result);
    r.readAsText(file, "UTF-8");
  };

  const TABS = [
    { id: "meta", label: "Meta Ads", color: T.meta, dot: !!meta },
    { id: "shopify", label: "Shopify", color: T.shopify, dot: !!shopifyOrders },
    {
      id: "pinterest",
      label: "Pinterest",
      color: T.pinterest,
      dot: !!pinterest,
    },
    { id: "config", label: "Campanha", color: "#7c3aed", dot: true },
    {
      id: "consolidated",
      label: "Consolidado",
      color: T.consolidated,
      dot: !!(meta || shopifyOrders || pinterest),
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.bg,
        fontFamily: "'Instrument Sans',sans-serif",
      }}
    >
      <GlobalStyles />
      {/* Header */}
      <div
        style={{
          background: T.card,
          borderBottom: `1px solid ${T.border}`,
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: 1300,
            margin: "0 auto",
            display: "flex",
            alignItems: "stretch",
            justifyContent: "space-between",
            height: 54,
            padding: "0 24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 26,
                height: 26,
                background: "#1a1714",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  color: "white",
                  fontSize: 13,
                  fontWeight: 800,
                  fontFamily: "'Syne',sans-serif",
                }}
              >
                G
              </span>
            </div>
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: T.text,
                  fontFamily: "'Syne',sans-serif",
                }}
              >
                Gallery Wall Mockups
              </div>
              <div
                style={{ fontSize: 9, color: T.faint, letterSpacing: "0.08em" }}
              >
                PERFORMANCE DASHBOARD
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "0 16px",
                  fontSize: 11,
                  fontWeight: tab === t.id ? 700 : 500,
                  color: tab === t.id ? t.color : T.muted,
                  borderBottom:
                    tab === t.id
                      ? `3px solid ${t.color}`
                      : "3px solid transparent",
                  transition: "all 0.15s",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontFamily: "'Syne',sans-serif",
                  letterSpacing: "0.04em",
                  whiteSpace: "nowrap",
                  marginBottom: -1,
                }}
              >
                {t.label}
                {t.dot && (
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: t.color,
                    }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1300, margin: "0 auto", padding: "26px 24px" }}>
        {tab === "meta" && (
          <MetaTab
            meta={meta}
            onMetaFile={readCsv((t) => setMeta(parseMeta(t)))}
          />
        )}
        {tab === "shopify" && (
          <ShopifyTab
            shopifyOrders={shopifyOrders}
            onOrdersFile={readCsv((t) =>
              setShopifyOrders(parseShopifyOrders(t))
            )}
          />
        )}
        {tab === "pinterest" && (
          <PinterestTab
            pinterest={pinterest}
            onPinterestFile={readCsv((t) => setPinterest(parsePinterest(t)))}
          />
        )}
        {tab === "config" && <CampaignConfigTab />}
        {tab === "consolidated" && (
          <ConsolidatedTab
            meta={meta}
            shopifyOrders={shopifyOrders}
            pinterest={pinterest}
          />
        )}
      </div>
    </div>
  );
}
