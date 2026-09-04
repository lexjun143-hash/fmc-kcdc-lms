import pool from "../config/db.js";

async function getRequester(requesterId) {
  const id = Number(requesterId);
  if (!id) return null;
  const [rows] = await pool.query(
    "SELECT id, participant_id, role, section FROM users WHERE id = ?",
    [id],
  );
  return rows[0] || null;
}

export async function ensureAttendanceTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      section VARCHAR(50) NOT NULL,
      start_at DATETIME NOT NULL,
      end_at DATETIME NOT NULL,
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT NOT NULL,
      user_id INT NOT NULL,
      status ENUM('present', 'late', 'excused', 'absent') NOT NULL DEFAULT 'absent',
      checked_in_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_session_user (session_id, user_id),
      FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}

function formatDateTime(date) {
  return new Date(date).toISOString().slice(0, 19).replace("T", " ");
}

export async function createAttendanceSession(req, res) {
  const { requesterId, section, startDate, startTime, endDate, endTime } =
    req.body;

  const requester = await getRequester(requesterId);
  if (!requester) {
    return res.status(400).json({ error: "A valid requesterId is required" });
  }

  if (requester.role !== "teacher" && requester.role !== "admin") {
    return res
      .status(403)
      .json({ error: "Only teachers and admins can set attendance windows" });
  }

  if (requester.role === "teacher" && requester.section !== section) {
    return res
      .status(403)
      .json({ error: "Teachers can only set windows for their own section" });
  }

  if (!section || !startDate || !endDate || !startTime || !endTime) {
    return res
      .status(400)
      .json({
        error:
          "section, startDate, endDate, startTime, and endTime are required",
      });
  }

  const start = new Date(`${startDate}T${startTime}`);
  const end = new Date(`${endDate}T${endTime}`);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  ) {
    return res.status(400).json({ error: "End must be after the start time" });
  }

  const [result] = await pool.query(
    "INSERT INTO attendance_sessions (section, start_at, end_at, created_by) VALUES (?, ?, ?, ?)",
    [section, formatDateTime(start), formatDateTime(end), requester.id],
  );

  const [students] = await pool.query(
    "SELECT id FROM users WHERE role = 'student' AND section = ?",
    [section],
  );

  if (students.length > 0) {
    const values = students.map(({ id }) => [result.insertId, id, "absent"]);
    await pool.query(
      "INSERT INTO attendance_records (session_id, user_id, status) VALUES ?",
      [values],
    );
  }

  res.status(201).json({
    id: result.insertId,
    section,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  });
}

export async function getSectionAttendance(req, res) {
  const { section } = req.query;
  if (!section) {
    return res.status(400).json({ error: "section is required" });
  }

  const [students] = await pool.query(
    "SELECT id, participant_id, name FROM users WHERE role = 'student' AND section = ? ORDER BY name ASC",
    [section],
  );

  const [sessions] = await pool.query(
    "SELECT * FROM attendance_sessions WHERE section = ? ORDER BY start_at DESC",
    [section],
  );

  const sessionIds = sessions.map((session) => session.id);
  let records = [];
  if (sessionIds.length > 0) {
    const placeholders = sessionIds.map(() => "?").join(",");
    [records] = await pool.query(
      `SELECT * FROM attendance_records WHERE session_id IN (${placeholders}) ORDER BY session_id DESC, user_id ASC`,
      sessionIds,
    );
  }

  const recordsBySession = new Map();
  for (const record of records) {
    const list = recordsBySession.get(record.session_id) || [];
    list.push(record);
    recordsBySession.set(record.session_id, list);
  }

  const enrichedSessions = sessions.map((session) => {
    const entries = (recordsBySession.get(session.id) || []).reduce(
      (acc, record) => {
        const student = students.find((item) => item.id === record.user_id);
        acc[student?.name || `User ${record.user_id}`] = {
          status: record.status,
          timeIn: record.checked_in_at
            ? new Date(record.checked_in_at).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })
            : null,
        };
        return acc;
      },
      {},
    );

    return {
      id: session.id,
      section: session.section,
      startDate: new Date(session.start_at).toISOString().slice(0, 10),
      startTime: new Date(session.start_at).toTimeString().slice(0, 5),
      endDate: new Date(session.end_at).toISOString().slice(0, 10),
      endTime: new Date(session.end_at).toTimeString().slice(0, 5),
      roster: Object.fromEntries(
        students.map((student) => [
          student.name,
          entries[student.name] || { status: "absent", timeIn: null },
        ]),
      ),
    };
  });

  res.json({ students, sessions: enrichedSessions });
}

export async function getMyAttendance(req, res) {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  const [rows] = await pool.query(
    `SELECT s.id, s.section, s.start_at, s.end_at, r.status, r.checked_in_at
     FROM attendance_sessions s
     LEFT JOIN attendance_records r ON r.session_id = s.id AND r.user_id = ?
     WHERE s.section = (SELECT section FROM users WHERE id = ?)
     ORDER BY s.start_at DESC`,
    [userId, userId],
  );

  const sessions = rows.map((row) => ({
    id: row.id,
    section: row.section,
    startAt: row.start_at,
    endAt: row.end_at,
    status: row.status || "absent",
    checkedInAt: row.checked_in_at,
  }));

  const total = sessions.length;
  const present = sessions.filter(
    (session) => session.status === "present",
  ).length;
  const late = sessions.filter((session) => session.status === "late").length;
  const rate = total ? Math.round(((present + late) / total) * 100) : 0;

  let streak = 0;
  for (const session of [...sessions].sort(
    (a, b) => new Date(b.startAt) - new Date(a.startAt),
  )) {
    if (session.status === "present" || session.status === "late") {
      streak += 1;
    } else {
      break;
    }
  }

  res.json({
    sessions,
    stats: {
      total,
      rate,
      streak,
      present,
      late,
    },
  });
}

export async function checkInForSession(req, res) {
  const { requesterId } = req.body;
  if (!requesterId) {
    return res.status(400).json({ error: "requesterId is required" });
  }

  const requester = await getRequester(requesterId);
  if (!requester) {
    return res.status(400).json({ error: "A valid requesterId is required" });
  }

  const now = new Date();
  const [rows] = await pool.query(
    `SELECT * FROM attendance_sessions
     WHERE section = ?
       AND start_at <= ?
       AND end_at >= ?
     ORDER BY start_at DESC
     LIMIT 1`,
    [requester.section, formatDateTime(now), formatDateTime(now)],
  );

  if (!rows.length) {
    return res
      .status(400)
      .json({
        error: "There is no open attendance window for your section right now",
      });
  }

  const session = rows[0];
  const endTime = new Date(session.end_at);
  const status = now <= endTime ? "present" : "late";
  const checkedInAt = formatDateTime(now);

  await pool.query(
    `INSERT INTO attendance_records (session_id, user_id, status, checked_in_at)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE status = VALUES(status), checked_in_at = VALUES(checked_in_at)`,
    [session.id, requester.id, status, checkedInAt],
  );

  res.json({
    id: session.id,
    section: session.section,
    status,
    checkedInAt,
  });
}
