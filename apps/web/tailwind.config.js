/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts}'],
  theme: {
    extend: {
      colors: {
        veltara: {
          bg: '#0a0a12',
          panel: '#13131f',
          border: '#1e1e32',
          accent: '#6c63ff',
          glow: '#4fffb0',
          text: '#e2e2f0',
          muted: '#6b6b8a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
