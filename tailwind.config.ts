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
      keyframes: {
        "car-bounce": {
          "50%": {
            transform: "translateY(-15%)",
            "animation-timing-function": "cubic-bezier(0.7, 0, 1, 1)",
          },
          "0%, 100%": {
            transform: "none",
            "animation-timing-function": "cubic-bezier(0, 0, 0.3, 1)",
          },
        },
        "spin-reverse": {
          from: {
            transform: "rotate(0deg)",
          },
          to: {
            transform: "rotate(-360deg)",
          },
        },
      },
      animation: {
        "car-bounce": "car-bounce 0.75s infinite",
      },
    },
  },
  plugins: [require("@headlessui/tailwindcss")],
} satisfies Config;
