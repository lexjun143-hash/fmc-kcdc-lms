import fs from "fs/promises";
import pool from "../config/db.js";
import { formatBytes, computeStatus } from "../utils/format.js";

// Sentinel stored in assignments.section for an admin's "All Sections"
// broadcast — not a row in the sections table, just a reserved string
// every section-matching query has to explicitly OR against (see
// getAssignments below, and getStudentNotifications in
// notificationController.js). Exported so sectionController.js can block
// a real section from ever being named this (which would otherwise be
// silently swallowed into "everyone"), and so nobody has to duplicate the
// literal string.
export const ALL_SECTIONS_SENTINEL = "ALL";

// Builds the exact shape MyAssignment.jsx expects, for one or more
// assignment rows (each optionally left-joined with the requesting
// student's submission).
async function mapRowsToAssignments(rows) {
  const submissionIds = rows.filter((r) => r.submission_id).map((r) => r.submission_id);

  let filesBySubmission = {};
  if (submissionIds.length > 0) {
    const [files] = await pool.query(
      "SELECT * FROM submission_files WHERE submission_id IN (?) ORDER BY uploaded_at ASC",
      [submissionIds],
    );
    filesBySubmission = files.reduce((acc, f) => {
      (acc[f.submission_id] ??= []).push({
        id: f.id,
        name: f.original_name,
        size: formatBytes(f.file_size),
        type: f.file_type,
      });
      return acc;
    }, {});
  }

  return rows.map((r) => {
    const hasSubmission = Boolean(r.submission_id);
    return {
      id: r.id,
      title: r.title,
      category: r.category,
      section: r.section,
      // teacher_name can be NULL if the teacher account was later deleted
      // (deleteUser nulls it out rather than deleting the assignment) —
      // fall back so the student view never renders/initials() a null.
      teacher: r.teacher_name || "Unassigned",
      instructions: r.instructions,
      dueDate: r.due_date,
      points: r.points,
      teacherAttachments: [],
      status: computeStatus(r.due_date, hasSubmission),
      submission: hasSubmission
        ? {
            comment: r.submission_comment || "",
            files: filesBySubmission[r.submission_id] || [],
            submittedAt: r.submitted_at,
            wonReward: Boolean(r.won_reward),
            // Stored at submit time (submissionController.js), never
            // recomputed here — the single source of truth the 2-late cap
            // also counts against.
            status: r.submission_status,
          }
        : null,
      reward:
        r.reward_limit != null
          ? { limit: r.reward_limit, claimedBy: r.reward_claimed, label: r.reward_label }
          : null,
    };
  });
}

const ASSIGNMENTS_WITH_SUBMISSION_SQL = `
  SELECT a.*, s.id AS submission_id, s.comment AS submission_comment,
         s.submitted_at, s.won_reward, s.status AS submission_status
  FROM assignments a
  LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ?
`;

// The student-facing "My Assignment" list — section-scoped: a student
// only ever sees assignments posted to their own section, resolved here
// from their own users row, never trusted from the client (this endpoint
// doesn't even accept a section param) — PLUS anything an admin broadcast
// to ALL_SECTIONS_SENTINEL, which reaches every student regardless of
// section. An assignment for Section A still never appears for a Section
// B/C/D student unless it's one of those "All Sections" ones.
export async function getAssignments(req, res) {
  const studentId = Number(req.query.studentId);
  if (!studentId) return res.status(400).json({ error: "studentId is required" });

  const [studentRows] = await pool.query("SELECT section FROM users WHERE id = ?", [studentId]);
  if (studentRows.length === 0) {
    return res.status(404).json({ error: "Account not found" });
  }
  const studentSection = studentRows[0].section;

  const [rows] = await pool.query(
    `${ASSIGNMENTS_WITH_SUBMISSION_SQL} WHERE (a.section = ? OR a.section = ?) ORDER BY a.due_date ASC`,
    [studentId, studentSection, ALL_SECTIONS_SENTINEL],
  );
  res.json(await mapRowsToAssignments(rows));
}

// Reused by submissionController after a submit/unsubmit so the response
// always reflects the freshly committed state.
export async function getAssignmentById(assignmentId, studentId) {
  const [rows] = await pool.query(
    `${ASSIGNMENTS_WITH_SUBMISSION_SQL} WHERE a.id = ?`,
    [studentId, assignmentId],
  );
  if (rows.length === 0) return null;
  const [mapped] = await mapRowsToAssignments(rows);
  return mapped;
}

// Shared by createAssignment/updateAssignment/deleteAssignment: resolves
// who's actually making this request (never trusted as a role string from
// the client — looked up fresh from participant_id every time) and, for
// role='teacher', their own section.
async function getActor(participantId) {
  const [rows] = await pool.query(
    "SELECT section, role FROM users WHERE participant_id = ?",
    [participantId],
  );
  return rows[0] || null;
}

// Admin picks any real section from a dropdown, or the ALL_SECTIONS_SENTINEL
// to broadcast to every section at once; a teacher never sees a section
// picker at all and can't move an assignment out of their own section no
// matter what the client sends — this is the one place that decides which
// of those two applies, reused by create and update. Validated against the
// real sections table (not just "is it a non-empty string") so a typo or a
// hand-crafted request can't silently create an assignment nobody's
// section query will ever match.
async function resolveSection(actor, requestedSection) {
  if (actor.role === "admin") {
    const trimmed = requestedSection?.trim();
    if (!trimmed) {
      return { error: "section is required" };
    }
    if (trimmed === ALL_SECTIONS_SENTINEL) {
      return { section: ALL_SECTIONS_SENTINEL };
    }
    const [rows] = await pool.query("SELECT 1 FROM sections WHERE name = ?", [trimmed]);
    if (rows.length === 0) {
      return { error: "That section doesn't exist" };
    }
    return { section: trimmed };
  }
  // teacher: any client-supplied section is ignored outright.
  return { section: actor.section };
}

export async function createAssignment(req, res) {
  const {
    title,
    category,
    participantId,
    section: requestedSection,
    teacherName,
    instructions,
    dueDate,
    hasPrize,
    prizeDescription,
    prizeWinners,
  } = req.body;

  if (!title?.trim() || !category || !participantId || !teacherName || !dueDate) {
    return res
      .status(400)
      .json({ error: "title, category, participantId, teacherName, and dueDate are required" });
  }
  if (hasPrize && (!prizeDescription?.trim() || !prizeWinners || Number(prizeWinners) < 1)) {
    return res
      .status(400)
      .json({ error: "prizeDescription and prizeWinners are required when hasPrize is true" });
  }

  const actor = await getActor(participantId);
  if (!actor) {
    return res.status(404).json({ error: "Account not found" });
  }
  if (actor.role !== "teacher" && actor.role !== "admin") {
    return res.status(403).json({ error: "Only teacher or admin accounts can publish assignments" });
  }

  const resolved = await resolveSection(actor, requestedSection);
  if (resolved.error) {
    return res.status(400).json({ error: resolved.error });
  }
  const section = resolved.section;

  // due_date is DATETIME NOT NULL; the form only collects a date, so pin it
  // to end-of-day the same way the seed data does.
  const dbDueDate = `${dueDate} 17:00:00`;
  const rewardLimit = hasPrize ? Number(prizeWinners) : null;
  const rewardLabel = hasPrize ? prizeDescription : null;

  // created_by/created_by_role record who actually made this — participantId
  // and actor.role are already resolved and validated above, never taken
  // fresh from the request body. This is what notificationController's
  // admin/teacher bell split keys off (see getStaffNotifications) — kept
  // separate from teacher_name, which is just a display label and, for an
  // admin-created assignment, isn't necessarily even an account.
  const [result] = await pool.query(
    `INSERT INTO assignments
       (title, category, section, teacher_name, instructions, due_date, points, reward_limit, reward_label, reward_claimed,
        created_by, created_by_role)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 0, ?, ?)`,
    [
      title.trim(),
      category,
      section,
      teacherName,
      instructions || null,
      dbDueDate,
      rewardLimit,
      rewardLabel,
      participantId,
      actor.role,
    ],
  );

  const [rows] = await pool.query("SELECT * FROM assignments WHERE id = ?", [result.insertId]);
  res.status(201).json(rows[0]);
}

export async function updateAssignment(req, res) {
  const assignmentId = Number(req.params.id);
  if (!assignmentId) return res.status(400).json({ error: "A valid assignment id is required" });

  const {
    title,
    category,
    participantId,
    section: requestedSection,
    instructions,
    dueDate,
    hasPrize,
    prizeDescription,
    prizeWinners,
  } = req.body;

  if (!title?.trim() || !category || !participantId || !dueDate) {
    return res
      .status(400)
      .json({ error: "title, category, participantId, and dueDate are required" });
  }
  if (hasPrize && (!prizeDescription?.trim() || !prizeWinners || Number(prizeWinners) < 1)) {
    return res
      .status(400)
      .json({ error: "prizeDescription and prizeWinners are required when hasPrize is true" });
  }

  const actor = await getActor(participantId);
  if (!actor) {
    return res.status(404).json({ error: "Account not found" });
  }
  if (actor.role !== "teacher" && actor.role !== "admin") {
    return res.status(403).json({ error: "Only teacher or admin accounts can manage assignments" });
  }

  const [existingRows] = await pool.query("SELECT section FROM assignments WHERE id = ?", [assignmentId]);
  if (existingRows.length === 0) {
    return res.status(404).json({ error: "Assignment not found" });
  }
  // A teacher can only reach assignments already in their own section —
  // checked against the DB row, not anything the client sent — and
  // resolveSection below keeps it pinned there even if they tried to
  // change it.
  if (actor.role === "teacher" && existingRows[0].section !== actor.section) {
    return res.status(403).json({ error: "You can only manage assignments in your own section" });
  }

  const resolved = await resolveSection(actor, requestedSection);
  if (resolved.error) {
    return res.status(400).json({ error: resolved.error });
  }
  const section = resolved.section;

  const dbDueDate = `${dueDate} 17:00:00`;
  const rewardLimit = hasPrize ? Number(prizeWinners) : null;
  const rewardLabel = hasPrize ? prizeDescription : null;

  await pool.query(
    `UPDATE assignments
       SET title = ?, category = ?, section = ?, instructions = ?, due_date = ?,
           reward_limit = ?, reward_label = ?
     WHERE id = ?`,
    [title.trim(), category, section, instructions || null, dbDueDate, rewardLimit, rewardLabel, assignmentId],
  );

  const [rows] = await pool.query("SELECT * FROM assignments WHERE id = ?", [assignmentId]);
  res.json(rows[0]);
}

export async function deleteAssignment(req, res) {
  const assignmentId = Number(req.params.id);
  if (!assignmentId) return res.status(400).json({ error: "A valid assignment id is required" });

  const { participantId } = req.body;
  const actor = await getActor(participantId);
  if (!actor) {
    return res.status(404).json({ error: "Account not found" });
  }
  if (actor.role !== "teacher" && actor.role !== "admin") {
    return res.status(403).json({ error: "Only teacher or admin accounts can delete assignments" });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [assignmentRows] = await connection.query(
      "SELECT id, section FROM assignments WHERE id = ? FOR UPDATE",
      [assignmentId],
    );
    if (assignmentRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Assignment not found" });
    }
    if (actor.role === "teacher" && assignmentRows[0].section !== actor.section) {
      await connection.rollback();
      return res.status(403).json({ error: "You can only delete assignments in your own section" });
    }

    // Collect uploaded files before the delete — submissions and
    // submission_files cascade automatically (ON DELETE CASCADE), but that
    // only removes the DB rows, not the actual files sitting in uploads/.
    const [files] = await connection.query(
      `SELECT sf.file_path
       FROM submission_files sf
       JOIN submissions s ON s.id = sf.submission_id
       WHERE s.assignment_id = ?`,
      [assignmentId],
    );

    await connection.query("DELETE FROM assignments WHERE id = ?", [assignmentId]);

    await connection.commit();
    await Promise.all(files.map((f) => fs.unlink(f.file_path).catch(() => {})));

    res.json({ success: true });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: "Failed to delete assignment" });
  } finally {
    connection.release();
  }
}

// Powers the "Manage Assignment" / "Check Assignment" page for both
// teacher and admin — scoped to *who created it*, not just section or
// role: a teacher sees only assignments they personally created (never
// another teacher's, never the admin's, even ones posted into their own
// section); an admin sees only assignments they personally created
// (never a teacher's, even in a section the admin otherwise oversees).
// created_by/created_by_role (set at creation — see createAssignment) is
// what this keys off, resolved from `user` below, never trusted from the
// client. Every stat this endpoint returns (activeAssignments,
// submissionRate, studentsYetToSubmit, ...) is derived from this same
// filtered `assignmentRows`, so they can never disagree with the list.
export async function getTeacherOverview(req, res) {
  const userId = Number(req.query.userId);
  if (!userId) return res.status(400).json({ error: "userId is required" });

  const [userRows] = await pool.query(
    "SELECT id, participant_id, name, role, section FROM users WHERE id = ?",
    [userId],
  );
  if (userRows.length === 0) return res.status(404).json({ error: "User not found" });
  const user = userRows[0];
  const isAdmin = user.role === "admin";

  const [assignmentRows] = await pool.query(
    isAdmin
      ? "SELECT * FROM assignments WHERE created_by_role = 'admin' AND created_by = ? ORDER BY due_date ASC"
      : "SELECT * FROM assignments WHERE created_by = ? ORDER BY due_date ASC",
    [user.participant_id],
  );

  if (assignmentRows.length === 0) {
    return res.json({ assignments: [], activeAssignments: 0, submissionRate: 0, studentsYetToSubmit: 0 });
  }

  const assignmentIds = assignmentRows.map((a) => a.id);

  // Batched: every submission (with the student's name) for these
  // assignments in one query, not one query per assignment.
  const [submissionRows] = await pool.query(
    `SELECT sub.id AS submission_id, sub.assignment_id, sub.student_id,
            sub.submitted_at, sub.status, u.name AS student_name
     FROM submissions sub
     JOIN users u ON u.id = sub.student_id
     WHERE sub.assignment_id IN (?)`,
    [assignmentIds],
  );
  const submissionsByAssignment = {};
  for (const row of submissionRows) {
    (submissionsByAssignment[row.assignment_id] ??= []).push(row);
  }

  // Batched: first attached file per submission, reused below instead of a
  // per-submission lookup.
  const submissionIds = submissionRows.map((r) => r.submission_id);
  const firstFileBySubmission = {};
  if (submissionIds.length > 0) {
    const [fileRows] = await pool.query(
      "SELECT submission_id, original_name FROM submission_files WHERE submission_id IN (?) ORDER BY uploaded_at ASC",
      [submissionIds],
    );
    for (const f of fileRows) {
      if (!(f.submission_id in firstFileBySubmission)) {
        firstFileBySubmission[f.submission_id] = f.original_name;
      }
    }
  }

  // Batched: every student, once, reused to build each assignment's
  // roster (who's missing) instead of a per-assignment lookup.
  const [studentRows] = await pool.query("SELECT id, name, section FROM users WHERE role = 'student'");

  // Batched: one query for every section's student count, reused across
  // all assignments instead of a per-assignment lookup.
  const [sectionRows] = await pool.query(
    "SELECT section, COUNT(*) AS total FROM users WHERE role = 'student' GROUP BY section",
  );
  const totalBySection = Object.fromEntries(sectionRows.map((r) => [r.section, r.total]));
  const totalAllStudents = sectionRows.reduce((sum, r) => sum + r.total, 0);

  const assignments = assignmentRows.map((a) => {
    const subs = submissionsByAssignment[a.id] || [];
    const subsByStudent = Object.fromEntries(subs.map((s) => [s.student_id, s]));
    const roster = a.section != null ? studentRows.filter((s) => s.section === a.section) : studentRows;
    const total = a.section != null ? totalBySection[a.section] || 0 : totalAllStudents;

    const submissions = roster.map((student) => {
      const sub = subsByStudent[student.id];
      if (!sub) {
        return { student: student.name, status: "missing", submittedAt: null, file: null };
      }
      // Stored at submit time (submissionController.js), never recomputed
      // here — same source of truth the 2-late cap counts against.
      return {
        student: student.name,
        status: sub.status === "late" ? "late" : "submitted",
        submittedAt: sub.submitted_at,
        file: firstFileBySubmission[sub.submission_id] || null,
      };
    });

    return {
      id: a.id,
      title: a.title,
      category: a.category,
      section: a.section,
      dueDate: a.due_date,
      // `submissions` has UNIQUE(assignment_id, student_id), so the row
      // count here already equals COUNT(DISTINCT student_id) — no extra
      // GROUP BY query needed.
      answered: subs.length,
      total,
      prize:
        a.reward_limit != null
          ? { enabled: true, description: a.reward_label, winners: a.reward_limit }
          : { enabled: false, description: "", winners: 0 },
      submissions,
    };
  });

  const activeAssignments = assignments.length;
  const totalAnswered = assignments.reduce((sum, a) => sum + a.answered, 0);
  const totalExpected = assignments.reduce((sum, a) => sum + a.total, 0);
  const submissionRate = totalExpected > 0 ? Math.round((totalAnswered / totalExpected) * 100) : 0;
  const studentsYetToSubmit = assignments.reduce(
    (sum, a) => sum + Math.max(0, a.total - a.answered),
    0,
  );

  res.json({ assignments, activeAssignments, submissionRate, studentsYetToSubmit });
}
