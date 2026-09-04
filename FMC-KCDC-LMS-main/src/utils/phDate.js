const PH_OFFSET = "+08:00";

/*
 * The backend always returns due_date/submitted_at as a naive
 * "YYYY-MM-DD HH:mm:ss" string with no timezone marker (see
 * fmc-backend/config/db.js's `dateStrings: true`) — it's already
 * Philippine wall-clock time. A bare "YYYY-MM-DD" (a due-date still being
 * typed into the teacher's form, before submission) is treated the same
 * way the backend pins it once saved: 5:00 PM PH time.
 *
 * Appending the PH UTC offset explicitly — rather than letting `new
 * Date()` guess based on whatever timezone the viewer's browser happens to
 * be in — is what makes the resulting instant, and everything formatted
 * from it below, correct for every viewer everywhere, not just people
 * physically in the Philippines.
 */
export function parsePhDate(raw) {
  if (!raw) return null;
  const withTime = raw.length === 10 ? `${raw} 17:00:00` : raw;
  const isoLocal = withTime.replace(" ", "T");
  return new Date(`${isoLocal}${PH_OFFSET}`);
}

// Always renders in Asia/Manila, regardless of the viewer's own device
// timezone — this is what actually fixes "shows the wrong time".
export function formatPhDateTime(raw) {
  const date = parsePhDate(raw);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatPhDate(raw) {
  const date = parsePhDate(raw);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatPhTime(raw) {
  const date = parsePhDate(raw);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

// Short "Aug 10" form used by the notification banners.
export function formatPhMonthDay(raw) {
  const date = parsePhDate(raw);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
  }).format(date);
}

// YYYY-MM-DD for a given instant, as a Philippine calendar day — correct
// regardless of the viewer's own device timezone. Used for date-input
// `min`/quick-pick values so e.g. "Tomorrow" means tomorrow in Manila, not
// tomorrow wherever the teacher's laptop clock is set. PH has no DST, so
// plain millisecond arithmetic on top of this is always safe.
export function toPhCalendarDate(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(date);
}
