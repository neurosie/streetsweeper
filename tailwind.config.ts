import { type Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        sign: {
          200: "hsl(159, 36%, 91%)",
          400: "hsl(161, 41%, 64%)",
          500: "hsl(161, 80%, 33%)",
          600: "hsl(161, 100%, 20%)",
          700: "hsl(161, 100%, 13%)",
        },
        infosign: {
          500: "hsl(209, 100%, 32%)",
          800: "hsl(209, 65%, 30%)",
        },
        warningsign: {
          500: "hsl(48, 100%, 50%)",
        },
      },
      fontFamily: {
        sans: ["var(--font-overpass)"],
        cursive: ["var(--font-sail)"],
      },
      backgroundImage: {
        "road-line":
          "repeating-linear-gradient(90deg, transparent, transparent 1rem, var(--tw-gradient-from) 1rem, var(--tw-gradient-from) 3rem)",
      },
    },
  },
  plugins: [require("@headlessui/tailwindcss")],
} satisfies Config;
