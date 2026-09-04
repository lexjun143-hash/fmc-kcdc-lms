import { apiFetch } from "./client.js";

export async function createUser(payload) {
  return apiFetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// requesterId is required when role="student" — the backend uses it to
// scope the list to the requesting teacher's own section (admins get the
// full roster), and `search` (name parts or participant ID) is applied on
// top of that same scope server-side, not instead of it. Harmless to omit
// requesterId for other roles.
export async function fetchUsers(role, requesterId, search) {
  const params = new URLSearchParams({ role });
  if (requesterId != null) params.set("requesterId", requesterId);
  if (search) params.set("search", search);
  return apiFetch(`/api/users?${params.toString()}`);
}

export async function fetchUserById(id) {
  return apiFetch(`/api/users/${id}`);
}

// Full-detail row (all student-info fields) keyed by participant_id, for
// the clickable-name detail view. requesterId is required — the backend
// only allows the account's own admin, the teacher who owns its section,
// or the account itself to see this level of PII.
export async function fetchUserByParticipantId(participantId, requesterId) {
  const params = new URLSearchParams({ requesterId });
  return apiFetch(`/api/users/participant/${participantId}?${params.toString()}`);
}

// Keyed by participant_id (never the opaque numeric id) — participant_id
// is permanently read-only, so it's the identifier, not a field you can
// change. `payload` must include `requesterId` (the caller's own numeric
// id) so the backend can verify this is either a self-edit or an admin.
export async function updateUser(participantId, payload) {
  return apiFetch(`/api/users/participant/${participantId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// Self-only on the backend by construction (no target id, just
// requesterId) — every role can call this on their own account, including
// students, since a theme preference isn't "account information" the way
// name/section/etc. are (see updateUser's student block). Not part of the
// updateUser/participant flow on purpose, so it can never be blocked by
// that endpoint's student restriction.
export async function updateThemePref(requesterId, theme) {
  return apiFetch("/api/users/theme", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requesterId, theme }),
  });
}

// Admin-only on the backend — requesterId is verified server-side, not
// just hidden in the UI.
export async function deleteUser(participantId, requesterId) {
  return apiFetch(`/api/users/participant/${participantId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requesterId }),
  });
}
