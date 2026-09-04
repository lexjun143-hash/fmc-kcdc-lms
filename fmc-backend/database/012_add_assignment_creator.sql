-- Run this in phpMyAdmin against fmc_kcdc_lms, AFTER 011_add_can_create_admin.sql.
--
-- Tracks who actually created each assignment, separately from the
-- existing free-text `teacher_name` (which is just "whose name to show
-- students/staff as the author" and, for an admin-created assignment, is
-- whatever name the admin typed in — not necessarily an account at all).
-- created_by/created_by_role is what the notification-routing split
-- (notificationController.getStaffNotifications) actually keys off:
--   - an admin's notification bell only shows assignments where
--     created_by_role = 'admin' AND created_by = that admin's own
--     participant_id — never another admin's, never a teacher's.
--   - a teacher's bell only shows their own section's assignments where
--     created_by_role = 'teacher' — an admin-created assignment posted
--     into that teacher's section still appears in the student's list
--     and the teacher's own Manage Assignment page as before, it just
--     never raises a notification for the teacher.
--
-- Nullable, and existing rows are left NULL rather than backfilled —
-- there's no reliable way to recover "who created this" for assignments
-- that predate this column (teacher_name is a display label, not
-- necessarily the creator's own account). A NULL-creator row simply
-- never appears in anyone's notification bell going forward; it's
-- unaffected everywhere else (student assignment lists, Manage
-- Assignment pages, etc.).

ALTER TABLE assignments
  ADD COLUMN created_by VARCHAR(20) NULL,
  ADD COLUMN created_by_role ENUM('admin', 'teacher') NULL;
