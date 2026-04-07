import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sage:        { DEFAULT: "#7D9D9C", dark: "#6a8a89" },
        cream:       "#FAF9F6",
        mist:        "#F0F4F4",
        ink:         "#2C3333",
        soul:        "#7B54BD",
        "soul-dark": "#6340a8",
      },
      fontFamily: {
        display: ["Cormorant Garamond", "Georgia", "serif"],
        sans:    ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card:  "12px",
        glass: "20px",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
