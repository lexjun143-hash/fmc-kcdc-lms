import { apiFetch } from "./client.js";

function notifyGiftRefresh() {
  window.dispatchEvent(new CustomEvent("gifts:refresh"));
}

export async function fetchGifts(requesterId) {
  return apiFetch(`/api/gifts?requesterId=${encodeURIComponent(requesterId)}`);
}

export async function createGift(payload) {
  const result = await apiFetch("/api/gifts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  notifyGiftRefresh();
  return result;
}

async function giftAction(id, action, requesterId) {
  const result = await apiFetch(`/api/gifts/${id}/${action}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requesterId }),
  });
  notifyGiftRefresh();
  return result;
}

export const markGiftSeen = (id, requesterId) =>
  giftAction(id, "seen", requesterId);
export const acknowledgeGift = (id, requesterId) =>
  giftAction(id, "acknowledge", requesterId);
export const reopenGift = (id, requesterId) =>
  giftAction(id, "reopen", requesterId);
export const remindGift = (id, requesterId) =>
  giftAction(id, "remind", requesterId);
