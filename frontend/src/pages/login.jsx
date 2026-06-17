import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import useAuthStore from "../store/authStore";

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login, register, loginWithGoogle } = useAuthStore();
  const navigate = useNavigate();

  const handleGoogle = async (credentialResponse) => {
    setError("");
    try {
      await loginWithGoogle(credentialResponse.credential);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Google sign-in failed");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isRegister) {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="w-[400px] flex flex-col gap-8">
        {/* Logo + Header */}
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-[var(--foreground)] flex items-center justify-center">
            <span className="text-[var(--background)] text-sm font-bold">F</span>
          </div>
          <div className="text-center space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
              {isRegister ? "Create your account" : "Welcome back"}
            </h1>
            <p className="text-[13px] text-[var(--muted-foreground)]">
              {isRegister
                ? "Enter your details to get started with FinCA"
                : "Sign in to your FinCA account"}
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 flex flex-col gap-5">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/15 px-4 py-2.5 text-[13px] text-red-400">
              {error}
            </div>
          )}

          {/* Google sign-in */}
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogle}
              onError={() => setError("Google sign-in was cancelled or failed")}
              theme="filled_black"
              shape="rectangular"
              text={isRegister ? "signup_with" : "signin_with"}
              width="340"
            />
          </div>

          {/* Divider */}
          <div className="relative flex items-center">
            <div className="flex-1 border-t border-[var(--border)]"></div>
            <span className="px-3 text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">or</span>
            <div className="flex-1 border-t border-[var(--border)]"></div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {isRegister && (
            <div className="space-y-2">
              <label className="text-[12px] font-medium text-[var(--muted-foreground)]">
                Name
              </label>
              <input
                className="w-full h-10 rounded-lg border border-[var(--border)] bg-transparent px-3.5 text-[13px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--ring)] transition-shadow"
                placeholder="Your full name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[12px] font-medium text-[var(--muted-foreground)]">
              Email
            </label>
            <input
              type="email"
              className="w-full h-10 rounded-lg border border-[var(--border)] bg-transparent px-3.5 text-[13px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--ring)] transition-shadow"
              placeholder="name@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[12px] font-medium text-[var(--muted-foreground)]">
              Password
            </label>
            <input
              type="password"
              className="w-full h-10 rounded-lg border border-[var(--border)] bg-transparent px-3.5 text-[13px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--ring)] transition-shadow"
              placeholder="••••••••"
              autoComplete={isRegister ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="h-10 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-[13px] font-medium hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer mt-1"
          >
            {loading ? "Please wait..." : isRegister ? "Create account" : "Sign in"}
          </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[13px] text-[var(--muted-foreground)]">
          {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
          <span
            className="text-[var(--foreground)] underline underline-offset-4 hover:opacity-80 cursor-pointer transition-opacity"
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
            }}
          >
            {isRegister ? "Sign in" : "Create account"}
          </span>
        </p>
      </div>
    </div>
  );
}
