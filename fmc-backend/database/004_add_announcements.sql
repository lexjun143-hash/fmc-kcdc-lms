-- Run this in phpMyAdmin against fmc_kcdc_lms, AFTER 003_nullable_assignment_teacher.sql.
--
-- Backs "Post Announcement" (admin/teacher) and "My Announcements"
-- (student). `section` is nullable on purpose: NULL means "all sections"
-- (an admin-only global post) — a teacher's own posts are always stamped
-- with their own section, never NULL, enforced server-side in
-- announcementController.js, never trusted from the client.

CREATE TABLE announcements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  category ENUM('Urgent', 'Event', 'Schedule', 'General') NOT NULL DEFAULT 'General',
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  section VARCHAR(50) NULL,
  posted_by_name VARCHAR(150) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
