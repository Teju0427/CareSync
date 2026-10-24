import { createContext, useContext, useEffect, useState } from "react";
import api from "./api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("caresync_user") || "null"); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem("caresync_token")) { setLoading(false); return; }
    api.get("/auth/me")
      .then((res) => { setUser(res.data); localStorage.setItem("caresync_user", JSON.stringify(res.data)); })
      .catch(() => { localStorage.removeItem("caresync_token"); localStorage.removeItem("caresync_user"); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  async function establishSession(accessToken) {
    localStorage.setItem("caresync_token", accessToken);
    const me = await api.get("/auth/me");
    localStorage.setItem("caresync_user", JSON.stringify(me.data));
    setUser(me.data);
    return me.data;
  }
  async function login(email, password) {
    const res = await api.post("/auth/login", { email, password });
    return establishSession(res.data.access_token);
  }
  async function register(payload) {
    const res = await api.post("/auth/register", payload);
    return establishSession(res.data.access_token);
  }
  function logout() {
    localStorage.removeItem("caresync_token");
    localStorage.removeItem("caresync_user");
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
