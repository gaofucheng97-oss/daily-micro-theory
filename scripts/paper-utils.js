const fs = require("node:fs/promises");
const path = require("node:path");

function asArray(value) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function cleanText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTitle(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function createPreview(abstract, maxLength = 280) {
  const text = cleanText(abstract);

  if (text.length <= maxLength) {
    return text;
  }

  const shortened = text.slice(0, maxLength);
  const lastSpace = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, Math.max(lastSpace, 180)).trim()}...`;
}

function stableId(source, value) {
  const normalized = normalizeTitle(value || source);
  return `${source.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${normalized
    .slice(0, 80)
    .replace(/\s+/g, "-")}`;
}

async function readJsonFile(filePath, fallback) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    return JSON.parse(text);
  } catch (error) {
    if (error.code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

async function writeJsonIfChanged(filePath, data) {
  const nextJson = `${JSON.stringify(data, null, 2)}\n`;

  let currentJson = "";
  try {
    currentJson = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  if (currentJson === nextJson) {
    return false;
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, nextJson, "utf8");
  return true;
}

async function writeHistoryCopy(filePath, data, collectionName, date = new Date()) {
  const day = date.toISOString().slice(0, 10);
  const historyPath = path.join(
    path.dirname(filePath),
    "history",
    collectionName,
    `${day}.json`
  );

  await writeJsonIfChanged(historyPath, data);
  return historyPath;
}

module.exports = {
  asArray,
  cleanText,
  createPreview,
  normalizeTitle,
  readJsonFile,
  stableId,
  writeHistoryCopy,
  writeJsonIfChanged
};
