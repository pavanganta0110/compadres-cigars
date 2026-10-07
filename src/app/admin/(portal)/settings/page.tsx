import { TAX_EFFECTIVE_DATE, TAX_MATRIX_SHA256 } from "@/lib/domain/tax";
import { requireStaff } from "@/lib/server/staff";

export const metadata = { title: "Settings" };

export default async function Settings() {
  await requireStaff("manage_restrictions");
  const env = process.env.APP_ENV ?? "unset";
  return (
    <>
      <h1>Settings</h1>
      <h2>Environment</h2>
      <p>APP_ENV: <strong>{env}</strong>. Payment, shipping and age providers run live only when APP_ENV is production AND the matching approval flag is true. Nothing is approved today.</p>
      <h2>Sales tax</h2>
      <p>Average combined state rates from the business-approved matrix (effective {TAX_EFFECTIVE_DATE}). Source hash <code>{TAX_MATRIX_SHA256}</code>. Estimates only; tax-professional review required before launch. No excise tax or nexus logic.</p>
      <h2>Age verification</h2>
      <p className="adm-note">Checkbox-only self-attestation is in use. It carries regulatory and underwriting risk. An ID-verification vendor can be added behind the same interface.</p>
    </>
  );
}
