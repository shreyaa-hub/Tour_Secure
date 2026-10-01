import axios from "axios";
import { API_BASE } from "@/lib/api";

export const http = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default http;
