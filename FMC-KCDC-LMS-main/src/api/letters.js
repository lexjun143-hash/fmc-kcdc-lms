import { apiFetch } from "./client.js";

export function fetchLetters(requesterId) {
  return apiFetch(
    `/api/letters?requesterId=${encodeURIComponent(requesterId)}`,
  );
}

export function markLetterSeen(id, requesterId, status = "New") {
  return apiFetch(`/api/letters/${id}/seen`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requesterId, status }),
  });
}

export function createLetter(formData) {
  return apiFetch("/api/letters", {
    method: "POST",
    body: formData,
  });
}

export function updateLetter(id, payload) {
  return apiFetch(`/api/letters/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
