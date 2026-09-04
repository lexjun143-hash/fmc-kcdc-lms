import pool from "../config/db.js";

const VALID_CATEGORIES = ["Urgent", "Event", "Schedule", "General"];

// There's no session/JWT in this app — every write hands the backend a
// numeric `requesterId` (users.id) and the role/section is resolved fresh
// from the DB every time, same convention as
// userController.getRequester / notificationController.getNotifications.
// Never trust a role or section sent directly from the client.
async function getRequester(requesterId) {
  const id = Number(requesterId);
  if (!id) return null;
  const [rows] = await pool.query(
    "SELECT id, name, role, section FROM users WHERE id = ?",
    [id],
  );
  return rows[0] || null;
}

// Admin picks any section from a dropdown (or leaves it blank for "All
// Sections" — a global post, stored as section = NULL). A teacher never
// sees a section picker at all and can't move a post out of their own
// section no matter what the client sends.
function resolveSection(requester, requestedSection) {
  if (requester.role === "admin") {
    const trimmed = requestedSection?.trim();
    return trimmed || null;
  }
  return requester.section;
}

function mapRow(a) {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    category: a.category,
    pinned: Boolean(a.pinned),
    section: a.section,
    author: a.posted_by_name,
    createdAt: a.created_at,
  };
}

// Powers both "My Announcements" (student) and the "Manage Announcements"
// list (teacher/admin) — one query, scoped entirely server-side by the
// requester's own role/section:
//   student -> their own section's posts PLUS every global (section IS
//              NULL) post, since a global post is meant for everyone;
//   teacher -> only posts already in their own section (never global ones
//              they didn't author — those are admin-owned);
//   admin   -> every post, unscoped.
export async function getAnnouncements(req, res) {
  const requester = await getRequester(req.query.requesterId);
  if (!requester) {
    return res.status(400).json({ error: "A valid requesterId is required" });
  }

  let sql = "SELECT * FROM announcements";
  const params = [];
  if (requester.role === "student") {
    sql += " WHERE section = ? OR section IS NULL";
    params.push(requester.section);
  } else if (requester.role === "teacher") {
    sql += " WHERE section = ?";
    params.push(requester.section);
  }
  // admin: no WHERE clause at all — everything, every section.
  sql += " ORDER BY pinned DESC, created_at DESC";

  const [rows] = await pool.query(sql, params);
  res.json(rows.map(mapRow));
}

export async function createAnnouncement(req, res) {
  const { requesterId, title, body, category, pinned, section: requestedSection } = req.body;

  if (!title?.trim() || !body?.trim()) {
    return res.status(400).json({ error: "title and body are required" });
  }
  if (category && !VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of ${VALID_CATEGORIES.join(", ")}` });
  }

  const requester = await getRequester(requesterId);
  if (!requester) {
    return res.status(400).json({ error: "A valid requesterId is required" });
  }
  if (requester.role !== "teacher" && requester.role !== "admin") {
    return res.status(403).json({ error: "Only teacher or admin accounts can post announcements" });
  }

  const section = resolveSection(requester, requestedSection);

  const [result] = await pool.query(
    `INSERT INTO announcements (title, body, category, pinned, section, posted_by_name)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [title.trim(), body.trim(), category || "General", Boolean(pinned), section, requester.name],
  );

  const [rows] = await pool.query("SELECT * FROM announcements WHERE id = ?", [result.insertId]);
  res.status(201).json(mapRow(rows[0]));
}

export async function updateAnnouncement(req, res) {
  const announcementId = Number(req.params.id);
  if (!announcementId) return res.status(400).json({ error: "A valid announcement id is required" });

  const { requesterId, title, body, category, pinned, section: requestedSection } = req.body;

  if (!title?.trim() || !body?.trim()) {
    return res.status(400).json({ error: "title and body are required" });
  }
  if (category && !VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of ${VALID_CATEGORIES.join(", ")}` });
  }

  const requester = await getRequester(requesterId);
  if (!requester) {
    return res.status(400).json({ error: "A valid requesterId is required" });
  }
  if (requester.role !== "teacher" && requester.role !== "admin") {
    return res.status(403).json({ error: "Only teacher or admin accounts can manage announcements" });
  }

  const [existingRows] = await pool.query("SELECT section FROM announcements WHERE id = ?", [announcementId]);
  if (existingRows.length === 0) {
    return res.status(404).json({ error: "Announcement not found" });
  }
  // A teacher can only reach posts already in their own section — checked
  // against the DB row, not anything the client sent.
  if (requester.role === "teacher" && existingRows[0].section !== requester.section) {
    return res.status(403).json({ error: "You can only manage announcements in your own section" });
  }

  const section = resolveSection(requester, requestedSection);

  await pool.query(
    `UPDATE announcements SET title = ?, body = ?, category = ?, pinned = ?, section = ? WHERE id = ?`,
    [title.trim(), body.trim(), category || "General", Boolean(pinned), section, announcementId],
  );

  const [rows] = await pool.query("SELECT * FROM announcements WHERE id = ?", [announcementId]);
  res.json(mapRow(rows[0]));
}

export async function deleteAnnouncement(req, res) {
  const announcementId = Number(req.params.id);
  if (!announcementId) return res.status(400).json({ error: "A valid announcement id is required" });

  const requester = await getRequester(req.body.requesterId);
  if (!requester) {
    return res.status(400).json({ error: "A valid requesterId is required" });
  }
  if (requester.role !== "teacher" && requester.role !== "admin") {
    return res.status(403).json({ error: "Only teacher or admin accounts can manage announcements" });
  }

  const [existingRows] = await pool.query("SELECT section FROM announcements WHERE id = ?", [announcementId]);
  if (existingRows.length === 0) {
    return res.status(404).json({ error: "Announcement not found" });
  }
  if (requester.role === "teacher" && existingRows[0].section !== requester.section) {
    return res.status(403).json({ error: "You can only manage announcements in your own section" });
  }

  await pool.query("DELETE FROM announcements WHERE id = ?", [announcementId]);
  res.json({ success: true });
}
