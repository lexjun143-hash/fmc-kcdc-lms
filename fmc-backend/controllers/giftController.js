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

function mapRow(gift, requester) {
  const mappedGift = {
    id: gift.id,
    studentId: gift.student_id,
    studentName: gift.student_name,
    section: gift.section,
    sponsor: {
      id: gift.sponsor_id || null,
      name: gift.sponsor_name || "Sponsor",
      country: gift.sponsor_country || "",
    },
    item: gift.item,
    note: gift.note,
    dateReceived: gift.date_received,
    status: gift.status,
    acknowledgedAt: gift.acknowledged_at,
    lastRemindedAt: gift.last_reminded_at,
  };
  if (requester?.role === "admin") mappedGift.seenAt = gift.seen_at;
  return mappedGift;
}

const giftSelect = `
  SELECT g.*, u.name AS student_name, u.section, s.id AS sponsor_id, s.name AS sponsor_name, s.country AS sponsor_country
  FROM gifts g 
  JOIN users u ON u.id = g.student_id
  LEFT JOIN sponsors s ON s.id = g.sponsor_id`;

export async function getGifts(req, res) {
  const requester = await getRequester(req.query.requesterId);
  if (!requester)
    return res.status(400).json({ error: "A valid requesterId is required" });

  let sql = giftSelect;
  const params = [];
  if (requester.role === "student") {
    sql += " WHERE g.student_id = ?";
    params.push(requester.id);
  } else if (requester.role !== "admin") {
    return res
      .status(403)
      .json({ error: "Only students and admins can view gifts" });
  }
  sql += " ORDER BY g.date_received DESC, g.created_at DESC";
  const [rows] = await pool.query(sql, params);
  res.json(rows.map((row) => mapRow(row, requester)));
}

export async function createGift(req, res) {
  const { requesterId, studentId, sponsorId, item, note, dateReceived } =
    req.body;
  const requester = await getRequester(requesterId);
  if (!requester)
    return res.status(400).json({ error: "A valid requesterId is required" });
  if (requester.role !== "admin")
    return res
      .status(403)
      .json({ error: "Only admins can send gift notifications" });
  if (!Number(studentId) || !sponsorId || !item?.trim() || !dateReceived) {
    return res.status(400).json({
      error: "studentId, sponsorId, item, and dateReceived are required",
    });
  }

  const [studentRows] = await pool.query(
    "SELECT id FROM users WHERE id = ? AND role = 'student'",
    [Number(studentId)],
  );
  if (studentRows.length === 0)
    return res.status(404).json({ error: "Student not found" });

  const [sponsorRows] = await pool.query(
    "SELECT id FROM sponsors WHERE id = ?",
    [sponsorId],
  );
  if (sponsorRows.length === 0)
    return res.status(404).json({ error: "Sponsor not found" });

  const [result] = await pool.query(
    `INSERT INTO gifts (student_id, created_by, sponsor_id, item, note, date_received)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      Number(studentId),
      requester.id,
      sponsorId,
      item.trim(),
      note?.trim() || null,
      dateReceived,
    ],
  );
  const [rows] = await pool.query(`${giftSelect} WHERE g.id = ?`, [
    result.insertId,
  ]);
  res.status(201).json(mapRow(rows[0], requester));
}

async function getGiftAndRequester(id, requesterId, res) {
  const requester = await getRequester(requesterId);
  if (!requester) {
    res.status(400).json({ error: "A valid requesterId is required" });
    return null;
  }
  const [rows] = await pool.query(`${giftSelect} WHERE g.id = ?`, [id]);
  if (rows.length === 0) {
    res.status(404).json({ error: "Gift not found" });
    return null;
  }
  const gift = rows[0];
  const allowed =
    requester.role === "admin" ||
    (requester.role === "student" && gift.student_id === requester.id);
  if (!allowed) {
    res.status(403).json({ error: "You are not allowed to change this gift" });
    return null;
  }
  return { gift, requester };
}

export async function markGiftSeen(req, res) {
  const id = Number(req.params.id);
  const result = await getGiftAndRequester(id, req.body.requesterId, res);
  if (!result) return;
  await pool.query(
    "UPDATE gifts SET seen_at = COALESCE(seen_at, NOW()) WHERE id = ?",
    [id],
  );
  const [rows] = await pool.query(`${giftSelect} WHERE g.id = ?`, [id]);
  res.json(mapRow(rows[0], result.requester));
}

export async function acknowledgeGift(req, res) {
  const id = Number(req.params.id);
  const result = await getGiftAndRequester(id, req.body.requesterId, res);
  if (!result) return;
  await pool.query(
    "UPDATE gifts SET status = 'Acknowledged', seen_at = COALESCE(seen_at, NOW()), acknowledged_at = COALESCE(acknowledged_at, NOW()) WHERE id = ?",
    [id],
  );
  const [rows] = await pool.query(`${giftSelect} WHERE g.id = ?`, [id]);
  res.json(mapRow(rows[0], result.requester));
}

export async function reopenGift(req, res) {
  const id = Number(req.params.id);
  const result = await getGiftAndRequester(id, req.body.requesterId, res);
  if (!result) return;
  if (result.requester.role !== "admin") {
    return res.status(403).json({ error: "Only admins can reopen gifts" });
  }
  await pool.query(
    "UPDATE gifts SET status = 'Awaiting', acknowledged_at = NULL WHERE id = ?",
    [id],
  );
  const [rows] = await pool.query(`${giftSelect} WHERE g.id = ?`, [id]);
  res.json(mapRow(rows[0], result.requester));
}

export async function remindGift(req, res) {
  const id = Number(req.params.id);
  const result = await getGiftAndRequester(id, req.body.requesterId, res);
  if (!result) return;
  if (result.requester.role !== "admin") {
    return res.status(403).json({ error: "Only admins can send reminders" });
  }
  await pool.query("UPDATE gifts SET last_reminded_at = NOW() WHERE id = ?", [
    id,
  ]);
  const [rows] = await pool.query(`${giftSelect} WHERE g.id = ?`, [id]);
  res.json(mapRow(rows[0], result.requester));
}
