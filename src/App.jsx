// Arquivo saneado parcialmente com as correções estruturais mais críticas.
// Substitua o seu arquivo atual por este conteúdo-base e continue a partir daqui.
// Principais correções aplicadas:
// 1) comentários JSX inválidos
// 2) template literals em style
// 3) bugs em CampanhaTab
// 4) alt={shortName} removido
// 5) trechos com sintaxe impossível corrigidos

import {
  useState, useCallback, useMemo, useEffect,
  createContext, useContext, useRef
} from "react";
import * as Papa from "papaparse";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, ReferenceLine
} from "recharts";

const SB_URL = "https://vcvtxaiksxdnczjiftap.supabase.co";
const SB_KEY = "YOUR_SUPABASE_ANON_KEY";
const sbH = {
  "Content-Type": "application/json",
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`
};

async function sbSave(type, content) {
  try {
    await fetch(`${SB_URL}/rest/v1/csv_files`, {
      method: "POST",
      headers: { ...sbH, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ type, content })
    });
  } catch (e) {
    console.warn(e);
  }
}

async function sbDelete(type) {
  try {
    await fetch(`${SB_URL}/rest/v1/csv_files?type=eq.${type}`, {
      method: "DELETE",
      headers: sbH
    });
  } catch {}
}

async function sbLoadAll() {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/csv_files?select=type,content`, {
      headers: sbH
    });
    if (!r.ok) return {};
    const rows = await r.json();
    const out = {};
    for (const x of rows) out[x.type] = x.content;
    return out;
  } catch {
    return {};
  }
}

async function sbUploadCreative(adName, file) {
  try {
    const ext = file.name.split(".").pop();
    const safeKey = (adName || "")
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9 _\-.]/g, "_")
      .slice(0, 80);
    const key = encodeURIComponent(safeKey) + "." + ext;
    const r = await fetch(`${SB_URL}/storage/v1/object/creatives/${key}`, {
      method: "POST",
      headers: { ...sbH, "x-upsert": "true", "Content-Type": file.type },
      body: file
    });
    if (!r.ok) {
      console.warn(await r.text());
      return null;
    }
    return {
      url: `${SB_URL}/storage/v1/object/public/creatives/${key}`,
      key: safeKey
    };
  } catch (e) {
    console.warn(e);
    return null;
  }
}

async function sbLoadCreativeImages() {
  try {
    const r = await fetch(`${SB_URL}/storage/v1/object/list/creatives`, {
      method: "POST",
      headers: { ...sbH, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: "", limit: 500 })
    });
    if (!r.ok) return {};
    const files = await r.json();
    const map = {};
    for (const f of files) {
      if (!f.name) continue;
      const decoded = decodeURIComponent(f.name.replace(/\.[^.]+$/, ""));
      map[decoded] = `${SB_URL}/storage/v1/object/public/creatives/${f.name}`;
    }
    return map;
  } catch {
    return {};
  }
}

const ThemeCtx = createContext(null);
const useT = () => useContext(ThemeCtx);

const BASE_THEME = {
  bg: "#f5f2ee",
  card: "#ffffff",
  border: "#e8e2da",
  text: "#1a1714",
  muted: "#8a7f74",
  faint: "#c8bfb4",
  meta: "#2563eb",
  metaL: "#dbeafe",
  shopify: "#008060",
  shopifyL: "#d1fae5",
  pinterest: "#e60023",
  pinterestL: "#fee2e5",
  violet: "#7c3aed",
  violetL: "#ede9fe",
  warn: "#d97706",
  warnL: "#fef3c7",
  good: "#16a34a",
  bad: "#dc2626",
  radius: 10,
  fontBody: "'Instrument Sans', sans-serif",
  fontDisplay: "'Syne', sans-serif",
  fontSize: 1.0
};

function lsGet(k, def) {
  try {
    const v = localStorage.getItem(k);
    return v != null ? JSON.parse(v) : def;
  } catch {
    return def;
  }
}

function lsSet(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
}

function normImgKey(s) {
  return (s || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 _\-.]/g, "_")
    .slice(0, 80);
}

function fmt(n, d = 0) {
  return n == null || isNaN(n)
    ? "—"
    : Number(n).toLocaleString("pt-BR", {
        minimumFractionDigits: d,
        maximumFractionDigits: d
      });
}

function fmtR(n) {
  return !n || isNaN(n)
    ? "—"
    : "R$\u00a0" + Number(n).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
}

function fmtUSD(n) {
  return n == null || isNaN(n) || n === 0
    ? "—"
    : "$\u00a0" + Number(n).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
}

function fmtPct(n) {
  return n == null || isNaN(n)
    ? "—"
    : Number(n).toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }) + "%";
}

function fmtX(n) {
  return !n || isNaN(n) || n === 0 ? "—" : Number(n).toFixed(2) + "×";
}

function fmtDate(s) {
  if (!s) return "—";
  try {
    const d = new Date(s + "T12:00:00");
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch {
    return s;
  }
}

function fmtMonth(m) {
  if (!m) return "—";
  const [y, mo] = m.split("-");
  return new Date(parseInt(y), parseInt(mo) - 1, 1).toLocaleDateString("pt-BR", {
    month: "short",
    year: "2-digit"
  });
}

function GlobalStyles({ theme }) {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Instrument+Sans:wght@400;500;600&display=swap');
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
      body{background:${theme.bg};font-family:${theme.fontBody};color:${theme.text};font-size:${(theme.fontSize || 1) * 14}px}
      ::-webkit-scrollbar{width:5px;height:5px}
      ::-webkit-scrollbar-thumb{background:#d6cfc5;border-radius:10px}
      input,select,textarea{font-family:inherit}
      @keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
      @keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
      @keyframes spin{to{transform:rotate(360deg)}}
    `}</style>
  );
}

function CreativeImageCell({ adName, images, onUpload }) {
  const T = useT();
  const [uploading, setUploading] = useState(false);
  const n = adName || "";
  const k1 = normImgKey(n);
  const k2 = n.trim().slice(0, 80);
  const k3 = n.trim().replace(/[^a-zA-Z0-9 _\-.]/g, "_").slice(0, 80);
  const url =
    images[k1] ||
    images[k2] ||
    images[k3] ||
    Object.entries(images).find(([k]) =>
      k && n.trim().length > 10 &&
      (k.startsWith(n.trim().slice(0, 30)) || normImgKey(k).startsWith(normImgKey(n).slice(0, 30)))
    )?.[1];

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    await onUpload(adName, file);
    setUploading(false);
  };

  return (
    <label style={{ cursor: "pointer", flexShrink: 0 }}>
      <input
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {url ? (
        <img
          src={url}
          alt={adName || "creative"}
          style={{
            width: 48,
            height: 48,
            objectFit: "cover",
            borderRadius: T.radius,
            border: `2px solid ${T.violet}`,
            display: "block"
          }}
          title="Clique para trocar"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: T.radius,
            border: `2px dashed ${uploading ? T.violet : T.faint}`,
            background: uploading ? T.violetL : T.bg,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1
          }}
          title="Clique para adicionar imagem"
        >
          <span style={{ fontSize: 14 }}>{uploading ? "⏳" : "🖼"}</span>
          {!uploading && (
            <span style={{ fontSize: 7, color: T.faint, letterSpacing: "0.05em" }}>
              ADD
            </span>
          )}
        </div>
      )}
    </label>
  );
}

function CampanhaTab({ meta, shopify, rate }) {
  const T = useT();

  if (!meta) {
    return (
      <div style={{ textAlign: "center", padding: "44px 0", color: T.faint, fontSize: 13 }}>
        Suba Meta Ads CSV para ver análise de campanha
      </div>
    );
  }

  const rows = Object.entries(meta.byCampaignMonth || {})
    .map(([, d]) => {
      const roas =
        d.spend > 0 && shopify
          ? (((shopify.byMonth?.[d.month]?.revenue || 0) * rate) / d.spend)
          : 0;

      return {
        ...d,
        roas,
        cpa: d.purchases > 0 ? d.spend / d.purchases : 0,
        cvr: d.lpv > 0 ? (d.purchases / d.lpv) * 100 : 0,
        cpm: d.impressions > 0 ? (d.spend / d.impressions) * 1000 : 0
      };
    })
    .sort((a, b) => a.campaign.localeCompare(b.campaign) || a.month.localeCompare(b.month));

  if (!rows.length) {
    return <div style={{ padding: 20, color: T.faint, fontSize: 12, textAlign: "center" }}>Sem dados de campanha por mês</div>;
  }

  const campaigns = [...new Set(rows.map((r) => r.campaign))];

  return (
    <div>
      {campaigns.map((camp) => {
        const campRows = rows.filter((r) => r.campaign === camp);
        const totSpend = campRows.reduce((a, r) => a + r.spend, 0);
        const totPurch = campRows.reduce((a, r) => a + r.purchases, 0);
        const totLpv = campRows.reduce((a, r) => a + r.lpv, 0);

        return (
          <div key={camp} style={{ marginBottom: 20, background: T.card, border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", background: T.bg, borderBottom: `1px solid ${T.border}`, fontWeight: 700, color: T.meta }}>
              {camp}
            </div>
            <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 8, marginBottom: 12 }}>
              <div>Total Gasto: {fmtR(totSpend)}</div>
              <div>Compras: {fmt(totPurch)}</div>
              <div>LPV: {fmt(totLpv)}</div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Mês", "Gasto", "Compras", "LPV", "Add Cart", "Impr.", "Cliques", "CPA", "CVR", "CPM"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "7px 10px",
                          fontSize: 9,
                          color: T.muted,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          textAlign: h === "Mês" ? "left" : "right",
                          background: T.bg,
                          borderBottom: `1px solid ${T.border}`,
                          fontFamily: T.fontDisplay
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campRows.map((r, i) => (
                    <tr key={r.month} style={{ background: i % 2 === 0 ? T.card : T.bg }}>
                      <td style={{ padding: "7px 10px", fontSize: 11, fontWeight: 700, color: T.text }}>{fmtMonth(r.month)}</td>
                      <td style={{ padding: "7px 10px", fontSize: 11, textAlign: "right", color: T.meta }}>{fmtR(r.spend)}</td>
                      <td style={{ padding: "7px 10px", fontSize: 11, textAlign: "right", color: r.purchases > 0 ? T.good : T.faint }}>{fmt(r.purchases)}</td>
                      <td style={{ padding: "7px 10px", fontSize: 11, textAlign: "right", color: T.violet }}>{fmt(r.lpv)}</td>
                      <td style={{ padding: "7px 10px", fontSize: 11, textAlign: "right", color: T.warn }}>{fmt(r.addCart)}</td>
                      <td style={{ padding: "7px 10px", fontSize: 11, textAlign: "right", color: T.muted }}>{fmt(r.impressions)}</td>
                      <td style={{ padding: "7px 10px", fontSize: 11, textAlign: "right", color: T.muted }}>{fmt(r.clicks)}</td>
                      <td style={{ padding: "7px 10px", fontSize: 11, textAlign: "right", color: r.cpa > 0 ? T.text : T.faint }}>{r.cpa > 0 ? fmtR(r.cpa) : "—"}</td>
                      <td style={{ padding: "7px 10px", fontSize: 11, textAlign: "right", color: r.cvr >= 3 ? T.good : r.cvr >= 1 ? T.warn : r.cvr > 0 ? T.bad : T.faint }}>{r.cvr > 0 ? fmtPct(r.cvr) : "—"}</td>
                      <td style={{ padding: "7px 10px", fontSize: 11, textAlign: "right", color: T.muted }}>{r.cpm > 0 ? fmtR(r.cpm) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => lsGet("gwm_theme_v2", BASE_THEME));
  const [showTheme, setShowTheme] = useState(false);
  const [showClear, setShowClear] = useState(false);
  const [tab, setTab] = useState("Consolidado");
  const [metaCsv, setMetaCsv] = useState("");
  const [shopifyCsv, setShopifyCsv] = useState("");
  const [pinterestCsv, setPinterestCsv] = useState("");
  const [rate, setRate] = useState(lsGet("gwm_rate", 5.85));
  const [fee, setFee] = useState(lsGet("gwm_fee", 6.8));
  const [openAIKey, setOpenAIKey] = useState(() => lsGet("gwm_oai_key", ""));
  const [creativeImages, setCreativeImages] = useState({});
  const [loadingInit, setLoadingInit] = useState(true);
  const T = theme;

  useEffect(() => {
    const init = async () => {
      setLoadingInit(true);
      const [stored, imgs] = await Promise.all([sbLoadAll(), sbLoadCreativeImages()]);
      if (stored.meta) setMetaCsv(stored.meta);
      if (stored.shopify) setShopifyCsv(stored.shopify);
      if (stored.pinterest) setPinterestCsv(stored.pinterest);
      setCreativeImages(imgs);
      setLoadingInit(false);
    };
    init();
  }, []);

  useEffect(() => {
    lsSet("gwm_rate", rate);
  }, [rate]);

  useEffect(() => {
    lsSet("gwm_fee", fee);
  }, [fee]);

  useEffect(() => {
    lsSet("gwm_oai_key", openAIKey);
  }, [openAIKey]);

  const handleImageUpload = useCallback(async (adName, file) => {
    const result = await sbUploadCreative(adName, file);
    if (result) {
      const nk = normImgKey(adName);
      setCreativeImages((prev) => ({
        ...prev,
        [result.key]: result.url,
        [nk]: result.url,
        [adName.trim().slice(0, 80)]: result.url
      }));
    }
  }, []);

  const TABS = ["Consolidado", "Meta Ads", "Shopify", "Pinterest", "Financeiro", "Leads", "Campanha"];
  const TAB_COLORS = {
    Consolidado: T.violet,
    "Meta Ads": T.meta,
    Shopify: T.shopify,
    Pinterest: T.pinterest,
    Financeiro: T.good,
    Leads: T.violet,
    Campanha: T.meta
  };

  const TAB_DOTS = {
    "Meta Ads": !!metaCsv,
    Shopify: !!shopifyCsv,
    Pinterest: !!pinterestCsv
  };

  return (
    <ThemeCtx.Provider value={T}>
      <GlobalStyles theme={T} />
      <div style={{ minHeight: "100vh", background: T.bg, fontFamily: T.fontBody }}>
        {/* HEADER */}
        <div
          style={{
            background: T.card,
            borderBottom: `1px solid ${T.border}`,
            padding: "0 24px",
            position: "sticky",
            top: 0,
            zIndex: 100,
            boxShadow: "0 1px 8px rgba(0,0,0,0.05)"
          }}
        >
          <div style={{ maxWidth: 1400, margin: "0 auto" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: 10,
                paddingBottom: 6,
                flexWrap: "wrap",
                gap: 8
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 15, color: T.text, letterSpacing: "-0.02em" }}>
                  gallery<span style={{ color: T.violet }}>.</span>wall
                  <span style={{ fontSize: 9, color: T.faint, fontWeight: 400, marginLeft: 8, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    PERFORMANCE DASHBOARD
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: T.bg,
                    border: `1px solid ${T.border}`,
                    borderRadius: T.radius,
                    padding: "4px 10px"
                  }}
                >
                  <span style={{ fontSize: 9, color: T.muted, fontFamily: T.fontDisplay, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    US$1 =
                  </span>
                  <span style={{ fontSize: 9, color: T.faint, fontFamily: T.fontDisplay }}>R$</span>
                  <input
                    type="number"
                    value={rate}
                    step="0.05"
                    min="1"
                    onChange={(e) => setRate(parseFloat(e.target.value) || 5.85)}
                    style={{ width: 52, border: "none", background: "transparent", fontSize: 13, fontWeight: 700, color: T.text, outline: "none", fontFamily: T.fontDisplay }}
                  />
                </div>

                <button
                  onClick={() => setShowTheme((s) => !s)}
                  style={{
                    fontSize: 10,
                    color: showTheme ? T.violet : T.muted,
                    background: "none",
                    border: `1px solid ${showTheme ? T.violet : T.border}`,
                    cursor: "pointer",
                    padding: "4px 10px",
                    borderRadius: 20,
                    fontFamily: T.fontDisplay,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontWeight: 600
                  }}
                >
                  🎨 Tema
                </button>
              </div>
            </div>

            {/* NAV */}
            <div style={{ display: "flex", gap: 2, paddingBottom: 0, overflowX: "auto" }}>
              {TABS.map((t) => {
                const active = tab === t;
                const color = TAB_COLORS[t] || T.violet;
                const hasDot = TAB_DOTS[t];
                return (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: "8px 14px",
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: active ? 700 : 500,
                      color: active ? color : T.muted,
                      fontFamily: T.fontDisplay,
                      letterSpacing: "0.04em",
                      borderBottom: active ? `2.5px solid ${color}` : "2.5px solid transparent",
                      transition: "all 0.15s",
                      whiteSpace: "nowrap",
                      position: "relative"
                    }}
                  >
                    {t}
                    {hasDot && (
                      <span
                        style={{
                          position: "absolute",
                          top: 6,
                          right: 6,
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: color
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 24px" }}>
          {loadingInit ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: T.faint, fontSize: 13 }}>Carregando dados...</div>
          ) : (
            <div style={{ animation: "slideIn 0.2s" }}>
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 20 }}>
                Arquivo-base saneado. Agora reaplique seus componentes restantes em blocos menores,
                sempre validando template literals em style e comentários JSX.
              </div>
            </div>
          )}
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}
