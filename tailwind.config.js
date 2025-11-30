/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dark mode backgrounds
        dark: {
          DEFAULT: '#0F172A',  // slate-900
          secondary: '#1E293B', // slate-800
          tertiary: '#334155',  // slate-700
          border: '#475569',    // slate-600
        },
        // Success/Profit colors
        profit: {
          bg: '#064E3B',
          DEFAULT: '#10B981',
          light: '#34D399',
          text: '#D1FAE5',
        },
        // Loss/Danger colors
        loss: {
          bg: '#7F1D1D',
          DEFAULT: '#EF4444',
          light: '#F87171',
          text: '#FEE2E2',
        },
        // Warning colors
        caution: {
          bg: '#78350F',
          DEFAULT: '#F59E0B',
          light: '#FCD34D',
          text: '#FEF3C7',
        },
        // Info/Accent colors
        accent: {
          bg: '#1E3A8A',
          DEFAULT: '#3B82F6',
          light: '#60A5FA',
          text: '#DBEAFE',
        },
        // Premium/Purple
        premium: {
          bg: '#581C87',
          DEFAULT: '#A855F7',
          light: '#C084FC',
          text: '#F3E8FF',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
      fontSize: {
        'xs': '0.75rem',
        'sm': '0.875rem',
        'base': '1rem',
        'lg': '1.125rem',
        'xl': '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
      },
      borderRadius: {
        'sm': '0.25rem',
        'md': '0.5rem',
        'lg': '0.75rem',
        'xl': '1rem',
      },
      boxShadow: {
        'sm': '0 1px 2px rgba(0, 0, 0, 0.2)',
        'md': '0 4px 6px rgba(0, 0, 0, 0.3)',
        'lg': '0 10px 15px rgba(0, 0, 0, 0.4)',
        'xl': '0 20px 25px rgba(0, 0, 0, 0.5)',
      }
    },
  },
  plugins: [],
}
