import localFont from "next/font/local";

// Loaded once here since Playfair Display is only used for poster headline
// text (see shared.ts: headlineFont) — Inter is already loaded app-wide.
export const playfairDisplay = localFont({
  src: "../../../../assets/fonts/playfair-display-latin.woff2",
  weight: "600 700",
  variable: "--font-playfair",
  display: "swap",
});
