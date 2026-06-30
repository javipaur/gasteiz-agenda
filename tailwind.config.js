/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./app/**/*.{ts,tsx}",
      "./pages/**/*.{ts,tsx}",
      "./components/**/*.{ts,tsx}",
    ],
    darkMode: 'class',
    theme: {
      extend: {
        colors: {
          primary: "#00675c",
          "primary-fixed": "#99ecdd",
          secondary: "#005ab1",
          // …todas tus otras variables
        },
        fontFamily: {
          headline: ["Epilogue", "sans-serif"],
          body: ["Manrope", "sans-serif"],
          label: ["Manrope", "sans-serif"],
        },
      },
    },
    plugins: [],
  };