# Daily Micro Theory

Daily Micro Theory is a free static website for recent theoretical
microeconomics papers. It uses plain HTML, CSS, and JavaScript and can be hosted
for free with GitHub Pages.

The homepage has two separate sections:

1. **Topic Papers**: recent arXiv `econ.TH` papers selected by topic relevance
   and recency.
2. **RePEc Author Watch**: recent papers from a manually editable author
   watchlist informed by RePEc/IDEAS profiles or rankings.

The author watchlist is not an objective list of the best economists. It is a
configurable list of authors you choose to follow.

The current watchlist is seeded from the public IDEAS/RePEc Microeconomics
field pages, dated April 2026. The ranked page exposes 146 ranked authors; the
remaining watchlist slots are filled from the linked Microeconomics author
index. Unknown personal, NBER, SSRN, and RSS URLs are left as `null`.

## Data Files

- `data/topic-papers.json`: the main topic feed used by the Topic Papers
  section.
- `data/papers.json`: a backward-compatible alias for the topic feed.
- `data/repec-author-watchlist.json`: authors and public URLs to check.
- `data/repec-author-papers.json`: papers found from the author watchlist.
- `data/history/`: daily history copies created by the workflow.

The update scripts and validation step remove or reject duplicate papers. A
paper is treated as a duplicate when it has the same DOI, canonical URL, arXiv
ID, or normalized title. The RePEc Author Watch section also skips papers that
already appear in Topic Papers.

## View It Locally

Because the page loads JSON files, open it through a small local web server
instead of double-clicking `index.html`.

```powershell
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Update Papers Locally

Install dependencies once:

```powershell
npm install
```

Update topic papers from arXiv:

```powershell
npm run update-topic-papers
```

Update RePEc Author Watch papers:

```powershell
npm run update-repec-author-papers
```

Refresh the RePEc author watchlist from the IDEAS/RePEc Microeconomics ranking:

```powershell
npm run update-repec-watchlist
```

Validate the data files:

```powershell
npm run validate-data
```

## Automatic Updates

GitHub Actions runs every morning around 9:07 AM London time. The workflow:

1. Updates Topic Papers from arXiv `econ.TH`.
2. Tries to update RePEc Author Watch papers from configured public URLs.
3. Preserves existing valid data if a source fails.
4. Saves daily history copies.
5. Deploys the static site with GitHub Pages Actions.

To run it manually:

1. Open the repository on GitHub.
2. Go to **Actions**.
3. Select **Update papers and deploy**.
4. Click **Run workflow**.

## Publish With GitHub Pages

1. Open the repository on GitHub.
2. Go to **Settings**.
3. Go to **Pages**.
4. Under **Build and deployment**, set **Source** to **GitHub Actions**.
5. Save the setting.

The workflow will publish the site for free.

## Add an Author to RePEc Author Watch

Edit `data/repec-author-watchlist.json`. Add one object per author. This is an
example structure, not real author data:

```json
{
  "name": "Author Name",
  "repecProfileUrl": null,
  "ideasAuthorUrl": null,
  "homepageUrl": null,
  "rssUrl": null,
  "nberAuthorUrl": null,
  "ssrnAuthorUrl": null,
  "priority": 1,
  "fields": ["Microeconomic Theory", "Game Theory"],
  "notes": "Why this author is on the watchlist."
}
```

Only add URLs you have verified from public pages. If a URL is unknown, leave it
as `null`. Do not invent personal websites, SSRN pages, NBER pages, or RSS
feeds.

The author section may miss papers when an author has no public feed, no
accessible working paper page, or a page whose metadata is not visible without
login, CAPTCHA, paywall, or access controls.

## Disable RePEc Author Watch

If the author-watch section breaks, set the watchlist to an empty array:

```json
[]
```

Then run:

```powershell
npm run validate-data
```

The homepage will still render the Topic Papers section and show an empty state
for RePEc Author Watch.

## Restore a Previous Version

Daily history files are saved under:

- `data/history/topic-papers/YYYY-MM-DD.json`
- `data/history/repec-author-papers/YYYY-MM-DD.json`

To restore a previous topic feed, copy the chosen history file back to:

```text
data/topic-papers.json
```

Also copy it to:

```text
data/papers.json
```

Then commit the restored files.

## If the Update Fails

Ask Codex:

```text
Check the failing GitHub Actions run for gaofucheng97-oss/daily-micro-theory,
explain why the Daily Micro Theory update failed, and fix it.
```

Include the failed workflow run URL and any error text from the update or
validation step.
