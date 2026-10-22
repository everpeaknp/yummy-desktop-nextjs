import { Playfair_Display } from "next/font/google";

// Loaded once here since Playfair Display is only used for poster headline
// text (see shared.ts: headlineFont) — Inter is already loaded app-wide.
export const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-playfair",
  display: "swap",
});
