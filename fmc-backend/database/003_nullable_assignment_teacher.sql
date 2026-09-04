-- Run this in phpMyAdmin against fmc_kcdc_lms, AFTER 002_add_users_auth.sql.
--
-- assignments.teacher_name was NOT NULL, which meant deleting a teacher
-- account had to either leave a dangling name string or destroy their
-- assignments outright. Making it nullable lets deleteUser (Manage
-- Teachers) null out just the teacher reference on delete, keeping the
-- assignment and every student's submissions/files intact.

ALTER TABLE assignments MODIFY teacher_name VARCHAR(150) NULL;
