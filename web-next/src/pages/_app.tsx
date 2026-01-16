import type { AppProps } from "next/app";
import "@/styles/globals.css";
import Head from "next/dist/shared/lib/head";

export default function App({ Component, pageProps }: AppProps) {
    return (
    <>
      <Head>
        {/* <title>TIC-OX</title> */}
        <link rel="icon" href="/xo.png" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
