import { useEffect, useState } from "react";
import { fetchSections } from "../api/sections";

// Every Section <select> in the app (Manage Students, Manage Teachers,
// the assignment Section picker, the announcement Section picker) loads
// its options from here instead of a hardcoded list — add a section in
// Manage Sections and it shows up everywhere on next load, no code
// change needed. Returns just the name strings, matching how those
// dropdowns already consumed a flat array before this existed.
export function useSections() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchSections()
      .then((data) => {
        if (!cancelled) setSections(data.map((s) => s.name));
      })
      .catch(() => {
        if (!cancelled) setSections([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { sections, loading };
}
