import { type AppType } from "next/app";
import { Overpass, Sail } from "next/font/google";
import Head from "next/head";
import { QueryClientProvider } from "@tanstack/react-query";

import { api, queryClient } from "~/utils/api";
import useViewportHeight from "~/utils/useViewportHeight";

import "~/styles/globals.css";

const overpass = Overpass({
  subsets: ["latin"],
  variable: "--font-overpass",
  display: "swap",
});

const sail = Sail({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-sail",
  display: "swap",
});

const MyApp: AppType = ({ Component, pageProps }) => {
  useViewportHeight();

  return (
    <div
      className={`${overpass.variable} ${sail.variable} min-h-[var(--app-height)] bg-gradient-to-b from-zinc-900 to-neutral-800 font-sans text-white`}
    >
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, interactive-widget=resizes-content"
        />
      </Head>
      <style jsx global>{`
        :root {
          --font-overpass: ${overpass.style.fontFamily};
          --font-sail: ${sail.style.fontFamily};
        }
      `}</style>
      <QueryClientProvider client={queryClient}>
        <Component {...pageProps} />
      </QueryClientProvider>
    </div>
  );
};

export default api.withTRPC(MyApp);
