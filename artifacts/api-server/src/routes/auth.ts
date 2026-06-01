import { Router } from "express";

const router = Router();

router.post("/forgot-password", (_req, res) => {
  return res.json({ ok: true, message: "Se o email existir, receberá instruções em breve." });
});

export default router;
