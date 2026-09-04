-- Run this in phpMyAdmin against fmc_kcdc_lms, AFTER 004_add_announcements.sql.
--
-- Sections were hardcoded ["Section A".."Section D"] in the frontend in
-- several places (Manage Students, Manage Teachers, the assignment
-- Section picker, the announcement Section picker). This table becomes
-- the single source of truth those dropdowns load from — see
-- sectionController.js. users.section / assignments.section /
-- announcements.section stay plain VARCHAR (unchanged) rather than a real
-- FK, since they're already free-text everywhere else in this schema;
-- renaming a section here cascades the new name into all three of those
-- tables in the same transaction (see renameSection) so nothing is left
-- pointing at a name that no longer exists.

CREATE TABLE sections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migrates the sections the app already had hardcoded (A-D, not just the
-- A/B example) so every account/assignment/announcement already using one
-- of these names keeps resolving correctly.
INSERT INTO sections (name) VALUES ('Section A'), ('Section B'), ('Section C'), ('Section D');
