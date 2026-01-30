/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./tpl/*.ftl'],
  theme: {
    extend: {},
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
        'corporate',
        {
          business: {
              // ...require("daisyui/src/colors/themes")["[data-theme=business]"],
              'primary': '#c891f2'
          }
        }
    ],
    darkTheme: 'business'
}
}

