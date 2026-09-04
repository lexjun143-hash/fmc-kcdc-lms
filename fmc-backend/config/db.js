import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  // Without this, mysql2 turns every DATE/DATETIME/TIMESTAMP column into a
  // JS Date by assuming the naive DB string ("2026-08-10 17:00:00", no
  // timezone marker) is in *this process's* local timezone, then Express's
  // res.json() re-serializes that Date as a UTC "...Z" string — a silent
  // conversion that only looked correct in dev because this machine's OS
  // timezone happens to already be UTC+8. dateStrings:true skips all of
  // that: due_date/submitted_at/etc. come back as the exact
  // "YYYY-MM-DD HH:mm:ss" string MySQL stored, untouched. All PH-time
  // interpretation now happens explicitly in one place — src/utils/phDate.js
  // on the frontend, fmc-backend/utils/format.js on the backend — instead
  // of being silently assumed by whatever timezone a machine happens to be
  // running in.
  dateStrings: true,
});

export default pool;
