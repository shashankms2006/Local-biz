\# Deploy this project to Vercel



\## Project layout

This folder is the Vercel project root. It contains `package.json`, `src/`, `server/`, `api/`, and `vercel.json`.



\## Vercel settings

\- Root Directory: the folder containing this `package.json` (if you upload the contents of this folder to the repository root, choose `.`).

\- Framework Preset: Vite (or leave detected automatically).

\- Build Command: `npm run build`

\- Output Directory: `dist`

\- Install Command: `npm install` (default is fine).



\## Environment variables

In Vercel → Project → Settings → Environment Variables, add:

\- `GOOGLE\_MAPS\_API\_KEY` = your server-side Google Places API key

\- optionally `GOOGLE\_REGION\_CODE` = `IN`



Enable the variable for Production and any Preview/Development environments you use. Never put the key in a `VITE\_` variable or commit it to Git.



After saving variables, redeploy the latest deployment.



\## API routes

`api/places/details.js` provides an explicit Vercel function for the preview's Places details request. `api/\[...path].js` forwards the other `/api/\*` requests to the existing Express app in `server/index.js`. Vercel routes these function requests directly; `vercel.json` only rewrites non-function paths to the Vite app. The API includes `/api/health`, `/api/places/details`, `/api/places/resolve`, `/api/places/search`, `/api/places/instant`, and `/api/websites/check`.



After deployment, open `/api/health` on your deployment URL. It should return JSON with `ok: true`. If it returns 500, inspect Vercel Function Logs and verify the Google API key variable. If it returns 404, verify that Vercel Root Directory points to this folder and that `api/\[...path].js` exists in the deployed repository.



\## Local development

Copy `.env.example` to `.env`, add your key, then run `npm install` and `npm run dev`. Vite proxies `/api` to the Express server on port 3001.

