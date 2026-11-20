# The Nile Pen

Live at https://thenilepen.com (deployed by Vercel from the `main` branch).

The site is a multi-page static site. Every page has its own address, title, description and share preview:

- `/` home, `/live`, `/about`, `/team`, `/submit`, `/contact`, `/advertise`, `/newsletter`, `/privacy`, `/terms`
- `/topic/<topic>` for the six sections
- `/article/<story>` for every story
- `404.html` for anything else

Other files: `sitemap.xml` (every page, for Google), `feed.xml` (RSS), `robots.txt`, `vercel.json` (clean URLs), `assets/` (scripts and fonts), icons and `og-image.png`.

Old links like `thenilepen.com/#/topic/climate` redirect to `/topic/climate` automatically.
