import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
  FiPlus, FiX, FiTrash2, FiTrendingUp, FiLayers, FiRepeat, FiTarget,
  FiChevronRight, FiSlash, FiZap, FiRefreshCw, FiSliders,
} from "react-icons/fi";
import { getStockIdeas, getInvestorProfile, saveInvestorProfile } from "../api/market";
import {
  getHoldings, createHolding, deleteHolding,
  getSips, createSip, cancelSip,
  getGoals, createGoal, deleteGoal,
  getPortfolio,
} from "../api/invest";
import { inr, fmtDate, todayISO } from "../utils/format";

const ASSET_TYPES = ["Stock", "etf", "crypto", "Mutual Fund", "Bonds", "Real Estate", "Gold", "Fixed Deposit", "Other"];

// Tag styling for the stock-ideas screen (matches backend tag values).
const IDEA_TAGS = {
  momentum: { label: "Momentum", color: "#22c55e" },
  dip: { label: "Dip", color: "#f97316" },
  diversifier: { label: "Diversifier", color: "#3b82f6" },
};

const ASSET_COLORS = {
  Stock: "#3b82f6", etf: "#06b6d4", crypto: "#a855f7", "Mutual Fund": "#22c55e",
  Bonds: "#eab308", "Real Estate": "#f97316", Gold: "#f59e0b", "Fixed Deposit": "#14b8a6", Other: "#71717a",
};

function freqLabel(days) {
  const map = { 1: "Daily", 7: "Weekly", 30: "Monthly", 90: "Quarterly", 180: "Half-yearly", 365: "Yearly" };
  return map[days] || `Every ${days} days`;
}

// Money invested through a SIP so far = installments that have occurred x amount.
// Mirrors the backend; cancelled SIPs stop accruing at their end_date.
function sipInvested(sip) {
  const freq = sip.frequency || 0;
  if (freq <= 0) return 0;
  let d = new Date(sip.start_date + "T00:00:00");
  let limit = new Date();
  if (sip.end_date) {
    const ed = new Date(sip.end_date + "T00:00:00");
    if (ed < limit) limit = ed;
  }
  let n = 0;
  while (d <= limit) { n++; d.setDate(d.getDate() + freq); }
  return n * sip.amount;
}

export default function Investments() {
  const [tab, setTab] = useState("holdings");
  const [ideas, setIdeas] = useState(null);
  const [ideasLoading, setIdeasLoading] = useState(true);
  const [ideasErr, setIdeasErr] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [investorProfile, setInvestorProfile] = useState(null);

  const loadIdeas = async () => {
    setIdeasLoading(true); setIdeasErr("");
    try {
      setIdeas(await getStockIdeas());
    } catch {
      setIdeasErr("Couldn't load market data — try refreshing in a moment.");
    } finally {
      setIdeasLoading(false);
    }
  };
  useEffect(() => {
    loadIdeas();
    getInvestorProfile().then(setInvestorProfile).catch(() => {});
  }, []);
  const [holdings, setHoldings] = useState([]);
  const [sips, setSips] = useState([]);
  const [goals, setGoals] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [h, s, g, p] = await Promise.all([
        getHoldings(), getSips(false), getGoals(), getPortfolio(),
      ]);
      setHoldings(h.data);
      setSips(s.data);
      setGoals(g.data);
      setPortfolio(p.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const allocation = Object.entries(portfolio?.by_asset_type || {})
    .map(([name, value]) => ({ name, value, color: ASSET_COLORS[name] || "#71717a" }))
    .sort((a, b) => b.value - a.value);

  const activeSipTotal = sips.filter((s) => s.active).reduce((sum, s) => sum + s.amount, 0);

  const TABS = [
    { key: "holdings", label: "Holdings", count: holdings.length },
    { key: "sips", label: "SIPs", count: sips.length },
    { key: "goals", label: "Goals", count: goals.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Investments
          </h2>
          <p className="text-[13px] text-[var(--muted-foreground)] mt-1">
            Track your portfolio, SIPs, and savings goals.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="h-9 px-4 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-[13px] font-medium hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer flex items-center gap-2"
        >
          <FiPlus size={15} strokeWidth={2.5} />
          Add {tab === "holdings" ? "holding" : tab === "sips" ? "SIP" : "goal"}
        </button>
      </div>

      {/* Stock Ideas — live NSE screen */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[13px] font-medium text-[var(--foreground)] flex items-center gap-2">
              <FiZap size={14} className="text-[#eab308]" />
              Stock Ideas
            </h3>
            <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">
              Live screen of liquid NSE names — educational, not investment advice.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowProfile(true)}
              className="h-8 px-3 rounded-lg border border-[var(--border)] text-[12px] text-[var(--foreground)] hover:bg-[var(--accent)] active:scale-[0.98] transition-all cursor-pointer flex items-center gap-2"
            >
              <FiSliders size={13} />
              {investorProfile?.age ? `Age ${investorProfile.age} · ${investorProfile.horizon}` : "Personalize"}
            </button>
            <button
              onClick={loadIdeas}
              disabled={ideasLoading}
              className="h-8 px-3 rounded-lg border border-[var(--border)] text-[12px] text-[var(--foreground)] hover:bg-[var(--accent)] active:scale-[0.98] transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              <FiRefreshCw size={13} className={ideasLoading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {ideasErr && (
          <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/15 px-3 py-2 text-[12px] text-red-400">{ideasErr}</div>
        )}

        {ideasLoading && !ideas && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-[76px] rounded-lg border border-[var(--border)] animate-pulse bg-[var(--accent)]/40" />
            ))}
          </div>
        )}

        {ideas?.ideas?.length > 0 && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
            {ideas.ideas.map((s) => {
              const tag = IDEA_TAGS[s.tag] || IDEA_TAGS.diversifier;
              return (
                <div key={s.symbol} className="rounded-lg border border-[var(--border)] p-3.5 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-[var(--foreground)] truncate">{s.symbol}</span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                      style={{ backgroundColor: tag.color + "18", color: tag.color }}
                    >
                      {tag.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[13px] font-medium text-[var(--foreground)]">{inr(s.price)}</span>
                    {s.owned && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] font-medium">Owned</span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--muted-foreground)] mt-1 truncate" title={`${s.name} — ${s.note}`}>
                    {s.note}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Why these picks */}
        {ideas?.why && (
          <div className="mt-4 pt-4 border-t border-[var(--border)]">
            <p className="text-[12px] font-medium text-[var(--foreground)]">Why these picks</p>
            {!ideas.personalized && (
              <p className="text-[12px] text-[var(--muted-foreground)] mt-1.5">
                Using default weights —{" "}
                <span className="underline underline-offset-2 cursor-pointer hover:text-[var(--foreground)]" onClick={() => setShowProfile(true)}>
                  set your age & investment horizon
                </span>{" "}
                to personalize the split.
              </p>
            )}
            <ul className="mt-1.5 space-y-1">
              {ideas.why.factors.map((f, i) => (
                <li key={i} className="text-[12px] text-[var(--muted-foreground)] flex gap-2">
                  <span className="text-[var(--foreground)]">•</span>{f}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-2.5">
              Screen criteria — Momentum: {ideas.why.criteria.momentum} · Dip: {ideas.why.criteria.dip} · Diversifier: {ideas.why.criteria.diversifier}. Universe: {ideas.why.criteria.universe}.
            </p>
          </div>
        )}
      </div>

      {/* Investor profile modal */}
      {showProfile && (
        <ProfileModal
          existing={investorProfile}
          onClose={() => setShowProfile(false)}
          onSaved={(p) => { setInvestorProfile(p); setShowProfile(false); loadIdeas(); }}
        />
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FiTrendingUp} color="#22c55e" label="Total Invested" value={inr(portfolio?.total_invested)} sub={`${portfolio?.holding_count || 0} holdings`} />
        <StatCard icon={FiLayers} color="#3b82f6" label="Asset Types" value={allocation.length} sub="Diversification" />
        <StatCard icon={FiRepeat} color="#a855f7" label="Active SIPs" value={portfolio?.active_sips || 0} sub={`${inr(activeSipTotal)} / cycle`} />
        <StatCard icon={FiTarget} color="#f97316" label="Goals" value={goals.length} sub="In progress" />
      </div>

      {/* Allocation + tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Allocation donut */}
        <div className="lg:col-span-2 min-w-0 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="text-[13px] font-medium text-[var(--foreground)]">Asset Allocation</h3>
          <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">Portfolio breakdown</p>
          {allocation.length === 0 ? (
            <div className="flex items-center justify-center h-[180px] text-[13px] text-[var(--muted-foreground)]">
              No holdings yet
            </div>
          ) : (
            <div className="flex items-center gap-4 mt-4">
              <div className="relative h-[150px] w-[150px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={allocation} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={68} paddingAngle={2} strokeWidth={0}>
                      {allocation.map((d) => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-[var(--muted-foreground)]">Total</span>
                  <span className="text-[14px] font-semibold text-[var(--foreground)]">{inr(portfolio?.total_invested)}</span>
                </div>
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                {allocation.slice(0, 6).map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="text-[12px] text-[var(--muted-foreground)] flex-1 truncate">{d.name}</span>
                    <span className="text-[12px] font-medium text-[var(--foreground)]">{inr(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tabbed lists */}
        <div className="lg:col-span-3 min-w-0 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          {/* Tab bar */}
          <div className="flex items-center gap-1 px-3 pt-3 border-b border-[var(--border)]">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setShowForm(false); }}
                className={`relative px-3 py-2.5 text-[13px] font-medium transition-colors cursor-pointer ${
                  tab === t.key ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                {t.label}
                <span className="ml-1.5 text-[11px] text-[var(--muted-foreground)]">{t.count}</span>
                {tab === t.key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--foreground)] rounded-full" />}
              </button>
            ))}
          </div>

          <div className="p-3 max-h-[360px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-6 w-6 rounded-full border-2 border-[var(--muted)] border-t-[var(--muted-foreground)] animate-spin" />
              </div>
            ) : tab === "holdings" ? (
              <HoldingsList holdings={holdings} onDelete={async (id) => { await deleteHolding(id); fetchAll(); }} />
            ) : tab === "sips" ? (
              <SipsList sips={sips} onCancel={async (id) => { await cancelSip(id); fetchAll(); }} />
            ) : (
              <GoalsList goals={goals} onDelete={async (id) => { await deleteGoal(id); fetchAll(); }} />
            )}
          </div>
        </div>
      </div>

      {/* Add modal */}
      {showForm && (
        <AddModal
          tab={tab}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchAll(); }}
        />
      )}
    </div>
  );
}

/* ---------- Lists ---------- */

function HoldingsList({ holdings, onDelete }) {
  if (holdings.length === 0) return <Empty label="No holdings yet" hint="Add your first investment to get started." />;
  return (
    <div className="space-y-1.5">
      {holdings.map((h) => {
        const value = h.quantity * h.purchase_price;
        const color = ASSET_COLORS[h.asset_type] || "#71717a";
        return (
          <div key={h._id} className="group flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-[var(--accent)] transition-colors">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 text-[12px] font-semibold" style={{ background: color + "20", color }}>
              {h.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[var(--foreground)] truncate">{h.name}</p>
              <p className="text-[12px] text-[var(--muted-foreground)]">
                {h.quantity} × {inr(h.purchase_price)} · <span style={{ color }}>{h.asset_type}</span>
              </p>
            </div>
            <p className="text-[13px] font-semibold text-[var(--foreground)]">{inr(value)}</p>
            <button onClick={() => onDelete(h._id)} className="opacity-0 group-hover:opacity-100 text-[var(--muted-foreground)] hover:text-red-400 transition-all cursor-pointer">
              <FiTrash2 size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function SipsList({ sips, onCancel }) {
  if (sips.length === 0) return <Empty label="No SIPs yet" hint="Set up a recurring investment plan." />;
  return (
    <div className="space-y-1.5">
      {sips.map((s) => (
        <div key={s._id} className="group flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-[var(--accent)] transition-colors">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: (s.active ? "#a855f7" : "#71717a") + "20" }}>
            <FiRepeat size={15} style={{ color: s.active ? "#a855f7" : "#71717a" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-medium text-[var(--foreground)] truncate">{s.name}</p>
              {s.active
                ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 font-medium">Active</span>
                : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] font-medium">Cancelled</span>}
            </div>
            <p className="text-[12px] text-[var(--muted-foreground)]">{inr(s.amount)} · {freqLabel(s.frequency)} · since {fmtDate(s.start_date)}</p>
          </div>
          <div className="text-right">
            <p className="text-[13px] font-semibold text-[var(--foreground)]">{inr(sipInvested(s))}</p>
            <p className="text-[11px] text-[var(--muted-foreground)]">invested</p>
          </div>
          {s.active && (
            <button onClick={() => onCancel(s._id)} title="Cancel SIP" className="opacity-0 group-hover:opacity-100 text-[var(--muted-foreground)] hover:text-red-400 transition-all cursor-pointer">
              <FiSlash size={14} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function GoalsList({ goals, onDelete }) {
  if (goals.length === 0) return <Empty label="No goals yet" hint="Define a savings target to track progress." />;
  return (
    <div className="space-y-3 px-1 py-1">
      {goals.map((g) => {
        const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100));
        return (
          <div key={g._id} className="group rounded-lg border border-[var(--border)] p-3 hover:border-[var(--muted-foreground)]/30 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[13px] font-medium text-[var(--foreground)]">{g.name}</p>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-[var(--muted-foreground)]">by {fmtDate(g.target_date)}</span>
                <button onClick={() => onDelete(g._id)} className="opacity-0 group-hover:opacity-100 text-[var(--muted-foreground)] hover:text-red-400 transition-all cursor-pointer">
                  <FiTrash2 size={13} />
                </button>
              </div>
            </div>
            <div className="h-2 rounded-full bg-[var(--muted)] overflow-hidden">
              <div className="h-full rounded-full bg-[var(--foreground)] transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[12px] font-medium text-[var(--foreground)]">{inr(g.current_amount)} <span className="text-[var(--muted-foreground)] font-normal">/ {inr(g.target_amount)}</span></span>
              <span className="text-[12px] text-[var(--muted-foreground)]">{pct}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Add Modal ---------- */

function AddModal({ tab, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState(
    tab === "holdings"
      ? { name: "", asset_type: "Stock", quantity: "", purchase_price: "", buy_date: todayISO() }
      : tab === "sips"
      ? { name: "", amount: "", frequency: 30, start_date: todayISO() }
      : { name: "", target_amount: "", current_amount: "", target_date: "" }
  );

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setErr("");
    try {
      if (tab === "holdings") {
        await createHolding({ name: form.name, asset_type: form.asset_type, quantity: parseFloat(form.quantity), purchase_price: parseFloat(form.purchase_price), buy_date: form.buy_date || null });
      } else if (tab === "sips") {
        await createSip({ name: form.name, amount: parseFloat(form.amount), frequency: parseInt(form.frequency), start_date: form.start_date });
      } else {
        await createGoal({ name: form.name, target_amount: parseFloat(form.target_amount), current_amount: parseFloat(form.current_amount || 0), target_date: form.target_date });
      }
      onSaved();
    } catch (e2) {
      setErr(e2.response?.data?.detail?.[0]?.msg || "Failed to save");
      setSaving(false);
    }
  };

  const title = tab === "holdings" ? "Add Holding" : tab === "sips" ? "Add SIP" : "Add Goal";

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_0.15s_ease]" onClick={onClose}>
      <div className="w-[440px] rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-[14px] font-semibold text-[var(--foreground)]">{title}</h3>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"><FiX size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          {err && <div className="rounded-lg bg-red-500/10 border border-red-500/15 px-3 py-2 text-[12px] text-red-400">{err}</div>}

          <Field label="Name">
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={tab === "holdings" ? "e.g. Reliance, BTC" : tab === "sips" ? "e.g. Nifty 50 Index" : "e.g. Emergency Fund"}
              className={inputCls} />
          </Field>

          {tab === "holdings" && (
            <>
              <Field label="Asset Type">
                <select value={form.asset_type} onChange={(e) => setForm({ ...form, asset_type: e.target.value })} className={inputCls + " cursor-pointer"}>
                  {ASSET_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Quantity"><input required type="number" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="0" className={inputCls} /></Field>
                <Field label="Buy Price (₹)"><input required type="number" step="any" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} placeholder="0.00" className={inputCls} /></Field>
              </div>
              <Field label="Buy Date"><input type="date" value={form.buy_date} onChange={(e) => setForm({ ...form, buy_date: e.target.value })} className={inputCls + " cursor-pointer"} /></Field>
            </>
          )}

          {tab === "sips" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Amount (₹)"><input required type="number" step="any" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" className={inputCls} /></Field>
                <Field label="Frequency">
                  <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className={inputCls + " cursor-pointer"}>
                    <option value={7}>Weekly</option>
                    <option value={30}>Monthly</option>
                    <option value={90}>Quarterly</option>
                    <option value={180}>Half-yearly</option>
                    <option value={365}>Yearly</option>
                  </select>
                </Field>
              </div>
              <Field label="Start Date"><input required type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={inputCls + " cursor-pointer"} /></Field>
            </>
          )}

          {tab === "goals" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Target (₹)"><input required type="number" step="any" value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })} placeholder="0.00" className={inputCls} /></Field>
                <Field label="Saved so far (₹)"><input type="number" step="any" value={form.current_amount} onChange={(e) => setForm({ ...form, current_amount: e.target.value })} placeholder="0.00" className={inputCls} /></Field>
              </div>
              <Field label="Target Date"><input required type="date" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} className={inputCls + " cursor-pointer"} /></Field>
            </>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg border border-[var(--border)] text-[13px] text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer">Cancel</button>
            <button type="submit" disabled={saving} className="h-9 px-4 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-[13px] font-medium hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer">
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- Shared bits ---------- */

const inputCls = "w-full h-9 rounded-lg border border-[var(--border)] bg-transparent px-3 text-[13px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--ring)]";

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[12px] font-medium text-[var(--muted-foreground)]">{label}</label>
      {children}
    </div>
  );
}

function ProfileModal({ existing, onClose, onSaved }) {
  const [age, setAge] = useState(existing?.age ? String(existing.age) : "");
  const [horizon, setHorizon] = useState(existing?.horizon || "long");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setErr("");
    try {
      const saved = await saveInvestorProfile({ age: parseInt(age, 10), horizon });
      onSaved(saved);
    } catch {
      setErr("Couldn't save — check the values and try again.");
      setSaving(false);
    }
  };

  const HORIZONS = [
    { value: "short", label: "Short — under 3 years" },
    { value: "medium", label: "Medium — 3 to 7 years" },
    { value: "long", label: "Long — over 7 years" },
  ];

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_0.15s_ease] p-4" onClick={onClose}>
      <div className="w-[400px] rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <h3 className="text-[14px] font-semibold text-[var(--foreground)]">Investor profile</h3>
            <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">Used to weight the stock ideas for you.</p>
          </div>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"><FiX size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          {err && <div className="rounded-lg bg-red-500/10 border border-red-500/15 px-3 py-2 text-[12px] text-red-400">{err}</div>}
          <div className="space-y-2">
            <label className="text-[12px] font-medium text-[var(--muted-foreground)]">Age</label>
            <input
              type="number" min="14" max="100" required value={age}
              onChange={(e) => setAge(e.target.value)} placeholder="e.g. 21"
              className="w-full h-9 rounded-lg border border-[var(--border)] bg-transparent px-3 text-[13px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[12px] font-medium text-[var(--muted-foreground)]">Investment horizon</label>
            <div className="space-y-1.5">
              {HORIZONS.map((h) => (
                <label key={h.value} className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-[13px] ${horizon === h.value ? "border-[var(--foreground)]/40 bg-[var(--accent)] text-[var(--foreground)]" : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]/50"}`}>
                  <input type="radio" name="horizon" value={h.value} checked={horizon === h.value} onChange={() => setHorizon(h.value)} className="accent-[var(--foreground)]" />
                  {h.label}
                </label>
              ))}
            </div>
          </div>
          <button
            type="submit" disabled={saving}
            className="w-full h-9 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-[13px] font-medium hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save & re-screen"}
          </button>
        </form>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, color, label, value, sub }) {
  return (
    <div className="group rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 hover:border-[var(--muted-foreground)]/30 transition-colors">
      <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: color + "18" }}>
        <Icon size={16} style={{ color }} />
      </div>
      <p className="text-[22px] font-semibold tracking-tight text-[var(--foreground)] mt-4">{value}</p>
      <p className="text-[12px] font-medium text-[var(--muted-foreground)] mt-0.5">{label}</p>
      <p className="text-[11px] text-[var(--muted-foreground)]/70 mt-1.5">{sub}</p>
    </div>
  );
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 shadow-lg">
      <p className="text-[11px] text-[var(--muted-foreground)]">{p.payload.name}</p>
      <p className="text-[13px] font-semibold text-[var(--foreground)]">{inr(p.value)}</p>
    </div>
  );
}

function Empty({ label, hint }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <p className="text-[13px] text-[var(--foreground)]">{label}</p>
      <p className="text-[12px] text-[var(--muted-foreground)] mt-1">{hint}</p>
    </div>
  );
}
