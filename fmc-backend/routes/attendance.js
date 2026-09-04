import { Router } from "express";
import {
  checkInForSession,
  createAttendanceSession,
  getMyAttendance,
  getSectionAttendance,
} from "../controllers/attendanceController.js";

const router = Router();

router.post("/sessions", createAttendanceSession);
router.get("/sessions", getSectionAttendance);
router.get("/my", getMyAttendance);
router.post("/checkin", checkInForSession);

export default router;
