import fs from "fs/promises";
import pool from "../config/db.js";

async function getRequester(requesterId) {
  const id = Number(requesterId);
  if (!id) return null;
  const [rows] = await pool.query(
    "SELECT id, name, role FROM users WHERE id = ?",
    [id],
  );
  return rows[0] || null;
}

async function getLetter(id) {
  const [rows] = await pool.query(`${letterSelect} WHERE l.id = ?`, [id]);
  return rows[0] || null;
}

function mapRow(letter, requester) {
  const mappedLetter = {
    id: letter.id,
    studentId: letter.student_id,
    name: letter.student_name,
    section: letter.section,
    quarter: letter.quarter,
    subject: `Letter to Your Sponsor — ${letter.quarter}`,
    prompt: letter.prompt,
    dueDate: letter.due_date,
    status: letter.status,
    body: letter.body || "",
    feedback: letter.feedback,
    sponsor: {
      id: letter.sponsor_id || null,
      name: letter.sponsor_name || "Sponsor",
      country: letter.sponsor_country || "",
    },
    sponsorLetterMode: letter.sponsor_letter_path ? "upload" : "type",
    sponsorLetterText: letter.sponsor_letter_text,
    sponsorLetterFile: letter.sponsor_letter_path,
    submittedAt: letter.submitted_at,
    sentAt: letter.sent_at,
  };
  if (requester?.role === "admin") mappedLetter.seenAt = letter.seen_at;
  return mappedLetter;
}

const letterSelect = `
  SELECT l.*, u.name AS student_name, u.section, s.id AS sponsor_id, s.name AS sponsor_name, s.country AS sponsor_country
  FROM letters l 
  JOIN users u ON u.id = l.student_id
  LEFT JOIN sponsors s ON s.id = l.sponsor_id`;

export async function createLetter(req, res) {
  const requester = await getRequester(req.body.requesterId);
  if (!requester)
    return res.status(400).json({ error: "A valid requesterId is required" });
  if (requester.role !== "admin") {
    if (req.file) await fs.unlink(req.file.path).catch(() => {});
    return res
      .status(403)
      .json({ error: "Only admins can post sponsor letters" });
  }

  const { studentId, quarter, prompt, dueDate, sponsorId, sponsorLetterText } =
    req.body;
  if (!studentId || !quarter?.trim() || !dueDate) {
    if (req.file) await fs.unlink(req.file.path).catch(() => {});
    return res
      .status(400)
      .json({ error: "studentId, quarter, and dueDate are required" });
  }
  const [students] = await pool.query(
    "SELECT id FROM users WHERE id = ? AND role = 'student'",
    [studentId],
  );
  if (students.length === 0) {
    if (req.file) await fs.unlink(req.file.path).catch(() => {});
    return res.status(404).json({ error: "Student not found" });
  }

  // Validate sponsor if provided
  if (sponsorId) {
    const [sponsors] = await pool.query(
      "SELECT id FROM sponsors WHERE id = ?",
      [sponsorId],
    );
    if (sponsors.length === 0) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      return res.status(404).json({ error: "Sponsor not found" });
    }
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO letters
       (student_id, quarter, prompt, due_date, status, sponsor_id, sponsor_letter_text, sponsor_letter_path)
       VALUES (?, ?, ?, ?, 'New', ?, ?, ?)`,
      [
        studentId,
        quarter.trim(),
        prompt?.trim() || null,
        dueDate,
        sponsorId || null,
        sponsorLetterText?.trim() || null,
        req.file?.path || null,
      ],
    );
    const letter = await getLetter(result.insertId);
    res.status(201).json(mapRow(letter, requester));
  } catch (err) {
    if (req.file) await fs.unlink(req.file.path).catch(() => {});
    throw err;
  }
}

export async function updateLetter(req, res) {
  const id = Number(req.params.id);
  const letter = await getLetter(id);
  if (!letter) return res.status(404).json({ error: "Letter not found" });
  const requester = await getRequester(req.body.requesterId);
  if (!requester)
    return res.status(400).json({ error: "A valid requesterId is required" });

  const action = req.body.action;
  const isStudent =
    requester.role === "student" && letter.student_id === requester.id;
  const isAdmin = requester.role === "admin";
  if (!isStudent && !isAdmin)
    return res
      .status(403)
      .json({ error: "You are not allowed to update this letter" });

  let sql;
  let params;
  if (isStudent && action === "draft") {
    sql =
      "UPDATE letters SET body = ?, status = IF(status = 'Revise', 'Revise', 'Drafting') WHERE id = ?";
    params = [req.body.body || "", id];
  } else if (isStudent && action === "submit") {
    sql =
      "UPDATE letters SET body = ?, status = 'Submitted', feedback = NULL, submitted_at = NOW() WHERE id = ?";
    params = [req.body.body || "", id];
  } else if (isAdmin && action === "revise") {
    sql = "UPDATE letters SET status = 'Revise', feedback = ? WHERE id = ?";
    params = [req.body.feedback?.trim() || null, id];
  } else if (isAdmin && action === "approve") {
    sql =
      "UPDATE letters SET status = 'Approved', feedback = NULL, sent_at = NOW() WHERE id = ?";
    params = [id];
  } else {
    return res.status(400).json({ error: "Invalid letter action" });
  }

  await pool.query(sql, params);
  const updatedLetter = await getLetter(id);
  res.json(mapRow(updatedLetter, requester));
}

export async function getLetters(req, res) {
  const requester = await getRequester(req.query.requesterId);
  if (!requester)
    return res.status(400).json({ error: "A valid requesterId is required" });
  if (requester.role !== "admin" && requester.role !== "student") {
    return res
      .status(403)
      .json({ error: "Only students and admins can view letters" });
  }

  let sql = letterSelect;
  const params = [];
  if (requester.role === "student") {
    sql += " WHERE l.student_id = ?";
    params.push(requester.id);
  }
  sql += " ORDER BY l.due_date DESC, l.created_at DESC";
  const [rows] = await pool.query(sql, params);
  res.json(rows.map((row) => mapRow(row, requester)));
}

export async function markLetterSeen(req, res) {
  const id = Number(req.params.id);
  const requester = await getRequester(req.body.requesterId);
  if (!requester)
    return res.status(400).json({ error: "A valid requesterId is required" });

  const [rows] = await pool.query(`${letterSelect} WHERE l.id = ?`, [id]);
  if (rows.length === 0)
    return res.status(404).json({ error: "Letter not found" });
  const letter = rows[0];
  if (
    requester.role !== "admin" &&
    !(requester.role === "student" && letter.student_id === requester.id)
  ) {
    return res
      .status(403)
      .json({ error: "You are not allowed to view this letter" });
  }

  await pool.query("UPDATE letters SET seen_at = NOW() WHERE id = ?", [id]);
  const [updatedRows] = await pool.query(`${letterSelect} WHERE l.id = ?`, [
    id,
  ]);
  res.json(mapRow(updatedRows[0], requester));
}
