import { createClient } from "@supabase/supabase-js";
import type { VercelRequest } from "@vercel/node";

function getSupabaseAdmin() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    "";
  if (!url || !key) throw new Error("Missing Supabase service config");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export { getSupabaseAdmin };

export function extractToken(req: VercelRequest): string | null {
  const auth = (req.headers.authorization as string) ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export async function authenticateUser(
  req: VercelRequest
): Promise<{ userId: string; email: string } | null> {
  const token = extractToken(req);
  if (!token) return null;
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) return null;
    return {
      userId: data.user.id,
      email: data.user.email ?? "",
    };
  } catch {
    return null;
  }
}

export async function authenticateAdmin(
  req: VercelRequest
): Promise<{ userId: string; email: string } | null> {
  const auth = await authenticateUser(req);
  if (!auth) return null;

  const adminEmail =
    process.env.ADMIN_EMAIL ||
    process.env.VITE_ADMIN_EMAIL ||
    "";

  if (adminEmail && auth.email === adminEmail) return auth;

  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from("profiles")
      .select("is_admin")
      .eq("id", auth.userId)
      .single();
    if ((data as { is_admin?: boolean } | null)?.is_admin) return auth;
  } catch {
    /* noop */
  }
  return null;
}

export function setCorsHeaders(res: { setHeader: (k: string, v: string) => void }) {
  const origin =
    process.env.ALLOWED_ORIGIN ||
    process.env.VITE_APP_URL ||
    "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
}
