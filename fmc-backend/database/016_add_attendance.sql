-- Attendance tracking for student check-ins and teacher-set windows.
-- Run this once against the same database used by the LMS backend.

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  section VARCHAR(50) NOT NULL,
  start_at DATETIME NOT NULL,
  end_at DATETIME NOT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_section_start (section, start_at),
  CONSTRAINT fk_attendance_session_creator
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  user_id INT NOT NULL,
  status ENUM('present', 'late', 'excused', 'absent') NOT NULL DEFAULT 'absent',
  checked_in_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_session_user (session_id, user_id),
  KEY idx_session_id (session_id),
  KEY idx_user_id (user_id),
  CONSTRAINT fk_attendance_record_session
    FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_record_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
