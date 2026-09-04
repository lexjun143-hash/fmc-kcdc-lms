import { apiFetch } from "./client.js";

export async function createAttendanceSession(payload) {
  return apiFetch("/api/attendance/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function fetchSectionAttendance(section) {
  return apiFetch(
    `/api/attendance/sessions?section=${encodeURIComponent(section)}`,
  );
}

export async function fetchMyAttendance(userId) {
  return apiFetch(`/api/attendance/my?userId=${encodeURIComponent(userId)}`);
}

export async function checkInForSession(requesterId) {
  return apiFetch("/api/attendance/checkin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requesterId }),
  });
}
