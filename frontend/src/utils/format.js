// Shared formatting helpers — the ONE place date & currency display styles live,
// so every page renders them identically.
//   inr(12000)            -> "₹12,000"
//   fmtDate("2026-06-29") -> "29 Jun 2026"
//   fmtMonth("2026-06")   -> "June 2026"
//   todayISO()            -> "2026-06-29"   (YYYY-MM-DD, for <input type="date">/API)
//   currentMonth()        -> "2026-06"      (YYYY-MM, for month pickers/API)

export const inr = (n) =>
  "₹" + Math.round(n || 0).toLocaleString("en-IN");

export const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(String(iso).slice(0, 10) + "T00:00:00");
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

export const fmtMonth = (month) =>
  new Date(month + "-01T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" });

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const currentMonth = () => new Date().toISOString().slice(0, 7);
