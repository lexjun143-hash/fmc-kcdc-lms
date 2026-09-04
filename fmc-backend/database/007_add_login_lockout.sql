-- Run this in phpMyAdmin against fmc_kcdc_lms, AFTER 006_add_submission_status.sql.
--
-- Tracks consecutive failed login attempts per account. After 5 wrong
-- passwords in a row, lock_until is set 5 minutes into the future
-- (authController.js) and login is rejected until it passes, even with
-- the correct password. A successful login (or the lock naturally
-- expiring) resets both columns back to their defaults.

ALTER TABLE users
  ADD COLUMN failed_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN lock_until DATETIME NULL;
