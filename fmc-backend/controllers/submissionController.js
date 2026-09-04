import fs from "fs/promises";
import pool from "../config/db.js";
import { guessFileType, toPhDate } from "../utils/format.js";
import { getAssignmentById, ALL_SECTIONS_SENTINEL } from "./assignmentController.js";

// Cap is on how many late submissions a student currently HAS, not how
// many they've ever made — unsubmitting a late one (DELETE, below) frees
// the slot back up, since this is a live COUNT over current rows.
const MAX_LATE_SUBMISSIONS = 2;

// multer's upload.array("files") middleware (routes/assignments.js) writes
// files to disk before this controller ever runs — every rejection path
// below (bad id, assignment/account not found, wrong section, ...) has to
// clean those up itself, the same way the outer catch already does for a
// genuine DB error, or a rejected submit leaks a file on disk that no DB
// row ever references.
function cleanupUploadedFiles(files) {
  return Promise.all(files.map((f) => fs.unlink(f.path).catch(() => {})));
}

export async function submitAssignment(req, res) {
  const rawId = req.params.id;
  const assignmentId = Number(rawId);
  const studentId = Number(req.body.studentId);
  const comment = req.body.comment?.trim() || null;
  const files = req.files || [];

  // Diagnostic: exactly what the URL param looked like on the wire vs.
  // what it became after Number(...) — a mismatch between the id "Turn
  // in" sent and a real assignments.id (undefined, a title string, a
  // non-numeric value that collapses to NaN, ...) shows up here before it
  // ever reaches the lookup query below.
  console.log(`[submitAssignment] raw req.params.id=${JSON.stringify(rawId)} -> assignmentId=${assignmentId}`);

  // IDs of previously-uploaded files (from an earlier submission) that the
  // student chose to keep. Anything not in this list gets deleted — the
  // browser only has bytes for files freshly picked in this request, so a
  // kept file can't just be "re-uploaded".
  let keepFileIds = [];
  try {
    keepFileIds = JSON.parse(req.body.keepFileIds || "[]");
  } catch {
    keepFileIds = [];
  }

  if (!assignmentId) {
    await cleanupUploadedFiles(files);
    return res.status(400).json({ error: "A valid assignment id is required" });
  }
  if (!studentId) {
    await cleanupUploadedFiles(files);
    return res.status(400).json({ error: "studentId is required" });
  }
  // A file is no longer mandatory — a written answer alone is a valid
  // submission (matches MyAssignment.jsx's own Turn in button, which
  // enables on either). Still needs *something*, though: reject a
  // completely empty one (no kept file, no new file, no comment).
  if (keepFileIds.length === 0 && files.length === 0 && !comment) {
    return res.status(400).json({ error: "Write an answer or attach a file" });
  }

  const connection = await pool.getConnection();
  let filesToDeleteFromDisk = [];

  try {
    await connection.beginTransaction();

    const [assignmentRows] = await connection.query(
      "SELECT * FROM assignments WHERE id = ? FOR UPDATE",
      [assignmentId],
    );
    console.log(`[submitAssignment] lookup for id=${assignmentId} found ${assignmentRows.length} row(s)`);
    if (assignmentRows.length === 0) {
      await connection.rollback();
      await cleanupUploadedFiles(files);
      return res.status(404).json({ error: "Assignment not found" });
    }
    const assignment = assignmentRows[0];

    // A student can only submit to an assignment in their own section —
    // checked against the student's *current* row, never anything the
    // request claims, and enforced even if this is a hand-crafted request
    // rather than one the UI actually offered (the UI only ever lists a
    // student's own-section assignments in the first place — see
    // getAssignments — but this is the real boundary, not that).
    const [studentRows] = await connection.query(
      "SELECT section FROM users WHERE id = ? AND role = 'student'",
      [studentId],
    );
    if (studentRows.length === 0) {
      await connection.rollback();
      await cleanupUploadedFiles(files);
      return res.status(404).json({ error: "Account not found" });
    }
    console.log(
      `[submitAssignment] section check: student.section=${JSON.stringify(studentRows[0].section)} ` +
        `assignment.section=${JSON.stringify(assignment.section)}`,
    );
    // An "All Sections" broadcast (admin-created, section =
    // ALL_SECTIONS_SENTINEL) is submittable by any student, regardless of
    // their own section — everything else still has to match exactly.
    if (
      assignment.section !== ALL_SECTIONS_SENTINEL &&
      studentRows[0].section !== assignment.section
    ) {
      await connection.rollback();
      await cleanupUploadedFiles(files);
      return res.status(403).json({ error: "This assignment isn't in your section" });
    }

    const [existingRows] = await connection.query(
      "SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ? FOR UPDATE",
      [assignmentId, studentId],
    );
    const existing = existingRows[0] || null;

    // Never blocks the submission itself — only caps how many late ones a
    // student can have at once. submitted_at is about to be NOW() (a real
    // UTC instant); due_date is a naive PH-local string, so it's read
    // through toPhDate the same way the rest of the app compares the two.
    const isLate = Date.now() > toPhDate(assignment.due_date).getTime();
    // Resubmitting an assignment that's already marked late doesn't
    // consume a second slot — only a fresh late marking (new submission,
    // or an on-time one now landing after the deadline) does.
    const newlyGoingLate = isLate && existing?.status !== "late";
    console.log(
      `[submitAssignment] due_date=${assignment.due_date} now=${new Date().toISOString()} ` +
        `isLate=${isLate} newlyGoingLate=${newlyGoingLate}`,
    );

    if (newlyGoingLate) {
      const [[{ count }]] = await connection.query(
        "SELECT COUNT(*) AS count FROM submissions WHERE student_id = ? AND status = 'late'",
        [studentId],
      );
      console.log(`[submitAssignment] late-cap check: student already has ${count}/${MAX_LATE_SUBMISSIONS} late submissions`);
      if (count >= MAX_LATE_SUBMISSIONS) {
        await connection.rollback();
        await cleanupUploadedFiles(files);
        return res.status(409).json({
          error: `You've reached the maximum of ${MAX_LATE_SUBMISSIONS} late submissions.`,
        });
      }
    }

    const status = isLate ? "late" : "on_time";

    let submissionId;
    let wonReward = existing?.won_reward ? true : false;
    console.log(
      `[submitAssignment] about to ${existing ? "UPDATE existing submission id=" + existing.id : "INSERT a new submission"} ` +
        `with status=${status}, ${files.length} file(s) to attach`,
    );

    if (existing) {
      submissionId = existing.id;
      await connection.query(
        "UPDATE submissions SET comment = ?, submitted_at = NOW(), status = ? WHERE id = ?",
        [comment, status, submissionId],
      );

      const [currentFiles] = await connection.query(
        "SELECT * FROM submission_files WHERE submission_id = ?",
        [submissionId],
      );
      const toRemove = currentFiles.filter((f) => !keepFileIds.includes(f.id));
      filesToDeleteFromDisk = toRemove.map((f) => f.file_path);
      if (toRemove.length > 0) {
        await connection.query("DELETE FROM submission_files WHERE id IN (?)", [
          toRemove.map((f) => f.id),
        ]);
      }
    } else {
      // Only a first-time submission can claim a reward slot — resubmitting
      // doesn't re-roll it (matches the original mock-data behavior).
      if (assignment.reward_limit != null && assignment.reward_claimed < assignment.reward_limit) {
        wonReward = true;
        await connection.query(
          "UPDATE assignments SET reward_claimed = reward_claimed + 1 WHERE id = ?",
          [assignmentId],
        );
      }
      const [result] = await connection.query(
        "INSERT INTO submissions (assignment_id, student_id, comment, submitted_at, won_reward, status) VALUES (?, ?, ?, NOW(), ?, ?)",
        [assignmentId, studentId, comment, wonReward, status],
      );
      submissionId = result.insertId;
    }

    for (const file of files) {
      await connection.query(
        `INSERT INTO submission_files
           (submission_id, original_name, stored_name, file_path, file_size, file_type)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          submissionId,
          file.originalname,
          file.filename,
          `uploads/${file.filename}`,
          file.size,
          guessFileType(file.originalname),
        ],
      );
    }

    await connection.commit();

    await Promise.all(
      filesToDeleteFromDisk.map((p) => fs.unlink(p).catch(() => {})),
    );

    res.json(await getAssignmentById(assignmentId, studentId));
  } catch (err) {
    await connection.rollback();
    // DB rows describing these never got committed — clean them up too,
    // same as every rejection path above.
    await cleanupUploadedFiles(files);
    console.error(err);
    res.status(500).json({ error: "Failed to save submission" });
  } finally {
    connection.release();
  }
}

export async function unsubmitAssignment(req, res) {
  const assignmentId = Number(req.params.id);
  const studentId = Number(req.body.studentId);
  if (!studentId) return res.status(400).json({ error: "studentId is required" });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [subRows] = await connection.query(
      "SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ?",
      [assignmentId, studentId],
    );
    if (subRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "No submission to undo" });
    }
    const submission = subRows[0];

    const [files] = await connection.query(
      "SELECT * FROM submission_files WHERE submission_id = ?",
      [submission.id],
    );

    await connection.query("DELETE FROM submissions WHERE id = ?", [submission.id]);

    if (submission.won_reward) {
      await connection.query(
        "UPDATE assignments SET reward_claimed = GREATEST(reward_claimed - 1, 0) WHERE id = ?",
        [assignmentId],
      );
    }

    await connection.commit();
    await Promise.all(files.map((f) => fs.unlink(f.file_path).catch(() => {})));

    res.json(await getAssignmentById(assignmentId, studentId));
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: "Failed to undo submission" });
  } finally {
    connection.release();
  }
}
