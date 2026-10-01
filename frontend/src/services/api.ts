// src/services/api.ts
import axios from "axios";
import { API_BASE } from "@/lib/api";

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // send/receive cookies
});
