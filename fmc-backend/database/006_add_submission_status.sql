-- Run this in phpMyAdmin against fmc_kcdc_lms, AFTER 005_add_sections.sql.
--
-- Submissions are never blocked past due_date — a student can always
-- submit late. This column is the stored, single source of truth for
-- whether a given submission was on time or late (set once at submit
-- time in submissionController.js, never recomputed on read), and is
-- what the 2-late-submissions-per-student cap counts against.

ALTER TABLE submissions
  ADD COLUMN status ENUM('on_time', 'late') NOT NULL DEFAULT 'on_time';

-- Backfill existing rows from their assignment's due_date so history
-- already on disk isn't silently treated as on-time.
UPDATE submissions s
JOIN assignments a ON a.id = s.assignment_id
SET s.status = IF(s.submitted_at > a.due_date, 'late', 'on_time');
