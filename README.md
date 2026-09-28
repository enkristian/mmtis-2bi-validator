# MMTIS 2b.i validator

Client-side validator for NeTEx sales offer packages against the Nordic MMTIS 2b.i profile.

https://enkristian.github.io/mmtis-2bi-validator/

Everything runs in your browser. Drop in your own XML file(s) — nothing is uploaded anywhere, and the page makes no network calls.

## Files

- `index.html` — markup only
- `styles.css` — all styling
- `meta.js` — NeTEx enum values, product references, and rule text (no user data)
- `validate_2bi.js` / `delivery_2bi.js` — validation logic
- `app.js` — UI wiring (drag & drop, rendering, navigation)

This is a straight copy of `html/` from the `mmtis-2b` generator repo (`validator.html` → `index.html`, everything else unchanged) — that generator now writes this exact file layout on every build. To update after a source change, copy those 6 files here again.
