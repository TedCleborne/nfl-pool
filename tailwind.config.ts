import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        nfl: {
          navy: '#013369',
          red: '#D50A0A',
          gold: '#FFB612',
        },
      },
    },
  },
  plugins: [],
}

export default config
