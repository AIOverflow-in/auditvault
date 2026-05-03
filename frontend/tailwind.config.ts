import type { Config } from 'tailwindcss';

// Senior-friendly defaults: larger base font, stronger contrast, generous
// line-height. Don't reduce these without revisiting the user-research notes.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      fontSize: {
        // Bumped one notch above Tailwind defaults; base is 17px.
        xs: ['0.875rem', { lineHeight: '1.5rem' }],   // 14
        sm: ['1rem',     { lineHeight: '1.625rem' }], // 16
        base: ['1.0625rem', { lineHeight: '1.7rem' }], // 17
        lg: ['1.1875rem', { lineHeight: '1.85rem' }], // 19
        xl: ['1.375rem',  { lineHeight: '2rem' }],    // 22
        '2xl': ['1.625rem', { lineHeight: '2.25rem' }], // 26
        '3xl': ['2rem',    { lineHeight: '2.5rem' }],
      },
      colors: {
        // Maritime palette
        navy: {
          50:  '#f4f7fb',
          100: '#e2eaf3',
          200: '#bdcde0',
          400: '#5f7da6',
          600: '#2c4d7c',
          700: '#1e3a5f',
          800: '#13294a',
          900: '#0f1f35',
        },
        teal: {
          50:  '#f0fdfa',
          100: '#ccfbf1',
          400: '#2dd4bf',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
        },
      },
      minHeight: {
        // 44px tap target floor for primary controls
        tap: '2.75rem',
      },
      minWidth: {
        tap: '2.75rem',
      },
      borderRadius: {
        DEFAULT: '0.5rem',
      },
    },
  },
  plugins: [],
};

export default config;
