-- Run this in phpMyAdmin against fmc_kcdc_lms, AFTER 007_add_login_lockout.sql.
--
-- Adds the full student-info fields to `users`. `name` (existing column)
-- stays the single combined display name used everywhere else in the app
-- (sidebar, assignment/announcement author strings, submission listings,
-- etc.) — it's derived from first/middle/last on create/edit rather than
-- typed separately, so nothing else in the codebase that already reads
-- users.name needs to change. `age` is stored as entered but the detail
-- view computes and displays age from birthdate instead, so it never goes
-- stale — see src/utils/age.js. height/weight are free-text (not a fixed
-- numeric unit) since the app never asked for a specific unit system.
-- Nullable throughout: only ever populated by the student create/edit
-- flow — teacher/admin rows leave these columns NULL.

ALTER TABLE users
  ADD COLUMN first_name VARCHAR(100) NULL,
  ADD COLUMN middle_name VARCHAR(100) NULL,
  ADD COLUMN last_name VARCHAR(100) NULL,
  ADD COLUMN age INT NULL,
  ADD COLUMN birthdate DATE NULL,
  ADD COLUMN school VARCHAR(150) NULL,
  ADD COLUMN grade_level VARCHAR(50) NULL,
  ADD COLUMN home_address VARCHAR(255) NULL,
  ADD COLUMN height VARCHAR(20) NULL,
  ADD COLUMN weight VARCHAR(20) NULL;
