import fs from "fs/promises";
import pool from "../config/db.js";
import { phCutoffMonthsAgo } from "../utils/format.js";

const RETENTION_MONTHS = 2;

// submissions/submission_files cascade automatically (ON DELETE CASCADE,
// schema.sql) once the parent assignment row is gone — that only removes
// the DB rows, not the actual uploaded files sitting in uploads/, so
// those are collected and unlinked explicitly here. Same pattern
// assignmentController.deleteAssignment already uses for a single manual
// delete, just batched over every assignment past the retention window
// instead of one id from a request.
async function cleanupAssignments() {
  const cutoff = phCutoffMonthsAgo(RETENTION_MONTHS);

  const [assignments] = await pool.query(
    "SELECT id FROM assignments WHERE due_date < ?",
    [cutoff],
  );
  if (assignments.length === 0) return { deleted: 0, filesRemoved: 0 };
  const ids = assignments.map((a) => a.id);

  const [files] = await pool.query(
    `SELECT sf.file_path
     FROM submission_files sf
     JOIN submissions s ON s.id = sf.submission_id
     WHERE s.assignment_id IN (?)`,
    [ids],
  );

  await pool.query("DELETE FROM assignments WHERE id IN (?)", [ids]);
  await Promise.all(files.map((f) => fs.unlink(f.file_path).catch(() => {})));

  return { deleted: ids.length, filesRemoved: files.length };
}

// letters has no ON DELETE CASCADE dependents of its own (see
// database/010_add_letters.sql) — just its own row, plus an uploaded
// sponsor-letter scan (sponsor_letter_path) to unlink if one was attached.
async function cleanupLetters() {
  const cutoff = phCutoffMonthsAgo(RETENTION_MONTHS);

  const [letters] = await pool.query(
    "SELECT id, sponsor_letter_path FROM letters WHERE due_date < ?",
    [cutoff],
  );
  if (letters.length === 0) return { deleted: 0, filesRemoved: 0 };
  const ids = letters.map((l) => l.id);
  const filePaths = letters.map((l) => l.sponsor_letter_path).filter(Boolean);

  await pool.query("DELETE FROM letters WHERE id IN (?)", [ids]);
  await Promise.all(filePaths.map((p) => fs.unlink(p).catch(() => {})));

  return { deleted: ids.length, filesRemoved: filePaths.length };
}

// The only place age-based deletion happens anywhere in this app. No
// route calls this — it's never reachable from a client request, not even
// an admin's own browser — only two internal call sites: the daily cron
// schedule (server.js) and authController.login's admin branch. Normal
// users have no way to trigger a mass delete; this is server-side-only by
// construction, not by a permission check that a bug could weaken.
export async function runCleanup() {
  const [assignmentsResult, lettersResult] = await Promise.all([
    cleanupAssignments(),
    cleanupLetters(),
  ]);

  if (assignmentsResult.deleted || lettersResult.deleted) {
    console.log(
      `[cleanup] removed ${assignmentsResult.deleted} assignment(s) ` +
        `(${assignmentsResult.filesRemoved} file(s)) and ` +
        `${lettersResult.deleted} letter(s) (${lettersResult.filesRemoved} file(s)) ` +
        `more than ${RETENTION_MONTHS} months past their due date`,
    );
  }

  return { assignments: assignmentsResult, letters: lettersResult };
}
