import { Html, Head, Main, NextScript } from "next/document";

// This repo uses the App Router (`app/`), but Next still expects a `_document`
// page during `next build` (it checks for custom getInitialProps).
// Providing a minimal Document keeps builds stable and doesn't affect App Router rendering.
export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

