import pool from "../config/db.js";
import { ALL_SECTIONS_SENTINEL } from "./assignmentController.js";

// A real section literally named "ALL" would be indistinguishable from
// assignmentController's broadcast-to-everyone sentinel — every student in
// every *other* section would suddenly see that section's own assignments
// too. Checked case-insensitively since "all"/"All" reads as the same word
// to an admin typing it in, even though the sentinel itself is stored
// uppercase.
function isReservedSectionName(name) {
  return name.trim().toUpperCase() === ALL_SECTIONS_SENTINEL;
}

// There's no session/JWT in this app — every write hands the backend a
// numeric `requesterId` (users.id) and the role is resolved fresh from
// the DB every time, same convention as userController/assignmentController/
// announcementController. Never trust a role sent directly from the client.
async function getRequester(requesterId) {
  const id = Number(requesterId);
  if (!id) return null;
  const [rows] = await pool.query("SELECT id, role FROM users WHERE id = ?", [id]);
  return rows[0] || null;
}

// Read is open to any logged-in role — students/teachers/admins all need
// this list just to populate a <select>. Only create/rename/delete are
// admin-gated below.
export async function getSections(req, res) {
  const [rows] = await pool.query("SELECT id, name, created_at FROM sections ORDER BY name ASC");
  res.json(rows.map((s) => ({ id: s.id, name: s.name, createdAt: s.created_at })));
}

export async function createSection(req, res) {
  const { requesterId, name } = req.body;

  const requester = await getRequester(requesterId);
  if (!requester) {
    return res.status(400).json({ error: "A valid requesterId is required" });
  }
  if (requester.role !== "admin") {
    return res.status(403).json({ error: "Only admins can create sections" });
  }
  if (!name?.trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  if (isReservedSectionName(name)) {
    return res.status(400).json({ error: '"All Sections" is reserved and can\'t be used as a section name' });
  }

  try {
    const [result] = await pool.query("INSERT INTO sections (name) VALUES (?)", [name.trim()]);
    res.status(201).json({ id: result.insertId, name: name.trim() });
  } catch (err) {
    // name is UNIQUE — surface a clear 409 instead of a raw SQL error.
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "That section name already exists" });
    }
    throw err;
  }
}

// Renaming a section is more than a row update: users.section,
// assignments.section, and announcements.section all store the section's
// *name* as plain text (not a foreign key), so every existing reference
// to the old name has to move to the new one in the same transaction —
// otherwise every account/assignment/announcement already using this
// section would silently stop matching it.
export async function renameSection(req, res) {
  const sectionId = Number(req.params.id);
  if (!sectionId) return res.status(400).json({ error: "A valid section id is required" });

  const { requesterId, name } = req.body;

  const requester = await getRequester(requesterId);
  if (!requester) {
    return res.status(400).json({ error: "A valid requesterId is required" });
  }
  if (requester.role !== "admin") {
    return res.status(403).json({ error: "Only admins can rename sections" });
  }
  if (!name?.trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  if (isReservedSectionName(name)) {
    return res.status(400).json({ error: '"All Sections" is reserved and can\'t be used as a section name' });
  }
  const newName = name.trim();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      "SELECT name FROM sections WHERE id = ? FOR UPDATE",
      [sectionId],
    );
    if (existingRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Section not found" });
    }
    const oldName = existingRows[0].name;

    if (oldName !== newName) {
      const [dupRows] = await connection.query(
        "SELECT id FROM sections WHERE name = ? AND id != ?",
        [newName, sectionId],
      );
      if (dupRows.length > 0) {
        await connection.rollback();
        return res.status(409).json({ error: "That section name already exists" });
      }

      await connection.query("UPDATE sections SET name = ? WHERE id = ?", [newName, sectionId]);
      await connection.query("UPDATE users SET section = ? WHERE section = ?", [newName, oldName]);
      await connection.query("UPDATE assignments SET section = ? WHERE section = ?", [newName, oldName]);
      await connection.query("UPDATE announcements SET section = ? WHERE section = ?", [newName, oldName]);
    }

    await connection.commit();
    res.json({ id: sectionId, name: newName });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: "Failed to rename section" });
  } finally {
    connection.release();
  }
}

// Blocks the delete (rather than orphaning anyone) if any student or
// teacher is still assigned to this section — the admin has to move or
// reassign those accounts first.
export async function deleteSection(req, res) {
  const sectionId = Number(req.params.id);
  if (!sectionId) return res.status(400).json({ error: "A valid section id is required" });

  const requester = await getRequester(req.body.requesterId);
  if (!requester) {
    return res.status(400).json({ error: "A valid requesterId is required" });
  }
  if (requester.role !== "admin") {
    return res.status(403).json({ error: "Only admins can delete sections" });
  }

  const [sectionRows] = await pool.query("SELECT name FROM sections WHERE id = ?", [sectionId]);
  if (sectionRows.length === 0) {
    return res.status(404).json({ error: "Section not found" });
  }
  const { name } = sectionRows[0];

  const [[{ count }]] = await pool.query(
    "SELECT COUNT(*) AS count FROM users WHERE section = ? AND role IN ('student', 'teacher')",
    [name],
  );
  if (count > 0) {
    return res.status(409).json({
      error: `Can't delete "${name}" — ${count} account${count === 1 ? " is" : "s are"} still assigned to it. Reassign them first.`,
    });
  }

  await pool.query("DELETE FROM sections WHERE id = ?", [sectionId]);
  res.json({ success: true });
}
