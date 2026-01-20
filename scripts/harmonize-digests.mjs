#!/usr/bin/env node

import { readFileSync, writeFileSync } from "fs";
import { join, basename } from "path";

const BLOG_DIR = "src/content/blog";

const TARGET_CONCLUSION =
  "That's it for this week's frontend digest! What are you most excited about? Happy coding! \u{1F680}";
const DEFAULT_IMAGE = "/images/posts/ferenc-almasi-hMYODfDWs9M-unsplash.jpg";

// Files to process
const FILES_TO_PROCESS = [
  "2023-11-11-frontend-weekly-digest-45.md",
  "2023-11-17-frontend-weekly-digest-46.md",
  "2023-11-24-frontend-weekly-digest-47.md",
  "2023-12-01-frontend-weekly-digest-48.md",
  "2023-12-08-frontend-weekly-digest-49.md",
  "2023-12-15-frontend-weekly-digest-50.md",
  "2024-01-04-frontend-weekly-digest-1.md",
  "2024-01-12-frontend-weekly-digest-2.md",
  "2024-02-05-frontend-weekly-digest-5.md",
  "2024-02-19-frontend-weekly-digest-7.md",
  "2024-03-04-frontend-weekly-digest-9.md",
  "2024-03-15-frontend-weekly-digest-11.md",
  "2024-03-29-frontend-weekly-digest-13.md",
  "2024-04-12-frontend-weekly-digest-15.md",
  "2024-04-26-frontend-weekly-digest-17.md",
  "2024-05-13-frontend-weekly-digest-19.md",
  "2024-05-23-frontend-weekly-digest-21.md",
  "2024-06-07-frontend-weekly-digest-23.md",
  "2024-06-21-frontend-weekly-digest-25.md",
  "2024-06-28-frontend-weekly-digest-26.md",
  "2024-07-12-frontend-weekly-digest-28.md",
  "2024-07-26-frontend-weekly-digest-30.md",
  "2024-08-02-frontend-weekly-digest-31.md",
  "2024-08-09-frontend-weekly-digest-32.md",
  "2024-08-26-frontend-weekly-digest-34.md",
  "2024-09-09-frontend-weekly-digest-36.md",
  "2024-09-23-frontend-weekly-digest-38.md",
  "2024-10-07-frontend-weekly-digest-40.md",
  "2024-10-21-frontend-weekly-digest-42.md",
  "2024-11-04-frontend-weekly-digest-44.md",
  "2024-11-18-frontend-weekly-digest-46.md",
  "2025-01-27-frontend-weekly-digest-4.md",
  "2025-02-10-frontend-weekly-digest-6.md",
];

// Broader emoji regex that includes variation selectors
const EMOJI_PATTERN =
  /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2300}-\u{23FF}\u{2B50}\u{2934}-\u{2935}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2614}-\u{2615}\u{2648}-\u{2653}\u{267F}\u{2693}\u{26A1}\u{26AA}-\u{26AB}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}-\u{26F3}\u{26F5}\u{26FA}\u{26FD}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}\u{2712}\u{2714}\u{2716}\u{271D}\u{2721}\u{2728}\u{2733}-\u{2734}\u{2744}\u{2747}\u{274C}\u{274E}\u{2753}-\u{2755}\u{2757}\u{2763}-\u{2764}\u{2795}-\u{2797}\u{27A1}\u{27B0}\u{27BF}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{2B55}\u{3030}\u{303D}\u{3297}\u{3299}\u{200D}\u{20E3}\u{FE0F}]+/gu;

// Section heading mappings (normalize to standard names)
const SECTION_MAPPINGS = {
  "news & updates": "\u{1F4E2} News & Trends",
  "news & trends": "\u{1F4E2} News & Trends",
  "releases & updates": "\u{1F195} Releases & Updates",
  "tools & resources": "\u{1F6E0} Tools & Resources",
  "explore more": "\u{1FA90} Explore More",
  "historical fun fact": "\u{1F4DC} Historical Fun Fact",
};

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error("Could not parse frontmatter");
  }

  const frontmatterRaw = match[1];
  const body = match[2];

  // Parse YAML-like frontmatter manually
  const frontmatter = {};
  const lines = frontmatterRaw.split("\n");

  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();

      // Remove quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      frontmatter[key] = value;
    }
  }

  return { frontmatter, body };
}

function buildFrontmatter(fm) {
  let result = "---\n";
  result += `title: "${fm.title}"\n`;
  result += `description: ${fm.description}\n`;
  result += `pubDate: "${fm.pubDate}"\n`;
  result += `conclusion: "${fm.conclusion}"\n`;
  result += `image: "${fm.image}"\n`;
  result += "---\n";
  return result;
}

function normalizeHeading(line) {
  // Convert ### to ## for main sections
  const headingMatch = line.match(/^(#{2,3})\s*(.*)$/);
  if (!headingMatch) return line;

  const content = headingMatch[2].trim();

  // Remove emoji and get text
  const textOnly = content.replace(EMOJI_PATTERN, "").trim();

  // Find the normalized section name
  const textLower = textOnly.toLowerCase();
  for (const [key, value] of Object.entries(SECTION_MAPPINGS)) {
    if (textLower.includes(key)) {
      return `## ${value}`;
    }
  }

  // If not a standard section, keep as is but ensure ## level
  return `## ${content}`;
}

function extractEmoji(text) {
  const matches = text.match(EMOJI_PATTERN);
  return matches ? matches[0] : null;
}

function normalizeListItem(line) {
  // Try multiple patterns to extract: emoji, title, url

  // Pattern 1: - emoji **[Title](URL)** (emoji before bold)
  let match = line.match(/^-\s*(.+?)\s*\*\*\[([^\]]+)\]\(([^)]+)\)\*\*(.*)$/);
  if (match) {
    const prefix = match[1];
    const emoji = extractEmoji(prefix);
    if (emoji) {
      return formatListItem(emoji, match[2], match[3]);
    }
  }

  // Pattern 2: - **emoji [Title](URL)** (emoji inside bold before bracket)
  match = line.match(/^-\s*\*\*(.+?)\s*\[([^\]]+)\]\(([^)]+)\)\*\*(.*)$/);
  if (match) {
    const prefix = match[1];
    const emoji = extractEmoji(prefix);
    if (emoji) {
      return formatListItem(emoji, match[2], match[3]);
    }
  }

  // Pattern 3: - **(emoji) [Title](URL)** (emoji in parens inside bold)
  match = line.match(/^-\s*\*\*\((.+?)\)\s*\[([^\]]+)\]\(([^)]+)\)\*\*(.*)$/);
  if (match) {
    const emojiContent = match[1];
    const emoji = extractEmoji(emojiContent) || emojiContent;
    return formatListItem(emoji, match[2], match[3]);
  }

  // Pattern 4: - **[emoji Title](URL)** (emoji inside brackets with title)
  match = line.match(/^-\s*\*\*\[(.+?)\]\(([^)]+)\)\*\*(.*)$/);
  if (match) {
    const titleWithEmoji = match[1];
    const emoji = extractEmoji(titleWithEmoji);
    if (emoji) {
      // Remove emoji from title
      const title = titleWithEmoji.replace(EMOJI_PATTERN, "").trim();
      return formatListItem(emoji, title, match[2]);
    }
  }

  // Pattern 5: - emoji [Title](URL) (emoji before link, no bold around emoji)
  match = line.match(/^-\s*(.+?)\s*\[([^\]]+)\]\(([^)]+)\)(.*)$/);
  if (match) {
    const prefix = match[1];
    const emoji = extractEmoji(prefix);
    if (emoji && !prefix.includes("**")) {
      return formatListItem(emoji, match[2], match[3]);
    }
  }

  return null;
}

function formatListItem(emoji, title, url) {
  // Ensure URL has ref tracking
  let finalUrl = url;
  if (!url.includes("ref=zazen_code")) {
    if (!url.includes("?")) {
      finalUrl = url + "?ref=zazen_code";
    } else {
      finalUrl = url + "&ref=zazen_code";
    }
  }

  return `- **(${emoji}) [${title}](${finalUrl})**`;
}

function processBody(body) {
  const lines = body.split("\n");
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip stray single-letter lines (like " a")
    if (line.trim().length === 1 && /^[a-z]$/i.test(line.trim())) {
      i++;
      continue;
    }

    // Check for section headings (## or ###)
    if (line.match(/^#{2,3}\s/)) {
      const normalized = normalizeHeading(line);
      result.push(normalized);
      i++;
      continue;
    }

    // Check for list items starting with -
    if (line.trim().startsWith("- ")) {
      const normalized = normalizeListItem(line);
      if (normalized) {
        result.push(normalized);
        i++;

        // Collect the description
        let description = null;

        while (i < lines.length) {
          const nextLine = lines[i];

          // Sub-bullet description (like "  - Description text")
          if (nextLine.match(/^\s+-\s+/)) {
            const descMatch = nextLine.match(/^\s+-\s+(.*)$/);
            if (descMatch && descMatch[1].trim()) {
              description = descMatch[1].trim();
            }
            i++;
            continue;
          }

          // Indented description (like "  Description text")
          if (nextLine.match(/^\s{2,}\S/)) {
            const trimmed = nextLine.trim();
            if (trimmed && !trimmed.startsWith("-")) {
              description = trimmed;
            }
            i++;
            continue;
          }

          // Empty line - might be followed by description
          if (nextLine.trim() === "") {
            i++;
            // Check if next non-empty line is indented description
            if (i < lines.length && lines[i].match(/^\s{2,}\S/)) {
              const trimmed = lines[i].trim();
              if (trimmed && !trimmed.startsWith("-")) {
                description = trimmed;
                i++;
              }
            }
            continue;
          }

          // Not a description, break out
          break;
        }

        // Add description with proper formatting (blank line then 2-space indent)
        if (description) {
          result.push("");
          result.push(`  ${description}`);
        }

        result.push("");
        continue;
      }
    }

    // Pass through other lines
    result.push(line);
    i++;
  }

  // Clean up multiple consecutive blank lines
  let cleanedResult = [];
  let prevWasBlank = false;

  for (const line of result) {
    const isBlank = line.trim() === "";
    if (isBlank && prevWasBlank) {
      continue; // Skip consecutive blank lines
    }
    cleanedResult.push(line);
    prevWasBlank = isBlank;
  }

  // Ensure file ends with single newline
  while (
    cleanedResult.length > 0 &&
    cleanedResult[cleanedResult.length - 1].trim() === ""
  ) {
    cleanedResult.pop();
  }
  cleanedResult.push("");

  return cleanedResult.join("\n");
}

function processFile(filePath) {
  console.log(`Processing: ${basename(filePath)}`);

  const content = readFileSync(filePath, "utf-8");
  const { frontmatter, body } = parseFrontmatter(content);

  // Update frontmatter
  frontmatter.conclusion = TARGET_CONCLUSION;
  if (!frontmatter.image) {
    frontmatter.image = DEFAULT_IMAGE;
  }

  // Process body
  const processedBody = processBody(body);

  // Rebuild file
  const newContent = buildFrontmatter(frontmatter) + processedBody;

  writeFileSync(filePath, newContent, "utf-8");
  console.log(`  Updated: ${basename(filePath)}`);
}

// Main
console.log("Harmonizing Frontend Weekly Digest files...\n");

let processed = 0;
let errors = 0;

for (const file of FILES_TO_PROCESS) {
  const filePath = join(BLOG_DIR, file);
  try {
    processFile(filePath);
    processed++;
  } catch (err) {
    console.error(`  Error processing ${file}: ${err.message}`);
    errors++;
  }
}

console.log(`\nDone! Processed ${processed} files, ${errors} errors.`);
