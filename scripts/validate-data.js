const path = require("node:path");
const { paperIdentityKeys, readJsonFile } = require("./paper-utils");

const PAPER_FILES = [
  ["Topic Papers", path.join(__dirname, "..", "data", "topic-papers.json")],
  [
    "RePEc Author Watch",
    path.join(__dirname, "..", "data", "repec-author-papers.json")
  ]
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function validatePaper(sectionName, paper, index) {
  const label = `${sectionName} paper ${index + 1}`;

  assert(paper && typeof paper === "object", `${label} must be an object.`);
  assert(typeof paper.title === "string" && paper.title.trim(), `${label} missing title.`);
  assert(Array.isArray(paper.authors), `${label} authors must be an array.`);
  assert(paper.authors.length > 0, `${label} must list at least one author.`);
  assert(
    /^\d{4}-\d{2}-\d{2}$/.test(paper.publicationDate),
    `${label} needs publicationDate as YYYY-MM-DD.`
  );
  assert(typeof paper.source === "string" && paper.source.trim(), `${label} missing source.`);
  assert(/^https?:\/\//.test(paper.paperUrl || ""), `${label} needs paperUrl.`);

  if (paper.abstract) {
    assert(
      typeof paper.abstract === "string" && paper.abstract.trim().length > 0,
      `${label} abstract must be text when present.`
    );
  }

  if (paper.abstract && paper.abstract.length > 320) {
    assert(
      typeof paper.abstractPreview === "string" &&
        paper.abstractPreview.length < paper.abstract.length,
      `${label} needs abstractPreview shorter than long abstract.`
    );
  }
}

function findDuplicatePaper(papers, seedPapers = []) {
  const seen = new Map();

  for (const paper of seedPapers) {
    for (const key of paperIdentityKeys(paper)) {
      seen.set(key, paper.title || "existing paper");
    }
  }

  for (const paper of papers) {
    for (const key of paperIdentityKeys(paper)) {
      if (seen.has(key)) {
        return {
          title: paper.title,
          duplicateOf: seen.get(key),
          key
        };
      }
    }

    for (const key of paperIdentityKeys(paper)) {
      seen.set(key, paper.title);
    }
  }

  return null;
}

async function main() {
  const loadedFiles = [];

  for (const [sectionName, filePath] of PAPER_FILES) {
    const papers = await readJsonFile(filePath, []);
    assert(Array.isArray(papers), `${sectionName} data must be an array.`);
    papers.forEach((paper, index) => validatePaper(sectionName, paper, index));
    const duplicate = findDuplicatePaper(papers);
    if (duplicate) {
      throw new Error(
        `${sectionName} has duplicate paper "${duplicate.title}" matching "${duplicate.duplicateOf}".`
      );
    }
    loadedFiles.push({ sectionName, papers });
    console.log(`${sectionName}: ${papers.length} papers valid.`);
  }

  const topicPapers = loadedFiles.find((file) => file.sectionName === "Topic Papers")?.papers || [];
  const authorPapers =
    loadedFiles.find((file) => file.sectionName === "RePEc Author Watch")?.papers || [];
  const crossDuplicate = findDuplicatePaper(authorPapers, topicPapers);

  if (crossDuplicate) {
    throw new Error(
      `Duplicate across sections: "${crossDuplicate.title}" already appears as "${crossDuplicate.duplicateOf}".`
    );
  }

  console.log("Data validation passed.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
