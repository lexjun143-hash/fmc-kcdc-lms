import pool from "../config/db.js";
import { toPhDate } from "../utils/format.js";
import { ALL_SECTIONS_SENTINEL } from "./assignmentController.js";

const EXCLUDED_STUDENT_CATEGORIES = ["My Letter Writing", "Center Requirements"];

// The following nav items have no backing table yet, so they intentionally
// get no badge (emitting one would mean faking a number). Left here as a
// checklist for what each would need to earn a real one. Labels below are
// copied verbatim from src/config/{student,teacher,admin}Nav.js, typo and
// all, since that's the exact string the Sidebar's badges map has to match.
//
// - "My Letter Writting" (student) / "Manage Letters" (admin):
//   needs a `letters` table (id, student_id, subject, body,
//   status ENUM('draft','submitted','reviewed','sent'), admin_feedback,
//   seen_by_student BOOLEAN, created_at, reviewed_at).
//   Student badge:  SELECT COUNT(*) FROM letters
//                    WHERE student_id = ? AND status = 'reviewed' AND seen_by_student = FALSE
//   Admin badge:    SELECT COUNT(*) FROM letters WHERE status = 'submitted'
//
// - "My Gift" (student) / "Manage Gifts" (admin):
//   needs a `gifts` table (id, student_id, description,
//   status ENUM('pending','shipped','delivered'), seen_by_student BOOLEAN, created_at).
//   Student badge:  SELECT COUNT(*) FROM gifts WHERE student_id = ? AND seen_by_student = FALSE
//   Admin badge:    SELECT COUNT(*) FROM gifts WHERE status = 'pending'
//
// - "My Attendance" (student):
//   needs an `attendance` table (id, student_id, date, status ENUM('present','absent','late'),
//   recorded_by, created_at) plus a way to know what the student has already seen —
//   either users.last_seen_attendance_at, or a generic
//   nav_last_seen(user_id, nav_label, last_seen_at) table so this pattern reuses
//   across pages instead of one bespoke "last seen" column per feature.
//   Badge: SELECT COUNT(*) FROM attendance WHERE student_id = ? AND created_at > ?  (last_seen_attendance_at)
//
// - "Check Attendance" (teacher):
//   same `attendance` table as above, but the teacher-side signal is "days not
//   yet recorded" rather than "records the student hasn't seen" — e.g. a
//   school-day calendar table, or simpler: flag any weekday since this
//   teacher's last recorded date with zero attendance rows for their section.
//   Badge (once a school_days/calendar table exists):
//     SELECT COUNT(*) FROM school_days d
//     WHERE d.date <= CURDATE() AND d.section = ?
//       AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.date = d.date AND a.section = d.section)
//
// - "My Announcements" (student):
//   needs an `announcements` table (id, title, body, posted_by, audience ENUM('all','section'),
//   section, status ENUM('draft','published'), created_at) plus the same
//   "last seen" mechanism as attendance above.
//   Badge: SELECT COUNT(*) FROM announcements
//          WHERE created_at > ? AND status = 'published' AND (section IS NULL OR section = ?)
//
// - "Post Announcement" (teacher/admin):
//   this is a compose-only page — there's nothing to be notified about by default.
//   If a "drafts pending" badge were ever wanted, it would use the same
//   `announcements` table above: SELECT COUNT(*) FROM announcements
//   WHERE status = 'draft' AND posted_by = ?

async function getStudentNotifications(user) {
  // Same filter as before (unsubmitted, not yet due, not an excluded
  // category) but now selecting the rows themselves instead of a bare
  // COUNT(*) — `count` and `dueSoon` both derive from this one result set
  // instead of running two separate queries. Section-scoped: a student
  // only ever sees assignments posted to their own section, resolved
  // server-side from their own users row — never a section the client
  // could claim — plus anything an admin broadcast to every section
  // (ALL_SECTIONS_SENTINEL), so the badge never disagrees with what
  // My Assignment (getAssignments) actually shows. If a student has none
  // right now, this simply returns an empty set and `count` below is
  // naturally 0 — nothing separate to "hide" once the query is accurate.
  const [rows] = await pool.query(
    `SELECT a.id, a.title, a.due_date
     FROM assignments a
     LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ?
     WHERE s.id IS NULL
       AND a.due_date >= NOW()
       AND a.category NOT IN (?)
       AND (a.section = ? OR a.section = ?)
     ORDER BY a.due_date ASC`,
    [user.id, EXCLUDED_STUDENT_CATEGORIES, user.section, ALL_SECTIONS_SENTINEL],
  );

  const count = rows.length;

  // "Due soon" = still on time (due_date >= NOW(), already guaranteed by
  // the query above) but within the next 24 hours. Deliberately does NOT
  // include overdue/"Missing" assignments — those aren't in this row set
  // at all, since the query only selects a.due_date >= NOW().
  const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const dueSoon = rows
    .filter((r) => toPhDate(r.due_date) <= in24h)
    .map((r) => ({ id: r.id, title: r.title, dueDate: r.due_date }));

  return {
    role: "student",
    count,
    dueSoon,
    badges: { "My Assignment": count },
  };
}

// Routed by *who created the assignment*, specifically — not just role or
// section — so bells never cross over, matching getTeacherOverview's own
// scope exactly (same filter, same source of truth):
//   - admin: only assignments this same admin created themselves
//     (created_by_role = 'admin' AND created_by = their own
//     participant_id) — never another admin's, and never a teacher's,
//     even ones posted into a section this admin oversees.
//   - teacher: only assignments this same teacher created themselves
//     (created_by = their own participant_id) — never another teacher's
//     in the same section, and never the admin's. An admin- or other-
//     teacher-created assignment posted into this teacher's section
//     still reaches students normally, it just never raises a
//     notification (or shows up in Check Assignment) for this teacher.
// Both resolved server-side from `user` (looked up fresh in
// getNotifications), never trusted from the client. A pre-migration row
// with a NULL creator (database/012_add_assignment_creator.sql) simply
// matches neither filter and appears in nobody's bell.
async function getStaffNotifications(user) {
  const isAdmin = user.role === "admin";

  const [assignmentRows] = await pool.query(
    isAdmin
      ? "SELECT id, title, section, due_date FROM assignments WHERE created_by_role = 'admin' AND created_by = ? ORDER BY due_date ASC"
      : "SELECT id, title, section, due_date FROM assignments WHERE created_by = ? ORDER BY due_date ASC",
    [user.participant_id],
  );

  if (assignmentRows.length === 0) {
    return withAdminBadges(user, {
      role: user.role,
      assignments: [],
      totalAnswered: 0,
      totalExpected: 0,
      awaitingCount: 0,
      badges: { "Manage Assignment": 0 },
    });
  }

  const assignmentIds = assignmentRows.map((a) => a.id);

  // Batched: every submitting student for these assignments in one query,
  // not one query per assignment. Raw (assignment_id, student_id) pairs
  // rather than a GROUP BY count — we need the actual student ids to work
  // out who *didn't* submit, and `submissions` has
  // UNIQUE(assignment_id, student_id) so a plain count of this set is
  // already the distinct-student count, no separate aggregate needed.
  const [submissionRows] = await pool.query(
    "SELECT assignment_id, student_id FROM submissions WHERE assignment_id IN (?)",
    [assignmentIds],
  );
  const submitterIdsByAssignment = {};
  for (const row of submissionRows) {
    (submitterIdsByAssignment[row.assignment_id] ??= new Set()).add(row.student_id);
  }

  // Batched: every student, once, reused to build both each assignment's
  // roster size and its non-submitter list — instead of a per-assignment
  // lookup or a separate GROUP BY just for section totals.
  const [studentRows] = await pool.query(
    "SELECT id, participant_id, name, section FROM users WHERE role = 'student'",
  );
  const studentsBySection = {};
  for (const s of studentRows) {
    (studentsBySection[s.section] ??= []).push(s);
  }

  const assignments = assignmentRows.map((a) => {
    const submitterIds = submitterIdsByAssignment[a.id] || new Set();
    const roster = a.section != null ? studentsBySection[a.section] || [] : studentRows;
    const nonSubmitters = roster
      .filter((s) => !submitterIds.has(s.id))
      .map((s) => ({ participantId: s.participant_id, name: s.name }));

    return {
      id: a.id,
      title: a.title,
      section: a.section,
      dueDate: a.due_date,
      answered: submitterIds.size,
      total: roster.length,
      nonSubmitters,
    };
  });

  const totalAnswered = assignments.reduce((sum, a) => sum + a.answered, 0);
  const totalExpected = assignments.reduce((sum, a) => sum + a.total, 0);
  const awaitingCount = assignments.reduce(
    (sum, a) => sum + Math.max(0, a.total - a.answered),
    0,
  );

  return withAdminBadges(user, {
    role: user.role,
    assignments,
    totalAnswered,
    totalExpected,
    awaitingCount,
    badges: { "Manage Assignment": awaitingCount },
  });
}

// Admin-only: how many submissions came in over the last 24 hours,
// center-wide. Mutates and returns `result` so both getStaffNotifications
// return paths (the empty-assignments early return and the full one) can
// share this without duplicating the query.
async function withAdminBadges(user, result) {
  if (user.role !== "admin") return result;

  const [rows] = await pool.query(
    "SELECT COUNT(*) AS count FROM submissions WHERE submitted_at >= NOW() - INTERVAL 1 DAY",
  );
  const newSubmissionsCount = rows[0].count;

  result.newSubmissionsCount = newSubmissionsCount;
  result.badges["Submissions"] = newSubmissionsCount;
  return result;
}

export async function getNotifications(req, res) {
  const userId = Number(req.query.userId);
  if (!userId) return res.status(400).json({ error: "userId is required" });

  // Role, section, AND participant_id are looked up server-side — never
  // trusted from the query string. Every notification below is filtered
  // against this user's own section and/or participant_id (for an
  // admin's created_by match in getStaffNotifications), not anything the
  // client could pass in.
  const [userRows] = await pool.query(
    "SELECT id, participant_id, name, role, section FROM users WHERE id = ?",
    [userId],
  );
  if (userRows.length === 0) return res.status(404).json({ error: "User not found" });

  const user = userRows[0];
  const result =
    user.role === "student"
      ? await getStudentNotifications(user)
      : await getStaffNotifications(user);

  res.json(result);
}
