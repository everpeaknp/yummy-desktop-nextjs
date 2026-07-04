export const CHECKOUT_MULTIPLE_ACTIVE_CASH_DRAWERS_MESSAGE =
  "Multiple active cash drawers are available to you. Close or reassign one before taking cash.";

export const CHECKOUT_OPEN_CASH_DRAWER_MESSAGE =
  "Open your cash drawer from Cash Drawers before taking a cash payment.";

const PAYMENT_READY_DRAWER_STATUSES = new Set([
  "opened",
  "closing_count_required",
  "reopened",
]);

type CheckoutDrawerResponse<TSession> = {
  data?: TSession[] | null;
  message?: unknown;
} | null | undefined;

export type CheckoutCashDrawerReadiness<TSession> = {
  controlsEnabled: boolean;
  paymentReadySessions: TSession[];
  ready: boolean;
  message: string;
};

export function isCheckoutPaymentReadyDrawer(session: { status?: unknown }) {
  return PAYMENT_READY_DRAWER_STATUSES.has(String(session.status || "").toLowerCase());
}

export function resolveCheckoutCashDrawerReadiness<TSession extends { status?: unknown }>(
  responseData: CheckoutDrawerResponse<TSession>,
): CheckoutCashDrawerReadiness<TSession> {
  const message = String(responseData?.message || "").toLowerCase();
  if (message.includes("controls are disabled")) {
    return {
      controlsEnabled: false,
      paymentReadySessions: [],
      ready: true,
      message: "",
    };
  }

  const rows = Array.isArray(responseData?.data) ? responseData.data : [];
  const paymentReadySessions = rows.filter(isCheckoutPaymentReadyDrawer);

  if (paymentReadySessions.length === 1) {
    return {
      controlsEnabled: true,
      paymentReadySessions,
      ready: true,
      message: "",
    };
  }

  if (paymentReadySessions.length > 1) {
    return {
      controlsEnabled: true,
      paymentReadySessions,
      ready: false,
      message: CHECKOUT_MULTIPLE_ACTIVE_CASH_DRAWERS_MESSAGE,
    };
  }

  return {
    controlsEnabled: true,
    paymentReadySessions,
    ready: false,
    message: CHECKOUT_OPEN_CASH_DRAWER_MESSAGE,
  };
}
