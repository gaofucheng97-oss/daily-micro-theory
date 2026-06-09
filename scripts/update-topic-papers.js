const path = require("node:path");
const { XMLParser } = require("fast-xml-parser");
const {
  asArray,
  cleanText,
  createPreview,
  stableId,
  writeHistoryCopy,
  writeJsonIfChanged
} = require("./paper-utils");

const ARXIV_URL =
  "https://export.arxiv.org/api/query?search_query=cat:econ.TH&start=0&max_results=100&sortBy=submittedDate&sortOrder=descending";
const TOPIC_OUTPUT_PATH = path.join(__dirname, "..", "data", "topic-papers.json");
const LEGACY_OUTPUT_PATH = path.join(__dirname, "..", "data", "papers.json");
const MAX_PAPERS = 20;

const TOPIC_KEYWORDS = {
  "Game Theory": [
    "bayesian game",
    "correlated equilibrium",
    "game theory",
    "incomplete information",
    "nash",
    "rationalizability",
    "stackelberg",
    "strategic",
    "strategy"
  ],
  "Mechanism Design": [
    "dominant strategy",
    "elicitation",
    "implementation",
    "incentive compatible",
    "incentive compatibility",
    "mechanism design",
    "revelation",
    "strategy-proof",
    "truthful",
    "vcg",
    "vickrey-clarke-groves"
  ],
  "Contract Theory": [
    "commitment",
    "contract theory",
    "limited liability",
    "moral hazard",
    "principal-agent",
    "relational contract"
  ],
  "Decision Theory": [
    "ambiguity",
    "bounded rationality",
    "choice theory",
    "decision theory",
    "expected utility",
    "lottery",
    "preference",
    "revealed preference",
    "risk aversion"
  ],
  "Market Design": [
    "allocation",
    "automated market maker",
    "clearing",
    "course allocation",
    "fair division",
    "labor market",
    "market design",
    "school choice"
  ],
  Auctions: [
    "auction",
    "auctions",
    "bidder",
    "bidding",
    "common-value",
    "reserve price",
    "vcg",
    "winner's curse"
  ],
  Matching: [
    "assignment",
    "deferred acceptance",
    "match",
    "matching",
    "school choice",
    "stable matching",
    "top trading cycles",
    "two-sided"
  ],
  "Social Choice": [
    "approval voting",
    "banzhaf",
    "borda",
    "coalition",
    "condorcet",
    "envy-free",
    "fair division",
    "pareto",
    "shapley",
    "social choice",
    "voting"
  ],
  "General Equilibrium": [
    "competitive equilibrium",
    "equilibrium manifold",
    "exchange economy",
    "general equilibrium",
    "market clearing",
    "pure exchange",
    "walras"
  ]
};

function countOccurrences(text, keyword) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\b${escaped}\\b`, "gi");
  return (text.match(pattern) || []).length;
}

function scoreAndTag(title, abstract, publicationDate) {
  const searchableTitle = title.toLowerCase();
  const searchableAbstract = abstract.toLowerCase();
  const topics = [];
  let topicScore = 0;

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    let score = 0;

    for (const keyword of keywords) {
      const normalizedKeyword = keyword.toLowerCase();
      score += countOccurrences(searchableTitle, normalizedKeyword) * 5;
      score += countOccurrences(searchableAbstract, normalizedKeyword) * 2;
    }

    if (score > 0) {
      topics.push(topic);
      topicScore += score;
    }
  }

  const ageDays = Math.max(
    0,
    (Date.now() - new Date(publicationDate).getTime()) / 86_400_000
  );
  const recencyScore = Math.max(0, 30 - ageDays);

  return {
    relevanceScore: Math.round((topicScore + recencyScore) * 100) / 100,
    topics
  };
}

function getLink(entry, matcher) {
  return asArray(entry.link).find(matcher)?.href || null;
}

function transformEntry(entry, collectedAt) {
  const title = cleanText(entry.title);
  const abstract = cleanText(entry.summary);
  const published = entry.published ? new Date(entry.published) : null;
  const categories = asArray(entry.category).map((category) => category.term);

  if (!title || !abstract || !published || Number.isNaN(published.getTime())) {
    return null;
  }

  if (!categories.includes("econ.TH")) {
    return null;
  }

  const publicationDate = published.toISOString().slice(0, 10);
  const { relevanceScore, topics } = scoreAndTag(
    title,
    abstract,
    publicationDate
  );

  if (relevanceScore <= 0 || topics.length === 0) {
    return null;
  }

  const paperUrl =
    getLink(entry, (link) => link.rel === "alternate") ||
    String(entry.id || "").replace("http://", "https://");
  const pdfUrl = getLink(
    entry,
    (link) => link.type === "application/pdf" || link.title === "pdf"
  );
  const arxivId = String(entry.id || paperUrl).split("/abs/").pop();

  return {
    id: stableId("arxiv", arxivId || title),
    title,
    authors: asArray(entry.author)
      .map((author) => cleanText(author.name))
      .filter(Boolean),
    publicationDate,
    abstract,
    abstractPreview: createPreview(abstract),
    topics,
    source: "arXiv",
    paperUrl,
    pdfUrl,
    relevanceScore,
    collectedAt
  };
}

async function fetchArxivFeed() {
  console.log(`Fetching arXiv feed: ${ARXIV_URL}`);

  const response = await fetch(ARXIV_URL, {
    headers: {
      "User-Agent":
        "DailyMicroTheory/1.0 (https://github.com/gaofucheng97-oss/daily-micro-theory)"
    }
  });

  if (!response.ok) {
    throw new Error(`arXiv returned ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function main() {
  try {
    const collectedAt = new Date().toISOString();
    const xml = await fetchArxivFeed();
    const parser = new XMLParser({
      attributeNamePrefix: "",
      ignoreAttributes: false,
      trimValues: true
    });
    const parsed = parser.parse(xml);
    const entries = asArray(parsed.feed?.entry);

    console.log(`Fetched ${entries.length} arXiv entries.`);

    const selected = entries
      .map((entry) => transformEntry(entry, collectedAt))
      .filter(Boolean)
      .sort((first, second) => {
        if (second.relevanceScore !== first.relevanceScore) {
          return second.relevanceScore - first.relevanceScore;
        }

        return (
          new Date(second.publicationDate) - new Date(first.publicationDate)
        );
      })
      .slice(0, MAX_PAPERS)
      .sort(
        (first, second) =>
          new Date(second.publicationDate) - new Date(first.publicationDate)
      );

    console.log(`Selected ${selected.length} topic papers after scoring.`);

    if (selected.length === 0) {
      console.log("No valid topic papers found. Existing data files preserved.");
      return;
    }

    const topicChanged = await writeJsonIfChanged(TOPIC_OUTPUT_PATH, selected);
    const legacyChanged = await writeJsonIfChanged(LEGACY_OUTPUT_PATH, selected);
    await writeHistoryCopy(TOPIC_OUTPUT_PATH, selected, "topic-papers");

    if (topicChanged || legacyChanged) {
      console.log(`Saved ${selected.length} papers to topic and legacy data files.`);
    } else {
      console.log("Topic paper data is already up to date.");
    }
  } catch (error) {
    console.error("Topic paper update failed. Existing data files preserved.");
    console.error(error);
  }
}

main();
