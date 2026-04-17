/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'chubut-yellow': '#FFB800',
        'chubut-orange': '#FF6B00',
        'chubut-blue-light': '#6B9AB0',
        'chubut-blue-dark': '#2C5F78',
        'chubut-bg': '#F0F4F7',
      },
    },
  },
  plugins: [],
}