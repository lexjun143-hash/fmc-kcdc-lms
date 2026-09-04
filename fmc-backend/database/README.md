# Database setup

## Fresh install

Run, in order:

```
schema.sql
003_nullable_assignment_teacher.sql
004_add_announcements.sql
005_add_sections.sql
006_add_submission_status.sql
007_add_login_lockout.sql
008_add_student_details.sql
009_add_theme_pref.sql
010_add_letters.sql
011_add_can_create_admin.sql
012_add_assignment_creator.sql
015_add_letter_seen.sql
```

**Skip `002_add_users_auth.sql`.** It is not part of this sequence — see
below.

## What `002_add_users_auth.sql` actually is

`002` is a **legacy upgrade path**, not a migration step. It exists only
for databases created from an older version of this project, back when
accounts lived in a separate `students` table instead of `users`.
`schema.sql` already creates the current `users` table, so `002` and
`schema.sql` are two _alternative_ starting points — never both.

Running `002` after `schema.sql` used to be actively harmful: `002`
drops `submissions` and `submission_files` unconditionally, then tries
to `CREATE TABLE users`, which already exists — the script errors out
right there, before it can recreate the two tables it just dropped. If
you ever end up with a database missing `submissions`/
`submission_files` because of this, run
`013_restore_submissions_tables.sql` to restore them (it's idempotent —
safe to run even if the tables already exist).

`002` now guards its `users` table creation with
`CREATE TABLE IF NOT EXISTS`, so this specific failure can no longer
happen even if it's run by mistake — but it should still never be part
of a normal fresh install.

## If you're upgrading an old `students`-table database

Run `002_add_users_auth.sql` instead of `schema.sql`, then continue
with `003` onward as above.
