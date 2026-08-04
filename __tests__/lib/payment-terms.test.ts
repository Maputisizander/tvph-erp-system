import { calculatePaymentDueDate, calculatePenaltyAmount } from "@/lib/payment-terms";

it("uses Manila's submission date", () => {
  expect(calculatePaymentDueDate(new Date("2026-07-14T17:00:00.000Z"), 30)).toBe("2026-08-14");
});

it("prorates monthly penalty daily at full precision", () => {
  expect(calculatePenaltyAmount({ amount: 100000, rate: 0.1, type: "monthly", overdueDays: 3 })).toBeCloseTo(1000, 6);
  expect(calculatePenaltyAmount({ amount: 100000, rate: 0.1, type: "monthly", overdueDays: 7 })).toBeCloseTo(70000 / 30, 6);
});

it("applies fixed penalty once", () => {
  expect(calculatePenaltyAmount({ amount: 100000, rate: 0.1, type: "fixed", overdueDays: 12 })).toBeCloseTo(10000, 6);
});
