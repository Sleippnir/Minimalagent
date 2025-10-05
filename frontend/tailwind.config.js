/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  corePlugins: {
    preflight: false, // Disable Tailwind's base reset to avoid -webkit-text-size-adjust
  },
  plugins: [],
}