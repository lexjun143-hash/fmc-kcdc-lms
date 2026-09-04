import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cron from "node-cron";
import pool from "./config/db.js";
import announcementsRouter from "./routes/announcements.js";
import giftsRouter from "./routes/gifts.js";
import lettersRouter from "./routes/letters.js";
import assignmentsRouter from "./routes/assignments.js";
import authRouter from "./routes/auth.js";
import notificationsRouter from "./routes/notifications.js";
import sectionsRouter from "./routes/sections.js";
import usersRouter from "./routes/users.js";
import attendanceRouter from "./routes/attendance.js";
import { runCleanup } from "./services/cleanupService.js";

dotenv.config();

const app = express();

// Explicit allow-list rather than a bare cors() (which reflects any
// Origin back and technically already "works") — this names exactly
// which frontends are expected to call this API. Both Vite ports are
// listed because Vite falls back to 5174 whenever 5173 is already taken
// (e.g. a previous dev server still running), and that fallback should
// never look like a CORS failure. Add the real deployed frontend origin
// here too once this stops being local-only.
const allowedOrigins = ["http://localhost:5173", "http://localhost:5174"];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  }),
);
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// Fired once at startup, not awaited — app.listen() below doesn't wait on
// this, so a slow/unreachable DB never delays the server actually binding
// the port. But it's the one thing that turns "the server is up" and "the
// server can actually talk to fmc_kcdc_lms" from an assumption into a
// logged fact, checked immediately rather than discovered on the first
// request a user happens to make.
pool
  .query("SELECT 1")
  .then(() => {
    console.log(
      `✓ Connected to MySQL database "${process.env.DB_NAME}" at ${process.env.DB_HOST}:${process.env.DB_PORT}`,
    );
  })
  .catch((err) => {
    console.error(
      `✗ Could not connect to MySQL database "${process.env.DB_NAME}" at ${process.env.DB_HOST}:${process.env.DB_PORT} — ` +
        `is XAMPP's MySQL running, and are DB_USER/DB_PASSWORD/DB_NAME in .env correct? (${err.code || err.message})`,
    );
  });

app.use("/api/announcements", announcementsRouter);
app.use("/api/gifts", giftsRouter);
app.use("/api/letters", lettersRouter);
app.use("/api/assignments", assignmentsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/sections", sectionsRouter);
app.use("/api/users", usersRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api", authRouter);

// Express 5 auto-forwards a rejected promise from any async route handler
// here (unlike Express 4, which needed each handler wrapped by hand) —
// verified directly: a DB connection failure inside a controller lands
// here and gets a normal JSON response, not a crashed process. This was
// still returning 400 with `err.message`, though, which is wrong on both
// counts for the errors that actually reach it: every *expected* failure
// (bad input, not found, permission denied, ...) is already handled
// inside its own controller with its own res.status(...).json(...) and
// never gets here at all — only genuinely unexpected errors do (a lost DB
// connection, a bug), which is a 500, not a 400. And some of those
// (e.g. mysql2's connection-refused AggregateError) have an empty
// `.message`, which meant the client saw `{"error":""}` — silently
// useless for debugging exactly the kind of "everything is failing"
// problem this exists to surface.
app.use((err, req, res, next) => {
  console.error(err);
  res
    .status(500)
    .json({ error: err.message || err.code || "Internal server error" });
});

// Daily maintenance sweep — deletes assignments/letters more than 2
// months past their due date (services/cleanupService.js), same job
// authController.login also fires on an admin login for the "simplest for
// thesis" path. `timezone: "Asia/Manila"` makes node-cron itself evaluate
// "3 AM" in Philippine wall time regardless of what timezone this server
// process/host happens to run in — not something left to a manual offset.
// This is the only place a schedule triggers it; nothing here is
// reachable from a client request.
cron.schedule(
  "0 3 * * *",
  () => {
    runCleanup().catch((err) =>
      console.error("[cleanup] daily run failed:", err),
    );
  },
  { timezone: "Asia/Manila" },
);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`fmc-backend listening on http://localhost:${PORT}`);
});
