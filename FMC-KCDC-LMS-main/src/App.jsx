import React, { useState, useRef, useEffect } from "react";
import { studentNav } from "./config/studentNav";
import { teacherNav } from "./config/teacherNav";
import { adminNav } from "./config/adminNav";
import Header from "./components/shared/Header";
import Sidebar from "./components/shared/Sidebar";
import Banner from "./components/shared/Banner";
import NotificationBar from "./components/shared/NotificationBar";
import NotificationFab from "./components/shared/NotificationFab";
import Login from "./pages/Login";
import { ThemeProvider } from "./context/ThemeContext";
import { getCurrentUser, logout } from "./api/auth";
import { fetchNotifications } from "./api/notifications";
import { fetchLetters } from "./api/letters";
import { fetchGifts } from "./api/gifts";
import { fetchAnnouncements } from "./api/announcements";

export default function OJTStudentPage() {
  const [user, setUser] = useState(() => getCurrentUser());
  const [activeItem, setActiveItem] = useState("My Account");
  // Below `lg` (1024px) this is a slide-in drawer that should start
  // closed; at `lg` and up it's a static column that should start
  // expanded. Read once at mount via matchMedia (not tracked on resize —
  // after mount this is the user's own manual toggle to control) so a
  // phone load doesn't open covering the whole screen, and a desktop load
  // doesn't start collapsed to icons for no reason.
  const [sidebarOpen, setSidebarOpen] = useState(
    () =>
      typeof window === "undefined" ||
      window.matchMedia("(min-width: 1024px)").matches,
  );
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [notifications, setNotifications] = useState(null);
  const [unreadLetterCount, setUnreadLetterCount] = useState(0);
  const [giftBadgeCount, setGiftBadgeCount] = useState(0);
  const [announcementBadgeCount, setAnnouncementBadgeCount] = useState(0);
  const [announcementIds, setAnnouncementIds] = useState([]);
  const [dismissedAnnouncementIds, setDismissedAnnouncementIds] = useState(
    () => {
      const currentUser = getCurrentUser();
      try {
        return JSON.parse(
          localStorage.getItem(
            `fmc_lms_dismissed_announcements_${currentUser?.id ?? "anonymous"}`,
          ) || "[]",
        );
      } catch {
        return [];
      }
    },
  );
  const [dismissedBadgeCounts, setDismissedBadgeCounts] = useState(() => {
    const currentUser = getCurrentUser();
    try {
      return JSON.parse(
        localStorage.getItem(
          `fmc_lms_dismissed_nav_badges_${currentUser?.id ?? "anonymous"}`,
        ) || "{}",
      );
    } catch {
      return {};
    }
  });
  const [giftResponseIds, setGiftResponseIds] = useState([]);
  const [dismissedGiftResponseIds, setDismissedGiftResponseIds] = useState(
    () => {
      try {
        return JSON.parse(
          localStorage.getItem("fmc_lms_dismissed_gift_responses") || "[]",
        );
      } catch {
        return [];
      }
    },
  );
  const fileInputRef = useRef(null);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setProfilePhoto(reader.result);
    reader.readAsDataURL(file);
  };

  function handleLoginSuccess(loggedInUser) {
    setActiveItem("My Account");
    setUser(loggedInUser);
  }

  function handleLogout() {
    logout();
    setUser(null);
  }

  useEffect(() => {
    function handleUserUpdated(event) {
      setUser(event.detail);
    }

    window.addEventListener("auth:user-updated", handleUserUpdated);
    return () =>
      window.removeEventListener("auth:user-updated", handleUserUpdated);
  }, []);

  useEffect(() => {
    try {
      setDismissedBadgeCounts(
        JSON.parse(
          localStorage.getItem(
            `fmc_lms_dismissed_nav_badges_${user?.id ?? "anonymous"}`,
          ) || "{}",
        ),
      );
    } catch {
      setDismissedBadgeCounts({});
    }
  }, [user?.id]);

  // Re-fetched on every nav change so badge counts and the notification
  // bar stay current as the user works (e.g. a teacher reviewing
  // submissions expects the "answered" count to catch up). Also re-fetched
  // immediately on a "notifications:refresh" event (dispatched by
  // src/api/assignments.js right after a successful submit/unsubmit, so a
  // student doesn't have to navigate away and back to see their own count
  // drop) and on window focus (so a teacher/admin who tabs back in sees
  // updated answered/total counts from students who submitted elsewhere —
  // there's no live push between sessions, so this is the closest
  // equivalent without adding websockets/polling).
  useEffect(() => {
    if (!user) {
      setNotifications(null);
      return;
    }

    let cancelled = false;
    function loadNotifications() {
      fetchNotifications(user.id)
        .then((data) => {
          if (!cancelled) setNotifications(data);
        })
        .catch(() => {
          if (!cancelled) setNotifications(null);
        });
    }

    loadNotifications();
    const refreshHandle = window.setInterval(loadNotifications, 30000);
    window.addEventListener("notifications:refresh", loadNotifications);
    window.addEventListener("focus", loadNotifications);

    return () => {
      cancelled = true;
      window.clearInterval(refreshHandle);
      window.removeEventListener("notifications:refresh", loadNotifications);
      window.removeEventListener("focus", loadNotifications);
    };
  }, [user, activeItem]);

  useEffect(() => {
    if (!user) {
      setUnreadLetterCount(0);
      return;
    }

    let cancelled = false;
    function loadUnreadLetters() {
      fetchLetters(user.id)
        .then((letters) => {
          if (cancelled) return;
          const count =
            user.role === "student"
              ? letters.filter(
                  (letter) =>
                    (letter.status === "New" || letter.status === "Revise") &&
                    !letter.seenAt,
                ).length
              : letters.filter((letter) => letter.status === "Submitted")
                  .length;
          setUnreadLetterCount(count);
        })
        .catch(() => {
          if (!cancelled) setUnreadLetterCount(0);
        });
    }

    loadUnreadLetters();
    const refreshHandle = window.setInterval(loadUnreadLetters, 30000);
    window.addEventListener("letters:refresh", loadUnreadLetters);
    window.addEventListener("focus", loadUnreadLetters);

    return () => {
      cancelled = true;
      window.clearInterval(refreshHandle);
      window.removeEventListener("letters:refresh", loadUnreadLetters);
      window.removeEventListener("focus", loadUnreadLetters);
    };
  }, [user]);

  useEffect(() => {
    try {
      setDismissedAnnouncementIds(
        JSON.parse(
          localStorage.getItem(
            `fmc_lms_dismissed_announcements_${user?.id ?? "anonymous"}`,
          ) || "[]",
        ),
      );
    } catch {
      setDismissedAnnouncementIds([]);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user || !["student", "admin"].includes(user.role)) {
      setGiftBadgeCount(0);
      return;
    }

    let cancelled = false;
    function loadGiftBadge() {
      fetchGifts(user.id)
        .then((gifts) => {
          if (cancelled) return;
          const responseIds = gifts
            .filter((gift) => gift.status === "Acknowledged")
            .map((gift) => gift.id);
          setGiftResponseIds(responseIds);
          const count =
            user.role === "admin"
              ? responseIds.filter(
                  (id) => !dismissedGiftResponseIds.includes(id),
                ).length
              : gifts.filter(
                  (gift) => gift.status === "Awaiting" && !gift.seenAt,
                ).length;
          setGiftBadgeCount(count);
        })
        .catch(() => {
          if (!cancelled) setGiftBadgeCount(0);
        });
    }

    loadGiftBadge();
    const refreshHandle = window.setInterval(loadGiftBadge, 30000);
    window.addEventListener("gifts:refresh", loadGiftBadge);
    window.addEventListener("focus", loadGiftBadge);

    return () => {
      cancelled = true;
      window.clearInterval(refreshHandle);
      window.removeEventListener("gifts:refresh", loadGiftBadge);
      window.removeEventListener("focus", loadGiftBadge);
    };
  }, [user, dismissedGiftResponseIds]);

  useEffect(() => {
    if (!user || user.role !== "student") {
      setAnnouncementBadgeCount(0);
      return;
    }

    let cancelled = false;
    function loadAnnouncementBadge() {
      fetchAnnouncements(user.id)
        .then((announcements) => {
          if (cancelled) return;
          const ids = announcements.map((announcement) => announcement.id);
          setAnnouncementIds(ids);
          setAnnouncementBadgeCount(
            ids.filter((id) => !dismissedAnnouncementIds.includes(id)).length,
          );
        })
        .catch(() => {
          if (!cancelled) setAnnouncementBadgeCount(0);
        });
    }

    loadAnnouncementBadge();
    const refreshHandle = window.setInterval(loadAnnouncementBadge, 30000);
    window.addEventListener("announcements:refresh", loadAnnouncementBadge);
    window.addEventListener("focus", loadAnnouncementBadge);

    return () => {
      cancelled = true;
      window.clearInterval(refreshHandle);
      window.removeEventListener(
        "announcements:refresh",
        loadAnnouncementBadge,
      );
      window.removeEventListener("focus", loadAnnouncementBadge);
    };
  }, [user, dismissedAnnouncementIds]);

  function handleSidebarBadgeClick(label) {
    const rawBadgeCount = Number(notifications?.badges?.[label] ?? 0);
    const currentCount = Number(sidebarBadges[label] ?? 0);
    const dismissalCount =
      label === "My Assignment" && user?.role === "student"
        ? Number(notifications?.count ?? 0)
        : label === "Manage Assignment" &&
            ["teacher", "admin"].includes(user?.role)
          ? submittedAssignmentCount
          : rawBadgeCount;
    if (currentCount <= 0 || dismissalCount <= 0) return;

    if (label !== "My Announcements") {
      setDismissedBadgeCounts((previous) => {
        const next = { ...previous, [label]: dismissalCount };
        localStorage.setItem(
          `fmc_lms_dismissed_nav_badges_${user?.id ?? "anonymous"}`,
          JSON.stringify(next),
        );
        return next;
      });
    }

    if (label === "Manage Gifts" && user?.role === "admin") {
      const dismissed = [
        ...new Set([...dismissedGiftResponseIds, ...giftResponseIds]),
      ];
      setDismissedGiftResponseIds(dismissed);
      localStorage.setItem(
        "fmc_lms_dismissed_gift_responses",
        JSON.stringify(dismissed),
      );
    }

    if (label === "My Announcements" && user?.role === "student") {
      const dismissed = [
        ...new Set([...dismissedAnnouncementIds, ...announcementIds]),
      ];
      setDismissedAnnouncementIds(dismissed);
      setAnnouncementBadgeCount(0);
      localStorage.setItem(
        `fmc_lms_dismissed_announcements_${user.id}`,
        JSON.stringify(dismissed),
      );
    }
  }

  if (!user) {
    return (
      <ThemeProvider user={user}>
        <Login onLoginSuccess={handleLoginSuccess} />
      </ThemeProvider>
    );
  }

  const role = user.role;

  // pick nav configuration by role
  const navConfig =
    role === "teacher" ? teacherNav : role === "admin" ? adminNav : studentNav;

  // determine active page component from selected nav; fallback to first
  const activePage =
    navConfig.find((n) => n.label === activeItem) ||
    navConfig.find((n) => n.label === "My Account") ||
    navConfig[0];

  const ActiveComponent = activePage.component || navConfig[0].component;

  const currentNav =
    navConfig.find((n) => n.label === activeItem) || navConfig[0];

  // derive banner from the active nav entry
  const banner = {
    title: currentNav.label,
    subtitle: currentNav.subtitle || "",
  };

  const submittedAssignmentCount =
    Number(
      notifications?.totalAnswered ??
        notifications?.submittedCount ??
        notifications?.pendingReviewCount ??
        0,
    ) || 0;

  // Same source as the Sidebar badges / NotificationBar — just a different
  // read of the one field that best represents "unread" for each role.
  const fabCount =
    role === "student" ? (notifications?.count ?? 0) : submittedAssignmentCount;

  const sidebarBadges = (() => {
    const raw = notifications?.badges ?? {};
    const normalizeBadgeKey = (value = "") =>
      String(value)
        .trim()
        .toLowerCase()
        .replace(/[_\-]+/g, " ")
        .replace(/\s+/g, " ");
    const map = Object.fromEntries(
      Object.entries(raw).filter(
        ([label, value]) =>
          Number(value) >
          Number(
            dismissedBadgeCounts[label] ??
              dismissedBadgeCounts[normalizeBadgeKey(label)] ??
              0,
          ),
      ),
    );

    const addBadge = (label, ...values) => {
      const count = values.find((value) => Number(value) > 0);
      if (!count) return;
      const remaining =
        Number(count) -
        Number(
          dismissedBadgeCounts[label] ??
            dismissedBadgeCounts[normalizeBadgeKey(label)] ??
            0,
        );
      if (remaining > 0) map[label] = remaining;
      else delete map[label];
    };

    const removeRawBadge = (label) => {
      Object.keys(map).forEach((key) => {
        if (normalizeBadgeKey(key) === normalizeBadgeKey(label)) {
          delete map[key];
        }
      });
    };

    if (role === "student") {
      removeRawBadge("My Assignment");
      addBadge("My Assignment", notifications?.count);
      addBadge(
        "My Letter Writting",
        unreadLetterCount,
        notifications?.letterCount,
      );
      addBadge("My Gift", giftBadgeCount, notifications?.giftCount);
      addBadge("My Attendance", notifications?.attendanceCount);
      removeRawBadge("My Announcements");
      addBadge("My Announcements", announcementBadgeCount);
    } else if (role === "teacher") {
      removeRawBadge("Manage Assignment");
      addBadge("Manage Assignment", submittedAssignmentCount);
      addBadge("Manage Participants", notifications?.participantCount);
      addBadge("Post Announcement", notifications?.announcementCount);
      addBadge("Check Attendance", notifications?.attendanceCount);
    } else if (role === "admin") {
      removeRawBadge("Manage Assignment");
      addBadge("Manage Assignment", submittedAssignmentCount);
      addBadge("Manage Users", notifications?.participantCount);
      addBadge("Manage Letters", unreadLetterCount, notifications?.letterCount);
      addBadge("Manage Gifts", giftBadgeCount);
      addBadge("Post Announcement", notifications?.announcementCount);
    }

    return map;
  })();

  return (
    <ThemeProvider user={user}>
      <div className="relative flex h-screen w-full flex-col overflow-hidden bg-gradient-to-br from-slate-100 via-emerald-50 to-orange-50 font-sans dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
        {/* Decorative blurred backdrop — this is what the glass panels
            throughout the app are actually reading as "glass" against.
            Dimmed (not just recolored) in dark mode so the blur reads as
            a subtle glow instead of a bright wash against the dark page. */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        >
          <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-green-300/30 blur-3xl dark:bg-emerald-500/10" />
          <div className="absolute -right-32 top-1/3 h-[28rem] w-[28rem] rounded-full bg-orange-300/25 blur-3xl dark:bg-orange-500/10" />
          <div className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-emerald-200/30 blur-3xl dark:bg-emerald-400/10" />
        </div>

        <Header onLogout={handleLogout} />

        <div className="flex min-h-0 flex-1">
          <Sidebar
            navItems={navConfig}
            activeItem={activeItem}
            setActiveItem={setActiveItem}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            profilePhoto={profilePhoto}
            setProfilePhoto={setProfilePhoto}
            fileInputRef={fileInputRef}
            handlePhotoChange={handlePhotoChange}
            role={role}
            userName={user.name}
            participantId={user.participantId}
            badges={sidebarBadges}
            onBadgeClick={handleSidebarBadgeClick}
          />

          {/* Main content */}
          <main className="min-w-0 flex-1 overflow-y-auto pb-4 pt-0 sm:pb-6">
            <Banner
              title={banner.title}
              subtitle={banner.subtitle}
              icon={currentNav.icon}
            />

            {/* Renders nothing on its own when there's nothing to show —
                e.g. a student with no dueSoon items, or staff with no
                assignments — so no role gate needed here anymore. */}
            <NotificationBar data={notifications} />

            <ActiveComponent onNavigate={setActiveItem} />
          </main>
        </div>

        <NotificationFab role={role} data={notifications} count={fabCount} />
      </div>
    </ThemeProvider>
  );
}
