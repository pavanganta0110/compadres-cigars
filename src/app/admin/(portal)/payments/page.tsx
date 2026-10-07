import { requireStaff } from "@/lib/server/staff";

export const metadata = { title: "Payments" };

export default async function Payments() {
  await requireStaff();
  return (
    <>
      <h1>Payments</h1>
      <p><span className="adm-pill warn">disabled</span> <span className="adm-pill warn">not production-ready</span></p>
      <p className="adm-note">No payment processor is connected. Orders are recorded as pending and no card is charged. QuickBooks Payments (sandbox) is the next phase. Production payments stay off until the processor approves tobacco and the approval is recorded.</p>
    </>
  );
}
