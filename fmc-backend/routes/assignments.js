import { Router } from "express";
import {
  getAssignments,
  createAssignment,
  updateAssignment,
  getTeacherOverview,
  deleteAssignment,
} from "../controllers/assignmentController.js";
import { submitAssignment, unsubmitAssignment } from "../controllers/submissionController.js";
import upload from "../middleware/upload.js";

const router = Router();

router.get("/overview", getTeacherOverview);
router.get("/", getAssignments);
router.post("/", createAssignment);
router.put("/:id", updateAssignment);
router.delete("/:id", deleteAssignment);
router.post("/:id/submit", upload.array("files"), submitAssignment);
router.delete("/:id/submit", unsubmitAssignment);

export default router;
