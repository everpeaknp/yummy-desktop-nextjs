// Native number-input arrows should move payment amounts in useful cash
// increments. Decimal values remain accepted for an exact bill balance.
export const PAYMENT_AMOUNT_STEP = 10;

export function preventPaymentAmountWheelChange(
  input: Pick<HTMLInputElement, "blur">,
): void {
  input.blur();
}
