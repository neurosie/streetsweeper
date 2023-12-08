import { type AppType } from "next/app";
import { Overpass, Sail } from "next/font/google";
import { QueryClientProvider } from "@tanstack/react-query";

import { api, queryClient } from "~/utils/api";

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
  return (
    <div
      className={`${overpass.variable} ${sail.variable} min-h-screen bg-gradient-to-b from-zinc-900 to-neutral-800 font-sans text-white`}
    >
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
