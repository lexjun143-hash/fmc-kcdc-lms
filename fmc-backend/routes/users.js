import { Router } from "express";
import {
  createUser,
  getUsers,
  getUserById,
  getUserByParticipantId,
  updateUser,
  updateThemePref,
  deleteUser,
} from "../controllers/userController.js";

const router = Router();

router.post("/", createUser);
router.get("/", getUsers);
// Registered ahead of no conflict with GET "/:id" — different HTTP verb,
// but kept near the top for visibility since it's the one route every
// role (including students) can call on themselves.
router.patch("/theme", updateThemePref);
router.get("/:id", getUserById);
router.get("/participant/:participantId", getUserByParticipantId);
router.put("/participant/:participantId", updateUser);
router.delete("/participant/:participantId", deleteUser);

export default router;
