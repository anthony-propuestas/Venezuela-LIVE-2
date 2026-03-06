/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        dark: {
          bg: '#000000',
          surface: '#1a1f2e',
          card: '#252d3d',
          border: '#3a4556',
          borderLight: '#4a5568',
        },
        slate: {
          350: '#a8b4c4',
        },
      },
    },
  },
  plugins: [],
};

