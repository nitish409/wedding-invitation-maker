import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/remotion/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        maroon: {
          DEFAULT: '#5C0A1B',
          dark: '#3B0510',
          light: '#82142B',
        },
        gold: {
          DEFAULT: '#D4AF37',
          light: '#F3E5AB',
          dark: '#9E7D1B',
        },
        cream: {
          DEFAULT: '#FFFDF9',
          warm: '#FDF6EC',
          blush: '#FADADD',
        },
      },
      fontFamily: {
        display: ['"Cinzel Decorative"', '"Cormorant Garamond"', 'serif'],
        serif: ['"Cormorant Garamond"', '"Noto Serif Devanagari"', 'serif'],
        sans: ['"Plus Jakarta Sans"', '"Noto Sans Devanagari"', 'sans-serif'],
        hindi: ['"Noto Serif Devanagari"', '"Rozha One"', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
