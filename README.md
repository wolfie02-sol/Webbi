# Webbi website

Bilingual (French / English) marketing site for Webbi, a web design studio in Montreal.
Plain HTML, CSS and JavaScript: no build step.

## Structure

The site has 5 pages in each language, each with its own address:

| Page | French | English |
|---|---|---|
| Home | `/fr/` | `/en/` |
| Services and process | `/fr/services/` | `/en/services/` |
| Pricing and FAQ | `/fr/tarifs/` | `/en/pricing/` |
| About | `/fr/a-propos/` | `/en/about/` |
| Contact | `/fr/contact/` | `/en/contact/` |
| Privacy policy (footer link) | `/fr/confidentialite/` | `/en/privacy/` |

The root address `/` sends visitors to the language they last used, or to French.

Files you edit:

- `js/i18n.js`: every piece of text, in English and French
- `src/template.html`: the layout of all pages (each page is a `<!-- page:… -->` block)
- `css/styles.css`: design, light and dark themes, responsive layout, animations
- `js/main.js`: price view (monthly / first-year total), build animation, swipe between pages on phones, contact form
- `site.config.json`: your website address (`siteUrl`, for example `"https://webbi.ca"`) and default language
- `contact.php`: emails contact form requests to webbicontacts@gmail.com (spam trap and rate limit included)
- Client projects shown on the home page: the Laura Carina Azcue card is in `src/template.html` (text in `js/i18n.js`, keys starting with `work.`)
- `demos/`: three simple example sites for fictional businesses, shown on the home page (plain HTML, edit directly)
- `assets/fonts/`: the site fonts, hosted with the site (no Google Fonts requests)
- `assets/`: logos, browser icons (`favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`), share images
  (`og-fr.png`, `og-en.png`) and example site thumbnails (`assets/demos/`)

Generated files (do not edit by hand): `index.html`, `404.html`, `fr/`, `en/`, `robots.txt`, and `sitemap.xml` once `siteUrl` is set.

## Making changes

After editing any of the files above, rebuild the pages (needs [Node.js](https://nodejs.org)):

```bash
node scripts/build.js
```

Then upload the result. The build adds a version number to the CSS and JS links, so visitors always get the latest files.

Set `siteUrl` in `site.config.json` as soon as you know your domain, then rebuild: this adds the links Google uses
to match French and English pages, and creates `sitemap.xml`. Submit `https://yourdomain/sitemap.xml` in
Google Search Console.

## Contact form

The form posts to `contact.php`, which emails the request to webbicontacts@gmail.com with the visitor as Reply-To.
For reliable delivery, create a mailbox named `no-reply@yourdomain` in Hostinger (hPanel → Emails): the script sends from that address.
Then send yourself a test request from the live site and check your spam folder the first time.

If the server can't be reached (for example, the page is opened straight from disk), the form falls back to opening
the visitor's email app with the message filled in.

## Privacy policy

The text is in `js/i18n.js` (keys starting with `privacy.`). It is a starting point written for Quebec's Law 25:
have it reviewed, and update the retention period or contact person if they differ for your business.

## Run locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deploy

### Hostinger

Upload `index.html`, `404.html`, `contact.php`, `.htaccess`, `robots.txt` (and `sitemap.xml` if present), and the folders
`fr/`, `en/`, `css/`, `js/`, `assets/` and `demos/` into `public_html` (hPanel → File Manager), with `index.html` directly inside `public_html`. Then install the free SSL certificate (hPanel → Security → SSL).
`.htaccess` forces HTTPS, compresses files, sets browser caching and adds basic security headers.


### Other hosts

Any static host works (GitHub Pages, Netlify, Vercel, Cloudflare Pages). On GitHub Pages:
Settings → Pages → Deploy from branch → select the branch and `/ (root)`.
