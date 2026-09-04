import {
  User,
  Users,
  LayoutGrid,
  Mail,
  Gift,
  Megaphone,
  FilePlus,
  Inbox,
} from "lucide-react";

import MyAccount from "../pages/admin/MyAccount";
import ManageLetters from "../pages/admin/ManageLetters";
import ManageGifts from "../pages/admin/ManageGifts";
import PostAnnouncement from "../pages/shared/PostAnnouncement";
import ManageAssignment from "../pages/teacher/ManageAssignment";
import ManageUsers from "../pages/admin/ManageUsers";
import ManageSections from "../pages/admin/ManageSections";

export const adminNav = [
  {
    label: "My Account",
    icon: User,
    component: MyAccount,
    subtitle: "View and edit your personal information",
  },
  {
    label: "Manage Users",
    icon: Users,
    component: ManageUsers,
    subtitle: "Manage participant, teacher, and admin accounts",
  },
  {
    label: "Manage Sections",
    icon: LayoutGrid,
    component: ManageSections,
    subtitle: "Add, rename, or remove sections",
  },
  {
    label: "Manage Assignment",
    icon: FilePlus,
    component: ManageAssignment,
    subtitle: "Post assignments for students",
  },

  {
    label: "Manage Letters",
    icon: Mail,
    component: ManageLetters,
    subtitle: "Review and manage submitted letters",
  },
  {
    label: "Manage Gifts",
    icon: Gift,
    component: ManageGifts,
    subtitle: "Track and manage sponsor gifts",
  },
  {
    label: "Post Announcement",
    icon: Megaphone,
    component: PostAnnouncement,
    subtitle: "Broadcast announcements to users",
  },
];

export default adminNav;
