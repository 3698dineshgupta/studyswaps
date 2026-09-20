/**
 * Browser helper: asks the server for a signed eSewa payload, then POSTs it
 * to eSewa via a hidden form (the ePay v2 flow is a form redirect).
 * No secrets here — signing happens in /api/payments/esewa/initiate.
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

  const { formUrl, fields } = data.payment as { formUrl: string; fields: Record<string, string> };

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
