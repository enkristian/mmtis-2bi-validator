# MMTIS 2b.i validator

Client-side validator for NeTEx sales offer packages against the Nordic MMTIS 2b.i profile.

https://enkristian.github.io/mmtis-2bi-validator/

Everything runs in your browser. Drop in your own XML file(s) — nothing is uploaded anywhere, and the page makes no network calls.

## Files

- `index.html` — markup only
- `styles.css` — all styling
- `meta.js` — NeTEx enum values, product references, and rule text (no user data)
- `validate.js` / `delivery.js` — validation logic
- `app.js` — UI wiring (drag & drop, rendering, navigation)

This is a manual copy of `html/` from the `mmtis-2b` generator repo, split into separate files (the original ships as one generated file). If the source changes, re-copy and re-split it here.
