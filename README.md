# pjmoller.github.io

Source for my personal portfolio site, a terminal-themed single page built with
plain HTML, CSS and JS (no framework, no build step). It's served straight from
GitHub Pages.

**Live site:** https://pjmoller.github.io

## Structure

```
index.html        the site itself (hero, work, about, play, contact)
css/style.css      all styling
script/script.js   renders projects from projects.json, scroll effects, etc.
projects.json      project data (see below), edited through /admin instead of by hand
admin/             password-protected panel for managing projects.json
worker/            source for the Cloudflare Worker the admin panel talks to
```

## Projects data

`projects.json` is the single source of truth for the "work" section. Each
entry looks like:

```json
{
  "id": "wildlands",
  "title": "Wildlands visitor predictor",
  "tags": ["Python", "Flask", "machine learning"],
  "blurb": "shown on the project card",
  "detail": "shown in the tap-for-more popup",
  "repos": [{ "label": "repo", "url": "https://github.com/..." }],
  "featured": true,
  "order": 1
}
```

`script.js` fetches this file and renders `featured: true` projects as cards in
the grid, everything else as compact rows further down. `order` controls
ranking within each group.

## Admin panel

`/admin` is a small CMS so I can add, edit, reorder and import projects
without touching code or committing JSON by hand. It's password protected and
talks to a Cloudflare Worker (`worker/worker.js`, deployed separately, not
part of this static site) instead of GitHub directly, so the admin password
and the GitHub token used to commit changes never live in this repo or in any
browser-shipped JS. `admin/admin.js` only ever sees a short-lived session
token after logging in.

What it can do:
- **Import from GitHub** — paste a repo URL, it pulls the name, primary
  language and README through the Worker.
- **Copy prompt for Claude** — builds a prompt from the imported README so I
  can paste it into a Claude chat and get a blurb/story written in my voice,
  then paste that back in. Nothing is generated automatically inside the
  panel itself.
- **Reorder / feature / delete** projects, edit tags, blurb, story and repo
  links.
- **Save to GitHub** — commits the updated `projects.json` straight to `main`
  through the Worker's GitHub token. GitHub Pages picks it up within a
  minute or so.

### Worker

The Worker (`worker/worker.js`) is the actual security boundary:

- `POST /login` checks the password and hands back a 12h HMAC-signed session
  token.
- `GET /projects` / `PUT /projects` read and write `projects.json` via
  GitHub's Contents API, authenticated with a fine-grained PAT scoped to just
  this repo's contents.
- `GET /import` proxies a repo's metadata and README from GitHub.

All of `ADMIN_PASSWORD`, `GITHUB_TOKEN` and `SESSION_SECRET` are set as
Worker secrets on Cloudflare, not committed anywhere. `worker.js` in this repo
is kept for version control only, the deployed copy is what's actually live.

## Local dev

It's static files, so any local server works:

```
python3 -m http.server 8000
```

The admin panel needs `WORKER_URL` in `admin/admin.js` pointed at a deployed
Worker to do anything beyond show the lock screen.
