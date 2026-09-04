-- Run this in phpMyAdmin against fmc_kcdc_lms, AFTER 014_add_gifts.sql.
-- Stores the most recent time a participant opened a letter so admins can track
-- revisits and revised submissions.

ALTER TABLE letters
  ADD COLUMN seen_at DATETIME NULL;