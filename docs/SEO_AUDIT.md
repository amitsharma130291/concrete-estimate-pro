# Concrete Cost Pro: five new tools and whole-site SEO audit

Date: 18 September 2026. Base commit: `a331274548c3c14bf2b421a666e231f1ac596f31`. Implementation branch: `feat/five-calculators-seo`.

## Scope and outcome

Reviewed the repository, existing public site and production-generated HTML for every public route. The updated build has 22 indexable public pages, seven noindex application pages and one application redirect. The automated report is `reports/seo/audit.json`; reproduce with `npm run build` followed by `npm run audit:seo`.

All five tools are functional and have separate purposes, original instructions, worked calculations, FAQs, contextual internal links and relevant Concrete Cost Pro promotions. The final local audit found no duplicate titles/descriptions, broken internal page/fragment links, orphan public pages, missing canonical URLs, sitemap coverage errors or flagged short editorial tool pages. These are local implementation results, not evidence of production deployment or Google's indexing decisions.

## Five-page audit

| New page | Distinct task | Editorial words | Incoming body links from distinct pages |
| --- | --- | ---: | ---: |
| `/concrete-invoice-template` | Customer invoice with taxable lines, payments, balance and printable PDF | 878 | 11 |
| `/ready-mix-concrete-cost-calculator` | One supplier's order including delivery, short-load, pumping and tax | 881 | 11 |
| `/concrete-pour-calculator` | Combine rectangular sections, apply allowance and round the total once | 874 | 12 |
| `/concrete-material-calculator` | Purchase schedule from specified quantities, waste and purchase increments | 895 | 11 |
| `/concrete-price-per-yard-calculator` | Compare two suppliers at the same quantity using delivered effective rates | 891 | 8 |

Every page has a unique title, description and H1, a production canonical URL, breadcrumbs, valid JSON-LD, an illustrative worked example and direct links to both pricing and product features. All five are linked directly from the homepage and calculator directory. Body-link counts exclude sitewide navigation/footer links and count source pages, not repeated anchors.

The material tool intentionally starts with a specified takeoff. It does not claim to design concrete mixes, reinforcement or structural dimensions. The invoice tool produces customer billing documents; its Pro promotion accurately presents estimating and cost tracking, without inventing a paid invoice archive.

## Duplicate, thin and scaled-content review

The six existing geometry calculators previously relied heavily on repeated explanatory and promotional blocks. Replaced those blocks with project-specific measurement checks, scope limits, distinct worked examples and relevant next steps. Removed redundant generic sales sections while retaining one focused product offer. Separated estimate/quote intent from the new invoice page; separated single-order ready-mix costing from two-supplier comparison.

The audit compares five-word shingles in the main content. The maximum observed containment score fell from approximately 0.689 in the initial expanded build to 0.455 after the content changes. Eleven pairs still trigger the full-main review threshold because useful calculators share interface labels, formulas and some practical notes. When interactive island content is excluded, no editorial pair exceeds the internal 0.35 triage threshold. Seven repeated long paragraphs remain, primarily shared interface explanations and practical disclaimers. Neither threshold is a Google quality standard, and similarity alone does not establish spam.

No exact duplicate core editorial pages were found. Each new tool provides different functionality and substantial task-specific guidance. Existing calculator pages now explain the actual project they serve rather than merely swapping a keyword. No unsupported claim is made that Google previously classified this site as scaled-content abuse, or that a local audit can certify its absence in Google's systems.

Contact is intentionally a short functional form. It was manually reviewed rather than padded to meet a word-count target. Legal, pricing, product and help pages were reviewed according to their purpose. Sample prices are explicitly illustrative; unsupported general market-price claims were removed.

## Site-wide fixes

- Standardized slash-free canonicals, product/refund schema URLs and sitemap URLs; configured trailing-slash redirects in the Vercel build output.
- Excluded all application routes from the public sitemap and retained their noindex metadata. Removed the robots block on `/app` so crawlers can read noindex; `/api` remains disallowed.
- Removed a WebSite SearchAction that described a nonexistent search endpoint.
- Corrected claims suggesting multiple saved estimates, project archives or reimportable estimate backups. The product currently maintains one working estimate; business-settings JSON and exported estimate PDF/CSV serve different purposes.
- Updated privacy/help/sales copy to match actual local storage and backup behavior. Clarified customer charges versus internal cost and margin calculations.
- Added descriptive contextual links between quantity, purchasing, supplier comparison, job pricing, estimates and invoices. No public page is orphaned.
- Added an automated SEO audit to the QA workflow and corrected a vulnerable routing dependency through a targeted same-major override. The final dependency audit reports zero known vulnerabilities.

## Product promotion

Every new page includes a task-specific offer, actual product screenshot, feature link and pricing CTA. The offer states the existing $79 lifetime launch price, regular $99 and no monthly subscription. Copy connects the free tool's result to relevant paid estimating, catalog, margin or actual-cost workflows. It does not promise automatic engineering decisions, payment processing or unsupported accounting features.

## Validation and boundaries

Validation includes the production build, Astro diagnostics, 223 unit tests, structured-data checks, the 22-page automated audit, desktop/mobile Chromium browser checks, accessibility scans, invalid-input checks and invoice print/PDF visual review. Browser checks use the actual generated public HTML through a local static server; payment/contact APIs and licensed checkout flows are outside this change's end-to-end scope.

The report does not include Search Console impressions, query cannibalization data, Google-selected canonicals, manual actions, backlinks or field Core Web Vitals. Those require external account data and production observation. FAQ markup does not guarantee a rich result. No numeric SEO score, ranking promise or indexing guarantee is implied.

After deployment, verify the live five URLs, trailing-slash redirects, sitemap and noindex headers/metadata. Use Search Console URL inspection and performance reports to confirm indexing and assess real query overlap. These production checks cannot be completed against an undeployed branch.

## Review references

The content review follows Google's [helpful-content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) and [spam policies](https://developers.google.com/search/docs/essentials/spam-policies). Canonical and link checks follow its [duplicate-URL guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) and [crawlable-link guidance](https://developers.google.com/search/docs/crawling-indexing/links-crawlable).
