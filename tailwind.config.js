/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Hebrew-first stack. Rubik/Assistant if installed by the OS, else system.
        sans: ['Rubik', 'Assistant', 'system-ui', 'Arial', 'sans-serif'],
        // Wordmark + page H1s only — used sparingly, everything else stays sans.
        display: ['"Secular One"', 'Rubik', 'system-ui', 'sans-serif'],
        // Classic literary/biblical Hebrew serif — for the odd authentic-feeling
        // quote or flourish, never body text.
        quote: ['"Frank Ruhl Libre"', 'serif'],
      },
      colors: {
        // Primary — warm coral-orange. Evolves the old single-ramp brand color
        // into a full scale so hover/active/subtle states don't all reuse 600.
        brand: {
          50: '#FFF1EC',
          100: '#FFE0D5',
          200: '#FFC3AE',
          300: '#FF9E7D',
          400: '#F5794F',
          500: '#EA5B3F',
          600: '#D6432A',
          700: '#B23320',
          800: '#8A2818',
          900: '#5C1B10',
        },
        // Secondary accent — mustard gold. Save/bookmark states, badges,
        // ratings; gives the palette a second job so brand isn't overloaded.
        accent: {
          50: '#FBF3E1',
          100: '#F5E4B8',
          200: '#EDCE80',
          300: '#E3B85A',
          400: '#D9A33D',
          500: '#C08A2A',
          600: '#9C6D1E',
          700: '#785417',
        },
        // Warm neutrals — hue-biased toward the palette instead of flat gray,
        // and tuned so the text tiers (500+) clear 4.5:1 on `paper`.
        stone: {
          50: '#FFF8F0',
          100: '#FBEFE2',
          200: '#F0DFCE',
          300: '#DCC6AE',
          400: '#B99C86',
          500: '#8F6E60',
          600: '#6E5348',
          700: '#4F3B33',
          800: '#362721',
          900: '#26140D',
        },
        success: { 500: '#2F8F5B', 600: '#26744A' },
        danger: { 500: '#D9433A', 600: '#B93129' },
      },
    },
  },
  plugins: [],
};
