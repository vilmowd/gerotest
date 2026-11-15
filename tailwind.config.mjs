/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        arcade: {
          bg: '#141b2d',
          panel: '#1c2740',
          card: '#222e48',
          border: '#4a5d78',
          muted: '#8b9bb4',
          accent: '#22d3ee',
          accent2: '#a78bfa',
          danger: '#f43f5e',
          success: '#34d399',
        },
      },
      fontFamily: {
        display: ['"Exo 2"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['"Exo 2"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 24px rgba(34, 211, 238, 0.14)',
      },
      backgroundImage: {
        'arcade-grid':
          'radial-gradient(ellipse at top, rgba(34,211,238,0.12), transparent 50%), linear-gradient(180deg, #141b2d 0%, #101625 100%)',
      },
    },
  },
  plugins: [],
};
