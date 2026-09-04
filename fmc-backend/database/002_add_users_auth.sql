-- ⚠ LEGACY MIGRATION — do NOT run this after schema.sql. ⚠
--
-- This is an ALTERNATIVE starting point to schema.sql, only for
-- upgrading a database that was set up from an EARLIER version of this
-- project (back when there was a separate `students` table). It is not
-- a step in the normal migration sequence.
--
-- Fresh installs must use: schema.sql, then 003 through 012, SKIPPING
-- this file entirely — schema.sql already creates `users`,
-- `submissions`, and `submission_files` in their current shape.
--
-- Running this after schema.sql drops `submissions`/`submission_files`
-- and then fails on "Table 'users' already exists" before it can
-- recreate them, silently losing both tables (see
-- 013_restore_submissions_tables.sql, which repairs that exact damage).
-- CREATE TABLE users now uses IF NOT EXISTS so that specific failure
-- can no longer happen even if this file is mistakenly run twice — but
-- it is still legacy-only and should not be part of a fresh install.
--
-- Consolidates identity into one `users` table (student, teacher, and
-- admin accounts all live here, distinguished by `role`) and re-points
-- submissions at it instead of the old students-only table. This drops
-- the old `students` table and any test submissions tied to it — safe,
-- since that was only demo/test data.

DROP TABLE IF EXISTS submission_files;
DROP TABLE IF EXISTS submissions;
DROP TABLE IF EXISTS students;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  participant_id VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('student', 'teacher', 'admin') NOT NULL,
  section VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Same shape as before, except student_id now references users(id)
-- (only ever a user with role = 'student' in practice).
CREATE TABLE submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  assignment_id INT NOT NULL,
  student_id INT NOT NULL,
  comment TEXT,
  submitted_at DATETIME NOT NULL,
  won_reward BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY one_submission_per_student (assignment_id, student_id)
);

CREATE TABLE submission_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  submission_id INT NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INT NOT NULL,
  file_type VARCHAR(50),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
);

-- One demo login per role. Passwords are bcrypt hashes of:
--   student -> student123
--   teacher -> teacher123
--   admin   -> admin123
-- Change these before this ever goes anywhere real.
INSERT INTO users (participant_id, name, password, role, section) VALUES
  ('PH626-00001', 'Josh Lyle B. Evangelista', '$2b$10$gN9uVm0aTE6zgsszJC0KOOG9fB/Sa71TSn5EeN5W2lg7mOIVsFhCO', 'student', 'Section A'),
  ('PH626-00002', 'Ate Grace Villareal', '$2b$10$vePaKKSKjBiDb.uxVyvtBOlfq1DYTq16R8XBKdKIB7Nel/PTDNlme', 'teacher', NULL),
  ('PH626-00003', 'Admin User', '$2b$10$0z4.xkqJtMavSnHWqWaiqeNAtgsURzCpVx/kTXnzx8xXO7FGNpybW', 'admin', NULL);
