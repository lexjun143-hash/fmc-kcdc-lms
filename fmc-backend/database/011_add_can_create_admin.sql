-- Run this in phpMyAdmin against fmc_kcdc_lms, AFTER 010_add_letters.sql.
--
-- Two-tier admin system: can_create_admin marks the primary/super admin
-- tier — only accounts with this set to TRUE may create further admin
-- accounts (see userController.createUser). Every other admin capability
-- (manage students/teachers/sections/assignments/letters/gifts/
-- announcements, delete, etc.) is identical regardless of tier; this flag
-- gates exactly one thing.
--
-- Every admin that already exists predates this two-tier system, so none
-- of them should lose capability just because this migration ran — they
-- are all grandfathered in as primary admins. Only admin accounts created
-- from this point on via the create-admin endpoint start restricted
-- (can_create_admin = FALSE is that endpoint's hardcoded default for any
-- admin it creates, never something the request body can override).

ALTER TABLE users
  ADD COLUMN can_create_admin BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE users SET can_create_admin = TRUE WHERE role = 'admin';
