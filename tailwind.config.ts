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
        infosign: {
          500: "#0054a5",
          900: "hsl(209, 65%, 30%)",
        },
        warningsign: {
          500: "#ffcd00",
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
