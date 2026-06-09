const path = require("node:path");
const { cleanText, writeJsonIfChanged } = require("./paper-utils");

const RANKING_URL = "https://ideas.repec.org/top/top.mic.html";
const AUTHOR_INDEX_URL = "https://ideas.repec.org/i/emic.html";
const OUTPUT_PATH = path.join(
  __dirname,
  "..",
  "data",
  "repec-author-watchlist.json"
);
const MAX_AUTHORS = 300;

function isIdeasAuthorProfile(url) {
  return /^\/[ef]\/p[^/]+\.html$/i.test(url.pathname);
}

function createWatchlistEntry(name, url, priority, notes) {
  return {
    name,
    repecProfileUrl: url,
    ideasAuthorUrl: url,
    homepageUrl: null,
    rssUrl: null,
    nberAuthorUrl: null,
    ssrnAuthorUrl: null,
    priority,
    fields: ["Microeconomics", "Microeconomic Theory"],
    notes
  };
}

function parseRankedAuthors(html) {
  const topAuthorsStart = html.search(/Top Authors/i);

  if (topAuthorsStart === -1) {
    throw new Error("Could not find the Top Authors section in the ranking page.");
  }

  const section = html.slice(topAuthorsStart);
  const linkPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const authors = [];
  const seenUrls = new Set();
  let match;

  while ((match = linkPattern.exec(section)) !== null && authors.length < MAX_AUTHORS) {
    const href = match[1];
    const name = cleanText(match[2]);

    let url;
    try {
      url = new URL(href, RANKING_URL);
    } catch {
      continue;
    }

    if (!name || !isIdeasAuthorProfile(url) || seenUrls.has(url.toString())) {
      continue;
    }

    seenUrls.add(url.toString());
    const rank = authors.length + 1;

    authors.push(
      createWatchlistEntry(
        name,
        url.toString(),
        rank,
        `Rank ${rank} in the IDEAS/RePEc Microeconomics field ranking, April 2026. Source: ${RANKING_URL}`
      )
    );
  }

  return authors;
}

function parseIndexedAuthors(html, existingAuthors) {
  const indexStart = html.search(/<A NAME=["']A["']>/i);

  if (indexStart === -1) {
    throw new Error("Could not find the author index section.");
  }

  const section = html.slice(indexStart);
  const linkPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const authors = [...existingAuthors];
  const seenUrls = new Set(authors.map((author) => author.repecProfileUrl));
  let match;

  while ((match = linkPattern.exec(section)) !== null && authors.length < MAX_AUTHORS) {
    const href = match[1];
    const name = cleanText(match[2]);

    let url;
    try {
      url = new URL(href, AUTHOR_INDEX_URL);
    } catch {
      continue;
    }

    if (!name || !isIdeasAuthorProfile(url) || seenUrls.has(url.toString())) {
      continue;
    }

    seenUrls.add(url.toString());
    const priority = authors.length + 1;
    authors.push(
      createWatchlistEntry(
        name,
        url.toString(),
        priority,
        `Added from the public IDEAS/RePEc Microeconomics author index to complete a 300-author watchlist. The ranking page lists only ${existingAuthors.length} ranked Microeconomics authors. Sources: ${RANKING_URL} and ${AUTHOR_INDEX_URL}`
      )
    );
  }

  return authors;
}

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "DailyMicroTheory/1.0 (watchlist metadata only; https://github.com/gaofucheng97-oss/daily-micro-theory)"
    }
  });

  if (!response.ok) {
    throw new Error(`${url} returned ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function main() {
  const rankingHtml = await fetchPage(RANKING_URL);
  const rankedAuthors = parseRankedAuthors(rankingHtml);
  const indexHtml = await fetchPage(AUTHOR_INDEX_URL);
  const authors = parseIndexedAuthors(indexHtml, rankedAuthors);

  if (authors.length !== MAX_AUTHORS) {
    throw new Error(`Expected ${MAX_AUTHORS} authors, found ${authors.length}.`);
  }

  const changed = await writeJsonIfChanged(OUTPUT_PATH, authors);

  if (changed) {
    console.log(`Saved ${authors.length} authors to data/repec-author-watchlist.json.`);
  } else {
    console.log("RePEc author watchlist is already up to date.");
  }
}

main().catch((error) => {
  console.error("Failed to update RePEc author watchlist from ranking.");
  console.error(error.message);
  process.exitCode = 1;
});
