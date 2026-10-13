/**
 * Browser helpers: eSewa's ePay v2 flow is a form POST redirect, so paying means building a hidden
 * form from server-signed fields and submitting it. No secrets here — signing happens server-side.
 */

export interface EsewaFormPayload { formUrl: string; fields: Record<string, string> }

/** Builds and submits the hidden form that sends the browser to eSewa. */
export function submitEsewaForm({ formUrl, fields }: EsewaFormPayload): void {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = formUrl;
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

/**
 * Asks the server for a signed eSewa payload for an order placed earlier, then pays.
 * Checkout itself already gets the payload back from POST /api/orders (one fewer round trip) and
 * should call submitEsewaForm directly; this is for "Pay now" on an existing unpaid order.
 */
export async function startEsewaPayment(orderId: string): Promise<void> {
  const res = await fetch('/api/payments/esewa/initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.payment) {
    throw new Error(data.error || 'Could not start eSewa payment');
  }

  submitEsewaForm(data.payment as EsewaFormPayload);
}
