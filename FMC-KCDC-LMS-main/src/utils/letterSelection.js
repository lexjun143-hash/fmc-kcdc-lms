export function groupLettersByStudent(letters) {
  const grouped = new Map();

  for (const letter of letters) {
    const key = String(letter.studentId ?? letter.student_id ?? "");
    if (!key) continue;

    const current = grouped.get(key) ?? [];
    current.push(letter);
    current.sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0));
    grouped.set(key, current);
  }

  return grouped;
}

export function getLatestLetterByStudent(letters) {
  const latestByStudent = new Map();
  const grouped = groupLettersByStudent(letters);

  for (const [studentId, studentLetters] of grouped) {
    latestByStudent.set(studentId, studentLetters[0]);
  }

  return latestByStudent;
}
