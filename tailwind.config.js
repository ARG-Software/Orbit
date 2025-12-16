/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts,css,scss,sass,less,styl}",
    "./index.html"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Proxima Nova"',
          'ui-sans-serif',
          'system-ui'
        ],
      },
      colors: {
        orbit: "#DCC4D5",
      }
    }
  },
  plugins: [
    require('daisyui')
  ],
  daisyui: {
    themes: [
      "dim",
      "pastel"
    ],
  }
}