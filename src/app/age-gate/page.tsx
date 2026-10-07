import Image from "next/image";
import { enterSite } from "./actions";
import { safeNextPath } from "@/lib/domain/age-gate";

export const metadata = { title: "Adults only", robots: { index: false } };

export default async function AgeGate({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="gate" id="main">
      <Image src="/images/crest.png" alt="Compadres Premium Cigars" width={280} height={280} priority />
      <h1>You must be 21 or older to enter</h1>
      <p>This site sells tobacco products and is intended for adults only. This notice is not identity verification; age is verified again at checkout.</p>
      <form action={enterSite}>
        <input type="hidden" name="next" value={safeNextPath(sp.next)} />
        <label className="check">
          <input type="checkbox" name="confirm" value="yes" required />
          <span>I confirm I am 21 years of age or older</span>
        </label>
        {sp.error && <p role="alert" className="form-error">Please confirm that you are 21 or older to continue.</p>}
        <button className="btn" type="submit">Enter site</button>
      </form>
      <p className="fine">Tobacco products are not for sale to anyone under 21. Please smoke responsibly.</p>
    </main>
  );
}
