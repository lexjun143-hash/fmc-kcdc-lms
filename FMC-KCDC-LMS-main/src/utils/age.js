// Age is stored as whatever was typed at create/edit time (users.age),
// but displayed here computed fresh from birthdate — so it never goes
// stale just because nobody remembered to bump it every year.
export function computeAge(birthdate) {
  if (!birthdate) return null;
  const dob = new Date(birthdate.length === 10 ? `${birthdate}T00:00:00` : birthdate);
  if (Number.isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}
