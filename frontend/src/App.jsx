import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from "react-router-dom";
import { FiGrid, FiDollarSign, FiTrendingUp, FiLogOut, FiUser, FiMenu, FiShield } from "react-icons/fi";
import useAuthStore from "./store/authStore";
import Login from "./pages/login";
import Expenses from "./pages/Expenses";
import Dashboard from "./pages/Dashboard";
import Investments from "./pages/Investments";
import Admin from "./pages/Admin";
import ChatWidget from "./components/ChatWidget";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-[var(--muted)] border-t-[var(--muted-foreground)] animate-spin" />
          <p className="text-[13px] text-[var(--muted-foreground)]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;
  return children;
}

export default function App() {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

const BASE_NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: FiGrid },
  { to: "/expenses", label: "Expenses", icon: FiDollarSign },
  { to: "/investments", label: "Investments", icon: FiTrendingUp },
];

const ADMIN_NAV_ITEM = { to: "/admin", label: "Admin", icon: FiShield };

function AppLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-20 flex flex-col border-r border-[var(--border)] bg-[var(--background)] transition-all duration-300 ease-in-out ${
          collapsed ? "-translate-x-full" : "translate-x-0"
        } w-[220px]`}
      >
        {/* Logo */}
        <div className="h-14 px-5 flex items-center gap-2 border-b border-[var(--border)]">
          <div className="h-7 w-7 rounded-lg bg-[var(--foreground)] flex items-center justify-center shrink-0">
            <span className="text-[var(--background)] text-xs font-bold">F</span>
          </div>
          <span className="text-[14px] font-semibold tracking-tight text-[var(--foreground)]">
            FinCA
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <p className="px-3 mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
            Menu
          </p>
          {[...BASE_NAV_ITEMS, ...(user?.role === "admin" ? [ADMIN_NAV_ITEM] : [])].map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `group flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-150 ${
                    isActive
                      ? "bg-[var(--accent)] text-[var(--foreground)] font-medium"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      size={16}
                      className={`transition-transform duration-150 group-hover:scale-110 ${isActive ? "scale-110" : ""}`}
                    />
                    {item.label}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User section */}
        <div className="px-3 py-3 border-t border-[var(--border)]">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
            <div className="h-8 w-8 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0">
              <FiUser size={14} className="text-[var(--muted-foreground)]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-[var(--foreground)] truncate">
                {user?.name || "User"}
              </p>
              <p className="text-[11px] text-[var(--muted-foreground)] truncate">
                {user?.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full mt-1 flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-400 transition-all duration-150 cursor-pointer"
          >
            <FiLogOut size={16} />
            Log out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className={`overflow-x-hidden transition-all duration-300 ease-in-out ${collapsed ? "ml-0" : "ml-[220px]"}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-10 h-14 flex items-center gap-3 px-6 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-md">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="h-9 w-9 flex items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-all duration-150 cursor-pointer"
            title={collapsed ? "Show sidebar" : "Hide sidebar"}
          >
            <FiMenu size={18} />
          </button>
        </header>

        {/* Page content */}
        <main className="px-6 md:px-8 py-8">
          <div className="max-w-[1200px] mx-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/investments" element={<Investments />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </div>
        </main>
      </div>

      {/* Floating AI assistant — only rendered for authenticated users */}
      <ChatWidget />
    </div>
  );
}
