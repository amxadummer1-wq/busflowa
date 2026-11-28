export type PaymentDetails = {
  upiId: string | null;
  payeeName: string | null;
};

export type ResolvedPaymentTarget = {
  upiId: string;
  payeeName: string;
};

export function resolvePaymentTarget(
  bus: PaymentDetails,
  owner: PaymentDetails,
): ResolvedPaymentTarget | null {
  const busUpiId = bus.upiId?.trim();
  const ownerUpiId = owner.upiId?.trim();
  const upiId = busUpiId || ownerUpiId;
  if (!upiId) return null;

  const payeeName = busUpiId ? bus.payeeName?.trim() || owner.payeeName?.trim() : owner.payeeName?.trim();
  if (!payeeName) return null;
  return { upiId, payeeName };
}

export function buildUpiPaymentUri(input: {
  upiId: string;
  payeeName: string;
  amount: number;
  ticketCode: string;
}): string {
  const query = new URLSearchParams({
    pa: input.upiId,
    pn: input.payeeName,
    am: input.amount.toFixed(2),
    cu: "INR",
    tn: `BUS FLOW ${input.ticketCode}`,
  });
  return `upi://pay?${query.toString()}`;
}

export function buildTicketQrValue(ticketCode: string): string {
  return `BUSFLOW:TICKET:${ticketCode}`;
}