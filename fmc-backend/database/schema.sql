-- Run this in phpMyAdmin (or the mysql CLI) against a database named
-- fmc_kcdc_lms — create that database first if it doesn't exist yet:
CREATE DATABASE IF NOT EXISTS defaultdb;
  USE defaultdb;
--
-- Note: if you already ran an earlier version of this file (back when
-- there was a separate `students` table), run
-- database/002_add_users_auth.sql instead of re-running this one — it
-- migrates you to the `users` table below without starting over.

-- One identity table for everyone who can log in — students, teachers,
-- and admins — distinguished by `role`. Login is by `participant_id`
-- (e.g. "PH626-00001"), not email.
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  participant_id VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('student', 'teacher', 'admin') NOT NULL,
  section VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  section VARCHAR(50),
  teacher_name VARCHAR(150) NOT NULL,
  instructions TEXT,
  due_date DATETIME NOT NULL,
  points INT DEFAULT 0,
  reward_limit INT DEFAULT NULL,
  reward_label VARCHAR(255) DEFAULT NULL,
  reward_claimed INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

INSERT INTO assignments
  (title, category, section, teacher_name, instructions, due_date, points, reward_limit, reward_label, reward_claimed)
VALUES
  ('Values Formation Reflection Paper', 'Christian Living Education', 'Section A', 'Ate Grace Villareal',
   'Write a one-page reflection on this month''s theme, ''Bayanihan and Community.'' Relate it to an experience you''ve had at the center. Attach a scanned or photographed copy of your handwritten paper, or a typed document.',
   '2026-07-20 17:00:00', 20, 5, 'Extra merit points + shoutout at Center Day', 3),

  ('Basic Math Worksheet — Fractions', 'Academic Support', 'Section A', 'Sir Jerome Padilla',
   'Complete items 1-20 on the fractions worksheet. Show your solution for each item, not just the final answer.',
   '2026-07-10 17:00:00', 50, 10, 'Bonus sticker on your progress chart', 4),

  ('Reading Log — Week 3', 'Academic Support', 'Section A', 'Sir Jerome Padilla',
   'Log at least 3 books or stories you read this week with a two-sentence summary for each.',
   '2026-07-24 17:00:00', 15, 3, 'Pick from the prize box', 3);
