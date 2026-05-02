import { apiRequest } from "./client";

export function getBackendHealth() {
  return apiRequest("/api/health");
}
