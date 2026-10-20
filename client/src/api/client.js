import axios from "axios";

const TOKEN_KEY = "djjs.token";

export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* storage unavailable */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ } },
};

export const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((config) => {
  const t = tokenStore.get();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401 && !err.config.url.includes("/auth/login")) {
      tokenStore.clear();
      window.dispatchEvent(new Event("djjs:logout"));
    }
    const e = new Error(err.response?.data?.message || err.message || "Request failed");
    e.status = err.response?.status;
    e.details = err.response?.data?.details;
    return Promise.reject(e);
  }
);
