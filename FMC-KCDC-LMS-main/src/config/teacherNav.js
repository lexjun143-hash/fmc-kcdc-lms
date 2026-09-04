import { User, UserPlus, FilePlus, Megaphone, CheckSquare } from "lucide-react";

import MyAccount from "../pages/teacher/MyAccount";
import UploadAssignment from "../pages/teacher/ManageAssignment";
import PostAnnouncement from "../pages/shared/PostAnnouncement";
import CheckAttendance from "../pages/teacher/CheckAttendance";
import ManageStudents from "../pages/shared/ManageStudents";

export const teacherNav = [
  {
    label: "My Account",
    icon: User,
    component: MyAccount,
    subtitle: "View and edit your personal information",
  },
  {
    label: "Manage Participants",
    icon: UserPlus,
    component: ManageStudents,
    subtitle: "Create and view participant accounts",
  },
  {
    label: "Manage Assignment",
    icon: FilePlus,
    component: UploadAssignment,
    subtitle: "Manage assignments for your participants",
  },
  {
    label: "Post Announcement",
    icon: Megaphone,
    component: PostAnnouncement,
    subtitle: "Share announcements with your class",
  },
  {
    label: "Check Attendance",
    icon: CheckSquare,
    component: CheckAttendance,
    subtitle: "Audit and adjust attendance records",
  },
];

export default teacherNav;
