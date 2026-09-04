import { apiFetch } from "./client.js";

// Lets App.jsx refresh the Sidebar badges / NotificationBar / NotificationFab
// immediately after a submit or unsubmit, without waiting for a page nav or
// window focus. Dispatched here (not in the page component) so it covers
// every caller of submitAssignment/unsubmitAssignment, not just MyAssignment.jsx.
function notifyRefresh() {
  window.dispatchEvent(new CustomEvent("notifications:refresh"));
}

export async function fetchAssignments(studentId) {
  return apiFetch(`/api/assignments?studentId=${studentId}`);
}

export async function createAssignment(payload) {
  const result = await apiFetch("/api/assignments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  notifyRefresh();
  return result;
}

// Same shape as createAssignment's payload. section is only meaningful
// when the caller is an admin — the backend ignores it entirely for a
// teacher and forces their own section instead, and also rejects the
// request outright if that teacher doesn't own the assignment being
// edited in the first place.
export async function updateAssignment(assignmentId, payload) {
  const result = await apiFetch(`/api/assignments/${assignmentId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  notifyRefresh();
  return result;
}

export async function fetchTeacherOverview(userId) {
  return apiFetch(`/api/assignments/overview?userId=${userId}`);
}

// participantId identifies the caller so the backend can verify they're
// allowed to delete this assignment (admin: any; teacher: only their own
// section) — never trusted from the UI alone.
export async function deleteAssignment(assignmentId, participantId) {
  const result = await apiFetch(`/api/assignments/${assignmentId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ participantId }),
  });
  // A delete never refreshed the Sidebar badge / NotificationBar /
  // NotificationFab before this, so they kept showing a stale pre-delete
  // count until the next nav change or window focus. Re-fetches
  // notifications from the server (the same section-scoped query that
  // built the list), so the badge is recomputed from current data rather
  // than decremented by guesswork on the client.
  notifyRefresh();
  return result;
}

// `comment` is text, `keepFileIds` are ids of previously-uploaded files the
// student didn't remove, and `newFiles` are raw browser File objects picked
// in this session.
export async function submitAssignment(
  assignmentId,
  { comment, keepFileIds, newFiles },
  studentId,
) {
  const formData = new FormData();
  formData.append("studentId", studentId);
  formData.append("comment", comment || "");
  formData.append("keepFileIds", JSON.stringify(keepFileIds));
  newFiles.forEach((file) => formData.append("files", file));

  // No Content-Type header here on purpose — the browser sets the
  // multipart boundary itself when the body is a FormData instance;
  // setting it manually would omit that boundary and break the upload.
  const result = await apiFetch(`/api/assignments/${assignmentId}/submit`, {
    method: "POST",
    body: formData,
  });
  notifyRefresh();
  return result;
}

export async function unsubmitAssignment(assignmentId, studentId) {
  const result = await apiFetch(`/api/assignments/${assignmentId}/submit`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentId }),
  });
  notifyRefresh();
  return result;
}
