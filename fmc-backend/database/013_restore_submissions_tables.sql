-- Restores `submissions` and `submission_files` if a fresh install
-- accidentally ran 002_add_users_auth.sql after schema.sql.
--
-- Why: 002_add_users_auth.sql is an ALTERNATIVE starting point to
-- schema.sql (upgrade path for the old setup that had a separate
-- `students` table), not a migration meant to run in sequence after it.
-- If it's run after schema.sql anyway, it DROPs submissions and
-- submission_files, then tries to CREATE TABLE users — which already
-- exists — and errors out on "Table 'users' already exists" before it
-- ever gets to recreate submissions/submission_files. Net effect: both
-- tables vanish.
--
-- This migration recreates them, with 006_add_submission_status.sql's
-- `status` column folded in directly, so 006 does not need to be run
-- separately after this. Both CREATE TABLEs use IF NOT EXISTS, so this
-- file is a safe no-op if the tables already exist correctly — it never
-- touches existing rows.

CREATE TABLE IF NOT EXISTS submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  assignment_id INT NOT NULL,
  student_id INT NOT NULL,
  comment TEXT,
  submitted_at DATETIME NOT NULL,
  won_reward BOOLEAN NOT NULL DEFAULT FALSE,
  status ENUM('on_time', 'late') NOT NULL DEFAULT 'on_time',
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY one_submission_per_student (assignment_id, student_id)
);

CREATE TABLE IF NOT EXISTS submission_files (
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
