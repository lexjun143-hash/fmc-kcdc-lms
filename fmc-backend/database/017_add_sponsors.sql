-- Normalize sponsor information into a dedicated sponsors table.
-- Run this after 016_add_attendance.sql.
-- This refactors sponsor data from being denormalized across letters, gifts, and user details
-- into a single source of truth for sponsor management and contact tracking.

CREATE TABLE IF NOT EXISTS sponsors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  country VARCHAR(100),
  since DATE DEFAULT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_sponsor_name_country (name, country),
  KEY idx_sponsor_name (name)
);

ALTER TABLE sponsors
  ADD COLUMN since DATE DEFAULT NULL;

-- Add sponsor_id to users table for one-to-one student-to-sponsor mapping
ALTER TABLE users
ADD COLUMN sponsor_id INT DEFAULT NULL,
ADD CONSTRAINT fk_user_sponsor
  FOREIGN KEY (sponsor_id) REFERENCES sponsors(id) ON DELETE SET NULL;

-- Add index for efficient sponsor lookups by student
CREATE INDEX idx_users_sponsor_id ON users(sponsor_id);

-- Optional: Add sponsor_id to letters table for historical tracking per letter
-- (in case a student's sponsor changes between letter cycles)
ALTER TABLE letters
ADD COLUMN sponsor_id INT DEFAULT NULL,
ADD CONSTRAINT fk_letter_sponsor
  FOREIGN KEY (sponsor_id) REFERENCES sponsors(id) ON DELETE SET NULL;

-- Optional: Add sponsor_id to gifts table for consistency.
-- Legacy gift rows created before the sponsor refactor may still have a required
-- `sponsor` text column, so allow it to remain nullable until the data is migrated.
ALTER TABLE gifts
  MODIFY COLUMN sponsor VARCHAR(150) NULL DEFAULT NULL;

ALTER TABLE gifts
  ADD COLUMN sponsor_id INT DEFAULT NULL;

ALTER TABLE gifts
  ADD CONSTRAINT fk_gift_sponsor
  FOREIGN KEY (sponsor_id) REFERENCES sponsors(id) ON DELETE SET NULL;
