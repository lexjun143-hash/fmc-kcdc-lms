import { apiFetch } from "./client.js";

export async function fetchNotifications(userId) {
  return apiFetch(`/api/notifications?userId=${userId}`);
}
