import { Router } from "express";
import {
  getGifts,
  createGift,
  markGiftSeen,
  acknowledgeGift,
  reopenGift,
  remindGift,
} from "../controllers/giftController.js";

const router = Router();

router.get("/", getGifts);
router.post("/", createGift);
router.patch("/:id/seen", markGiftSeen);
router.patch("/:id/acknowledge", acknowledgeGift);
router.patch("/:id/reopen", reopenGift);
router.patch("/:id/remind", remindGift);

export default router;
