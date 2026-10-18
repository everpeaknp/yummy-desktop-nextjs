import localFont from "next/font/local";

// Loaded once here since Playfair Display is only used for poster headline
// text (see shared.ts: headlineFont) — Inter is already loaded app-wide.
export const playfairDisplay = localFont({
  src: "./playfair-display-latin-wght-normal.woff2",
  weight: "400 900",
  style: "normal",
  variable: "--font-playfair",
  display: "swap",
});
