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

const papersContainer = document.querySelector("#papers");
const filtersContainer = document.querySelector("#filters");
const resultCount = document.querySelector("#result-count");
const lastUpdated = document.querySelector("#last-updated");

let papers = [];
let activeTopic = "All";

function formatDate(dateString) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date(dateString));
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

function setLastUpdated(lastModified) {
  if (!lastUpdated) {
    return;
  }

  if (!lastModified) {
    lastUpdated.textContent = "Available after publish";
    return;
  }

  const date = new Date(lastModified);

  if (Number.isNaN(date.getTime())) {
    lastUpdated.textContent = "Available after publish";
    return;
  }

  lastUpdated.textContent = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London"
  }).format(date);
}

function renderFilters() {
  filtersContainer.innerHTML = "";

  TOPICS.forEach((topic) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = topic;
    button.className = "filter-button";
    button.setAttribute("aria-pressed", String(topic === activeTopic));

    if (topic === activeTopic) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => {
      activeTopic = topic;
      renderFilters();
      renderPapers();
    });

    filtersContainer.appendChild(button);
  });
}

function renderPapers() {
  const visiblePapers =
    activeTopic === "All"
      ? papers
      : papers.filter((paper) => paper.topics.includes(activeTopic));

  papersContainer.innerHTML = "";
  resultCount.textContent = `${visiblePapers.length} paper${
    visiblePapers.length === 1 ? "" : "s"
  } shown`;

  if (visiblePapers.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No papers match this topic yet.";
    papersContainer.appendChild(empty);
    return;
  }

  visiblePapers.forEach((paper) => {
    const card = document.createElement("article");
    card.className = "paper-card";

    const meta = document.createElement("div");
    meta.className = "paper-meta";
    meta.textContent = formatDate(paper.publicationDate);

    const title = document.createElement("h3");
    title.className = "paper-title";
    title.textContent = paper.title;

    const authors = document.createElement("p");
    authors.className = "paper-authors";
    authors.textContent = paper.authors.join(", ");

    const abstract = document.createElement("p");
    abstract.className = "paper-abstract";
    abstract.textContent = paper.abstract;

    const tagList = document.createElement("div");
    tagList.className = "tag-list";
    paper.topics.forEach((topic) => {
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

    card.append(meta, title, authors, abstract, tagList, links);
    papersContainer.appendChild(card);
  });
}

async function loadPapers() {
  try {
    const response = await fetch("data/papers.json");

    if (!response.ok) {
      throw new Error(`Could not load papers: ${response.status}`);
    }

    papers = await response.json();
    setLastUpdated(response.headers.get("last-modified"));
    papers.sort(
      (first, second) =>
        new Date(second.publicationDate) - new Date(first.publicationDate)
    );

    renderFilters();
    renderPapers();
  } catch (error) {
    papersContainer.innerHTML =
      '<p class="empty-state">Could not load paper data. Check data/papers.json.</p>';
    resultCount.textContent = "Paper data unavailable";
    setLastUpdated(null);
    console.error(error);
  }
}

renderFilters();
loadPapers();
