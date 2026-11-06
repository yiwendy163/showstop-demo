# ShowStop demo app

Portfolio demo of the ShowStop redesign: a landing page plus a dashboard that turns a TikTok trend into an editable production plan. All trends and plans are illustrative samples in `data/`; nothing calls an AI model (D07, D13).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static output in dist/, relative paths for GitHub Pages
npm run deploy     # build and publish dist/ to the gh-pages branch
```

Live demo: https://yiwendy163.github.io/showstop-demo/

```bash
```

Deep links for portfolio visitors: `#/home?as=maya` or `#/home?as=jordan` open the dashboard as a sample creator. `#/plan/new/<trendId>?fail=1` shows the generation-failure state once.

## Structure

- `data/` — sample creators, trends and plans (labelled samples).
- `src/lib/` — hash router, browser-only store (guarded localStorage), plan model and plain-text export.
- `src/screens/` — Landing, Profile, Home, Feed, Detail, Editor (option C, D4.4), Saved.
- `scripts/shoot.mjs` — headless Chrome screenshots with device emulation for iteration records: `node scripts/shoot.mjs <outDir> 390x844@2 name=<url>`.
