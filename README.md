# Daily Micro Theory

Daily Micro Theory is a free static website for displaying recent theoretical
microeconomics papers. It shows paper cards with titles, authors, publication
dates, abstract previews, topic tags, paper links, and PDF links when available.

The site uses plain HTML, CSS, and JavaScript. Paper data is stored in
`data/papers.json`, and a GitHub Actions workflow updates that file every
morning from the arXiv `econ.TH` feed.

## View It Locally

Because the page loads `data/papers.json`, open it through a small local web
server instead of double-clicking `index.html`.

From this folder, run:

```powershell
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

If Python is not installed, you can still publish the site with GitHub Pages and
view it online.

## Update Papers Locally

Install dependencies once:

```powershell
npm install
```

Run the arXiv updater:

```powershell
npm run update-papers
```

The updater fetches recent arXiv `econ.TH` papers, scores and tags them with
microeconomic theory keywords, keeps the top 10, and writes `data/papers.json`.
If arXiv is unavailable or no valid papers are found, the existing JSON file is
preserved.

## Automatic Updates

GitHub Actions runs the update workflow every morning around 9:07 AM London
time. The workflow can also be run manually:

1. Open the repository on GitHub.
2. Go to **Actions**.
3. Select **Update papers and deploy**.
4. Click **Run workflow**.

## Publish With GitHub Pages

1. Push the repository to GitHub.
2. Open the repository on GitHub.
3. Go to **Settings**.
4. Go to **Pages**.
5. Under **Build and deployment**, set **Source** to **GitHub Actions**.
6. Save the settings.

The workflow uses GitHub Pages Actions to deploy the static files for free. The
Pages screen will show the public website URL after deployment finishes.

## Update Papers

You can still edit `data/papers.json` manually. Each paper should include:

- `title`
- `authors`
- `publicationDate`
- `abstract`
- `topics`
- `paperUrl`
- `pdfUrl`

Use `null` for `pdfUrl` when a PDF is not available.

## If the Update Fails

Ask Codex:

```text
Check the failing GitHub Actions run for gaofucheng97-oss/daily-micro-theory,
explain why the Daily Micro Theory update failed, and fix it.
```

The most useful details are the failed workflow run URL and any error message
shown in the **Update paper data** step.
