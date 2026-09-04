import { Router } from "express";
import upload from "../middleware/upload.js";
import {
  createLetter,
  getLetters,
  markLetterSeen,
  updateLetter,
} from "../controllers/letterController.js";

const router = Router();

router.get("/", getLetters);
router.post("/", upload.single("attachment"), createLetter);
router.patch("/:id/seen", markLetterSeen);
router.patch("/:id", updateLetter);

export default router;
