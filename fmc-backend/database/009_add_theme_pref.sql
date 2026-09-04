-- Run this in phpMyAdmin against fmc_kcdc_lms, AFTER 008_add_student_details.sql.
--
-- Adds a per-account UI theme preference. Deliberately not tied to role —
-- every account (student/teacher/admin) can set its own light/dark
-- preference regardless of what it's otherwise allowed to edit on its own
-- row (a student is view-only for profile fields, but theme is a UI
-- preference, not account information, and is written through a separate
-- endpoint — see userController.updateThemePref).

ALTER TABLE users
  ADD COLUMN theme_pref ENUM('light', 'dark') NOT NULL DEFAULT 'light';
