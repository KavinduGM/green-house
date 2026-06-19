/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        leaf: { 50:'#f1f8f3',100:'#dceede',200:'#bbddc1',300:'#8ec59a',400:'#5ba56d',500:'#3a8a4f',600:'#2b6e3d',700:'#245833',800:'#1f4a2c',900:'#1a3d25' },
        soil: { 700:'#5b4636' },
      },
      fontFamily: { sans: ['Inter','system-ui','-apple-system','sans-serif'] },
      boxShadow: { card: '0 1px 3px rgba(16,40,24,0.06), 0 1px 2px rgba(16,40,24,0.04)' },
    },
  },
  plugins: [],
};
