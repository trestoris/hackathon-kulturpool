# Veryfake

A responsive SvelteKit verification workspace based on the supplied interface reference. Uses Svelte 5, Tailwind CSS 4, shadcn-svelte (Sidebar, Sheet, Card, Input Group, Input, Textarea, Button, Toggle Group, Avatar, Badge, Label, Progress, Separator, Tooltip, and Empty), and Lucide icons.

## Run locally

```sh
npm install
npm run dev
```

## Validate

```sh
npm run check
npm test
npm run build
```

## Features

- Full-height image while drafting a search; submitting with Enter or the Search button reveals the review area and sidebar. Editing or clearing the query returns to the landing view and cancels the previous search.

- Table-based review queue with score sorting, status filters, and a review dialog.
- The review dialog places entity identity and source-record evidence on the left, with model assessment and a separate expert feedback form on the right. Open sections use typography, spacing, and separators. The low-confidence label sits under the assessment heading, with exact confidence beside the decision. It stacks on small screens and keeps the footer actions visible. The query is retained with saved feedback but omitted from the dialog. The record match score stays in the data and table but is omitted from the dialog.

- Submit a query with Enter or the search button to search the live Kulturpool API. The first 10 search results use German labels/descriptions with English fallback and identify candidate QIDs; the review table is built from their linked enriched records. Typing alone does not send requests. Editing or clearing the query cancels pending work and clears stale results.
- Responsive expert-feedback sidebar with a mobile drawer. Saved decisions and full comments remain visible independently of table filters; disagreements with the LLM are marked as corrections.
- The review table shows matching enriched candidates assessed by `google/gemini-2.5-flash-lite` with numeric confidence strictly below `0.3`. Every data cell opens the review dialog, including the original record/field value, actual LLM explanation, confidence, model, and approve/reject/comment controls.
- Expert feedback is saved locally with an assessment snapshot. Record, field, original value, candidate QID, model, and analysis revision identify each review independently. Saved feedback remains editable after changing the search or reloading. Legacy demo feedback is retained separately.

Entity fixtures live in `src/lib/entities.ts`; the page is in `src/routes/+page.svelte`, and the visual theme is in `src/routes/layout.css`. The header uses the user-provided Wien Museum image.

Feature components live in `src/lib/components/verification/`: the search hero, suggestions table, review dialog, feedback sidebar, and feedback card. Decision and score badges are shared across these views. The route owns search and review state, filtering, and browser storage; components receive typed props and callbacks. The underlying shadcn-svelte components remain in `src/lib/components/ui/`.

API integration steps 1–5 are implemented: browser → SvelteKit `GET /api/search` → `https://lookup.kulturpool.ai/api/search`. The server validates input and upstream responses, applies a 15-second timeout, and returns safe errors. Search state lives in `src/lib/search.svelte.ts`, shared response types in `src/lib/kulturpool.ts`, and the upstream client in `src/lib/server/kulturpool-search.ts`. No API key is required for this public search endpoint.

Step 2 derives `search.qids` from the validated search results: unique QIDs in their original order, without changing result rows or Wiki scores. The list is cleared with the search results when the query changes, is cleared, or a new request begins.

Step 3 fetches `/api/entities/{qid}` through a SvelteKit server endpoint, with at most three requests in flight. Entity responses are validated and stored by QID in `search.entityLookups`, including their original `record_ids`. Each lookup is marked found, missing (404), or failed; partial failures retain successful entities and the original search results. Editing, clearing, or resubmitting the search cancels pending requests and clears entity state.

Step 4 deduplicates record IDs across loaded entities and fetches `/api/records/{record_id}` through the local server. URL-shaped IDs are encoded as a single path segment; requests always target the fixed Kulturpool API host. The queue runs at most three requests at a time, reports progress, and stores validated original/enriched data in `search.recordLookups`. Missing records and request failures are distinct, successful responses with failed enrichment remain intact, and retries fetch only failed requests. Search reset cancels queued work and clears record state.

Step 5 extracts nested `values[].candidates` (and direct `candidates`) from successful record enrichments. Only QIDs returned by the search and the configured model's valid assessments are considered. Missing/malformed confidence, scores, or decisions are excluded. The Wiki score comes from the enriched candidate's `score`, never the confidence. Duplicate assessments collapse to one row; separate records, fields, values, and analysis revisions remain independent. The table's All/To review/Reviewed filters operate on these qualifying assessments.

Source links use API-returned URLs only. Opening a review requests `/api/entity-sources/{qid}`, which reads Kulturpool's `/api/resolve/entity/{qid}` and returns its explicit `wikidata_url` unchanged after validating its QID and HTTPS Wikidata destination. Missing or invalid URLs show an unavailable state; no Wikidata or Wikipedia URL is guessed. Closing the dialog cancels pending source loading. The source-record link uses the API's URL-shaped `record_id`.

Feedback uses `veryfake-reviews-v2`; legacy `veryfake-reviews` data is read without overwriting it. Saves remain local to the browser, with no feedback API request. Model selection and file input are not implemented yet. A search score is never treated as LLM confidence. Reviews remain browser-local. Deployment requires a server-capable SvelteKit adapter suitable for your hosting provider. Run the tests with Node.js 22.18+ or 24+.

The UI uses the shadcn-svelte Nova component style and neutral theme tokens. Tailwind utilities handle layout; the score cards use Tailwind emerald, rose, and sky 50 backgrounds, 900 text, and 200 borders.

The next review workflow's data layer is available as `search.reviewQueue`: one group
per QID with distinct low-confidence record matches, their original boolean decisions,
and exact individual confidence values. Search and record match scores are separate.
See [the grouped output contract](docs/review-output.md). The table/dialog migration
to this grouped output is the next approval step; the existing UI remains in place.
