import { createContext, useContext, useEffect, useState } from "react";
import api from "./api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("caresync_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("caresync_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem("caresync_token");
        localStorage.removeItem("caresync_user");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("caresync_token", res.data.access_token);
    const me = await api.get("/auth/me");
    localStorage.setItem("caresync_user", JSON.stringify(me.data));
    setUser(me.data);
    return me.data;
  }

  async function register(payload) {
    const res = await api.post("/auth/register", payload);
    localStorage.setItem("caresync_token", res.data.access_token);
    const me = await api.get("/auth/me");
    localStorage.setItem("caresync_user", JSON.stringify(me.data));
    setUser(me.data);
    return me.data;
  }

  function logout() {
    localStorage.removeItem("caresync_token");
    localStorage.removeItem("caresync_user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
