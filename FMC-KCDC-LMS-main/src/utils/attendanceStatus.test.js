import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeAttendanceStatus,
  normalizeStudentAttendance,
  pickBestAttendanceStatus,
} from "./attendanceStatus.js";

test("normalizeAttendanceStatus maps teacher and student status values to one canonical set", () => {
  assert.equal(normalizeAttendanceStatus("ontime"), "present");
  assert.equal(normalizeAttendanceStatus("present"), "present");
  assert.equal(normalizeAttendanceStatus("late"), "late");
  assert.equal(normalizeAttendanceStatus("none"), "absent");
  assert.equal(normalizeAttendanceStatus("absent"), "absent");
  assert.equal(normalizeAttendanceStatus(undefined), "absent");
});

test("normalizeStudentAttendance keeps the roster entry safe for the monitor table", () => {
  const normalized = normalizeStudentAttendance({
    name: "Ana Reyes",
    status: "ontime",
    timeIn: "08:15 AM",
  });

  assert.deepEqual(normalized, {
    name: "Ana Reyes",
    status: "present",
    timeIn: "08:15 AM",
  });
});

test("pickBestAttendanceStatus prefers checked-in statuses over stale absent records on the same date", () => {
  assert.equal(
    pickBestAttendanceStatus(["absent", "present", "late"]),
    "present",
  );
  assert.equal(
    pickBestAttendanceStatus(["absent", "excused", "absent"]),
    "excused",
  );
});
