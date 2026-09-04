export function normalizeAttendanceStatus(status) {
  if (!status) return "absent";

  const normalized = String(status).trim().toLowerCase();

  switch (normalized) {
    case "ontime":
    case "present":
      return "present";
    case "late":
      return "late";
    case "none":
    case "absent":
    case "excused":
      return normalized === "excused" ? "excused" : "absent";
    default:
      return "absent";
  }
}

export function pickBestAttendanceStatus(statuses = []) {
  const normalized = statuses
    .map((status) => normalizeAttendanceStatus(status))
    .filter(Boolean);

  if (!normalized.length) return "absent";

  const priority = {
    present: 4,
    late: 3,
    excused: 2,
    absent: 1,
  };

  return [...normalized].sort(
    (a, b) => (priority[b] ?? 0) - (priority[a] ?? 0),
  )[0];
}

export function normalizeStudentAttendance(student) {
  const name = student?.name ?? "Unknown student";
  return {
    ...student,
    name,
    status: normalizeAttendanceStatus(student?.status),
  };
}
