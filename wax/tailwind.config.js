/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        wax: {
          50: '#fdf8f0',
          100: '#f5e6cc',
          200: '#e8c88a',
          300: '#d4a24a',
          400: '#c4882a',
          500: '#a66f1e',
          600: '#855818',
          700: '#654214',
          800: '#4a3010',
          900: '#2d1d0a',
          950: '#1a1006',
        },
      },
    },
  },
  plugins: [],
};
