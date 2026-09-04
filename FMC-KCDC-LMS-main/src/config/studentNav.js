import {
  User,
  FileEdit,
  BookOpen,
  Gift,
  ClipboardEdit,
  Megaphone,
} from "lucide-react";

import MyAccount from "../pages/student/MyAccount";
import MyLetterWriting from "../pages/student/MyLetterWriting";
import MyAssignment from "../pages/student/MyAssignment";
import MyGift from "../pages/student/MyGift";
import MyAttendance from "../pages/student/MyAttendance";
import MyAnnouncements from "../pages/student/MyAnnouncements";

export const studentNav = [
  {
    label: "My Account",
    icon: User,
    component: MyAccount,
    subtitle: "View and edit your personal information",
  },
  {
    label: "My Letter Writting",
    icon: FileEdit,
    component: MyLetterWriting,
    subtitle: "Create and view your letters",
  },
  {
    label: "My Assignment",
    icon: BookOpen,
    component: MyAssignment,
    subtitle: "View and submit assignments",
  },
  {
    label: "My Gift",
    icon: Gift,
    component: MyGift,
    subtitle: "Available gifts and rewards",
  },
  {
    label: "My Attendance",
    icon: ClipboardEdit,
    component: MyAttendance,
    subtitle: "Your attendance records",
  },
  {
    label: "My Announcements",
    icon: Megaphone,
    component: MyAnnouncements,
    subtitle: "Latest news and announcements",
  },
];

export default studentNav;
