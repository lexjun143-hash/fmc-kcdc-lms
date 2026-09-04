// The one place the backend's base URL is read from — every api/*.js file
// imports apiFetch (or, rarely, API_URL directly) from here instead of each
// declaring its own copy of the same fallback. That duplication used to be
// harmless only by coincidence (all six files happened to stay in sync);
// centralizing it means there's no way for one page to quietly end up
// pointed somewhere different — e.g. the Vite dev server's own port
// (5173) instead of the actual backend — while the rest still work.
// Override via VITE_API_URL in .env.local (see .env.example); falls back
// to the local dev backend's default port.
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Shared by every api/*.js call site instead of each hand-rolling the same
// fetch + status-check + error-body-parsing dance. Two distinct failure
// modes get turned into an actionable message instead of a generic one:
//
//  - fetch() itself never gets a response at all — backend not running,
//    wrong port/URL, a CORS preflight rejected, DNS failure. The browser
//    only ever reports this as a bare "TypeError: Failed to fetch", which
//    says nothing about *why*. Caught here and replaced with a message
//    that names the actual URL being hit, so a raw "Failed to fetch"
//    never reaches a page's UI as-is.
//  - The server responded, but with a non-2xx status — every controller
//    in this backend returns { error: "..." } on failure, which becomes
//    the thrown Error's message. Any other fields on that body (e.g.
//    auth.login's `lockedUntil`) ride along on the thrown Error object
//    too, so a caller that needs one doesn't have to re-parse the
//    response itself.
export async function apiFetch(path, options) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, options);
  } catch {
    throw new Error(`Could not reach the server at ${API_URL} — is the backend running?`);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `Request failed (HTTP ${res.status})`);
    Object.assign(err, body);
    throw err;
  }

  return res.json();
}
