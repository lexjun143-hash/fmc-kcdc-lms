import React from "react";
import { Camera } from "lucide-react";

// Below `lg` (1024px, same cutoff App.jsx uses to seed the initial open/
// closed default) this single `sidebarOpen` boolean means "is the drawer
// open" — the sidebar is fixed/off-canvas and slides in over the page
// with a backdrop. At `lg` and up it instead means "expanded vs. icon-
// rail" — the sidebar is a static column that's always visible, exactly
// the pre-existing desktop behavior, just now paired with the mobile
// drawer rather than replacing it.
export default function Sidebar({
  navItems,
  activeItem,
  setActiveItem,
  sidebarOpen,
  setSidebarOpen,
  profilePhoto,
  setProfilePhoto,
  fileInputRef,
  handlePhotoChange,
  role,
  userName,
  participantId,
  badges = {},
  onBadgeClick,
}) {
  const roleLabel =
    role === "teacher" ? "Teacher" : role === "admin" ? "Admin" : "Participant";

  function normalizeBadgeKey(value = "") {
    return String(value)
      .trim()
      .toLowerCase()
      .replace(/[_\-]+/g, " ")
      .replace(/\s+/g, " ");
  }

  function badgeCount(label) {
    const raw = badges ?? {};
    const exactMatch = raw[label];
    if (typeof exactMatch !== "undefined") {
      const count = Number(exactMatch);
      if (!count || count <= 0) return null;
      return count > 99 ? "99+" : count;
    }

    const normalizedTarget = normalizeBadgeKey(label);
    const match = Object.entries(raw).find(
      ([key]) => normalizeBadgeKey(key) === normalizedTarget,
    );
    if (!match) return null;

    const count = Number(match[1]);
    if (!count || count <= 0) return null;
    return count > 99 ? "99+" : count;
  }

  // Picking a nav item closes the drawer on mobile (a drawer that stays
  // open after navigating just blocks the page you asked to see) but must
  // never collapse the sidebar on desktop, where it's a static column, not
  // an overlay. `lg` here matches the Tailwind `lg:` breakpoint (1024px)
  // used throughout this component, checked at click-time rather than
  // tracked in state since it only ever needs to gate this one decision.
  function handleNavClick(label) {
    if (badgeCount(label)) onBadgeClick?.(label);
    setActiveItem(label);
    const isMobile = window.matchMedia?.("(max-width: 1023px)").matches;
    if (isMobile) setSidebarOpen(false);
  }

  return (
    <>
      {!sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="fixed left-0 top-1/2 z-50 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-r-xl border border-l-0 border-white/60 bg-white/85 text-green-700 shadow-lg shadow-slate-900/10 backdrop-blur-md transition-all hover:w-12 hover:bg-white dark:border-white/15 dark:bg-slate-900/90 dark:text-emerald-300"
          aria-label="Open navigation"
          aria-expanded="false"
          title="Open navigation"
        >
          <img
            src="images/sidetoggle.png"
            alt=""
            className="h-6 w-6 rotate-180 object-contain"
          />
        </button>
      )}

      {/* Backdrop — mobile/tablet only (lg:hidden), dismisses the drawer
          on tap. Harmless to mount whenever sidebarOpen is true on
          desktop too, since lg:hidden removes it from layout there. */}
      {sidebarOpen && (
        <div
          aria-hidden="true"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 h-full w-72 flex-shrink-0 overflow-visible border-r border-white/40 bg-white/70 shadow-lg shadow-slate-900/5 backdrop-blur-lg transition-transform duration-300 ease-in-out dark:border-white/10 dark:bg-slate-900/60 lg:static lg:transition-[width] ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${sidebarOpen ? "lg:w-60 xl:w-72" : "lg:w-[52px]"} lg:translate-x-0`}
      >
        <button
          type="button"
          onClick={() => setSidebarOpen((prev) => !prev)}
          className="absolute right-[-14px] top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-green-200 bg-white text-green-700 shadow-md shadow-slate-900/15 transition-all hover:scale-110 hover:bg-green-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-slate-800"
          aria-label={sidebarOpen ? "Collapse navigation" : "Expand navigation"}
          aria-expanded={sidebarOpen}
          title={sidebarOpen ? "Collapse navigation" : "Expand navigation"}
        >
          <img
            src="images/sidetoggle.png"
            alt=""
            className={`h-6 w-6 object-contain transition-transform duration-200 ${
              sidebarOpen ? "" : "rotate-180"
            }`}
          />
        </button>
        {sidebarOpen ? (
          <div className="h-full w-60 overflow-y-auto px-4 py-6 sm:w-72 sm:px-5">
            <div className="flex flex-col items-center">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="group relative flex h-24 w-24 cursor-pointer items-center justify-center rounded-full border-4 border-green-700 bg-slate-100"
              >
                {profilePhoto ? (
                  <img
                    src={profilePhoto}
                    alt="Profile"
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-14 w-14 text-slate-400"
                    fill="currentColor"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7v1H4v-1z" />
                  </svg>
                )}

                {/* Hover overlay with camera icon */}
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/40 group-hover:opacity-100">
                  <Camera size={22} className="text-white" />
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </div>
              <span className="mt-1 rounded-full bg-green-700 px-3 py-0.5 text-xs font-semibold text-white shadow">
                {participantId}
              </span>
              <h2 className="mt-3 text-center text-sm font-bold uppercase tracking-wide text-slate-800">
                {userName}
              </h2>
              <p className="text-xs text-slate-500">{roleLabel}</p>
            </div>

            <nav className="mt-6 border-t border-slate-100 pt-4">
              <ul className="space-y-1">
                {navItems.map(({ label, icon: Icon }) => {
                  const isActive = activeItem === label;
                  return (
                    <li key={label}>
                      <button
                        onClick={() => handleNavClick(label)}
                        className={`relative flex w-full items-center gap-3 rounded-md py-2.5 pl-4 pr-3 text-left text-sm font-semibold transition-colors ${
                          isActive
                            ? "text-green-700"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                        }`}
                      >
                        {isActive && (
                          <span className="absolute right-0 top-0 h-full w-1  bg-green-700" />
                        )}
                        <span className="relative inline-flex flex-shrink-0">
                          <Icon
                            size={18}
                            className={
                              isActive ? "text-green-700" : "text-slate-400"
                            }
                          />
                          {badgeCount(label) && (
                            <span
                              role="button"
                              tabIndex={0}
                              aria-label={`Dismiss ${badgeCount(label)} notifications for ${label}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                onBadgeClick?.(label);
                              }}
                              onKeyDown={(event) => {
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  onBadgeClick?.(label);
                                }
                              }}
                              className="absolute -right-1 -top-1 flex h-4 min-w-[16px] cursor-pointer items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white"
                            >
                              {badgeCount(label)}
                            </span>
                          )}
                        </span>
                        <span className="whitespace-nowrap">{label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        ) : (
          <nav className="flex h-full w-[52px] flex-col items-center gap-1 py-6">
            {navItems.map(({ label, icon: Icon }) => {
              const isActive = activeItem === label;
              return (
                <button
                  key={label}
                  onClick={() => {
                    if (badgeCount(label)) onBadgeClick?.(label);
                    setActiveItem(label);
                  }}
                  title={label}
                  aria-label={label}
                  className={`relative flex h-10 w-full items-center justify-center transition-colors ${
                    isActive
                      ? "text-green-700"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {isActive && (
                    <span className="absolute right-0 top-0 h-full w-1  bg-green-700" />
                  )}
                  <span className="relative inline-flex">
                    <Icon size={18} />
                    {badgeCount(label) && (
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={`Dismiss ${badgeCount(label)} notifications for ${label}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onBadgeClick?.(label);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            onBadgeClick?.(label);
                          }
                        }}
                        className="absolute -right-2 -top-2 flex h-4 min-w-[16px] cursor-pointer items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white"
                      >
                        {badgeCount(label)}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </nav>
        )}
      </aside>
    </>
  );
}
