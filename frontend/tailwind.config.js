/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        'base-blue': '#0052FF',
        'polygon-purple': '#8247E5',
      }
    },
  },
  plugins: [],
}