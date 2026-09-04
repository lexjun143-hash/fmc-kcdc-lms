-- Run this in phpMyAdmin against fmc_kcdc_lms, AFTER 009_add_theme_pref.sql.
--
-- Minimal `letters` table — ManageLetters.jsx / MyLetterWriting.jsx are
-- currently pure frontend mocks with hardcoded data; this is not the full
-- send/review sponsor-letters feature, just enough real schema for the
-- age-based cleanup job (services/cleanupService.js) to have something to
-- delete from. Columns mirror the frontend mock's fields (quarter, prompt,
-- status, body, feedback) and the same denormalized-`section`-string
-- convention `assignments` already uses (no FK to a sections table).
--
-- `due_date` is the reply-due date for that letter cycle — same role as
-- assignments.due_date, and what the 2-month cleanup compares against.
-- `sponsor_letter_path`, like submission_files.file_path, points at an
-- uploaded file on disk that the cleanup job must fs.unlink() itself; the
-- DB row cleanup alone (ON DELETE CASCADE / this table's own DELETE)
-- never touches the filesystem.

CREATE TABLE letters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  section VARCHAR(50),
  quarter VARCHAR(100) NOT NULL,
  prompt TEXT,
  due_date DATE NOT NULL,
  status ENUM('New', 'Drafting', 'Submitted', 'Revise', 'Approved') NOT NULL DEFAULT 'New',
  body TEXT,
  feedback TEXT,
  sponsor_name VARCHAR(150),
  sponsor_country VARCHAR(100),
  sponsor_letter_text TEXT,
  sponsor_letter_path VARCHAR(500),
  submitted_at DATETIME,
  sent_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);
