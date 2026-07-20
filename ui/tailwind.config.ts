import type { Config } from "tailwindcss";

// Palette + type lifted from the zelos site so this panel feels like the same brand.
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0E1F3A",
        "ink-soft": "#2C3E5C",
        green: { DEFAULT: "#1FBD55", deep: "#18A246", soft: "#2FCB66" },
        blue: { DEFAULT: "#3D4FE5", deep: "#2A3DD0" },
        yellow: { DEFAULT: "#FFB325", deep: "#F59E0B" },
        orange: "#FB923C",
        paper: "#FFFFFF",
        "paper-warm": "#FFFBF1",
        neutral: { 50: "#F8F9FB", 100: "#EEF1F6", 200: "#DDE3EC", 300: "#C7D0DD" },
      },
      fontFamily: {
        sans: ["var(--font-mulish)", "system-ui", "sans-serif"],
        mono: ["var(--font-jbmono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      keyframes: {
        "fade-up": { "0%": { opacity: "0", transform: "translateY(16px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        spin360: { to: { transform: "rotate(360deg)" } },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out forwards",
      },
    },
  },
  plugins: [],
};
export default config;
