// Audits prerendered public HTML rather than source templates. Similarity and word counts
// are triage signals for editorial review, never Google spam verdicts or ranking scores.
import {
  readFileSync,
  readdirSync,
  existsSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { join, relative, dirname } from "node:path";
const root = "dist/client";
const output = process.argv[2] || "reports/seo/audit.json";
const origin = "https://concretecostpro.com";
const normalize = (path) => (path === "/" ? "/" : path.replace(/\/+$/, ""));
const decode = (text) =>
  text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16)),
    )
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
const plain = (html) =>
  decode(
    html
      .replace(
        /<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>|<svg\b[^>]*>[\s\S]*?<\/svg>|<!--[\s\S]*?-->/gi,
        " ",
      )
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
const attrs = (tag) =>
  Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map((m) => [
      m[1].toLowerCase(),
      decode(m[2] ?? m[3]),
    ]),
  );
const tags = (html, name) =>
  [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map((m) =>
    attrs(m[0]),
  );
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) =>
    item.isDirectory()
      ? files(join(dir, item.name))
      : item.name.endsWith(".html")
        ? [join(dir, item.name)]
        : [],
  );
}
const errors = [];
const review = [];
const pages = [];
const excluded = [];
for (const file of files(root)) {
  const html = readFileSync(file, "utf8");
  const path = normalize(
    "/" +
      relative(root, file)
        .replaceAll("\\", "/")
        .replace(/index\.html$/, ""),
  );
  const metas = tags(html, "meta");
  if (metas.some((m) => m["http-equiv"]?.toLowerCase() === "refresh")) {
    excluded.push({ path, reason: "redirect" });
    continue;
  }
  if (
    metas.some((m) => m.name === "robots" && m.content?.includes("noindex"))
  ) {
    excluded.push({ path, reason: "noindex" });
    continue;
  }
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || "";
  const title = plain(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "");
  const descriptions = metas.filter((m) => m.name === "description");
  const canonical = tags(html, "link").filter((l) => l.rel === "canonical");
  const h1 = [...main.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) =>
    plain(m[1]),
  );
  if (!main) errors.push(`${path}: no main content`);
  if (!title) errors.push(`${path}: missing title`);
  if (descriptions.length !== 1 || !descriptions[0].content)
    errors.push(`${path}: expected one nonempty meta description`);
  if (canonical.length !== 1 || canonical[0].href !== `${origin}${path}`)
    errors.push(`${path}: canonical does not match normalized production URL`);
  if (h1.length !== 1)
    errors.push(`${path}: expected one H1, got ${h1.length}`);
  const jsonLd = [];
  for (const match of html.matchAll(
    /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      jsonLd.push(JSON.parse(match[1]));
    } catch {
      errors.push(`${path}: invalid JSON-LD`);
    }
  }
  if (jsonLd.some((s) => s["@type"] === "WebSite" && s.potentialAction))
    errors.push(
      `${path}: SearchAction advertises an unimplemented site search`,
    );
  const links = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
    .map((m) => ({ ...attrs(m[1]), label: plain(m[2]) }))
    .filter((l) => l.href);
  const bodyLinks = [...main.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
    .map((m) => ({ ...attrs(m[1]), label: plain(m[2]) }))
    .filter((l) => l.href);
  const paragraphs = [...main.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => plain(m[1]))
    .filter((p) => p.split(" ").length >= 15);
  const text = plain(main);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 250 && !["/contact", "/refund"].includes(path))
    review.push(
      `${path}: low main-text count (${wordCount}); assess task usefulness manually`,
    );
  for (const image of tags(html, "img")) {
    if (!("alt" in image))
      errors.push(`${path}: image missing alt (${image.src})`);
    if (
      image.src?.startsWith("/") &&
      !existsSync(join(root, decodeURIComponent(image.src.split(/[?#]/)[0])))
    )
      errors.push(`${path}: broken local image ${image.src}`);
  }
  const editorialText = plain(
    main.replace(/<astro-island\b[^>]*>[\s\S]*?<\/astro-island>/gi, " "),
  );
  pages.push({
    path,
    title,
    description: descriptions[0]?.content,
    canonical: canonical[0]?.href,
    h1,
    wordCount,
    editorialWords: editorialText.split(/\s+/).filter(Boolean).length,
    jsonLdTypes: jsonLd.map((s) => s["@type"]),
    links,
    bodyLinks,
    paragraphs,
    text,
    editorialText,
  });
}
const paths = new Set(pages.map((p) => p.path));
const routePaths = new Set([...paths, ...excluded.map((p) => p.path)]);
for (const page of pages)
  for (const link of page.links) {
    if (/^(mailto:|tel:|javascript:)/.test(link.href)) continue;
    let url;
    try {
      url = new URL(link.href, `${origin}${page.path}`);
    } catch {
      errors.push(`${page.path}: invalid href ${link.href}`);
      continue;
    }
    if (url.origin !== origin) continue;
    const target = normalize(url.pathname);
    if (
      !routePaths.has(target) &&
      !existsSync(join(root, decodeURIComponent(url.pathname)))
    )
      errors.push(`${page.path}: broken internal link ${link.href}`);
    if (url.hash && routePaths.has(target)) {
      const targetFile = join(
        root,
        target === "/" ? "index.html" : `${target}/index.html`,
      );
      if (existsSync(targetFile)) {
        const targetHtml = readFileSync(targetFile, "utf8");
        const ids = [...targetHtml.matchAll(/\bid="([^"]+)"/g)].map(
          (m) => m[1],
        );
        if (!ids.includes(decodeURIComponent(url.hash.slice(1))))
          errors.push(`${page.path}: missing linked fragment ${link.href}`);
      }
    }
  }
for (const field of ["title", "description", "canonical", "text"]) {
  const grouped = Map.groupBy(pages, (p) => p[field]);
  for (const [value, group] of grouped)
    if (value && group.length > 1)
      errors.push(`Duplicate ${field}: ${group.map((p) => p.path).join(", ")}`);
}
const inbound = (path, body = false) =>
  pages
    .filter(
      (p) =>
        p.path !== path &&
        (body ? p.bodyLinks : p.links).some((l) => {
          try {
            const url = new URL(l.href, origin);
            return url.origin === origin && normalize(url.pathname) === path;
          } catch {
            return false;
          }
        }),
    )
    .map((p) => p.path);
for (const page of pages)
  if (page.path !== "/" && !inbound(page.path).length)
    errors.push(`${page.path}: orphan page`);
const sitemapFiles = readdirSync(root).filter((f) =>
  /^sitemap-\d+\.xml$/.test(f),
);
const sitemap = sitemapFiles.flatMap((file) =>
  [
    ...readFileSync(join(root, file), "utf8").matchAll(/<loc>(.*?)<\/loc>/g),
  ].map((m) => decode(m[1])),
);
for (const url of sitemap) {
  const path = new URL(url).pathname;
  if (!paths.has(normalize(path)))
    errors.push(`Sitemap includes nonindexable URL: ${url}`);
  if (url !== `${origin}${normalize(path)}`)
    errors.push(`Sitemap/canonical URL mismatch: ${url}`);
}
for (const path of paths)
  if (!sitemap.includes(`${origin}${path}`))
    errors.push(`${path}: missing from sitemap`);
const repeatedParagraphs = [];
const pg = new Map();
for (const page of pages)
  for (const paragraph of new Set(page.paragraphs)) {
    if (!pg.has(paragraph)) pg.set(paragraph, []);
    pg.get(paragraph).push(page.path);
  }
for (const [text, locations] of pg)
  if (locations.length > 1) repeatedParagraphs.push({ text, pages: locations });
function shingles(text) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return new Set(
    words.slice(0, -4).map((_, i) => words.slice(i, i + 5).join(" ")),
  );
}
const similarity = [];
for (let i = 0; i < pages.length; i++)
  for (let j = i + 1; j < pages.length; j++) {
    const a = shingles(pages[i].text);
    const b = shingles(pages[j].text);
    const overlap = [...a].filter((s) => b.has(s)).length;
    const containment = overlap / Math.min(a.size, b.size);
    if (containment >= 0.35)
      similarity.push({
        pages: [pages[i].path, pages[j].path],
        smallerPageShingleOverlap: Number(containment.toFixed(3)),
      });
  }
const editorialSimilarity = [];
for (let i = 0; i < pages.length; i++)
  for (let j = i + 1; j < pages.length; j++) {
    const a = shingles(pages[i].editorialText);
    const b = shingles(pages[j].editorialText);
    const overlap = [...a].filter((s) => b.has(s)).length;
    const containment = overlap / Math.min(a.size, b.size);
    if (containment >= 0.35)
      editorialSimilarity.push({
        pages: [pages[i].path, pages[j].path],
        smallerPageShingleOverlap: Number(containment.toFixed(3)),
      });
  }
const newSlugs = [
  "concrete-invoice-template",
  "ready-mix-concrete-cost-calculator",
  "concrete-pour-calculator",
  "concrete-material-calculator",
  "concrete-price-per-yard-calculator",
];
const newPages = newSlugs.map((slug) => {
  const path = `/${slug}`;
  const p = pages.find((p) => p.path === path);
  if (!p) errors.push(`${path}: new page missing`);
  const bodyInbound = inbound(path, true);
  if (bodyInbound.length < 3)
    errors.push(`${path}: fewer than 3 contextual inbound pages`);
  if (
    p &&
    (!p.bodyLinks.some((l) => l.href === "/pricing") ||
      !p.bodyLinks.some((l) => l.href === "/concrete-estimating-software"))
  )
    errors.push(`${path}: missing paid-product body links`);
  return {
    path,
    wordCount: p?.wordCount,
    bodyInbound,
    inbound: inbound(path),
    bodyOutbound: [...new Set(p?.bodyLinks.map((l) => l.href))],
    schemaTypes: p?.jsonLdTypes,
  };
});
const result = {
  generatedAt: new Date().toISOString(),
  scope:
    "All prerendered indexable HTML; redirects and licensed noindex app pages checked separately. Word counts and similarity are review signals, not Google thresholds. Editorial similarity excludes interactive astro-island interface content, retaining all static page copy.",
  publicPages: pages.length,
  excluded,
  errors: [...new Set(errors)],
  review,
  newPages,
  similarity: similarity.sort(
    (a, b) => b.smallerPageShingleOverlap - a.smallerPageShingleOverlap,
  ),
  editorialSimilarity: editorialSimilarity.sort(
    (a, b) => b.smallerPageShingleOverlap - a.smallerPageShingleOverlap,
  ),
  repeatedParagraphs,
  pages: pages.map(
    ({ links, bodyLinks, paragraphs, text, editorialText, ...p }) => ({
      ...p,
      inbound: inbound(p.path),
      bodyInbound: inbound(p.path, true),
    }),
  ),
};
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(result, null, 2));
console.log(
  JSON.stringify(
    {
      output,
      publicPages: pages.length,
      errors: result.errors,
      review,
      similarPairs: similarity.length,
      repeatedParagraphs: repeatedParagraphs.length,
    },
    null,
    2,
  ),
);
if (errors.length) process.exitCode = 1;
