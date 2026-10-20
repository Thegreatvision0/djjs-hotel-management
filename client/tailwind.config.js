/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Rupee", '"DM Sans"', "system-ui", "sans-serif"],
        display: ['"Cormorant Garamond"', "Georgia", "serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        ink: { 950: "#0f1420", 900: "#151b2b", 800: "#1e2638", 700: "#2a3348", 600: "#3b4560" },
        gold: { 50: "#fbf7ec", 100: "#f4ead0", 200: "#e9d5a1", 300: "#dcbc6e", 400: "#c9a84c", 500: "#b08d3c", 600: "#8f7030", 700: "#6e5626" },
        canvas: "#f6f5f1",
        line: "#e8e5dc",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)",
        pop: "0 12px 32px -8px rgba(16,24,40,.18), 0 4px 8px -4px rgba(16,24,40,.08)",
      },
      keyframes: {
        "slide-in": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
        "fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
        "pop-in": { from: { opacity: 0, transform: "scale(.97) translateY(4px)" }, to: { opacity: 1, transform: "none" } },
      },
      animation: {
        "slide-in": "slide-in .22s cubic-bezier(.2,.8,.2,1)",
        "fade-in": "fade-in .15s ease-out",
        "pop-in": "pop-in .18s cubic-bezier(.2,.8,.2,1)",
      },
    },
  },
  plugins: [],
};
