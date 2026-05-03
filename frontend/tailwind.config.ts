import type { Config } from 'tailwindcss';

// Senior-friendly defaults plus a refined visual layer: larger base font,
// strong contrast, generous line-height, layered shadows, and a small warm
// accent (sand) used sparingly to soften the mostly-cool maritime palette.
// Don't reduce sizes / drop accents without revisiting the user-research notes.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        // For display headings (login hero, dashboard greeting). Native serif
        // adds a touch of weight/seniority without an external font dep.
        display: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        xs:    ['0.875rem',  { lineHeight: '1.5rem' }],   // 14
        sm:    ['1rem',      { lineHeight: '1.625rem' }], // 16
        base:  ['1.0625rem', { lineHeight: '1.7rem' }],   // 17
        lg:    ['1.1875rem', { lineHeight: '1.85rem' }],  // 19
        xl:    ['1.375rem',  { lineHeight: '2rem' }],     // 22
        '2xl': ['1.625rem',  { lineHeight: '2.25rem' }],  // 26
        '3xl': ['2rem',      { lineHeight: '2.5rem' }],   // 32
        '4xl': ['2.5rem',    { lineHeight: '2.875rem' }], // 40 — display
        '5xl': ['3rem',      { lineHeight: '3.25rem' }],  // 48 — display
      },
      letterSpacing: {
        tightish: '-0.01em',
        display: '-0.02em',
      },
      colors: {
        navy: {
          50:  '#f4f7fb',
          100: '#e2eaf3',
          200: '#bdcde0',
          300: '#8aa6c7',
          400: '#5f7da6',
          500: '#456690',
          600: '#2c4d7c',
          700: '#1e3a5f',
          800: '#13294a',
          900: '#0f1f35',
          950: '#091221',
        },
        teal: {
          50:  '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        // Warm accent — used sparingly (badges, subtle highlights). Keeps the
        // UI from feeling clinically blue.
        sand: {
          50:  '#fbf7ee',
          100: '#f5ead4',
          200: '#ead2a0',
          400: '#d2a85a',
          600: '#a47a31',
        },
      },
      minHeight: {
        tap: '2.75rem',
      },
      minWidth: {
        tap: '2.75rem',
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        xl: '0.875rem',
      },
      boxShadow: {
        // Subtle, layered. Two shadows = depth without harsh edges.
        card:        '0 1px 2px rgba(15, 31, 53, 0.04), 0 4px 12px rgba(15, 31, 53, 0.05)',
        'card-hover':'0 4px 8px rgba(15, 31, 53, 0.06), 0 12px 28px rgba(15, 31, 53, 0.08)',
        focus:       '0 0 0 3px rgba(13, 148, 136, 0.25)',
      },
      backgroundImage: {
        'maritime-hero': `radial-gradient(circle at 20% -10%, rgba(45, 212, 191, 0.18), transparent 55%),
                          radial-gradient(circle at 110% 110%, rgba(20, 184, 166, 0.10), transparent 55%),
                          linear-gradient(140deg, #0f1f35 0%, #13294a 60%, #0d9488 200%)`,
      },
    },
  },
  plugins: [],
};

export default config;
