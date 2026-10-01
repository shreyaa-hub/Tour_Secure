// frontend/src/lib/axios.ts
import axios from "axios";

const baseURL =
  import.meta.env.VITE_SERVER_BASE_URL?.replace(/\/+$/, "") ||
  "http://localhost:4000";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "http://localhost:4000/api",
  withCredentials: true,
});

// Attach Bearer from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

// ✅ Make 401s from *public* endpoints silent
const PUBLIC_PATHS = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/me",    // we treat 401 here as "not logged in", not an error popup
];

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url || "";
    const isPublic = PUBLIC_PATHS.some((p) => url.endsWith(p) || url.includes(p));

    // For 401 on public endpoints, don't throw a global "Not authorized" toast
    if (status === 401 && isPublic) {
      // Let the caller handle it gracefully (e.g., return null for /me)
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);
