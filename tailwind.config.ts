import { type Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        sign: {
          200: "#DFF0EA",
          400: "#7FC9B2",
          800: "#006747",
        },
        royalblue: {
          500: "#0047A3",
        },
      },
      fontFamily: {
        sans: ["var(--font-overpass)"],
      },
    },
  },
  plugins: [require("@headlessui/tailwindcss")],
} satisfies Config;
