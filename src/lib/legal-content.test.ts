import { describe, expect, it } from "vitest";
import { LEGAL_PAGES } from "./legal";
import { contactFromEnv, LEGAL_DOCS, US_STATE_NAMES } from "./legal-content";

const contact = contactFromEnv({ COMPADRES_CONTACT_EMAIL: "hello@example.com", COMPADRES_CONTACT_PHONE: "816-555-0100" });
const text = (slug: string) => [LEGAL_DOCS[slug].intro, ...LEGAL_DOCS[slug].blocks(contact).flatMap((b) => [b.h, ...(b.p ?? []), ...(b.ul ?? [])])].join("\n");

describe("legal pages", () => {
  it("every page in the footer has full content, with distinct headings and no empty blocks", () => {
    expect(Object.keys(LEGAL_DOCS).sort()).toEqual(Object.keys(LEGAL_PAGES).sort());
    for (const slug of Object.keys(LEGAL_PAGES)) {
      const blocks = LEGAL_DOCS[slug].blocks(contact);
      expect(blocks.length).toBeGreaterThanOrEqual(4);   // the restrictions page adds its live state lists on top
      expect(new Set(blocks.map((b) => b.h)).size).toBe(blocks.length);
      for (const b of blocks) { expect(b.h.length).toBeGreaterThan(2); expect((b.p?.length ?? 0) + (b.ul?.length ?? 0)).toBeGreaterThan(0); }
    }
  });
  it("contains no leftover drafting markers", () => {
    for (const slug of Object.keys(LEGAL_PAGES)) expect(text(slug)).not.toMatch(/TODO|TBD|lorem|\[\s*\]|XXX/i);
  });
  it("states the facts the site really enforces", () => {
    expect(text("age-policy")).toMatch(/21/);
    expect(text("age-policy")).toMatch(/adult signature/i);
    expect(text("shipping")).toMatch(/FedEx/);
    expect(text("shipping")).toMatch(/P\.O\. boxes/);
    expect(text("privacy")).toMatch(/never receive/i);                    // card data stays with the processor
    expect(text("privacy")).toMatch(/do not sell/i);
    expect(text("terms")).toMatch(/SURGEON GENERAL WARNING/);
    expect(text("returns")).toMatch(/perishable/i);
    expect(text("restrictions")).toMatch(/District of Columbia/);
  });
  it("contact details come from the environment and never invent an email address", () => {
    expect(text("privacy")).toContain("hello@example.com");
    const none = contactFromEnv({});
    const t = LEGAL_DOCS.privacy.blocks(none).map((b) => (b.p ?? []).join(" ")).join(" ");
    expect(t).not.toMatch(/@/);
    expect(t).toContain("1111 E. 73rd St, Kansas City, MO 64131");
  });
  it("knows all 50 state names", () => { expect(Object.keys(US_STATE_NAMES)).toHaveLength(50); });
});
