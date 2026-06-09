const path = require("node:path");
const { XMLParser } = require("fast-xml-parser");
const {
  asArray,
  cleanText,
  createPreview,
  dedupePapers,
  readJsonFile,
  removePapersAlreadySeen,
  stableId,
  writeHistoryCopy,
  writeJsonIfChanged
} = require("./paper-utils");

const WATCHLIST_PATH = path.join(
  __dirname,
  "..",
  "data",
  "repec-author-watchlist.json"
);
const OUTPUT_PATH = path.join(__dirname, "..", "data", "repec-author-papers.json");
const TOPIC_PAPERS_PATH = path.join(__dirname, "..", "data", "topic-papers.json");

const PUBLIC_SOURCE_FIELDS = [
  ["rssUrl", "RSS"],
  ["repecProfileUrl", "RePEc/IDEAS"],
  ["ideasAuthorUrl", "RePEc/IDEAS"],
  ["homepageUrl", "Personal Website"],
  ["nberAuthorUrl", "NBER"],
  ["ssrnAuthorUrl", "SSRN"]
];

function isHttpUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function getXmlLink(entry) {
  const links = asArray(entry.link);
  const link =
    links.find((item) => item.href && item.rel === "alternate") ||
    links.find((item) => item.href) ||
    links.find((item) => typeof item === "string");

  return typeof link === "string" ? link : link?.href || null;
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function sourceForField(fieldName) {
  return PUBLIC_SOURCE_FIELDS.find(([field]) => field === fieldName)?.[1] || "RSS";
}

function paperFromFeedEntry(entry, author, fieldName, collectedAt) {
  const title = cleanText(entry.title);
  const paperUrl = getXmlLink(entry) || cleanText(entry.id);
  const abstract = cleanText(
    entry.summary || entry.description || entry.content || entry["content:encoded"]
  );
  const publicationDate = parseDate(
    entry.published || entry.updated || entry.pubDate || entry.date
  );

  if (!title || !paperUrl || !publicationDate) {
    return null;
  }

  return {
    id: stableId(sourceForField(fieldName), paperUrl || title),
    title,
    authors: [author.name],
    matchedAuthor: author.name,
    matchedAuthorRepecUrl: author.repecProfileUrl || author.ideasAuthorUrl || null,
    publicationDate,
    abstract: abstract || null,
    abstractPreview: abstract ? createPreview(abstract) : null,
    source: sourceForField(fieldName),
    paperUrl,
    pdfUrl: null,
    doi: null,
    topics: [],
    relevanceScore: Number(author.priority || 0),
    collectedAt
  };
}

function parseFeed(text, author, fieldName, collectedAt) {
  const parser = new XMLParser({
    attributeNamePrefix: "",
    ignoreAttributes: false,
    trimValues: true
  });
  const parsed = parser.parse(text);
  const channelItems = asArray(parsed.rss?.channel?.item);
  const atomEntries = asArray(parsed.feed?.entry);
  const entries = channelItems.length > 0 ? channelItems : atomEntries;

  return entries
    .map((entry) => paperFromFeedEntry(entry, author, fieldName, collectedAt))
    .filter(Boolean);
}

function extractDateFromText(text) {
  const match = text.match(/\b(20\d{2})[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b/);
  if (!match) {
    return null;
  }

  return parseDate(match[0].replace(/\//g, "-"));
}

function absolutizeUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function parseConservativeHtml(text, baseUrl, author, fieldName, collectedAt) {
  const papers = [];
  const linkPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const source = sourceForField(fieldName);
  const paperWords =
    /(working paper|discussion paper|paper|article|research|abstract|nber|ssrn|repec|ideas)/i;
  let match;

  while ((match = linkPattern.exec(text)) !== null) {
    const href = absolutizeUrl(match[1], baseUrl);
    const title = cleanText(match[2]);
    const publicationDate = extractDateFromText(title);

    if (!href || !title || !paperWords.test(title) || !publicationDate) {
      continue;
    }

    papers.push({
      id: stableId(source, href),
      title,
      authors: [author.name],
      matchedAuthor: author.name,
      matchedAuthorRepecUrl: author.repecProfileUrl || author.ideasAuthorUrl || null,
      publicationDate,
      abstract: null,
      abstractPreview: null,
      source,
      paperUrl: href,
      pdfUrl: null,
      doi: null,
      topics: [],
      relevanceScore: Number(author.priority || 0),
      collectedAt
    });
  }

  return papers;
}

async function fetchConfiguredUrl(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "DailyMicroTheory/1.0 (metadata only; https://github.com/gaofucheng97-oss/daily-micro-theory)"
    }
  });

  if (!response.ok) {
    throw new Error(`${url} returned ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  return { contentType, text };
}

async function collectForAuthor(author, collectedAt) {
  const papers = [];

  console.log(`Checking ${author.name}.`);

  for (const [fieldName] of PUBLIC_SOURCE_FIELDS) {
    const url = author[fieldName];

    if (!isHttpUrl(url)) {
      continue;
    }

    try {
      console.log(`  Fetching ${fieldName}: ${url}`);
      const { contentType, text } = await fetchConfiguredUrl(url);
      const looksLikeXml =
        fieldName === "rssUrl" ||
        contentType.includes("xml") ||
        contentType.includes("rss") ||
        contentType.includes("atom");
      const found = looksLikeXml
        ? parseFeed(text, author, fieldName, collectedAt)
        : parseConservativeHtml(text, url, author, fieldName, collectedAt);

      console.log(`  ${sourceForField(fieldName)} yielded ${found.length} papers.`);
      papers.push(...found);
    } catch (error) {
      console.error(`  ${fieldName} failed for ${author.name}: ${error.message}`);
    }
  }

  return papers;
}

async function main() {
  try {
    const watchlist = await readJsonFile(WATCHLIST_PATH, []);

    if (!Array.isArray(watchlist) || watchlist.length === 0) {
      console.log("RePEc Author Watch watchlist is empty. Existing paper data preserved.");
      return;
    }

    const collectedAt = new Date().toISOString();
    const allPapers = [];

    for (const author of watchlist) {
      if (!author?.name) {
        console.log("Skipping watchlist entry without a name.");
        continue;
      }

      allPapers.push(...(await collectForAuthor(author, collectedAt)));
    }

    const { unique: dedupedPapers, duplicates } = dedupePapers(allPapers);
    const topicPapers = await readJsonFile(TOPIC_PAPERS_PATH, []);
    const { unique: papers, duplicates: topicDuplicates } =
      removePapersAlreadySeen(dedupedPapers, topicPapers);

    papers.sort(
      (first, second) =>
        new Date(second.publicationDate) - new Date(first.publicationDate)
    );

    console.log(
      `Collected ${papers.length} author-watch papers; removed ${duplicates.length} internal duplicates and ${topicDuplicates.length} papers already in Topic Papers.`
    );

    if (papers.length === 0) {
      console.log("No author-watch papers found. Existing data file preserved.");
      return;
    }

    const changed = await writeJsonIfChanged(OUTPUT_PATH, papers);
    await writeHistoryCopy(OUTPUT_PATH, papers, "repec-author-papers");

    if (changed) {
      console.log(`Saved ${papers.length} papers to data/repec-author-papers.json.`);
    } else {
      console.log("RePEc Author Watch paper data is already up to date.");
    }
  } catch (error) {
    console.error("RePEc Author Watch update failed. Existing data file preserved.");
    console.error(error);
  }
}

main();
