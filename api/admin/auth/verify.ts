import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual, randomBytes } from "crypto";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "Method not allowed" }); return; }

  const body = req.body as Record<string, unknown> | undefined;
  const password = body?.["password"];

  if (typeof password !== "string" || password.length === 0 || password.length > 256) {
    await new Promise(r => setTimeout(r, 300 + Math.random() * 200));
    res.status(200).json({ ok: false });
    return;
  }

  const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "";
  const supabaseServiceKey =
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ??
    process.env["VITE_SUPABASE_SERVICE_ROLE"] ??
    process.env["VITE_SUPABASE_SERVICE_ROLE_KEY"] ??
    "";

  const secret = process.env["ADMIN_JWT_SECRET"] ?? supabaseServiceKey ?? "";

  if (!secret) {
    res.status(500).json({ ok: false, error: "Server misconfigured" });
    return;
  }

  let expected = (process.env["ADMIN_PANEL_PASSWORD"] ?? "").trim();

  if (!expected && supabaseUrl && supabaseServiceKey) {
    try {
      const admin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data } = await admin
        .from("platform_settings")
        .select("value")
        .eq("key", "admin_security_password")
        .maybeSingle();
      if (typeof data?.value === "string" && (data.value as string).trim()) {
        expected = (data.value as string).trim();
      }
    } catch {
      // continue with fallback
    }
  }

  if (!expected) expected = "12345678y";

  const trimmedPassword = password.trim();

  const padLen = Math.max(expected.length, trimmedPassword.length, 64);
  const a = new Uint8Array(Buffer.from(expected.padEnd(padLen, "\0"), "utf8"));
  const b = new Uint8Array(Buffer.from(trimmedPassword.padEnd(padLen, "\0"), "utf8"));
  const lengthMatch = expected.length === trimmedPassword.length;
  const bytesMatch = timingSafeEqual(a, b);
  const match = lengthMatch && bytesMatch;

  await new Promise(r => setTimeout(r, 100 + Math.random() * 150));

  if (match) {
    const ts = Date.now().toString();
    const nonce = randomBytes(12).toString("hex");
    const sig = createHmac("sha256", secret).update(`admin:${ts}:${nonce}`).digest("hex");
    const token = Buffer.from(JSON.stringify({ ts, nonce, sig })).toString("base64url");
    res.status(200).json({ ok: true, token });
  } else {
    res.status(200).json({ ok: false });
  }
}
