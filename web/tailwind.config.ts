/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}", // <-- Esta línea es vital si usas la carpeta src
  ],
  theme: {
    extend: {
      colors: {
        cruci: {
          red: '#D32F2F',
          dark: '#0a0a0a',
        },
      },
    },
  },
  plugins: [],
}