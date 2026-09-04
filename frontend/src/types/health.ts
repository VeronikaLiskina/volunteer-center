export interface HealthResponse {
  status: "ok" | "error";
  database: "connected" | "unavailable";
}

