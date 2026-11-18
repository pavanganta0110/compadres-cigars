"use client";
import { useState } from "react";

/** Copies the ship-to block (name, street, city/state/ZIP) so staff can paste it into FedEx when making the label. */
export function CopyAddress({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    try { await navigator.clipboard.writeText(text); setState("copied"); } catch { setState("failed"); }
    setTimeout(() => setState("idle"), 2500);
  }
  return (
    <>
      <button type="button" className="adm-btn" onClick={copy}>{state === "copied" ? "Copied" : "Copy address"}</button>
      {state === "failed" && <span role="alert"> Could not copy. Select the address and copy it by hand.</span>}
    </>
  );
}
