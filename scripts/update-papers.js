const fs = require("node:fs/promises");
const path = require("node:path");
const { XMLParser } = require("fast-xml-parser");

const ARXIV_URL =
  "https://export.arxiv.org/api/query?search_query=cat:econ.TH&start=0&max_results=75&sortBy=submittedDate&sortOrder=descending";
const OUTPUT_PATH = path.join(__dirname, "..", "data", "papers.json");
const MAX_PAPERS = 10;

const TOPIC_KEYWORDS = {
  "Game Theory": [
    "bayesian game",
    "correlated equilibrium",
    "game",
    "game theory",
    "incomplete information",
    "nash",
    "rationalizability",
    "stackelberg",
    "strategic",
    "strategy",
    "synchronization game",
    "volunteer's dilemma"
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
    "contract",
    "contract theory",
    "limited liability",
    "moral hazard",
    "principal-agent",
    "principal",
    "relational contract"
  ],
  "Decision Theory": [
    "ambiguity",
    "bounded rationality",
    "choice",
    "decision theory",
    "expected utility",
    "lottery",
    "preference",
    "preferences",
    "revealed preference",
    "risk aversion",
    "utility representation"
  ],
  "Market Design": [
    "allocation",
    "automated market maker",
    "clearing",
    "course allocation",
    "exchange",
    "fair division",
    "labor market",
    "market design",
    "market maker",
    "platform",
    "school choice"
  ],
  Auctions: [
    "auction",
    "auctions",
    "bidder",
    "bidding",
    "common-value",
    "reserve price",
    "revenue",
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

function asArray(value) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function countOccurrences(text, keyword) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\b${escaped}\\b`, "gi");
  return (text.match(pattern) || []).length;
}

function scoreAndTag(title, abstract) {
  const searchableTitle = title.toLowerCase();
  const searchableAbstract = abstract.toLowerCase();
  const topics = [];
  let score = 0;

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    let topicScore = 0;

    for (const keyword of keywords) {
      const normalizedKeyword = keyword.toLowerCase();
      topicScore += countOccurrences(searchableTitle, normalizedKeyword) * 5;
      topicScore += countOccurrences(searchableAbstract, normalizedKeyword) * 2;
    }

    if (topicScore > 0) {
      topics.push(topic);
      score += topicScore;
    }
  }

  return { score, topics };
}

function getLink(entry, matcher) {
  return asArray(entry.link).find(matcher)?.href || null;
}

function transformEntry(entry) {
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

  const { score, topics } = scoreAndTag(title, abstract);

  if (score <= 0 || topics.length === 0) {
    return null;
  }

  const paperUrl =
    getLink(entry, (link) => link.rel === "alternate") ||
    String(entry.id || "").replace("http://", "https://");
  const pdfUrl = getLink(
    entry,
    (link) => link.type === "application/pdf" || link.title === "pdf"
  );

  return {
    paper: {
      title,
      authors: asArray(entry.author)
        .map((author) => cleanText(author.name))
        .filter(Boolean),
      publicationDate: published.toISOString().slice(0, 10),
      abstract,
      topics,
      paperUrl,
      pdfUrl
    },
    score
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

async function writeIfUseful(papers) {
  if (papers.length === 0) {
    console.log("No valid papers found. Existing data/papers.json was preserved.");
    return;
  }

  const nextJson = `${JSON.stringify(papers, null, 2)}\n`;

  let currentJson = "";
  try {
    currentJson = await fs.readFile(OUTPUT_PATH, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  if (currentJson === nextJson) {
    console.log("data/papers.json is already up to date.");
    return;
  }

  await fs.writeFile(OUTPUT_PATH, nextJson, "utf8");
  console.log(`Saved ${papers.length} papers to data/papers.json.`);
}

async function main() {
  try {
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
      .map(transformEntry)
      .filter(Boolean)
      .sort((first, second) => {
        if (second.score !== first.score) {
          return second.score - first.score;
        }

        return (
          new Date(second.paper.publicationDate) -
          new Date(first.paper.publicationDate)
        );
      })
      .slice(0, MAX_PAPERS)
      .map((item) => item.paper)
      .sort(
        (first, second) =>
          new Date(second.publicationDate) - new Date(first.publicationDate)
      );

    console.log(`Selected ${selected.length} papers after scoring and tagging.`);
    await writeIfUseful(selected);
  } catch (error) {
    console.error("Paper update failed. Existing data/papers.json was preserved.");
    console.error(error);
  }
}

main();
