# Requests for other owners

## Desktop navigation

Enable the Phone tab in `public/index.html` and make it navigate to the standalone Phone dashboard at `http://127.0.0.1:4320/`. Clear the “soon” label and avoid dispatching Phone to the in-page Computer/Globe tab handler. The gateway owns the Phone page and links back to `http://127.0.0.1:4317/`.
