import { type AppType } from "next/app";
import { Overpass, Sail } from "next/font/google";

import { api } from "~/utils/api";

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
      className={`${overpass.variable} ${sail.variable} min-h-screen bg-gradient-to-b from-neutral-900 to-stone-700 font-sans text-white`}
    >
      <Component {...pageProps} />
    </div>
  );
};

export default api.withTRPC(MyApp);
