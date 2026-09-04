import { apiFetch } from "./client.js";

const STORAGE_KEY = "fmc_lms_user";

export async function login(participantId, password) {
  // apiFetch throws on a non-2xx status (or if the server can't be
  // reached at all) with the backend's own error message — including
  // `lockedUntil` on a lockout response, carried onto the thrown Error so
  // the login page can run a live countdown instead of just showing the
  // static message text.
  const user = await apiFetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ participantId, password }),
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  return user;
}

export function logout() {
  localStorage.removeItem(STORAGE_KEY);
}

export function updateCurrentUser(updatedUser) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
  window.dispatchEvent(
    new CustomEvent("auth:user-updated", {
      detail: updatedUser,
    }),
  );
}

// Reads the logged-in user (id, participantId, name, role) out of
// localStorage. Returns null if no one's logged in. This is the stand-in
// for a real session — there's no token, so anything reading this trusts
// the browser's local storage as-is.
export function getCurrentUser() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
