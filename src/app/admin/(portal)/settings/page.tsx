import { TAX_EFFECTIVE_DATE, TAX_MATRIX_SHA256 } from "@/lib/domain/tax";
import { requireStaff } from "@/lib/server/staff";
import { testFedExAction } from "./actions";

export const metadata = { title: "Settings" };

export default async function Settings({ searchParams }: { searchParams: Promise<{ ok?: string; step?: string; msg?: string; code?: string; track?: string }> }) {
  await requireStaff("manage_restrictions");
  const env = process.env.APP_ENV ?? "unset";
  const t = await searchParams;
  return (
    <>
      <h1>Settings</h1>
      <h2>Environment</h2>
      <p>APP_ENV: <strong>{env}</strong>. Payment, shipping and age providers run live only when APP_ENV is production AND the matching approval flag is true. Nothing is approved today.</p>
      <h2>Shipping (FedEx)</h2>
      <p>Runs one real authorization and one small rate quote against FedEx and reports which step fails. No secrets are shown.</p>
      <form action={testFedExAction}><button className="adm-btn" type="submit">Test FedEx connection</button></form>
      {t.msg && (
        <p className={t.ok === "1" ? "adm-note" : "adm-alert"} role={t.ok === "1" ? "status" : "alert"}>
          <strong>{t.ok === "1" ? "OK" : `Failed at: ${t.step}`}.</strong> {t.msg.slice(0, 400)} {t.code && <code>{t.code.slice(0, 80)}</code>}<br />{t.track?.slice(0, 200)}
        </p>
      )}
      <h2>Sales tax</h2>
      <p>Average combined state rates from the business-approved matrix (effective {TAX_EFFECTIVE_DATE}). Source hash <code>{TAX_MATRIX_SHA256}</code>. Estimates only; tax-professional review required before launch. No excise tax or nexus logic.</p>
      <h2>Age verification</h2>
      <p className="adm-note">Checkbox-only self-attestation is in use. It carries regulatory and underwriting risk. An ID-verification vendor can be added behind the same interface.</p>
    </>
  );
}
