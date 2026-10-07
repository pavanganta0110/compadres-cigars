"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AGE_COOKIE, AGE_COOKIE_TTL_SECONDS, safeNextPath, signAgeToken } from "@/lib/domain/age-gate";

export async function enterSite(formData: FormData) {
  const next = safeNextPath(String(formData.get("next") ?? "/"));
  if (formData.get("confirm") !== "yes") redirect(`/age-gate?next=${encodeURIComponent(next)}&error=1`);
  const secret = process.env.AGE_GATE_SECRET;
  if (!secret) throw new Error("AGE_GATE_SECRET is not configured");
  const token = await signAgeToken(secret, Math.floor(Date.now() / 1000));
  (await cookies()).set(AGE_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: AGE_COOKIE_TTL_SECONDS,
  });
  redirect(next);
}
