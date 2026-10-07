import Image from "next/image";
import Link from "next/link";
import { formatUsd } from "@/lib/domain/money";
import { readCart, resolveLines } from "@/lib/server/cart-store";
import { updateCartAction } from "./actions";

export const metadata = { title: "Your cart" };

export default async function CartPage() {
  const lines = await resolveLines(await readCart());
  const subtotal = lines.reduce((n, l) => n + l.unitPriceCents * l.quantity, 0);
  return (
    <main id="main" className="section">
      <h1>Your cart</h1>
      {lines.length === 0 ? (
        <p>Your cart is empty. <Link href="/shop">Browse the collection</Link>.</p>
      ) : (
        <>
          <ul className="cart-lines">
            {lines.map((l) => (
              <li key={l.productId} className="cart-line">
                <div className="cart-thumb">{l.image && <Image src={l.image} alt="" fill sizes="96px" />}</div>
                <div>
                  <Link href={`/products/${l.slug}`}>{l.name}</Link>
                  <p className="fine">{formatUsd(l.unitPriceCents)} each{l.quantity > l.stock && " · exceeds available stock"}</p>
                </div>
                <form action={updateCartAction} className="qty">
                  <input type="hidden" name="productId" value={l.productId} />
                  <label>Qty <input type="number" name="quantity" min={0} max={99} defaultValue={l.quantity} /></label>
                  <button className="link-btn" type="submit">Update</button>
                </form>
                <p className="price">{formatUsd(l.unitPriceCents * l.quantity)}</p>
              </li>
            ))}
          </ul>
          <p className="cart-total">Subtotal <strong>{formatUsd(subtotal)}</strong></p>
          <p className="fine">Shipping and estimated tax are calculated at checkout. Adult signature required on delivery.</p>
          <Link className="btn" href="/checkout">Proceed to checkout</Link>
        </>
      )}
    </main>
  );
}
