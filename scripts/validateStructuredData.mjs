// Validates the built site's JSON-LD against the Google Search Console Merchant Listings
// requirements: exactly one Product entity (on /pricing/), every required field present, and
// no fabricated review/rating/shipping/GTIN data. Run after `npm run build` with
// `npm run validate:schema`, or via `node scripts/validateStructuredData.mjs`.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist/client";
const LD_JSON_RE = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;

function findHtmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) out.push(...findHtmlFiles(full));
    else if (entry === "index.html") out.push(full);
  }
  return out;
}

let errors = [];
let productEntities = []; // { file, entity }

for (const file of findHtmlFiles(DIST)) {
  const html = readFileSync(file, "utf-8");
  let match;
  while ((match = LD_JSON_RE.exec(html))) {
    let parsed;
    try {
      parsed = JSON.parse(match[1]);
    } catch (err) {
      errors.push(`${file}: malformed JSON-LD block -- ${err.message}`);
      continue;
    }
    const types = Array.isArray(parsed["@type"]) ? parsed["@type"] : [parsed["@type"]];
    if (types.includes("Product")) productEntities.push({ file, entity: parsed });
  }
}

if (productEntities.length === 0) {
  errors.push("No Product entity found anywhere in the built site -- expected exactly one, on /pricing/.");
} else if (productEntities.length > 1) {
  errors.push(`Found ${productEntities.length} Product entities (expected exactly one): ${productEntities.map((p) => p.file).join(", ")}`);
}

for (const { file, entity } of productEntities) {
  const required = {
    name: entity.name,
    image: entity.image,
    brand: entity.brand,
    offers: entity.offers,
    "offers.price": entity.offers?.price,
    "offers.priceCurrency": entity.offers?.priceCurrency,
    "offers.availability": entity.offers?.availability,
    "offers.hasMerchantReturnPolicy": entity.offers?.hasMerchantReturnPolicy,
  };
  for (const [field, value] of Object.entries(required)) {
    if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
      errors.push(`${file}: Product entity missing required field "${field}"`);
    }
  }

  // Guard against ever fabricating these -- see the comment above productSchema in
  // pricing.astro for why they're intentionally absent.
  const forbidden = ["review", "aggregateRating", "gtin", "gtin8", "gtin12", "gtin13", "gtin14", "mpn"];
  for (const field of forbidden) {
    if (entity[field] !== undefined) {
      errors.push(`${file}: Product entity has "${field}" -- this must only be added from real, verified data.`);
    }
  }

  if (Array.isArray(entity.image)) {
    for (const url of entity.image) {
      if (!/^https:\/\/concretecostpro\.com\//.test(url)) {
        errors.push(`${file}: Product image "${url}" is not an absolute production URL.`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error("Structured-data validation FAILED:\n");
  for (const e of errors) console.error(" -", e);
  process.exit(1);
}

console.log(`Structured-data validation passed: ${productEntities.length} Product entity found on ${productEntities[0]?.file}, all required fields present, no fabricated fields.`);
