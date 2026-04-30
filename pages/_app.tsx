import type { AppProps } from "next/app";

// Minimal Pages Router app wrapper.
// This project primarily uses the App Router (`app/`), but Next's build pipeline
// may still load `_app`/`_document` during page-data collection.
export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}

