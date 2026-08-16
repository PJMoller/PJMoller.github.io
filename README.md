# pjmoller.github.io

Personal portfolio site. Terminal-themed, single page, plain HTML/CSS/JS, no
framework and no build step. Hosted for free on GitHub Pages.

Live at https://pjmoller.github.io

## What's in here

```
index.html        the actual site (hero, work, about, play, contact)
css/style.css      all the styling
script/script.js   pulls projects.json in and renders it, plus scroll effects etc.
projects.json      the project data, edited through /admin instead of by hand
admin/             a little password-locked panel for managing projects.json
worker/            the Cloudflare Worker the admin panel talks to
```

## The project data

`projects.json` drives the whole "work" section. Each project is just:

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

`script.js` reads this and puts anything with `featured: true` up top as a
card, everything else goes into the compact list further down. `order`
controls the ranking within each group.

## The admin panel

`/admin` adds, edits, reorders and imports projects without touching code or
hand-editing JSON. It's password protected, and it talks to a Cloudflare
Worker instead of GitHub directly, so the password and the GitHub token used
to commit changes never sit in this repo or get shipped to the browser. The
admin page itself only ever holds a short-lived session token once logged
in.

A few things it does:

- paste a GitHub repo link and it pulls the name, language and README
  through the Worker
- a "copy prompt" button builds a prompt from that README, meant to draft
  the blurb and story elsewhere, then paste back in
- reorder, feature, or delete projects, edit tags/blurb/story/repo links
- hitting save commits the updated `projects.json` straight to `main`.
  GitHub Pages usually picks it up within a minute

### the Worker

`worker/worker.js` checks the password, hands back a signed session token
good for 12 hours, and proxies reads/writes of `projects.json` plus repo
lookups through a GitHub token scoped to just this repo. None of
`ADMIN_PASSWORD`, `GITHUB_TOKEN` or `SESSION_SECRET` are committed anywhere,
they're set as Worker secrets on Cloudflare. The copy of `worker.js` in this
repo is here for version history, the one actually running is deployed
separately.

## running it locally

It's static files, so anything works, e.g.

```
python3 -m http.server 8000
```

The admin panel won't do much locally unless `WORKER_URL` in
`admin/admin.js` points at an actual deployed Worker, otherwise it's just
the lock screen.
