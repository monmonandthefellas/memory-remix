import { supabase } from "../lib/supabaseClient";

const LIST_ALLOWED_STATUSES = new Set(["all", "pending", "approved", "rejected"]);
const PATCH_ALLOWED_STATUSES = new Set(["approved", "rejected"]);

class AdminApiError extends Error {
  constructor({ code, status, message, details = null }) {
    super(message || "Admin API request failed.");
    this.name = "AdminApiError";
    this.code = code || "request_failed";
    this.status = typeof status === "number" ? status : 0;
    this.details = details;
  }
}

function normalizeApiError(payload, fallbackStatus) {
  if (payload && typeof payload === "object") {
    return new AdminApiError({
      code: payload.error || "request_failed",
      status: fallbackStatus,
      message: payload.message || "Admin API request failed.",
      details: payload,
    });
  }

  return new AdminApiError({
    code: "request_failed",
    status: fallbackStatus,
    message: "Admin API request failed.",
  });
}

export async function getAccessTokenFromSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new AdminApiError({
      code: "unauthorized",
      status: 401,
      message: "Failed to read Supabase session.",
      details: error,
    });
  }

  const accessToken = data?.session?.access_token;
  if (!accessToken) {
    throw new AdminApiError({
      code: "unauthorized",
      status: 401,
      message: "Missing access token in active session.",
    });
  }

  return accessToken;
}

export async function authorizedFetch(path, init = {}) {
  const token = await getAccessTokenFromSession();
  const headers = new Headers(init.headers || {});

  headers.set("Authorization", `Bearer ${token}`);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response;
  try {
    response = await fetch(path, { ...init, headers });
  } catch (networkError) {
    throw new AdminApiError({
      code: "network_error",
      status: 0,
      message: "Network error while calling admin API.",
      details: networkError,
    });
  }

  const isJson = (response.headers.get("content-type") || "").includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    throw normalizeApiError(payload, response.status);
  }

  return payload;
}

export async function listSubmissions({ status = "all", limit = 50, offset = 0 } = {}) {
  const normalizedStatus = String(status).toLowerCase();
  if (!LIST_ALLOWED_STATUSES.has(normalizedStatus)) {
    throw new AdminApiError({
      code: "invalid_query",
      status: 400,
      message: "status must be one of: all, pending, approved, rejected.",
    });
  }

  const query = new URLSearchParams({
    status: normalizedStatus,
    limit: String(limit),
    offset: String(offset),
  });

  return authorizedFetch(`/api/admin/submissions?${query.toString()}`, {
    method: "GET",
  });
}

export async function getSubmissionById(id) {
  if (!id || typeof id !== "string") {
    throw new AdminApiError({
      code: "invalid_id",
      status: 400,
      message: "id must be a valid UUID.",
    });
  }

  return authorizedFetch(`/api/admin/submissions/${encodeURIComponent(id)}`, {
    method: "GET",
  });
}

export async function updateSubmissionStatus(id, status) {
  if (!id || typeof id !== "string") {
    throw new AdminApiError({
      code: "invalid_id",
      status: 400,
      message: "id must be a valid UUID.",
    });
  }

  const normalizedStatus = String(status).toLowerCase();
  if (!PATCH_ALLOWED_STATUSES.has(normalizedStatus)) {
    throw new AdminApiError({
      code: "invalid_status",
      status: 400,
      message: "status must be one of: approved, rejected.",
    });
  }

  return authorizedFetch(`/api/admin/submissions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: normalizedStatus }),
  });
}

export { AdminApiError };

