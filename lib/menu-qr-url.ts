const DEFAULT_MENU_QR_BASE_URL = "https://menu.yummyever.com/qr";

export function getMenuQrUrl(
  token: string,
  configuredBase = process.env.NEXT_PUBLIC_MENU_QR_BASE_URL,
) {
  const base = configuredBase?.trim() || DEFAULT_MENU_QR_BASE_URL;
  return `${base.replace(/\/+$/, "")}/${encodeURIComponent(token)}`;
}
