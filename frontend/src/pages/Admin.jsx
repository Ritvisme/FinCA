import { useState, useEffect } from "react";
import { FiUsers, FiCreditCard, FiTrendingUp, FiRepeat, FiShield } from "react-icons/fi";
import { listUsers, getStats } from "../api/admin";
import { inr, fmtDate } from "../utils/format";

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [s, u] = await Promise.all([getStats(), listUsers()]);
        setStats(s.data);
        setUsers(u.data);
      } catch (e) {
        setErr(e.response?.data?.detail || "Failed to load admin data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-7 w-7 rounded-full border-2 border-[var(--muted)] border-t-[var(--muted-foreground)] animate-spin" />
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-lg bg-red-500/10 border border-red-500/15 px-4 py-3 text-[13px] text-red-400">
        {err}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] flex items-center gap-2">
          <FiShield size={20} /> Admin
        </h2>
        <p className="text-[13px] text-[var(--muted-foreground)] mt-1">
          Platform overview — users, transactions, and portfolio activity.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={FiUsers} color="#3b82f6" label="Total Users" value={stats.total_users} sub={`${stats.google_users} via Google`} />
        <StatCard icon={FiCreditCard} color="#f97316" label="Transactions" value={stats.total_transactions} sub="all-time" />
        <StatCard icon={FiTrendingUp} color="#22c55e" label="Holdings" value={stats.total_holdings} sub="across all users" />
        <StatCard icon={FiRepeat} color="#a855f7" label="SIPs" value={stats.total_sips} sub="active + cancelled" />
        <StatCard icon={FiShield} color="#eab308" label="Admins" value={users.filter((u) => u.role === "admin").length} sub="incl. you" />
      </div>

      {/* Users table */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-[13px] font-medium text-[var(--foreground)]">Users</h3>
          <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">Most recent first.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
                <th className="text-left font-medium px-5 py-3">User</th>
                <th className="text-left font-medium px-5 py-3">Role</th>
                <th className="text-left font-medium px-5 py-3">Signed up</th>
                <th className="text-right font-medium px-5 py-3">Txns</th>
                <th className="text-right font-medium px-5 py-3">Spent</th>
                <th className="text-left font-medium px-5 py-3">Method</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-[var(--border)] hover:bg-[var(--accent)]/50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="text-[13px] font-medium text-[var(--foreground)]">{u.name || "—"}</p>
                    <p className="text-[12px] text-[var(--muted-foreground)]">{u.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        u.role === "admin"
                          ? "bg-yellow-500/15 text-yellow-400"
                          : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[12px] text-[var(--muted-foreground)]">{fmtDate(u.created_at)}</td>
                  <td className="px-5 py-3 text-[13px] text-right text-[var(--foreground)]">{u.transaction_count}</td>
                  <td className="px-5 py-3 text-[13px] text-right text-[var(--foreground)]">{inr(u.total_spent)}</td>
                  <td className="px-5 py-3 text-[12px] text-[var(--muted-foreground)]">{u.google_id ? "Google" : "Email"}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-[13px] text-[var(--muted-foreground)] py-12">
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, color, label, value, sub }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 hover:border-[var(--muted-foreground)]/30 transition-colors">
      <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: color + "18" }}>
        <Icon size={16} style={{ color }} />
      </div>
      <p className="text-[22px] font-semibold tracking-tight text-[var(--foreground)] mt-4">{value}</p>
      <p className="text-[12px] font-medium text-[var(--muted-foreground)] mt-0.5">{label}</p>
      <p className="text-[11px] text-[var(--muted-foreground)]/70 mt-1.5">{sub}</p>
    </div>
  );
}
