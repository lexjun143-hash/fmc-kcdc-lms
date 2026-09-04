import bcrypt from "bcrypt";
import pool from "../config/db.js";
import { toPhDate } from "../utils/format.js";
import { runCleanup } from "../services/cleanupService.js";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 5;

export async function login(req, res) {
  const { participantId, password } = req.body;

  if (!participantId || !password) {
    return res.status(400).json({ error: "Participant ID and password are required" });
  }

  const [rows] = await pool.query(
    "SELECT * FROM users WHERE participant_id = ?",
    [participantId],
  );

  // Same generic message whether the ID doesn't exist or the password is
  // wrong — don't give an attacker a way to enumerate valid IDs. Lockout
  // is the one deliberate exception: once locked, the response says so
  // explicitly (with remaining time) rather than staying generic, since
  // that's the whole point of telling the user how long to wait.
  if (rows.length === 0) {
    return res.status(401).json({ error: "Invalid ID or password" });
  }

  let user = rows[0];

  if (user.lock_until) {
    // lock_until is a naive "YYYY-MM-DD HH:mm:ss" string (pool uses
    // dateStrings:true) — already Philippine wall-clock time, same
    // convention as due_date elsewhere. toPhDate interprets it with an
    // explicit +08:00 offset rather than letting the driver or this
    // process's own timezone guess, so the comparison against Date.now()
    // (a real UTC instant) is correct regardless of server timezone.
    const lockUntilMs = toPhDate(user.lock_until).getTime();
    if (lockUntilMs > Date.now()) {
      const minutesLeft = Math.max(1, Math.ceil((lockUntilMs - Date.now()) / 60000));
      return res.status(423).json({
        error: `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`,
        lockedUntil: user.lock_until,
      });
    }
    // Lock has expired — auto-unlock and reset the count before
    // continuing, so this attempt is evaluated on a clean slate.
    await pool.query("UPDATE users SET failed_attempts = 0, lock_until = NULL WHERE id = ?", [user.id]);
    user = { ...user, failed_attempts: 0, lock_until: null };
  }

  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches) {
    const attempts = user.failed_attempts + 1;

    if (attempts >= MAX_FAILED_ATTEMPTS) {
      // Computed by MySQL's own clock (same convention as every other
      // DATETIME write in this app, e.g. submitted_at = NOW()) so the
      // stored value and the one returned to the client are identical —
      // no separate NOW() evaluation to drift out of sync.
      const [[{ lockUntil }]] = await pool.query(
        "SELECT NOW() + INTERVAL ? MINUTE AS lockUntil",
        [LOCKOUT_MINUTES],
      );
      await pool.query(
        "UPDATE users SET failed_attempts = ?, lock_until = ? WHERE id = ?",
        [attempts, lockUntil, user.id],
      );
      return res.status(423).json({
        error: `Too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`,
        lockedUntil: lockUntil,
      });
    }

    await pool.query("UPDATE users SET failed_attempts = ? WHERE id = ?", [attempts, user.id]);
    return res.status(401).json({ error: "Invalid ID or password" });
  }

  // Correct password and not locked — reset the counter and log in.
  if (user.failed_attempts > 0) {
    await pool.query("UPDATE users SET failed_attempts = 0, lock_until = NULL WHERE id = ?", [user.id]);
  }

  // "Simplest for thesis" trigger: an admin login doubles as the age-based
  // cleanup check (services/cleanupService.js), on top of the daily cron
  // schedule in server.js. Deliberately not awaited — cleanup never
  // delays or fails this login response, it just logs on error.
  if (user.role === "admin") {
    runCleanup().catch((err) => console.error("[cleanup] admin-login run failed:", err));
  }

  res.json({
    id: user.id,
    participantId: user.participant_id,
    name: user.name,
    role: user.role,
    section: user.section,
    themePref: user.theme_pref,
    canCreateAdmin: !!user.can_create_admin,
  });
}
