# Webbi website

Bilingual (French / English) marketing site for Webbi, a web design studio in Montreal.
Plain HTML, CSS and JavaScript: no build step.

## Structure

- `index.html`: the page (all sections: hero, why, about, services, process, pricing, FAQ, contact)
- `css/styles.css`: design tokens, light and dark themes, responsive layout, animations
- `js/i18n.js`: every piece of text in English and French. Edit copy here.
- `js/main.js`: language switch, price view (monthly / first-year total), build animation, contact form
- `assets/`: logo (light and dark versions)

## Language

The site picks French or English from the visitor's browser, remembers the choice from the FR/EN toggle,
and can be forced with a link: `?lang=fr` or `?lang=en`.

## Contact form

The form opens the visitor's email app with a pre-filled message to webbicontacts@gmail.com.
To receive submissions directly instead, connect it to a form service (Formspree, Netlify Forms, etc.)
in `initForm()` in `js/main.js`.

## Run locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deploy

### Hostinger

Upload `index.html`, `.htaccess`, `css/`, `js/` and `assets/` into `public_html` (hPanel → File Manager),
with `index.html` directly inside `public_html`. Then install the free SSL certificate (hPanel → Security → SSL).
`.htaccess` forces HTTPS, compresses files, sets browser caching and adds basic security headers.

When you change `css/styles.css` or a file in `js/`, raise the `?v=1` number on its link in `index.html`
(for example to `?v=2`) so returning visitors get the new version right away.

### Other hosts

Any static host works (GitHub Pages, Netlify, Vercel, Cloudflare Pages). On GitHub Pages:
Settings → Pages → Deploy from branch → select the branch and `/ (root)`.
