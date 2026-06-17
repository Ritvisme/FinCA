import { create } from "zustand";
import api from "../api/axios";

const useAuthStore = create((set) => ({
  user: null,
  loading: true,

  login: async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("access_token", res.data.access_token);
    const me = await api.get("/auth/me");
    set({ user: me.data });
  },

  register: async (name, email, password) => {
    await api.post("/auth/register", { name, email, password });
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("access_token", res.data.access_token);
    const me = await api.get("/auth/me");
    set({ user: me.data });
  },

  logout: () => {
    localStorage.removeItem("access_token");
    set({ user: null });
  },

  checkAuth: async () => {
    // If we have an access token, try /auth/me — the response interceptor
    // will silently refresh on 401. If we don't have one, try a refresh
    // directly (the cookie may still be valid from a prior session).
    const token = localStorage.getItem("access_token");
    if (!token) {
      try {
        const r = await api.post("/auth/refresh");
        localStorage.setItem("access_token", r.data.access_token);
      } catch {
        set({ user: null, loading: false });
        return;
      }
    }
    try {
      const res = await api.get("/auth/me");
      set({ user: res.data, loading: false });
    } catch {
      localStorage.removeItem("access_token");
      set({ user: null, loading: false });
    }
  },

  loginWithGoogle: async (idToken) => {
    const res = await api.post("/auth/google", { id_token: idToken });
    localStorage.setItem("access_token", res.data.access_token);
    const me = await api.get("/auth/me");
    set({ user: me.data });
  },
}));

export default useAuthStore;