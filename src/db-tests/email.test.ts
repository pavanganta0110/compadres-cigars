import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb } from "./harness";

let db: PGlite;
beforeEach(async () => { db = await freshDb(); }, 60_000);

const enqueue = async (key: string, to = "Buyer@Example.com", kind = "order_confirmation") =>
  (await db.query<{ id: string | null }>("select enqueue_email($1, $2, $3, 'Subject', '{\"n\":1}'::jsonb) as id", [kind, key, to])).rows[0].id;
const claim = async (n = 10) => (await db.query<{ id: string; status: string; attempts: number }>("select * from claim_emails($1)", [n])).rows;
const row = async (id: string) => (await db.query<{ status: string; attempts: number; last_error: string | null; sent_at: string | null; provider_id: string | null; next_attempt_at: string }>("select * from email_outbox where id = $1", [id])).rows[0];

describe("email outbox", () => {
  it("queues one email per business event (dedupe key) and lowercases the address", async () => {
    const a = await enqueue("order_confirmation:o1");
    expect(a).not.toBeNull();
    expect(await enqueue("order_confirmation:o1")).toBeNull();
    expect((await db.query<{ to_email: string }>("select to_email from email_outbox")).rows).toEqual([{ to_email: "buyer@example.com" }]);
    expect(await enqueue("order_confirmation:o2")).not.toBeNull();
  });
  it("claims due emails once; a claimed email cannot be claimed again", async () => {
    await enqueue("k1"); await enqueue("k2");
    const first = await claim();
    expect(first).toHaveLength(2);
    expect(first.every((r) => r.status === "sending" && r.attempts === 1)).toBe(true);
    expect(await claim()).toHaveLength(0);
  });
  it("a worker that crashed mid-send is reclaimed after 10 minutes", async () => {
    const id = (await enqueue("k1"))!;
    await claim();
    await db.exec("alter table email_outbox disable trigger email_outbox_updated");   // the trigger would reset updated_at to now()
    await db.query("update email_outbox set updated_at = now() - interval '11 minutes' where id = $1", [id]);
    await db.exec("alter table email_outbox enable trigger email_outbox_updated");
    const again = await claim();
    expect(again.map((r) => r.id)).toEqual([id]);
    expect(again[0].attempts).toBe(2);
  });
  it("records sent, skipped, retry-with-backoff, and goes dead after 5 attempts or a permanent failure", async () => {
    const [a, b, c, d] = await Promise.all(["a", "b", "c", "d"].map((k) => enqueue(k))) as string[];
    await claim();
    await db.query("select finish_email($1, 'sent', 'resend', 'em_1', null)", [a]);
    await db.query("select finish_email($1, 'skipped', 'resend', null, 'sandbox_recipient_not_allowed')", [b]);
    await db.query("select finish_email($1, 'retry', 'resend', null, 'http_503')", [c]);
    await db.query("select finish_email($1, 'dead', 'resend', null, 'validation_error')", [d]);
    expect(await row(a)).toMatchObject({ status: "sent", provider_id: "em_1" });
    expect((await row(a)).sent_at).not.toBeNull();
    expect(await row(b)).toMatchObject({ status: "skipped", last_error: "sandbox_recipient_not_allowed" });
    const r = await row(c);
    expect(r).toMatchObject({ status: "failed", last_error: "http_503" });
    expect(new Date(r.next_attempt_at).getTime()).toBeGreaterThan(Date.now() + 4 * 60_000);   // backs off ~5 min
    expect(await row(d)).toMatchObject({ status: "dead" });
    expect(await claim()).toHaveLength(0);                                                      // failed one is not due yet
    await db.query("update email_outbox set attempts = 5, status = 'sending' where id = $1", [c]);
    await db.query("select finish_email($1, 'retry', 'resend', null, 'http_503')", [c]);
    expect((await row(c)).status).toBe("dead");                                                 // attempt cap
  });
  it("is service-role only", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await expect(db.query("select * from email_outbox")).rejects.toThrow();
      await expect(db.query("select enqueue_email('admin_test','x','a@b.co','s','{}')")).rejects.toThrow();
      await expect(db.query("select * from claim_emails(5)")).rejects.toThrow();
      await db.exec("reset role");
    }
  });
  it("stores marketing consent on customers (off by default)", async () => {
    await db.exec("insert into customers(email) values ('a@b.co')");
    expect((await db.query("select marketing_opt_in, marketing_opt_in_at from customers")).rows[0]).toEqual({ marketing_opt_in: false, marketing_opt_in_at: null });
  });
});
