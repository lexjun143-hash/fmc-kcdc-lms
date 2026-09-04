import { apiFetch } from "./client.js";

// Open read — any logged-in role needs this just to populate a <select>.
export async function fetchSections() {
  return apiFetch("/api/sections");
}

// Admin-only on the backend — requesterId is verified server-side, not
// just hidden in the UI. Rejects duplicate names with a 409.
export async function createSection(name, requesterId) {
  return apiFetch("/api/sections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requesterId, name }),
  });
}

// Cascades the new name into users.section / assignments.section /
// announcements.section server-side, in one transaction — nothing that
// referenced the old name is left orphaned.
export async function renameSection(id, name, requesterId) {
  return apiFetch(`/api/sections/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requesterId, name }),
  });
}

// Blocked (409) server-side if any student/teacher is still assigned to
// this section, with a message explaining how many.
export async function deleteSection(id, requesterId) {
  return apiFetch(`/api/sections/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requesterId }),
  });
}
