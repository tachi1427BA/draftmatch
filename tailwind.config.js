/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      keyframes: {
        "lottery-spin": {
          "0%":   { transform: "rotate(0deg) scale(1)",    borderColor: "rgb(250 204 21)" },
          "25%":  { transform: "rotate(90deg) scale(1.15)", borderColor: "rgb(239 68 68)" },
          "50%":  { transform: "rotate(180deg) scale(1)",  borderColor: "rgb(59 130 246)" },
          "75%":  { transform: "rotate(270deg) scale(1.15)", borderColor: "rgb(168 85 247)" },
          "100%": { transform: "rotate(360deg) scale(1)",  borderColor: "rgb(250 204 21)" },
        },
        "lottery-glow": {
          "0%, 100%": { boxShadow: "0 0 12px 4px rgba(250,204,21,0.6)" },
          "50%":       { boxShadow: "0 0 28px 8px rgba(239,68,68,0.8)" },
        },
      },
      animation: {
        "lottery-spin": "lottery-spin 0.7s linear infinite",
        "lottery-glow": "lottery-glow 0.9s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
