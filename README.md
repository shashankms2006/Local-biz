\# BizFinder — Local Business Outreach Dashboard (Google Maps edition)



Find salons, spas, gyms, turfs/playgrounds and tours \& travels in a city, see which have no

working website, track leads, and generate preview sites. Business data comes from the

\*\*Google Places API (New)\*\*.



\## Setup



1\. In Google Cloud Console, use (or create) a project, \*\*enable "Places API (New)"\*\*, turn on billing

&#x20;  if Google asks (new accounts get free usage), and create an API key.

2\. In the project folder:



```bash

npm install

copy .env.example .env        # macOS/Linux: cp .env.example .env

\# open .env and set GOOGLE\_MAPS\_API\_KEY=your\_key

npm run dev

```



Open http://localhost:5173. The \*\*Settings\*\* page shows which provider is active and whether its key is set.

`npm run dev` starts the API server (port 3001, holds the key) and the web app (port 5173).

`npm test` runs 21 tests with Google mocked (no key needed).



\## Security



\* The key is read from `GOOGLE\_MAPS\_API\_KEY` by `server/` only, sent to Google in a request header, never

&#x20; to the browser, never logged, never in error messages. `.env` is in `.gitignore`.

\* Also restrict the key in Google Cloud (API restriction: Places API (New) only) and set a budget alert.

\* The server listens on 127.0.0.1 only; the website checker refuses private/loopback addresses.



\## How searching works (Google)



| Step | Google call |

|---|---|

| Resolve a typed city into candidates (you confirm if ambiguous) | Text Search `POST /v1/places:searchText`, keeping results whose `types` are a city/district |

| Find businesses | Text Search, e.g. `"gym in Mysuru"`, with `locationRestriction.rectangle` = the city's viewport, `pageSize=20`, up to 3 pages |

| Live "instant" search box | Text Search with a 25 km `locationBias` circle |



\* Requested fields: name, address, address components, location, phone, website, rating, review count,

&#x20; weekly hours, Google Maps link, status, types. Phone/website/rating/hours are higher-priced fields, so each

&#x20; request is billed accordingly. Check your Google pricing and quota before running big searches

&#x20; (a full 5-category search is roughly 30 requests).

\* Real ratings and review counts now feed the lead score. Nothing is invented: missing data shows "Not available".

\* The Map link opens the exact Google listing (`googleMapsUri`).

\* Permanently closed listings are dropped; temporarily closed ones are noted.

\* Duplicates are removed by Google's place id, then name + address. Results are cached in memory for 10 minutes only.



\## City filtering (important)



Google provides \*\*no administrative boundary polygon\*\*, so results are limited to the city's map

\*\*rectangle\*\* and the app says so ("approximate"). To catch out-of-city rows, each address is checked:

if the town named in the address differs from your search (aliases such as Bangalore/Bengaluru and

Mysore/Mysuru are understood), the row gets a \*\*Verify location\*\* badge. Use "Hide doubtful locations" to

hide them. A town in the same district still counts as a different town.



\## Website status (separate from the places provider)



`POST /api/websites/check`: follows up to 5 redirects, 8 s timeout, tries HTTP if HTTPS fails.

\*\*Active\*\* = responded (bot-blocking 401/403/405/429 still counts), \*\*Inactive\*\* = DNS/TLS/timeout/4xx/5xx,

\*\*No website\*\* = none listed or only a social/listing page.



\## Known limitations



\* Google returns at most 60 results per query; big cities need district-level searches.

\* No email addresses (not provided by Places).

\* Google's terms restrict storing and reusing Places data beyond your own use; read them before exporting at scale.

\* Preview-site rules from the brief still apply (disclaimer wording, real photos only).

