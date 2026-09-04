-- Run against fmc_kcdc_lms after the existing migrations.
-- Gift notifications belong to a participant and retain their acknowledgement state.

CREATE TABLE IF NOT EXISTS gifts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  created_by INT NOT NULL,
  sponsor VARCHAR(150) NULL DEFAULT NULL,
  sponsor_id INT NULL DEFAULT NULL,
  item VARCHAR(255) NOT NULL,
  note TEXT,
  date_received DATE NOT NULL,
  status ENUM('Awaiting', 'Acknowledged') NOT NULL DEFAULT 'Awaiting',
  seen_at DATETIME NULL,
  acknowledged_at DATETIME NULL,
  last_reminded_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (sponsor_id) REFERENCES sponsors(id) ON DELETE SET NULL,
  INDEX gifts_student_status (student_id, status),
  INDEX gifts_date_received (date_received)
);