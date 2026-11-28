import { describe, expect, it } from "vitest";

import { buildTicketQrValue, buildUpiPaymentUri, resolvePaymentTarget } from "@/lib/ticketing";

describe("ticket payment details", () => {
  it("uses the bus UPI override before the owner's UPI details", () => {
    expect(
      resolvePaymentTarget(
        { upiId: "bus@bank", payeeName: "Bus Account" },
        { upiId: "owner@bank", payeeName: "Owner Account" },
      ),
    ).toEqual({ upiId: "bus@bank", payeeName: "Bus Account" });
  });

  it("falls back to the owner's UPI details when the bus has no override", () => {
    expect(
      resolvePaymentTarget(
        { upiId: null, payeeName: null },
        { upiId: "owner@bank", payeeName: "Owner Account" },
      ),
    ).toEqual({ upiId: "owner@bank", payeeName: "Owner Account" });
  });

  it("creates a UPI intent for the exact fare amount and INR", () => {
    const url = new URL(
      buildUpiPaymentUri({
        upiId: "owner@bank",
        payeeName: "Owner Account",
        amount: 25.5,
        ticketCode: "BF-TEST",
      }),
    );

    expect(url.protocol).toBe("upi:");
    expect(url.searchParams.get("pa")).toBe("owner@bank");
    expect(url.searchParams.get("am")).toBe("25.50");
    expect(url.searchParams.get("cu")).toBe("INR");
  });

  it("encodes a ticket's public QR value using only its unique ticket code", () => {
    expect(buildTicketQrValue("BF-TEST")).toBe("BUSFLOW:TICKET:BF-TEST");
  });
});