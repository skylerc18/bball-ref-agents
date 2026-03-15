import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        court: {
          950: "#0e1a12",
          900: "#14261a",
          700: "#1f3f2a",
          500: "#2f6b43",
          300: "#8bbf6c"
        },
        whistle: {
          500: "#f2b632",
          400: "#f7c85c"
        }
      },
      boxShadow: {
        panel: "0 12px 32px rgba(0, 0, 0, 0.28)"
      }
    }
  },
  plugins: []
};

export default config;
