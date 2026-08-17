// Post-build assertions. Runs as part of `pnpm build`, so it fails CI rather than shipping.
//
// Exists because of a real incident: rehype-mermaid renders diagrams by driving Playwright, and the
// CI runner had no browser binary. Mermaid threw, rehype-mermaid emitted the page with an EMPTY BODY,
// `astro build` exited 0, and a blank article went live. Nothing in the pipeline noticed — the page
// was 105 KB of header, nav and footer with the entire post missing.
//
// Both checks below are about that class of failure: output that is well-formed but hollow.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const blogSrc = join(root, "src/content/blog");

const failures = [];

if (!existsSync(dist)) {
  console.error("verify-build: dist/ is missing — did astro build run?");
  process.exit(1);
}

const slugOf = (file) => file.replace(/\.mdx?$/, "");
const posts = readdirSync(blogSrc).filter((f) => /\.mdx?$/.test(f));

for (const file of posts) {
  const slug = slugOf(file);
  const built = join(dist, "blog", slug, "index.html");
  if (!existsSync(built)) {
    failures.push(`${slug}: no built page at dist/blog/${slug}/index.html`);
    continue;
  }

  const source = readFileSync(join(blogSrc, file), "utf8");
  const html = readFileSync(built, "utf8");

  // A post whose prose vanished still renders chrome, so measure the article region, not the file.
  const body = html.split('id="main-content"')[1] ?? "";
  const text = body
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 400) {
    failures.push(`${slug}: article body is ${text.length} chars — looks empty`);
  }

  // Every ```mermaid fence in the source must have become an SVG. rehype-mermaid drops the content
  // instead of erroring, so the absence of this attribute is the only signal that it failed.
  if (/^```mermaid\b/m.test(source) && !html.includes('aria-roledescription="flowchart')) {
    failures.push(`${slug}: has a mermaid fence but no rendered flowchart SVG`);
  }
}

if (failures.length > 0) {
  console.error(`verify-build: ${failures.length} problem(s)`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(`verify-build: ${posts.length} posts OK`);
