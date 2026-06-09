# Daily Micro Theory

Daily Micro Theory is a free static website for displaying recent
microeconomic theory papers. It shows paper cards with titles, authors,
publication dates, abstract previews, topic tags, paper links, and PDF links
when available.

The first version uses plain HTML, CSS, and JavaScript. Paper data is stored in
`data/papers.json`, so you can update the site by editing one file.

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

## Publish With GitHub Pages

1. Push the repository to GitHub.
2. Open the repository on GitHub.
3. Go to **Settings**.
4. Go to **Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Choose the `main` branch and the `/ (root)` folder.
7. Save the settings.

GitHub will publish the site for free. The Pages screen will show the public
website URL after deployment finishes.

## Update Papers

Edit `data/papers.json`. Each paper should include:

- `title`
- `authors`
- `publicationDate`
- `abstract`
- `topics`
- `paperUrl`
- `pdfUrl`

Use `null` for `pdfUrl` when a PDF is not available.
