/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        arcade: {
          bg: '#0b0f1a',
          panel: '#121826',
          card: '#161e2e',
          border: '#9fd4b8',
          muted: '#8b9bb4',
          accent: '#22d3ee',
          accent2: '#a78bfa',
          danger: '#f43f5e',
          success: '#34d399',
        },
      },
      fontFamily: {
        display: ['"Orbitron"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['"Exo 2"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 24px rgba(159, 212, 184, 0.22)',
      },
      backgroundImage: {
        'arcade-grid':
          'radial-gradient(ellipse at top, rgba(34,211,238,0.12), transparent 50%), linear-gradient(180deg, #0b0f1a 0%, #0e1422 100%)',
      },
    },
  },
  plugins: [],
};
