import { loadSession } from "./authStorage";

const API_BASE_URL = "/api";

function resolveApiPath(path) {
  if (path.startsWith("/api")) {
    return path;
  }

  if (
    path.startsWith("/auth") ||
    path.startsWith("/user") ||
    path.startsWith("/admin") ||
    path.startsWith("/process-text")
  ) {
    return path;
  }

  return `${API_BASE_URL}${path}`;
}

export function buildApiHeaders(extraHeaders = {}) {
  const session = loadSession();
  const headers = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }

  return headers;
}

export async function apiFetch(path, options = {}) {
  const { headers, ...rest } = options;
  return fetch(resolveApiPath(path), {
    credentials: "include",
    ...rest,
    headers: buildApiHeaders(headers),
  });
}
