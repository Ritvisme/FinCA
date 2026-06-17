import { useState, useEffect } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, AreaChart, Area, CartesianGrid,
} from "recharts";
import {
  FiTrendingUp, FiTrendingDown, FiDollarSign, FiTarget,
  FiCreditCard, FiArrowUpRight, FiArrowDownRight,
} from "react-icons/fi";
import { getMonthlySummary } from "../api/expense";
import { getPortfolio, getGoals } from "../api/invest";

const CAT_COLORS = {
  Food: "#f97316", Transport: "#3b82f6", Entertainment: "#a855f7",
  Utilities: "#eab308", Healthcare: "#ef4444", Education: "#22c55e",
  Shopping: "#ec4899", Subscriptions: "#6366f1", Other: "#71717a",
};

const ASSET_COLORS = ["#3b82f6", "#22c55e", "#a855f7", "#f97316", "#eab308", "#ec4899", "#06b6d4", "#ef4444", "#71717a"];

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function inr(n) {
  return "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(currentMonth());

  const isCurrentMonth = month === currentMonth();

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const [s, p, g] = await Promise.all([
          getMonthlySummary(month),
          getPortfolio(),
          getGoals(),
        ]);
        if (!active) return;
        setSummary(s.data);
        setPortfolio(p.data);
        setGoals(g.data);
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [month]);

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-7 w-7 rounded-full border-2 border-[var(--muted)] border-t-[var(--muted-foreground)] animate-spin" />
      </div>
    );
  }

  const totalSpent = summary?.total_spend || 0;
  const invested = portfolio?.total_invested || 0;
  const income = summary?.income || 0;
  const surplus = summary?.surplus;

  // Pie data — spending by category
  const pieData = Object.entries(summary?.by_category || {}).map(([name, value]) => ({
    name, value, color: CAT_COLORS[name] || "#71717a",
  })).sort((a, b) => b.value - a.value);

  // Bar data — investments by asset type
  const assetData = Object.entries(portfolio?.by_asset_type || {}).map(([name, value], i) => ({
    name, value, color: ASSET_COLORS[i % ASSET_COLORS.length],
  })).sort((a, b) => b.value - a.value);

  // Area data — SIP by month
  const sipMonths = Object.entries(portfolio?.sip_by_month || {})
    .map(([month, items]) => ({
      month: month.slice(5),
      amount: items.reduce((sum, it) => sum + it.amount, 0),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Dashboard
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Overview for {new Date(month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isCurrentMonth && (
            <button
              onClick={() => setMonth(currentMonth())}
              className="h-9 px-3 rounded-lg border border-[var(--border)] text-[12px] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-all cursor-pointer"
            >
              This month
            </button>
          )}
          <input
            type="month"
            value={month}
            max={currentMonth()}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="h-9 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-[13px] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] cursor-pointer"
          />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={FiCreditCard} iconColor="#f97316"
          label="Total Spent" value={inr(totalSpent)}
          sub={`${summary?.transaction_count || 0} transactions`}
        />
        <StatCard
          icon={FiTrendingUp} iconColor="#22c55e"
          label="Invested" value={inr(invested)}
          sub={`${portfolio?.holding_count || 0} holdings`}
        />
        <StatCard
          icon={FiDollarSign} iconColor="#3b82f6"
          label="Monthly Income" value={income ? inr(income) : "—"}
          sub={income ? "Budgeted" : "Not set"}
        />
        <StatCard
          icon={FiTarget} iconColor="#a855f7"
          label="Surplus" value={surplus != null ? inr(surplus) : "—"}
          trend={surplus != null ? (surplus >= 0 ? "up" : "down") : null}
          sub={surplus != null ? (surplus >= 0 ? "Saving" : "Over budget") : "Set a budget"}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Spending donut */}
        <div className="lg:col-span-2 min-w-0 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="text-[13px] font-medium text-[var(--foreground)]">Spending by Category</h3>
          <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">This month's breakdown</p>
          {pieData.length === 0 ? (
            <EmptyChart label="No spending yet" />
          ) : (
            <div className="flex items-center gap-4 mt-4">
              <div className="relative h-[150px] w-[150px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData} dataKey="value" nameKey="name"
                      cx="50%" cy="50%" innerRadius={48} outerRadius={68}
                      paddingAngle={2} strokeWidth={0}
                    >
                      {pieData.map((d) => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip prefix="₹" />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-[var(--muted-foreground)]">Total</span>
                  <span className="text-[15px] font-semibold text-[var(--foreground)]">{inr(totalSpent)}</span>
                </div>
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                {pieData.slice(0, 5).map((d) => (
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

        {/* Asset allocation bars */}
        <div className="lg:col-span-3 min-w-0 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="text-[13px] font-medium text-[var(--foreground)]">Investment Allocation</h3>
          <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">By asset type</p>
          {assetData.length === 0 ? (
            <EmptyChart label="No investments yet" />
          ) : (
            <div className="mt-4 h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={assetData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v >= 1000 ? (v/1000)+"k" : v}`} />
                  <Tooltip content={<ChartTooltip prefix="₹" />} cursor={{ fill: "var(--accent)" }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {assetData.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* SIP trend + Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* SIP area chart */}
        <div className="lg:col-span-3 min-w-0 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="text-[13px] font-medium text-[var(--foreground)]">SIP Contributions</h3>
          <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">Monthly investment plan</p>
          {sipMonths.length === 0 ? (
            <EmptyChart label="No SIPs set up" />
          ) : (
            <div className="mt-4 h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sipMonths} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sipGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v >= 1000 ? (v/1000)+"k" : v}`} />
                  <Tooltip content={<ChartTooltip prefix="₹" />} cursor={{ stroke: "var(--border)" }} />
                  <Area type="monotone" dataKey="amount" stroke="#22c55e" strokeWidth={2} fill="url(#sipGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Goals */}
        <div className="lg:col-span-2 min-w-0 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-medium text-[var(--foreground)]">Savings Goals</h3>
              <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">{goals.length} active</p>
            </div>
          </div>
          {goals.length === 0 ? (
            <EmptyChart label="No goals yet" />
          ) : (
            <div className="mt-4 space-y-4">
              {goals.slice(0, 4).map((g) => {
                const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100));
                return (
                  <div key={g._id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12px] text-[var(--foreground)] font-medium truncate">{g.name}</span>
                      <span className="text-[11px] text-[var(--muted-foreground)]">{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
                      <div className="h-full rounded-full bg-[var(--foreground)] transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[11px] text-[var(--muted-foreground)]">{inr(g.current_amount)}</span>
                      <span className="text-[11px] text-[var(--muted-foreground)]">{inr(g.target_amount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, iconColor, label, value, sub, trend }) {
  return (
    <div className="group rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 hover:border-[var(--muted-foreground)]/30 transition-colors">
      <div className="flex items-center justify-between">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: iconColor + "18" }}>
          <Icon size={16} style={{ color: iconColor }} />
        </div>
        {trend && (
          <span className={`flex items-center gap-0.5 text-[11px] font-medium ${trend === "up" ? "text-green-400" : "text-red-400"}`}>
            {trend === "up" ? <FiArrowUpRight size={13} /> : <FiArrowDownRight size={13} />}
          </span>
        )}
      </div>
      <p className="text-[22px] font-semibold tracking-tight text-[var(--foreground)] mt-4">{value}</p>
      <p className="text-[12px] font-medium text-[var(--muted-foreground)] mt-0.5">{label}</p>
      <p className="text-[11px] text-[var(--muted-foreground)]/70 mt-1.5">{sub}</p>
    </div>
  );
}

function ChartTooltip({ active, payload, prefix = "" }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 shadow-lg">
      <p className="text-[11px] text-[var(--muted-foreground)]">{p.payload.name || p.payload.month}</p>
      <p className="text-[13px] font-semibold text-[var(--foreground)]">
        {prefix}{(p.value || 0).toLocaleString("en-IN")}
      </p>
    </div>
  );
}

function EmptyChart({ label }) {
  return (
    <div className="flex flex-col items-center justify-center h-[150px] text-center">
      <p className="text-[13px] text-[var(--muted-foreground)]">{label}</p>
    </div>
  );
}
