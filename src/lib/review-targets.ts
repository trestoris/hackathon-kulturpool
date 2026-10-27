import type { RecordLookup, SearchResponse, SearchResult } from './kulturpool.js';

export const REVIEW_MODEL = 'google/gemini-2.5-flash-lite';
export const CONFIDENCE_THRESHOLD = 0.3;

export type RecordImage = {
	url: string;
	attribution: string;
	rights: string;
	rightsUrl?: string;
};

export type ReviewContext = {
	qid: string;
	recordId: string;
	recordTitle: string;
	recordDescription: string;
	recordImage?: RecordImage;
	fieldKey: string;
	sourceField: string;
	originalValue: string;
	valueIdentity: string;
	model: string;
	confidence: number;
	analyzedAt: string;
};

export type ReviewTarget = {
	id: string;
	name: string;
	description: string;
	score: string;
	llmDecision: string;
	explanation: string;
	context?: ReviewContext;
};

type EnrichedReviewTarget = ReviewTarget & {
	context: ReviewContext;
	plausible: boolean;
	matchScore: number;
};

/** One flagged assessment; confidence is the exact upstream number, never aggregated. */
export type ReviewMatch = Omit<ReviewContext, 'qid'> & {
	id: string;
	plausible: boolean;
	matchScore: number;
	explanation: string;
};

export type ReviewEntity = {
	qid: string;
	name: string;
	description: string;
	searchScore: number;
	/** Summary of the flagged record matches, not a judgment about the search query. */
	llmDecision: 'Relevant' | 'Not relevant' | 'Mixed';
	matches: ReviewMatch[];
};

export type ReviewQueue = {
	query: string;
	model: string;
	confidenceThreshold: number;
	entities: ReviewEntity[];
};

function object(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Read the common plain-text and JSON-LD text forms without rendering HTML. */
function displayText(value: unknown): string {
	if (typeof value === 'string') return value;
	if (Array.isArray(value)) return value.map(displayText).filter(Boolean).join('; ');
	if (object(value))
		return displayText(value['@value'] ?? value.value ?? value.prefLabel ?? value.label);
	return '';
}

/** Keep the exact API URL; never synthesize a thumbnail or a provider link. */
function mediaUrl(value: unknown): string | undefined {
	if (object(value)) return mediaUrl(value.id ?? value['@id']);
	if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return;
	try {
		const url = new URL(value);
		if (!url.username && !url.password) return value;
	} catch {
		/* Invalid source metadata is simply unavailable. */
	}
}

/** Also guards media restored from older or malformed local review snapshots. */
export function isRecordImage(value: unknown): value is RecordImage {
	return (
		object(value) &&
		!!mediaUrl(value.url) &&
		typeof value.attribution === 'string' &&
		typeof value.rights === 'string' &&
		(value.rightsUrl === undefined || !!mediaUrl(value.rightsUrl))
	);
}

export function extractRecordImage(original: Record<string, unknown>): RecordImage | undefined {
	const cho = object(original.aggregatedCHO) ? original.aggregatedCHO : original;
	const list = (value: unknown) => (Array.isArray(value) ? value : [value]);
	// edm:object is the preview; isShownBy/hasView can also contain audio, video or documents.
	const resources = [
		...list(original.object).map((value) => ({ value, preview: true })),
		...list(original.isShownBy).map((value) => ({ value, preview: false })),
		...list(original.hasView).map((value) => ({ value, preview: false }))
	];
	for (const { value, preview } of resources) {
		const url = mediaUrl(value);
		if (!url) continue;
		const metadata = object(value) ? value : {};
		const type = displayText(metadata.dcType ?? metadata.type).toLowerCase();
		const format = displayText(metadata.format ?? metadata.dcFormat).toLowerCase();
		const path = new URL(url).pathname;
		if (
			/\.(pdf|mp3|mp4|wav|ogg|webm|mov|zip)$/i.test(path) ||
			/audio|video|pdf/.test(`${type} ${format}`)
		)
			continue;
		if (
			!preview &&
			!/image/.test(`${type} ${format}`) &&
			displayText(cho.edmType).toUpperCase() !== 'IMAGE' &&
			!/\.(jpe?g|png|webp|avif|gif)$/i.test(path)
		)
			continue;
		const rightsValue = metadata.edmRights ?? original.edmRights;
		const rightsUrl = mediaUrl(rightsValue);
		return {
			url,
			attribution: displayText(metadata.dcRights) || displayText(original.dataProvider),
			rights: rightsUrl ? 'Rights (source metadata)' : displayText(rightsValue),
			...(rightsUrl ? { rightsUrl } : {})
		};
	}
}

export function reviewTargetId(context: ReviewContext): string {
	return JSON.stringify([
		'enriched-v1',
		context.recordId,
		context.fieldKey,
		context.sourceField,
		context.valueIdentity,
		context.qid,
		context.model,
		context.analyzedAt
	]);
}

/** Only the selected model's assessment on the matched enriched candidate controls eligibility. */
export function extractReviewTargets(
	searchResults: readonly SearchResult[],
	lookups: Record<string, RecordLookup>
): EnrichedReviewTarget[] {
	const matches = new Map(searchResults.map((item) => [item.q_id, item]));
	const targets = new Map<string, EnrichedReviewTarget>();
	for (const lookup of Object.values(lookups)) {
		if (lookup.status !== 'found' || lookup.record.status !== 'success') continue;
		const record = lookup.record;
		if (!record.enriched_data) continue;
		const original = record.original_record;
		const cho = object(original.aggregatedCHO) ? original.aggregatedCHO : original;
		const recordTitle = displayText(cho.title) || record.record_id;
		const recordDescription = displayText(cho.description);
		const recordImage = extractRecordImage(original);
		for (const [fieldKey, field] of Object.entries(record.enriched_data)) {
			if (!object(field)) continue;
			const sourceField = typeof field.source_field === 'string' ? field.source_field : fieldKey;
			// Support both values[].candidates and the documented direct candidates shape.
			const values = Array.isArray(field.values) ? field.values : [field];
			for (const value of values) {
				if (!object(value) || !Array.isArray(value.candidates)) continue;
				const originalValue = value.value ?? cho[sourceField] ?? original[sourceField] ?? null;
				for (const candidate of value.candidates) {
					if (!object(candidate) || typeof candidate.q_id !== 'string') continue;
					const match = matches.get(candidate.q_id);
					if (!match || !object(candidate.plausibility)) continue;
					const assessment = candidate.plausibility[REVIEW_MODEL];
					if (
						!object(assessment) ||
						typeof assessment.plausible !== 'boolean' ||
						typeof assessment.confidence !== 'number' ||
						!Number.isFinite(assessment.confidence) ||
						assessment.confidence < 0 ||
						assessment.confidence >= CONFIDENCE_THRESHOLD ||
						typeof candidate.score !== 'number' ||
						!Number.isFinite(candidate.score)
					)
						continue;
					const context: ReviewContext = {
						qid: candidate.q_id,
						recordId: record.record_id,
						recordTitle,
						recordDescription,
						...(recordImage ? { recordImage } : {}),
						fieldKey,
						sourceField,
						originalValue: displayText(originalValue),
						valueIdentity: JSON.stringify([originalValue, value.url ?? null]),
						model: REVIEW_MODEL,
						confidence: assessment.confidence,
						analyzedAt:
							typeof assessment.analyzed_at === 'string' && assessment.analyzed_at
								? assessment.analyzed_at
								: record.processed_at
					};
					const id = reviewTargetId(context);
					if (targets.has(id)) continue;
					targets.set(id, {
						id,
						context,
						plausible: assessment.plausible,
						matchScore: candidate.score,
						name:
							typeof candidate.label === 'string' && candidate.label
								? candidate.label
								: match.label,
						description:
							typeof candidate.description === 'string'
								? candidate.description
								: (match.description ?? ''),
						score: String(candidate.score),
						llmDecision: assessment.plausible ? 'Relevant' : 'Not relevant',
						explanation:
							typeof assessment.reason === 'string' && assessment.reason.trim()
								? assessment.reason
								: 'No explanation was provided for this assessment.'
					});
				}
			}
		}
	}
	return [...targets.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** Group the review queue by QID while preserving independent record-level assessments. */
export function buildReviewQueue(
	search: SearchResponse | null,
	lookups: Record<string, RecordLookup>
): ReviewQueue {
	const results = search?.results ?? [];
	const matchesByQid = new Map<string, ReviewMatch[]>();
	for (const target of extractReviewTargets(results, lookups)) {
		const { qid, ...context } = target.context;
		const matches = matchesByQid.get(qid) ?? [];
		matches.push({
			...context,
			id: target.id,
			plausible: target.plausible,
			matchScore: target.matchScore,
			explanation: target.explanation
		});
		matchesByQid.set(qid, matches);
	}

	const entities = new Map<string, ReviewEntity>();
	for (const result of results) {
		const matches = matchesByQid.get(result.q_id);
		if (!matches?.length || entities.has(result.q_id)) continue;
		const accepted = matches.some((match) => match.plausible);
		const rejected = matches.some((match) => !match.plausible);
		entities.set(result.q_id, {
			qid: result.q_id,
			name: result.label,
			description: result.description ?? '',
			searchScore: result.score,
			llmDecision: accepted && rejected ? 'Mixed' : accepted ? 'Relevant' : 'Not relevant',
			matches
		});
	}
	return {
		query: search?.query ?? '',
		model: REVIEW_MODEL,
		confidenceThreshold: CONFIDENCE_THRESHOLD,
		entities: [...entities.values()]
	};
}
