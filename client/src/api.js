function joinUrl(base, path) {
  const b = String(base || "");
  const p = String(path || "");
  if (!b) return p;
  if (!p) return b;
  if (b === "/api" && p.startsWith("/api")) return p;
  if (b.endsWith("/") && p.startsWith("/")) return `${b.slice(0, -1)}${p}`;
  return `${b}${p}`;
}

export function getApiBaseUrl() {
  const raw = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || "";
  const trimmed = String(raw || "").trim();
  if (trimmed) {
    if (trimmed === "/api") return "";
    return trimmed;
  }
  try {
    const loc = globalThis.location;
    const protocol = String(loc?.protocol || "").trim();
    if (protocol === "https:") return "";
    const hostname = String(loc?.hostname || "").trim();
    if (hostname) return `http://${hostname}:3001`;
  } catch (e) {
    void e;
  }
  return "http://localhost:3001";
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function apiGet(path) {
  const url = joinUrl(getApiBaseUrl(), path);
  const res = await fetch(url, { method: "GET" });
  const body = await parseJsonSafe(res);
  if (!res.ok) {
    const message =
      body?.error || body?.message || res.statusText || "request_failed";
    const err = new Error(message);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export async function apiSend(path, method, data) {
  const url = joinUrl(getApiBaseUrl(), path);
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data ?? {}),
  });
  const body = await parseJsonSafe(res);
  if (!res.ok) {
    const message =
      body?.error || body?.message || res.statusText || "request_failed";
    const err = new Error(message);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}
