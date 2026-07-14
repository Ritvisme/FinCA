import axios from "axios";

// Base API URL. Set VITE_API_URL in production (Vercel) to the Render backend,
// e.g. https://finca-backend.onrender.com — defaults to local dev otherwise.
export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const API_V1 = `${API_BASE}/api/v1`;

const api = axios.create({
  baseURL: API_V1,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // A 401 from the refresh endpoint itself just means "no valid session" —
    // don't try to refresh again or redirect, or we hard-reload in a loop.
    const isRefreshCall = originalRequest?.url?.includes("/auth/refresh");

    if (error.response?.status === 401 && !originalRequest._retry && !isRefreshCall) {
      originalRequest._retry = true;
      try {
        const res = await axios.post(
          `${API_V1}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        const newToken = res.data.access_token;
        localStorage.setItem("access_token", newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem("access_token");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
