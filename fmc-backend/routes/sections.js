import { Router } from "express";
import {
  getSections,
  createSection,
  renameSection,
  deleteSection,
} from "../controllers/sectionController.js";

const router = Router();

router.get("/", getSections);
router.post("/", createSection);
router.put("/:id", renameSection);
router.delete("/:id", deleteSection);

export default router;
