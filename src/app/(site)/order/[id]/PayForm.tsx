"use client";
import { payOrderAction } from "../../checkout/actions";
import { PaymentFields, useTokenizedSubmit, type Tokenizer } from "../../checkout/PaymentFields";

/** Pay (or retry paying) a pending order. Same tokenize-in-the-browser flow as checkout. */
export function PayForm({ orderId, tokenizer, error }: { orderId: string; tokenizer: Tokenizer; error?: string }) {
  const pay = useTokenizedSubmit(tokenizer);
  return (
    <form action={payOrderAction} onSubmit={pay.onSubmit} className="form-grid">
      <input type="hidden" name="orderId" value={orderId} />
      <PaymentFields tokenizer={tokenizer} error={pay.error ?? error} />
      <div className="wide"><button className="btn" type="submit">Pay now</button></div>
    </form>
  );
}
