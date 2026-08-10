/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#070910",
          card: "#0d111d",
          elevated: "#151b2b",
          border: "#26314a",
        },
        accent: {
          DEFAULT: "#8b7cff",
          light: "#a996ff",
          dark: "#6d4df2",
        },
      },
    },
  },
  plugins: [],
};
