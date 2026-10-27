# Grouped review output

The application combines the existing Kulturpool API responses into `search.reviewQueue`.
This is the normalized application output, not a new HTTP endpoint or a change to the
upstream API. The TypeScript contract (`ReviewQueue`, `ReviewEntity`, `ReviewMatch`)
lives in `src/lib/review-targets.ts`.

## Selection and grouping

- One entity group per search-result QID, in search-result order.
- Each group contains only distinct matches requiring review: the configured model
  supplies a boolean `plausible` and a finite numeric confidence in `[0, 0.3)`.
- Both accepted and rejected model decisions qualify. Missing confidence is not zero;
  another model's assessment and legacy flat fields are not substituted.
- A single qualifying match is enough to include the entity. No confidence is averaged,
  joined, rounded, converted into a percentage, or used to calculate `plausible`.
- `llmDecision` summarizes the flagged matches: `Relevant`, `Not relevant`, or `Mixed`.
  It does not express model relevance to the user's query.
- The original record lookups remain available separately, including unflagged matches
  and direct identifier resolutions. They are not discarded from API state.

## Scores and identity

| Property                          | Source / meaning                                                            |
| --------------------------------- | --------------------------------------------------------------------------- |
| `entities[].searchScore`          | The search result's score for the submitted query                           |
| `entities[].matches[].matchScore` | The enriched candidate's score for its record field                         |
| `entities[].matches[].confidence` | The exact confidence number from that candidate's selected-model assessment |
| `entities[].matches[].plausible`  | The model's original boolean decision                                       |
| `entities[].matches[].id`         | Existing assessment ID, unchanged for saved-feedback compatibility          |

Each match also includes its record ID, title and description, source field, original
value and value identity, enrichment field key, model, analysis timestamp, and explanation.
The identity includes record, field, original value, QID, model, and analysis revision.
Grouping never transfers an expert decision to another match.

The following excerpt illustrates the Mozart response (identity and additional record
metadata omitted for readability):

```json
{
	"query": "mozrt",
	"model": "google/gemini-2.5-flash-lite",
	"confidenceThreshold": 0.3,
	"entities": [
		{
			"qid": "Q254",
			"name": "Wolfgang Amadeus Mozart",
			"description": "Musiker und Komponist der Wiener Klassik",
			"searchScore": 70.23868,
			"llmDecision": "Relevant",
			"matches": [
				{
					"recordTitle": "Ein Moment aus den letzten Tagen Mozarts",
					"sourceField": "subject",
					"originalValue": "Wolfgang Amadeus Mozart",
					"matchScore": 1320.9994,
					"plausible": true,
					"confidence": 0.1321,
					"explanation": "Wolfgang Amadeus Mozart ist die gesuchte Person."
				}
			]
		}
	]
}
```

## Implementation stage

The grouped data contract and selection are implemented. The existing table and dialog
still consume individual review targets until the next approved UI step. That step will
use shadcn-svelte components, display each match's concrete confidence, and preserve
record-level review controls and saved feedback. There is no entity-level confidence.
