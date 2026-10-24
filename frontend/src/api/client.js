import axios from "axios";

// Resolution order: runtime config.js (Docker/Azure) -> build-time env -> dev proxy.
const runtime = typeof window !== "undefined" ? window.__CONFIG__?.API_URL : "";
const baseURL = (runtime || import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

const api = axios.create({ baseURL, timeout: 20000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("caresync_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    const onLogin = window.location.pathname.startsWith("/login");
    if (error.response?.status === 401 && !onLogin) {
      localStorage.removeItem("caresync_token");
      localStorage.removeItem("caresync_user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export function errorMessage(err, fallback = "Something went wrong. Please try again.") {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  if (err?.code === "ERR_NETWORK") return "Can't reach the server. Check your connection and try again.";
  return fallback;
}

export default api;
