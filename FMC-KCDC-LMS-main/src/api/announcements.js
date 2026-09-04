import { apiFetch } from "./client.js";

function notifyAnnouncementRefresh() {
  window.dispatchEvent(new CustomEvent("announcements:refresh"));
}

// Scoped entirely server-side by requesterId: a student gets their own
// section's posts plus every global (all-sections) post; a teacher gets
// only their own section's posts (for managing); an admin gets everything.
export async function fetchAnnouncements(requesterId) {
  return apiFetch(`/api/announcements?requesterId=${requesterId}`);
}

// `section` is only meaningful when the caller is an admin — the backend
// ignores it entirely for a teacher and forces their own section instead.
// Omitting it (or an empty string) as an admin posts to "All Sections".
export async function createAnnouncement(payload) {
  const result = await apiFetch("/api/announcements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  notifyAnnouncementRefresh();
  return result;
}

export async function updateAnnouncement(id, payload) {
  const result = await apiFetch(`/api/announcements/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  notifyAnnouncementRefresh();
  return result;
}

// requesterId identifies the caller so the backend can verify they're
// allowed to delete this post (admin: any; teacher: only their own
// section) — never trusted from the UI alone.
export async function deleteAnnouncement(id, requesterId) {
  const result = await apiFetch(`/api/announcements/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requesterId }),
  });
  notifyAnnouncementRefresh();
  return result;
}
