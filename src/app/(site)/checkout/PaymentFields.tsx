"use client";
import { useState, type FormEvent } from "react";
import { mockTokenForCard } from "@/lib/payments/token";

export type Tokenizer = { kind: "mock" } | { kind: "quickbooks"; url: string };

const digits = (v: string) => v.replace(/\D/g, "");

/**
 * Card fields. They deliberately have NO `name` attribute, so the browser never includes them in the form post:
 * the card goes from here straight to the processor's tokenization endpoint, and our server only receives the token.
 */
export function PaymentFields({ tokenizer, error }: { tokenizer: Tokenizer; error?: string }) {
  return (
    <fieldset className="wide payment-fields" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend style={{ color: "var(--brass)" }}>Payment</legend>
      {tokenizer.kind === "mock"
        ? <p className="notice" role="note">Sandbox payment: no real card is charged. Test card 4242 4242 4242 4242 approves; 4000 0000 0000 0002 declines. Use any future expiry and any 3-digit code.</p>
        : <p className="notice" role="note">Sandbox payment through Intuit: no real card is charged. Use Intuit&apos;s sandbox test cards.</p>}
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      <div className="form-grid">
        <label className="wide">Name on card<input id="cc-name" autoComplete="cc-name" /></label>
        <label className="wide">Card number<input id="cc-number" inputMode="numeric" autoComplete="cc-number" /></label>
        <label>Expiry (MM/YY)<input id="cc-exp" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" /></label>
        <label>Security code<input id="cc-csc" inputMode="numeric" autoComplete="cc-csc" /></label>
      </div>
      <input type="hidden" name="paymentToken" defaultValue="" />
    </fieldset>
  );
}

type Fields = { number: string; name: string; month: string; year: string; cvc: string; zip: string };

async function tokenize(t: Tokenizer, f: Fields): Promise<string> {
  if (!/^\d{13,19}$/.test(f.number)) throw new Error("Enter a valid card number.");
  if (!/^(0[1-9]|1[0-2])$/.test(f.month) || !/^\d{4}$/.test(f.year)) throw new Error("Enter the expiry as MM/YY.");
  if (!/^\d{3,4}$/.test(f.cvc)) throw new Error("Enter the security code.");
  if (t.kind === "mock") return mockTokenForCard(f.number);
  const res = await fetch(t.url, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", "Request-Id": crypto.randomUUID() },
    body: JSON.stringify({ card: { number: f.number, expMonth: f.month, expYear: f.year, cvc: f.cvc, name: f.name || undefined, address: { postalCode: f.zip || undefined } } }),
  });
  const j = (await res.json().catch(() => ({}))) as { value?: string };
  if (!res.ok || typeof j.value !== "string") throw new Error("We could not read those card details. Please check them and try again.");
  return j.value;
}

/** Returns an onSubmit handler: tokenize first, then submit the form with only the opaque token attached. */
export function useTokenizedSubmit(tokenizer: Tokenizer | null) {
  const [error, setError] = useState<string | undefined>();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (!tokenizer) return;
    const form = e.currentTarget;
    const hidden = form.elements.namedItem("paymentToken") as HTMLInputElement | null;
    if (!hidden || hidden.value) return;           // already tokenized: let the form post
    e.preventDefault();
    const val = (id: string) => (form.querySelector<HTMLInputElement>(`#${id}`)?.value ?? "");
    const exp = digits(val("cc-exp"));
    const fields: Fields = {
      number: digits(val("cc-number")), name: val("cc-name").trim(), cvc: digits(val("cc-csc")), month: exp.slice(0, 2),
      year: exp.length === 4 ? `20${exp.slice(2)}` : exp.length === 6 ? exp.slice(2) : "", zip: form.querySelector<HTMLInputElement>('input[name="postalCode"]')?.value ?? "",
    };
    setError(undefined);
    tokenize(tokenizer, fields).then((token) => {
      hidden.value = token;
      for (const id of ["cc-number", "cc-exp", "cc-csc", "cc-name"]) { const el = form.querySelector<HTMLInputElement>(`#${id}`); if (el) el.value = ""; }
      // Defer: a requestSubmit() made while the browser is still dispatching the original submit event is ignored.
      setTimeout(() => {
        form.requestSubmit();                       // React reads the form data synchronously during this call
        hidden.value = "";                          // tokens are single use; never leave one behind
      }, 0);
    }, (err: unknown) => setError(err instanceof Error ? err.message : "Check your card details."));
  };
  return { onSubmit, error };
}
