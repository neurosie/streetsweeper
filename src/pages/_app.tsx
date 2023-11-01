import { type AppType } from "next/app";
import { Overpass } from "next/font/google";

import { api } from "~/utils/api";

import "~/styles/globals.css";

const overpass = Overpass({
  subsets: ["latin"],
  variable: "--font-overpass",
});

const MyApp: AppType = ({ Component, pageProps }) => {
  return (
    <main
      className={`${overpass.variable} min-h-screen bg-gradient-to-b from-gray-700 to-gray-800 font-sans text-white`}
    >
      <Component {...pageProps} />
    </main>
  );
};

export default api.withTRPC(MyApp);
