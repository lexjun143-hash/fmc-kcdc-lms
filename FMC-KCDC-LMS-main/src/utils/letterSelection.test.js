import test from "node:test";
import assert from "node:assert/strict";
import {
  getLatestLetterByStudent,
  groupLettersByStudent,
} from "./letterSelection.js";

test("keeps every letter in a student's history instead of collapsing to one", () => {
  const letters = [
    { studentId: 7, id: 100, quarter: "Older" },
    { studentId: 7, id: 200, quarter: "Newer" },
    { studentId: 9, id: 300, quarter: "Only one" },
  ];

  const grouped = groupLettersByStudent(letters);

  assert.deepEqual(
    grouped.get("7").map((letter) => letter.id),
    [200, 100],
  );
  assert.deepEqual(grouped.get("9").map((letter) => letter.id), [300]);
  assert.equal(grouped.size, 2);
});

test("latest-letter helper still returns only the newest record for compatibility", () => {
  const letters = [
    { studentId: 11, id: 500, quarter: "Older" },
    { studentId: 11, id: 501, quarter: "Newest" },
  ];

  const byStudent = getLatestLetterByStudent(letters);

  assert.equal(byStudent.get("11").id, 501);
});
