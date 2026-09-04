import bcrypt from "bcrypt";
import fs from "fs/promises";
import pool from "../config/db.js";
import { normalizeSponsorPayload } from "../utils/sponsor.js";

const VALID_ROLES = ["student", "teacher", "admin"];

// There's no session/JWT in this app — every write that needs to know
// "who is making this request" is handed a numeric `requesterId` by the
// client (same convention as getTeacherOverview/getNotifications), and
// resolves that id's role server-side. Never trust a role string sent
// directly from the client.
async function getRequester(requesterId) {
  const id = Number(requesterId);
  if (!id) return null;
  const [rows] = await pool.query(
    "SELECT id, participant_id, role, section, can_create_admin FROM users WHERE id = ?",
    [id],
  );
  return rows[0] || null;
}

// Students are created/edited with separate First/Middle/Last name
// fields; teacher/admin accounts (their own simpler create forms) still
// send a single `name`. Either is accepted — the one combined display
// name every other part of the app already reads (sidebar, assignment
// author, submission listings, ...) is always derived from whichever was
// actually provided, so nothing else needed to change.
function computeName({ name, firstName, middleName, lastName }) {
  const hasNameParts = firstName?.trim() || lastName?.trim();
  if (!hasNameParts) return name?.trim() || null;
  return [firstName, middleName, lastName]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");
}

async function upsertSponsorFromUser(
  { sponsorId, sponsorName, sponsorCountry, sponsorSince } = {},
  connection = pool,
) {
  const normalized = normalizeSponsorPayload({
    sponsorId,
    sponsorName,
    sponsorCountry,
    sponsorSince,
  });

  if (!normalized) return null;

  if (normalized.sponsorId) {
    const [rows] = await connection.query(
      "SELECT id FROM sponsors WHERE id = ?",
      [normalized.sponsorId],
    );
    return rows.length ? rows[0].id : null;
  }

  const matchName = normalized.name || null;
  const matchCountry = normalized.country || null;

  if (matchName) {
    const [rows] = await connection.query(
      "SELECT id FROM sponsors WHERE name = ? AND (? IS NULL OR country = ?)",
      [matchName, matchCountry, matchCountry],
    );
    if (rows.length) return rows[0].id;
  }

  const [result] = await connection.query(
    `INSERT INTO sponsors (name, country, since)
     VALUES (?, ?, ?)`,
    [matchName, matchCountry, normalized.since || null],
  );

  return result.insertId;
}

export async function createUser(req, res) {
  const {
    requesterId,
    participantId,
    name,
    firstName,
    middleName,
    lastName,
    age,
    birthdate,
    school,
    gradeLevel,
    homeAddress,
    height,
    weight,
    sponsorId,
    sponsorName,
    sponsorCountry,
    sponsorSince,
    password,
    role = "student",
    section,
  } = req.body;

  const requester = await getRequester(requesterId);
  if (!requester) {
    return res.status(400).json({ error: "A valid requesterId is required" });
  }

  const isAdmin = requester.role === "admin";
  const isTeacher = requester.role === "teacher";
  if (!isAdmin && !isTeacher) {
    return res
      .status(403)
      .json({ error: "Only admins and teachers can create accounts" });
  }
  // Teachers may only create student accounts, and only in their own
  // section — role and section are both forced from the teacher's own
  // users row below, never taken from the request body.
  if (isTeacher && role && role !== "student") {
    return res
      .status(403)
      .json({ error: "Teachers can only create student accounts" });
  }
  if (isTeacher && !requester.section) {
    return res
      .status(400)
      .json({ error: "Your account has no section assigned" });
  }
  // Two-tier admin system: only a primary admin (can_create_admin = true)
  // may create another admin account. Every admin created through this
  // endpoint is hardcoded to can_create_admin = false below regardless of
  // who created them or what the request body sends — the only way an
  // account ever becomes a primary admin is the DB migration that seeded
  // one, never this API.
  if (isAdmin && role === "admin" && !requester.can_create_admin) {
    return res
      .status(403)
      .json({ error: "Only a primary admin can create admin accounts" });
  }

  const computedName = computeName({ name, firstName, middleName, lastName });
  if (!participantId?.trim() || !computedName || !password) {
    return res
      .status(400)
      .json({ error: "participantId, name, and password are required" });
  }

  const effectiveRole = isTeacher ? "student" : role;
  const effectiveSection = isTeacher ? requester.section : section || null;
  if (!VALID_ROLES.includes(effectiveRole)) {
    return res
      .status(400)
      .json({ error: "role must be one of student, teacher, admin" });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const sponsorIdValue = await upsertSponsorFromUser(
      { sponsorId, sponsorName, sponsorCountry, sponsorSince },
      connection,
    );

    // can_create_admin is always false here — never a value the request
    // can set, regardless of role. The only accounts with it true are
    // whichever admin(s) the DB migration grandfathered in
    // (011_add_can_create_admin.sql); there is no API path that ever
    // grants it.
    const [result] = await connection.query(
      `INSERT INTO users
         (participant_id, name, first_name, middle_name, last_name, age, birthdate,
          school, grade_level, home_address, height, weight, password, role, section,
          sponsor_id, can_create_admin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
      [
        participantId.trim(),
        computedName,
        firstName?.trim() || null,
        middleName?.trim() || null,
        lastName?.trim() || null,
        age || null,
        birthdate || null,
        school?.trim() || null,
        gradeLevel?.trim() || null,
        homeAddress?.trim() || null,
        height?.trim() || null,
        weight?.trim() || null,
        passwordHash,
        effectiveRole,
        effectiveSection,
        sponsorIdValue ?? null,
      ],
    );

    await connection.commit();

    res.status(201).json({
      id: result.insertId,
      participantId: participantId.trim(),
      name: computedName,
      role: effectiveRole,
      section: effectiveSection,
      canCreateAdmin: false,
    });
  } catch (err) {
    await connection.rollback().catch(() => {});
    // participant_id is UNIQUE — surface a clear 409 instead of a raw
    // SQL error reaching the client.
    if (err.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ error: "That Participant ID is already taken" });
    }
    throw err;
  } finally {
    connection.release();
  }
}

function mapUserRow(u) {
  return {
    id: u.id,
    participantId: u.participant_id,
    name: u.name,
    role: u.role,
    section: u.section,
    sponsorId: u.sponsor_id ?? null,
    sponsorName: u.sponsor_name || "",
    sponsorCountry: u.sponsor_country || "",
    sponsor: u.sponsor_id
      ? {
          id: u.sponsor_id,
          name: u.sponsor_name || "",
          country: u.sponsor_country || "",
        }
      : null,
    canCreateAdmin: !!u.can_create_admin,
    createdAt: u.created_at,
  };
}

export async function getUsers(req, res) {
  const { role, requesterId, search } = req.query;

  if (role === "student") {
    // Never rely on the client to scope this — a teacher must only ever
    // see their own section's roster, resolved here from their own
    // account server-side, not a value they could pass in. Admins search
    // every section. `search` (if present) is an additional AND'd
    // condition on top of that scope, not a replacement for it.
    const requester = await getRequester(requesterId);
    if (!requester) {
      return res.status(400).json({ error: "A valid requesterId is required" });
    }

    const conditions = ["role = 'student'"];
    const params = [];

    if (requester.role === "teacher") {
      conditions.push("section = ?");
      params.push(requester.section);
    }

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push(
        "(first_name LIKE ? OR last_name LIKE ? OR middle_name LIKE ? OR participant_id LIKE ?)",
      );
      params.push(term, term, term, term);
    }

    const [rows] = await pool.query(
      `SELECT u.id, u.participant_id, u.name, u.role, u.section,
          u.sponsor_id, s.name AS sponsor_name, s.country AS sponsor_country,
          u.can_create_admin, u.created_at
       FROM users u LEFT JOIN sponsors s ON s.id = u.sponsor_id
       WHERE ${conditions.join(" AND ")} ORDER BY u.created_at DESC`,
      params,
    );
    return res.json(rows.map(mapUserRow));
  }

  const [rows] = await pool.query(
    role
      ? "SELECT u.id, u.participant_id, u.name, u.role, u.section, u.sponsor_id, s.name AS sponsor_name, s.country AS sponsor_country, u.can_create_admin, u.created_at FROM users u LEFT JOIN sponsors s ON s.id = u.sponsor_id WHERE u.role = ? ORDER BY u.created_at DESC"
      : "SELECT u.id, u.participant_id, u.name, u.role, u.section, u.sponsor_id, s.name AS sponsor_name, s.country AS sponsor_country, u.can_create_admin, u.created_at FROM users u LEFT JOIN sponsors s ON s.id = u.sponsor_id ORDER BY u.created_at DESC",
    role ? [role] : [],
  );

  // password is never selected above, let alone returned.
  res.json(rows.map(mapUserRow));
}

// Used by My Account pages to load the logged-in user's own current row
// (section, name, etc.) fresh from the DB instead of trusting whatever was
// cached in localStorage at login time.
export async function getUserById(req, res) {
  const { id } = req.params;

  const [rows] = await pool.query(
    "SELECT id, participant_id, name, role, section, theme_pref, can_create_admin, created_at FROM users WHERE id = ?",
    [id],
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: "User not found" });
  }

  const u = rows[0];
  res.json({
    id: u.id,
    participantId: u.participant_id,
    name: u.name,
    role: u.role,
    section: u.section,
    themePref: u.theme_pref,
    canCreateAdmin: !!u.can_create_admin,
    createdAt: u.created_at,
  });
}

// A theme preference is a UI setting, not "account information" — every
// role may set their own, including students, who are otherwise view-only
// on their own row (see updateUser's blanket student block above). This
// endpoint is self-only by construction: there is no target id/
// participantId in the URL, it always writes to whichever row
// `requesterId` resolves to server-side, so it can't be pointed at anyone
// else's account.
export async function updateThemePref(req, res) {
  const { requesterId, theme } = req.body;

  const requester = await getRequester(requesterId);
  if (!requester) {
    return res.status(400).json({ error: "A valid requesterId is required" });
  }
  if (theme !== "light" && theme !== "dark") {
    return res.status(400).json({ error: "theme must be 'light' or 'dark'" });
  }

  await pool.query("UPDATE users SET theme_pref = ? WHERE id = ?", [
    theme,
    requester.id,
  ]);
  res.json({ themePref: theme });
}

// Powers the clickable-name detail view in Manage Students. Returns every
// column, not just the summary shape getUsers/getUserById use. Gated
// beyond just "is this requester logged in" since it's materially more
// sensitive PII (birthdate, home address, physical measurements) than
// anything else this app exposes: admin sees anyone, a teacher only a
// student already in their own section, and a student can fetch their
// own row.
export async function getUserByParticipantId(req, res) {
  const { participantId } = req.params;

  const requester = await getRequester(req.query.requesterId);
  if (!requester) {
    return res.status(400).json({ error: "A valid requesterId is required" });
  }

  const [rows] = await pool.query(
    `SELECT u.*, s.id AS sponsor_id, s.name AS sponsor_name, s.country AS sponsor_country, s.since AS sponsor_since
     FROM users u
     LEFT JOIN sponsors s ON s.id = u.sponsor_id
     WHERE u.participant_id = ?`,
    [participantId],
  );
  if (rows.length === 0) {
    return res.status(404).json({ error: "User not found" });
  }
  const u = rows[0];

  const isSelf = requester.participant_id === participantId;
  const isAdmin = requester.role === "admin";
  const isOwningTeacher =
    requester.role === "teacher" && requester.section === u.section;
  if (!isSelf && !isAdmin && !isOwningTeacher) {
    return res
      .status(403)
      .json({ error: "Not authorized to view this account" });
  }

  res.json({
    id: u.id,
    participantId: u.participant_id,
    name: u.name,
    firstName: u.first_name,
    middleName: u.middle_name,
    lastName: u.last_name,
    age: u.age,
    birthdate: u.birthdate,
    school: u.school,
    gradeLevel: u.grade_level,
    homeAddress: u.home_address,
    height: u.height,
    weight: u.weight,
    role: u.role,
    section: u.section,
    sponsorId: u.sponsor_id ?? null,
    sponsorName: u.sponsor_name || "",
    sponsorCountry: u.sponsor_country || "",
    sponsorSince: u.sponsor_since || "",
    sponsor: u.sponsor_id
      ? {
          id: u.sponsor_id,
          name: u.sponsor_name || "",
          country: u.sponsor_country || "",
          since: u.sponsor_since || "",
        }
      : null,
    createdAt: u.created_at,
  });
}

// Only appends a SET clause when the field was actually present in the
// request body — omitted fields are left untouched rather than wiped to
// NULL, same rule updateUser already applied to section/password before
// this grew to cover the rest of the student-detail fields.
function addOptionalField(
  setClauses,
  values,
  body,
  jsField,
  sqlColumn,
  { trim = true } = {},
) {
  if (body[jsField] === undefined) return;
  const raw = body[jsField];
  setClauses.push(`${sqlColumn} = ?`);
  values.push(trim ? raw?.toString().trim() || null : raw || null);
}

// Self-edit (My Account, teacher/admin only) AND admin-edit-any-account
// AND teacher-edit-own-section-student share this one endpoint, keyed by
// participant_id — never by the opaque numeric id, and participant_id
// itself is never accepted into the SET clause below (it's the WHERE key
// only, and is permanently read-only once an account exists — the client
// can send it in the body and it will simply never be read).
export async function updateUser(req, res) {
  const { participantId } = req.params;
  const {
    requesterId,
    name,
    firstName,
    middleName,
    lastName,
    section,
    sponsorId,
    sponsorName,
    sponsorCountry,
    sponsorSince,
    password,
  } = req.body;

  const requester = await getRequester(requesterId);
  if (!requester) {
    return res.status(400).json({ error: "A valid requesterId is required" });
  }

  // Students are view-only, full stop — never allowed to update any row,
  // including their own. This is a blanket check on the requester's role
  // alone, independent of which participantId is targeted or what the
  // request body claims, so it can't be routed around by a hand-crafted
  // request "editing yourself".
  if (requester.role === "student") {
    return res
      .status(403)
      .json({ error: "Students cannot edit account information" });
  }

  // Fetched up front (not just at UPDATE time) because authorizing a
  // teacher's edit requires knowing the target's *current* role/section —
  // never a value carried on the request.
  const [targetRows] = await pool.query(
    "SELECT participant_id, role, section FROM users WHERE participant_id = ?",
    [participantId],
  );
  if (targetRows.length === 0) {
    return res.status(404).json({ error: "User not found" });
  }
  const target = targetRows[0];

  const isSelf = requester.participant_id === participantId;
  const isAdmin = requester.role === "admin";
  // A teacher may only edit a student who is currently in their own
  // section. Compared against the target's actual row, never against
  // anything the request claims.
  const isOwningTeacher =
    requester.role === "teacher" &&
    target.role === "student" &&
    target.section === requester.section;
  if (!isSelf && !isAdmin && !isOwningTeacher) {
    return res
      .status(403)
      .json({ error: "Not authorized to edit this account" });
  }

  const namePartsProvided =
    firstName !== undefined ||
    middleName !== undefined ||
    lastName !== undefined;
  const computedName = namePartsProvided
    ? computeName({ firstName, middleName, lastName })
    : name?.trim();
  if (!computedName) {
    return res.status(400).json({ error: "name is required" });
  }

  // Reassigning a section is admin-only. A teacher's request may still
  // carry a `section` field (e.g. the student's unchanged current value)
  // but it is never trusted/applied — same for a self-edit, which must
  // never be able to move its own account. password is optional — a
  // non-empty value resets it, an omitted/blank one leaves it untouched.
  const sectionProvided =
    Object.prototype.hasOwnProperty.call(req.body, "section") && isAdmin;
  const passwordProvided = typeof password === "string" && password.length > 0;
  if (passwordProvided && password.length < 6) {
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters" });
  }

  const setClauses = ["name = ?"];
  const values = [computedName];
  if (sectionProvided) {
    setClauses.push("section = ?");
    values.push(section || null);
  }
  if (passwordProvided) {
    setClauses.push("password = ?");
    values.push(await bcrypt.hash(password, 10));
  }
  addOptionalField(setClauses, values, req.body, "firstName", "first_name");
  addOptionalField(setClauses, values, req.body, "middleName", "middle_name");
  addOptionalField(setClauses, values, req.body, "lastName", "last_name");
  addOptionalField(setClauses, values, req.body, "age", "age", { trim: false });
  addOptionalField(setClauses, values, req.body, "birthdate", "birthdate", {
    trim: false,
  });
  addOptionalField(setClauses, values, req.body, "school", "school");
  addOptionalField(setClauses, values, req.body, "gradeLevel", "grade_level");
  addOptionalField(setClauses, values, req.body, "homeAddress", "home_address");
  addOptionalField(setClauses, values, req.body, "height", "height");
  addOptionalField(setClauses, values, req.body, "weight", "weight");

  const sponsorFieldsProvided = [
    "sponsorId",
    "sponsorName",
    "sponsorCountry",
    "sponsorSince",
  ].some((key) => Object.prototype.hasOwnProperty.call(req.body, key));

  if (sponsorFieldsProvided) {
    const sponsorIdValue = await upsertSponsorFromUser(
      { sponsorId, sponsorName, sponsorCountry, sponsorSince },
      pool,
    );
    setClauses.push("sponsor_id = ?");
    values.push(sponsorIdValue ?? null);
  }

  // participant_id is never in the SET list above — it's a WHERE key
  // only, and permanently read-only once an account exists. For a
  // teacher, the WHERE is also where their section scope is actually
  // enforced (defense in depth beyond the authorization check above): if
  // the student isn't (still) in their section, this simply touches zero
  // rows instead of updating anyone.
  let where = "participant_id = ?";
  values.push(participantId);
  if (isOwningTeacher) {
    where += " AND section = ? AND role = 'student'";
    values.push(requester.section);
  }

  const [result] = await pool.query(
    `UPDATE users SET ${setClauses.join(", ")} WHERE ${where}`,
    values,
  );

  if (result.affectedRows === 0) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json({
    participantId,
    name: computedName,
    ...(sectionProvided ? { section: section || null } : {}),
  });
}

// Admins can delete any account. Teachers can delete only a student
// currently in their own section (see the scope check below) — never a
// teacher or admin account, and never a student outside their section.
// Deletes the account and, via ON DELETE CASCADE on submissions.student_id,
// its own submissions and (transitively) their submission_files rows
// (relevant for a student). If the target is a teacher (only reachable by
// an admin requester), this deliberately does NOT touch their assignments
// or any student's submissions/files against them — teacher_name is
// nullable (003_nullable_assignment_teacher.sql) specifically so the
// assignments' teacher reference can just be cleared instead, keeping
// every student's work intact. assignments has no teacher_id FK (only a
// denormalized teacher_name, same best-effort-match limitation already
// noted in getTeacherOverview/notificationController), so "this teacher's
// assignments" is matched by name.
export async function deleteUser(req, res) {
  const { participantId } = req.params;
  const { requesterId } = req.body;

  const requester = await getRequester(requesterId);
  if (!requester) {
    return res.status(400).json({ error: "A valid requesterId is required" });
  }
  const isAdmin = requester.role === "admin";
  const isTeacher = requester.role === "teacher";
  if (!isAdmin && !isTeacher) {
    return res
      .status(403)
      .json({ error: "Only admins and teachers can delete accounts" });
  }
  if (requester.participant_id === participantId) {
    return res
      .status(400)
      .json({ error: "You cannot delete your own account" });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [targetRows] = await connection.query(
      "SELECT id, name, role, section, can_create_admin FROM users WHERE participant_id = ? FOR UPDATE",
      [participantId],
    );
    if (targetRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "User not found" });
    }
    const target = targetRows[0];

    // A teacher may only delete a student currently in their own section —
    // checked against the target's actual row, never anything the request
    // itself claims. Teachers can't reach the "target is a teacher"
    // branch below at all, since that requires target.role === "teacher".
    if (
      isTeacher &&
      (target.role !== "student" || target.section !== requester.section)
    ) {
      await connection.rollback();
      return res
        .status(403)
        .json({ error: "Not authorized to delete this account" });
    }

    // No one — not even another primary admin — can delete a primary
    // admin. This is absolute (unlike the rest of this function's checks,
    // which vary by requester role) and checked against the target's own
    // row, never trusting anything the request claims.
    if (target.can_create_admin) {
      await connection.rollback();
      return res
        .status(403)
        .json({ error: "The primary admin account cannot be deleted" });
    }

    // Collect any uploaded files this user's own submissions reference
    // (relevant for a student) before the cascade delete removes the DB
    // rows — submissions and submission_files cascade automatically
    // (ON DELETE CASCADE), but that only cleans up the rows, not the
    // actual files sitting in uploads/. Same pattern as
    // assignmentController.deleteAssignment.
    const [ownFiles] = await connection.query(
      `SELECT sf.file_path
       FROM submission_files sf
       JOIN submissions s ON s.id = sf.submission_id
       WHERE s.student_id = ?`,
      [target.id],
    );

    if (target.role === "teacher") {
      await connection.query(
        "UPDATE assignments SET teacher_name = NULL WHERE teacher_name = ?",
        [target.name],
      );
    }

    await connection.query("DELETE FROM users WHERE id = ?", [target.id]);

    await connection.commit();
    await Promise.all(
      ownFiles.map((f) => fs.unlink(f.file_path).catch(() => {})),
    );

    res.json({ success: true });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: "Failed to delete account" });
  } finally {
    connection.release();
  }
}
