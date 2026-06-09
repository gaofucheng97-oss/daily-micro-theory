const TOPICS = [
  "All",
  "Game Theory",
  "Mechanism Design",
  "Contract Theory",
  "Decision Theory",
  "Market Design",
  "Auctions",
  "Matching",
  "Social Choice",
  "General Equilibrium"
];

const state = {
  topicPapers: [],
  authorPapers: [],
  activeTopic: "All",
  activeAuthorFilter: { type: "all", value: "All watched authors" },
  lastUpdatedValues: []
};

const elements = {
  topicPapers: document.querySelector("#topic-papers"),
  topicFilters: document.querySelector("#topic-filters"),
  topicResultCount: document.querySelector("#topic-result-count"),
  authorPapers: document.querySelector("#author-papers"),
  authorFilters: document.querySelector("#author-filters"),
  authorResultCount: document.querySelector("#author-result-count"),
  lastUpdated: document.querySelector("#last-updated")
};

function formatDate(dateString) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date(dateString));
}

function formatDateTime(dateString) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London"
  }).format(new Date(dateString));
}

function createPreview(text, maxLength = 280) {
  if (!text || text.length <= maxLength) {
    return text || "";
  }

  const shortened = text.slice(0, maxLength);
  const lastSpace = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, Math.max(lastSpace, 180)).trim()}...`;
}

function createLink(href, label, className = "") {
  const link = document.createElement("a");
  link.href = href;
  link.textContent = label;
  link.className = `paper-link ${className}`.trim();
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

function setLastUpdated() {
  if (!elements.lastUpdated) {
    return;
  }

  const dates = state.lastUpdatedValues
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((first, second) => second - first);

  elements.lastUpdated.textContent =
    dates.length > 0 ? formatDateTime(dates[0]) : "Available after publish";
}

function noteLastUpdated(papers, lastModified) {
  const collectedAtValues = papers
    .map((paper) => paper.collectedAt)
    .filter(Boolean);

  state.lastUpdatedValues.push(...collectedAtValues);

  if (lastModified) {
    state.lastUpdatedValues.push(lastModified);
  }

  setLastUpdated();
}

async function loadJson(urls) {
  const errors = [];

  for (const url of urls) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`${url} returned ${response.status}`);
      }

      return {
        data: await response.json(),
        lastModified: response.headers.get("last-modified")
      };
    } catch (error) {
      errors.push(error);
    }
  }

  throw errors[errors.length - 1];
}

function renderFilterButton(container, label, active, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className = "filter-button";
  button.setAttribute("aria-pressed", String(active));

  if (active) {
    button.classList.add("active");
  }

  button.addEventListener("click", onClick);
  container.appendChild(button);
}

function renderTopicFilters() {
  elements.topicFilters.innerHTML = "";

  TOPICS.forEach((topic) => {
    renderFilterButton(
      elements.topicFilters,
      topic,
      topic === state.activeTopic,
      () => {
        state.activeTopic = topic;
        renderTopicFilters();
        renderTopicPapers();
      }
    );
  });
}

function authorFilterLabel(filter) {
  return filter.type === "all" ? "All watched authors" : filter.value;
}

function renderAuthorFilters() {
  elements.authorFilters.innerHTML = "";

  const authors = [
    ...new Set(state.authorPapers.map((paper) => paper.matchedAuthor).filter(Boolean))
  ].sort();
  const sources = [
    ...new Set(state.authorPapers.map((paper) => paper.source).filter(Boolean))
  ].sort();
  const filters = [
    { type: "all", value: "All watched authors" },
    ...authors.map((author) => ({ type: "author", value: author })),
    ...sources.map((source) => ({ type: "source", value: source }))
  ];

  filters.forEach((filter) => {
    const active =
      filter.type === state.activeAuthorFilter.type &&
      filter.value === state.activeAuthorFilter.value;

    renderFilterButton(elements.authorFilters, authorFilterLabel(filter), active, () => {
      state.activeAuthorFilter = filter;
      renderAuthorFilters();
      renderAuthorPapers();
    });
  });
}

function createPaperCard(paper, sectionName) {
  const card = document.createElement("article");
  card.className = "paper-card";

  const meta = document.createElement("div");
  meta.className = "paper-meta";
  meta.textContent = [formatDate(paper.publicationDate), paper.source]
    .filter(Boolean)
    .join(" | ");

  const title = document.createElement("h3");
  title.className = "paper-title";
  title.textContent = paper.title;

  const authors = document.createElement("p");
  authors.className = "paper-authors";
  authors.textContent = paper.authors.join(", ");

  const abstract = document.createElement("p");
  const abstractId = `${sectionName}-${paper.id || crypto.randomUUID()}-abstract`;
  const fullAbstract = paper.abstract || "";
  const preview = paper.abstractPreview || createPreview(fullAbstract);
  abstract.id = abstractId;
  abstract.className = "paper-abstract";
  abstract.textContent = preview || "No abstract available from the configured source.";

  const tagList = document.createElement("div");
  tagList.className = "tag-list";
  const tags = [
    ...(paper.topics || []),
    paper.matchedAuthor ? `Watchlist: ${paper.matchedAuthor}` : null
  ].filter(Boolean);

  tags.forEach((topic) => {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = topic;
    tagList.appendChild(tag);
  });

  const links = document.createElement("div");
  links.className = "paper-links";
  links.appendChild(createLink(paper.paperUrl, "Paper"));

  if (paper.pdfUrl) {
    links.appendChild(createLink(paper.pdfUrl, "PDF", "pdf"));
  }

  if (fullAbstract && preview && fullAbstract.length > preview.length) {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "abstract-toggle";
    toggle.textContent = "Show full abstract";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", abstractId);

    toggle.addEventListener("click", () => {
      const isExpanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!isExpanded));
      toggle.textContent = isExpanded ? "Show full abstract" : "Hide abstract";
      abstract.textContent = isExpanded ? preview : fullAbstract;
      abstract.classList.toggle("expanded", !isExpanded);
    });

    links.appendChild(toggle);
  }

  card.append(meta, title, authors, abstract, tagList, links);
  return card;
}

function renderPaperGrid(container, countElement, papers, emptyMessage, sectionName) {
  container.innerHTML = "";
  countElement.textContent = `${papers.length} paper${
    papers.length === 1 ? "" : "s"
  } shown`;

  if (papers.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = emptyMessage;
    container.appendChild(empty);
    return;
  }

  papers.forEach((paper) => {
    container.appendChild(createPaperCard(paper, sectionName));
  });
}

function renderTopicPapers() {
  const visiblePapers =
    state.activeTopic === "All"
      ? state.topicPapers
      : state.topicPapers.filter((paper) => paper.topics.includes(state.activeTopic));

  renderPaperGrid(
    elements.topicPapers,
    elements.topicResultCount,
    visiblePapers,
    "No topic papers match this filter yet.",
    "topic"
  );
}

function renderAuthorPapers() {
  const { type, value } = state.activeAuthorFilter;
  const visiblePapers = state.authorPapers.filter((paper) => {
    if (type === "author") {
      return paper.matchedAuthor === value;
    }

    if (type === "source") {
      return paper.source === value;
    }

    return true;
  });

  renderPaperGrid(
    elements.authorPapers,
    elements.authorResultCount,
    visiblePapers,
    "No author-watch papers yet. Add public author URLs to data/repec-author-watchlist.json.",
    "author"
  );
}

async function loadTopicPapers() {
  try {
    const { data, lastModified } = await loadJson([
      "data/topic-papers.json",
      "data/papers.json"
    ]);

    state.topicPapers = data.sort(
      (first, second) =>
        new Date(second.publicationDate) - new Date(first.publicationDate)
    );

    noteLastUpdated(state.topicPapers, lastModified);
    renderTopicFilters();
    renderTopicPapers();
  } catch (error) {
    elements.topicPapers.innerHTML =
      '<p class="empty-state">Could not load topic paper data.</p>';
    elements.topicResultCount.textContent = "Topic paper data unavailable";
    console.error(error);
  }
}

async function loadAuthorPapers() {
  try {
    const { data, lastModified } = await loadJson(["data/repec-author-papers.json"]);

    state.authorPapers = data.sort(
      (first, second) =>
        new Date(second.publicationDate) - new Date(first.publicationDate)
    );

    noteLastUpdated(state.authorPapers, lastModified);
    renderAuthorFilters();
    renderAuthorPapers();
  } catch (error) {
    elements.authorPapers.innerHTML =
      '<p class="empty-state">Could not load RePEc Author Watch data.</p>';
    elements.authorResultCount.textContent = "Author-watch data unavailable";
    console.error(error);
  }
}

setLastUpdated();
renderTopicFilters();
renderAuthorFilters();
loadTopicPapers();
loadAuthorPapers();
