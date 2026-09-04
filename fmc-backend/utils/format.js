export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function guessFileType(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  if (ext === "pdf") return "pdf";
  if (["doc", "docx"].includes(ext)) return "doc";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
  return "default";
}

// pool is configured with dateStrings:true (config/db.js), so every
// DATE/DATETIME column arrives as a naive "YYYY-MM-DD HH:mm:ss" string with
// no timezone marker — it's already Philippine wall-clock time. Appending
// the PH UTC offset explicitly (rather than letting `new Date()` guess
// based on whatever timezone this process happens to be running in) is
// what makes the resulting instant correct regardless of server timezone.
export function toPhDate(raw) {
  if (!raw) return null;
  return new Date(`${raw.replace(" ", "T")}+08:00`);
}

// Mirrors the "assigned" | "submitted" | "late" status the frontend
// used to set by hand on its mock data.
export function computeStatus(dueDate, hasSubmission) {
  if (hasSubmission) return "submitted";
  return toPhDate(dueDate).getTime() < Date.now() ? "late" : "assigned";
}

// The reverse direction of toPhDate above: instead of interpreting a
// stored naive string as PH time, this produces one — "right now, N
// months ago, in Philippine time" as the same naive "YYYY-MM-DD HH:mm:ss"
// shape every DATE/DATETIME column in this DB already holds. Used by
// services/cleanupService.js to build the age cutoff for the assignment/
// letter deletion sweep. Computed here in Node from an explicit
// Asia/Manila read of the clock, not from MySQL's own NOW() — this app
// has never assumed the DB server's session timezone is Asia/Manila (see
// config/db.js's dateStrings:true comment), so trusting a raw
// `DATE_SUB(NOW(), INTERVAL 2 MONTH)` on the DB side would silently UTC-
// shift the cutoff if the server isn't already configured for +08:00.
export function phCutoffMonthsAgo(months) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type) => parts.find((p) => p.type === type).value;
  // Intl's 24-hour format reports midnight as "24", which Date(...)'s
  // constructor doesn't accept as an hour.
  const hour = get("hour") === "24" ? "00" : get("hour");

  // Built purely as a field-arithmetic scratchpad — its own timezone is
  // irrelevant, only setMonth()'s calendar math and the getters below
  // (which just echo back Manila's wall-clock numbers) matter.
  const phNow = new Date(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    Number(hour),
    Number(get("minute")),
    Number(get("second")),
  );
  phNow.setMonth(phNow.getMonth() - months);

  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${phNow.getFullYear()}-${pad(phNow.getMonth() + 1)}-${pad(phNow.getDate())} ` +
    `${pad(phNow.getHours())}:${pad(phNow.getMinutes())}:${pad(phNow.getSeconds())}`
  );
}
