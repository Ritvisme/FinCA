import { useState, useEffect, useRef } from "react";
import { getTransactions, createTransaction, deleteTransaction, getMonthlySummary, setBudget } from "../api/expense";
import {
  FiPlus, FiTrash2, FiX, FiShoppingBag, FiTruck, FiFilm, FiZap, FiHeart,
  FiBookOpen, FiShoppingCart, FiRepeat, FiMoreHorizontal, FiSliders, FiChevronDown,
} from "react-icons/fi";

const CATEGORIES = [
  { name: "Food", icon: FiShoppingBag, color: "#f97316" },
  { name: "Transport", icon: FiTruck, color: "#3b82f6" },
  { name: "Entertainment", icon: FiFilm, color: "#a855f7" },
  { name: "Utilities", icon: FiZap, color: "#eab308" },
  { name: "Healthcare", icon: FiHeart, color: "#ef4444" },
  { name: "Education", icon: FiBookOpen, color: "#22c55e" },
  { name: "Shopping", icon: FiShoppingCart, color: "#ec4899" },
  { name: "Subscriptions", icon: FiRepeat, color: "#6366f1" },
  { name: "Other", icon: FiMoreHorizontal, color: "#71717a" },
];

function getCategoryMeta(name) {
  return CATEGORIES.find((c) => c.name === name) || CATEGORIES[CATEGORIES.length - 1];
}

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function daysInMonth(month) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function getMonthRange(month) {
  const lastDay = daysInMonth(month);
  return { start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, "0")}` };
}

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function inr(n) {
  return "₹" + Math.round(n || 0).toLocaleString("en-IN");
}

const AVG_PERIODS = [
  { key: "daily", label: "Daily avg" },
  { key: "weekly", label: "Weekly avg" },
  { key: "monthly", label: "Monthly total" },
];

function average(total, month, period) {
  const days = daysInMonth(month);
  if (period === "monthly") return total;
  if (period === "weekly") return total / (days / 7);
  return total / days;
}

export default function Expenses() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [avgPeriod, setAvgPeriod] = useState("daily");
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    amount: "", category: "Food", merchant: "", description: "",
    date: new Date().toISOString().slice(0, 10),
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const { start, end } = getMonthRange(month);
      const [txnRes, sumRes] = await Promise.all([
        getTransactions(start, end),
        getMonthlySummary(month),
      ]);
      setTransactions(txnRes.data);
      setSummary(sumRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [month]);

  // Close the Add-expense dropdown on outside click / Escape
  const addRef = useRef(null);
  useEffect(() => {
    if (!showForm) return;
    const onClick = (e) => { if (addRef.current && !addRef.current.contains(e.target)) setShowForm(false); };
    const onKey = (e) => { if (e.key === "Escape") setShowForm(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [showForm]);

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await createTransaction({
        amount: parseFloat(form.amount),
        category: form.category,
        date: form.date || null,
        merchant: form.merchant || null,
        description: form.description || null,
      });
      setForm({ amount: "", category: "Food", merchant: "", description: "", date: new Date().toISOString().slice(0, 10) });
      setShowForm(false);
      fetchData();
    } catch (err) {
      console.error("Create error:", err.response?.data);
    }
  };

  const handleDelete = async (id) => {
    try { await deleteTransaction(id); fetchData(); } catch (err) { console.error(err); }
  };

  const topCategory = summary?.by_category
    ? Object.entries(summary.by_category).sort((a, b) => b[1] - a[1])[0]?.[0] || "--"
    : "--";

  const total = summary?.total_spend || 0;
  const budget = summary?.budget;
  const income = summary?.income;
  const allocations = budget?.allocations || {};
  const allocatedTotal = Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">Expenses</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Track spending and budget by month.</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-9 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-[13px] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] cursor-pointer"
          />
          <button
            onClick={() => setShowBudget(true)}
            className="h-9 px-4 rounded-lg border border-[var(--border)] text-[13px] text-[var(--foreground)] hover:bg-[var(--accent)] active:scale-[0.98] transition-all cursor-pointer flex items-center gap-2"
          >
            <FiSliders size={15} />
            {budget ? "Edit budget" : "Set budget"}
          </button>
          <div className="relative" ref={addRef}>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="h-9 px-4 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-[13px] font-medium hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer flex items-center gap-2"
            >
              <FiPlus size={15} strokeWidth={2.5} />
              Add expense
            </button>

            {/* Dropdown form anchored to the button */}
            {showForm && (
              <div className="absolute right-0 top-[calc(100%+8px)] w-[460px] z-40 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl p-5 animate-[slideDown_0.15s_ease] text-left">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[13px] font-medium text-[var(--foreground)]">New Expense</h3>
                  <button type="button" onClick={() => setShowForm(false)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"><FiX size={16} /></button>
                </div>
                <form onSubmit={handleAdd} className="grid grid-cols-2 gap-4">
                  <Field label="Amount">
                    <input type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required className={inputCls} autoFocus />
                  </Field>
                  <Field label="Category">
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls + " cursor-pointer"}>
                      {CATEGORIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Merchant">
                    <input placeholder="e.g. Swiggy" value={form.merchant} onChange={(e) => setForm({ ...form, merchant: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Date">
                    <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls + " cursor-pointer"} />
                  </Field>
                  <div className="col-span-2">
                    <Field label="Description">
                      <input placeholder="What was this for?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} />
                    </Field>
                  </div>
                  <div className="col-span-2 flex justify-end gap-3 pt-1">
                    <button type="button" onClick={() => setShowForm(false)} className="h-9 px-4 rounded-lg border border-[var(--border)] text-[13px] text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer">Cancel</button>
                    <button type="submit" className="h-9 px-4 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-[13px] font-medium hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer">Add</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Spent" value={inr(total)} />
          <StatCard label="Transactions" value={summary.transaction_count || 0} />
          <StatCard label="Top Category" value={topCategory} />
          {/* Average card with period dropdown */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="flex items-center justify-between">
              <div className="relative">
                <select
                  value={avgPeriod}
                  onChange={(e) => setAvgPeriod(e.target.value)}
                  className="appearance-none bg-transparent text-[12px] font-medium text-[var(--muted-foreground)] pr-4 focus:outline-none cursor-pointer hover:text-[var(--foreground)] transition-colors"
                >
                  {AVG_PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
                <FiChevronDown size={12} className="absolute right-0 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none" />
              </div>
            </div>
            <p className="text-[22px] font-semibold tracking-tight text-[var(--foreground)] mt-2">
              {inr(average(total, month, avgPeriod))}
            </p>
          </div>
        </div>
      )}

      {/* Budget Overview (when set) OR Spending by Category */}
      {budget ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[13px] font-medium text-[var(--foreground)]">Budget Overview</h3>
            <button onClick={() => setShowBudget(true)} className="text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer">Edit</button>
          </div>
          {/* Income / Spent / Invested / Remaining */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <MiniStat label="Income" value={income != null ? inr(income) : "—"} />
            <MiniStat label="Spent" value={inr(total)} />
            <MiniStat label="Invested" value={inr(summary.invested || 0)} accent={summary.invested ? "#a855f7" : undefined} />
            <MiniStat
              label={income != null ? "Remaining" : "Budgeted"}
              value={income != null ? inr(summary.surplus) : inr(allocatedTotal)}
              accent={income != null ? (summary.surplus >= 0 ? "#22c55e" : "#ef4444") : undefined}
            />
          </div>
          {/* Per-category allocation vs spent */}
          <div className="space-y-3">
            {CATEGORIES.filter((c) => allocations[c.name] || summary.by_category?.[c.name]).map((c) => {
              const alloc = Number(allocations[c.name]) || 0;
              const spent = summary.by_category?.[c.name] || 0;
              // If allocation is set, show progress against it; otherwise show share of total spent.
              const denom = alloc || total || 1;
              const pct = Math.min(100, Math.round((spent / denom) * 100));
              const over = alloc && spent > alloc;
              return (
                <div key={c.name} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: c.color + "18" }}>
                    <c.icon size={14} style={{ color: c.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] text-[var(--foreground)]">{c.name}</span>
                      <span className="text-[12px] font-medium text-[var(--foreground)]">
                        {inr(spent)} <span className="text-[var(--muted-foreground)] font-normal">/ {alloc ? inr(alloc) : "no limit"}</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: over ? "#ef4444" : c.color }} />
                    </div>
                  </div>
                  <span className={`text-[12px] w-12 text-right ${over ? "text-red-400 font-medium" : "text-[var(--muted-foreground)]"}`}>
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : summary?.by_category && Object.keys(summary.by_category).length > 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[13px] font-medium text-[var(--foreground)]">Spending by Category</h3>
            <button onClick={() => setShowBudget(true)} className="text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer">Set a budget →</button>
          </div>
          <div className="space-y-3">
            {Object.entries(summary.by_category).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => {
              const meta = getCategoryMeta(cat);
              const pct = total ? Math.round((amount / total) * 100) : 0;
              return (
                <div key={cat} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: meta.color + "18" }}>
                    <meta.icon size={14} style={{ color: meta.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] text-[var(--foreground)]">{cat}</span>
                      <span className="text-[13px] font-medium text-[var(--foreground)]">{inr(amount)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: meta.color }} />
                    </div>
                  </div>
                  <span className="text-[12px] text-[var(--muted-foreground)] w-10 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Recent Transactions */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-[13px] font-medium text-[var(--foreground)]">Recent Transactions</h3>
          <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">Your activity for this month.</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12"><div className="h-6 w-6 rounded-full border-2 border-[var(--muted)] border-t-[var(--muted-foreground)] animate-spin" /></div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-[var(--muted-foreground)]">No transactions this month.</p>
            <p className="text-[12px] text-[var(--muted-foreground)] mt-1">Click "Add expense" to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {transactions.map((txn) => {
              const meta = getCategoryMeta(txn.category);
              const Icon = meta.icon;
              return (
                <div key={txn._id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--accent)]/50 transition-colors group">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: meta.color + "18" }}>
                    <Icon size={16} style={{ color: meta.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[var(--foreground)]">{txn.merchant || txn.category}</p>
                    <p className="text-[12px] text-[var(--muted-foreground)]">{txn.description || txn.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-semibold text-[var(--foreground)]">-{inr(txn.amount)}</p>
                    <p className="text-[12px] text-[var(--muted-foreground)]">{formatDate(txn.date)}</p>
                  </div>
                  <button onClick={() => handleDelete(txn._id)} className="opacity-0 group-hover:opacity-100 text-[var(--muted-foreground)] hover:text-red-400 transition-all cursor-pointer ml-1"><FiTrash2 size={14} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Budget Modal */}
      {showBudget && (
        <BudgetModal
          month={month}
          existing={budget}
          existingIncome={income}
          onClose={() => setShowBudget(false)}
          onSaved={() => { setShowBudget(false); fetchData(); }}
        />
      )}
    </div>
  );
}

/* ---------- Budget Modal ---------- */

function BudgetModal({ month, existing, existingIncome, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [income, setIncome] = useState(existingIncome != null ? String(existingIncome) : "");
  const [allocs, setAllocs] = useState(() => {
    const init = {};
    CATEGORIES.forEach((c) => { init[c.name] = existing?.allocations?.[c.name] != null ? String(existing.allocations[c.name]) : ""; });
    return init;
  });

  const allocatedTotal = Object.values(allocs).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const incomeNum = parseFloat(income) || 0;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setErr("");
    try {
      const allocations = {};
      Object.entries(allocs).forEach(([k, v]) => { if (v !== "" && !isNaN(parseFloat(v))) allocations[k] = parseFloat(v); });
      await setBudget({ month, income: income !== "" ? parseFloat(income) : null, allocations });
      onSaved();
    } catch (e2) {
      setErr(e2.response?.data?.detail?.[0]?.msg || "Failed to save budget");
      setSaving(false);
    }
  };

  const monthLabel = new Date(month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_0.15s_ease] p-4" onClick={onClose}>
      <div className="w-[480px] max-h-[88vh] flex flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
          <div>
            <h3 className="text-[14px] font-semibold text-[var(--foreground)]">Budget · {monthLabel}</h3>
            <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">Set income and category limits.</p>
          </div>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"><FiX size={18} /></button>
        </div>

        <form onSubmit={submit} className="flex flex-col min-h-0 flex-1">
          <div className="p-5 space-y-4 overflow-y-auto">
            {err && <div className="rounded-lg bg-red-500/10 border border-red-500/15 px-3 py-2 text-[12px] text-red-400">{err}</div>}

            <Field label="Monthly Income (₹)">
              <input type="number" step="any" value={income} onChange={(e) => setIncome(e.target.value)} placeholder="e.g. 80000" className={inputCls} />
            </Field>

            <div className="space-y-2">
              <p className="text-[12px] font-medium text-[var(--muted-foreground)]">Category Allocations</p>
              {CATEGORIES.map((c) => (
                <div key={c.name} className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: c.color + "18" }}>
                    <c.icon size={13} style={{ color: c.color }} />
                  </div>
                  <span className="text-[13px] text-[var(--foreground)] flex-1">{c.name}</span>
                  <input
                    type="number" step="any" value={allocs[c.name]}
                    onChange={(e) => setAllocs({ ...allocs, [c.name]: e.target.value })}
                    placeholder="0"
                    className="w-28 h-8 rounded-lg border border-[var(--border)] bg-transparent px-3 text-[13px] text-right text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/40 focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Footer with live totals */}
          <div className="border-t border-[var(--border)] px-5 py-4 shrink-0">
            <div className="flex items-center justify-between mb-3 text-[12px]">
              <span className="text-[var(--muted-foreground)]">Allocated <span className="text-[var(--foreground)] font-medium">{inr(allocatedTotal)}</span></span>
              {incomeNum > 0 && (
                <span className={allocatedTotal > incomeNum ? "text-red-400" : "text-[var(--muted-foreground)]"}>
                  {allocatedTotal > incomeNum ? "Over income by " : "Unallocated "}
                  <span className="font-medium">{inr(Math.abs(incomeNum - allocatedTotal))}</span>
                </span>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg border border-[var(--border)] text-[13px] text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer">Cancel</button>
              <button type="submit" disabled={saving} className="h-9 px-4 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-[13px] font-medium hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer">{saving ? "Saving..." : "Save budget"}</button>
            </div>
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

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <p className="text-[12px] font-medium text-[var(--muted-foreground)]">{label}</p>
      <p className="text-[22px] font-semibold tracking-tight text-[var(--foreground)] mt-2">{value}</p>
    </div>
  );
}

function MiniStat({ label, value, accent }) {
  return (
    <div className="rounded-lg border border-[var(--border)] p-3">
      <p className="text-[11px] font-medium text-[var(--muted-foreground)]">{label}</p>
      <p className="text-[17px] font-semibold tracking-tight mt-1" style={{ color: accent || "var(--foreground)" }}>{value}</p>
    </div>
  );
}
