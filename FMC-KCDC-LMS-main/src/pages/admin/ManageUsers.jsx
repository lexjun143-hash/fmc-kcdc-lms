import React, { useState } from "react";
import { ArrowLeft, GraduationCap, ShieldCheck, UserPlus } from "lucide-react";
import GlassCard from "../../components/shared/GlassCard";
import ManageStudents from "../shared/ManageStudents";
import ManageTeachers from "./ManageTeachers";
import ManageAdmins from "./ManageAdmins";

const userSections = [
  {
    label: "Manage Participants",
    description: "Create, update, and review participant accounts.",
    icon: UserPlus,
    color: "green",
    component: ManageStudents,
  },
  {
    label: "Manage Teachers",
    description: "Create and manage teacher accounts.",
    icon: GraduationCap,
    color: "blue",
    component: ManageTeachers,
  },
  {
    label: "Manage Admins",
    description: "Manage administrator access and accounts.",
    icon: ShieldCheck,
    color: "orange",
    component: ManageAdmins,
  },
];

const colorStyles = {
  green: {
    icon: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    hover:
      "hover:border-green-300 hover:bg-green-50/60 dark:hover:border-green-700 dark:hover:bg-green-900/10",
  },
  blue: {
    icon: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    hover:
      "hover:border-blue-300 hover:bg-blue-50/60 dark:hover:border-blue-700 dark:hover:bg-blue-900/10",
  },
  orange: {
    icon: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    hover:
      "hover:border-orange-300 hover:bg-orange-50/60 dark:hover:border-orange-700 dark:hover:bg-orange-900/10",
  },
};

export default function ManageUsers({ onNavigate }) {
  const [selectedSection, setSelectedSection] = useState(null);
  const selectedUserSection = userSections.find(
    ({ label }) => label === selectedSection,
  );
  const SelectedComponent = selectedUserSection?.component;

  return (
    <div className="relative space-y-4 px-4 sm:px-6">
    <br></br>
      <GlassCard as="section" solid className="p-4 sm:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Manage Users
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Choose an account type to manage.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {userSections.map(({ label, description, icon: Icon, color }) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setSelectedSection(label);
                onNavigate?.("Manage Users");
              }}
              className={`group flex min-h-40 flex-col items-start rounded-xl border border-slate-200 bg-white p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/40 ${colorStyles[color].hover}`}
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-xl ${colorStyles[color].icon}`}
              >
                <Icon size={22} strokeWidth={2} />
              </span>
              <span className="mt-4 text-sm font-bold text-slate-800 group-hover:text-slate-950 dark:text-slate-100 dark:group-hover:text-white">
                {label}
              </span>
              <span className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {description}
              </span>
            </button>
          ))}
        </div>
      </GlassCard>

      {SelectedComponent && (
        <section>
          <div className="mb-3 flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {selectedUserSection.label}
            </h3>
            <button
              type="button"
              onClick={() => setSelectedSection(null)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <ArrowLeft size={14} />
              Back to users
            </button>
          </div>
          <SelectedComponent />
        </section>
      )}
    </div>
  );
}
