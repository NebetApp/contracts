/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Nebet Brand Colors
        'nebet-primary': '#1E2E3F',
        'nebet-secondary': '#223A4E',
        'nebet-tertiary': '#275365',
        'nebet-accent': '#3B7F9F',
        'nebet-grey': '#8F969C',
        'nebet-mist': '#F2F5F7',
      },
      fontFamily: {
        'heading': ['Nunito', 'system-ui', 'sans-serif'],
        'body': ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'in': 'in 0.2s ease-out',
        'slide-in-from-right': 'slide-in-from-right 0.3s ease-out',
      },
      keyframes: {
        'in': {
          '0%': { transform: 'translateY(18px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        'slide-in-from-right': {
          '0%': { transform: 'translateX(100%)', opacity: 0 },
          '100%': { transform: 'translateX(0)', opacity: 1 },
        },
      },
    },
  },
  plugins: [],
};