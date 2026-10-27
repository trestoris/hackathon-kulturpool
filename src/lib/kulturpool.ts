export type SearchResult = {
	q_id: string;
	label: string;
	description: string | null;
	score: number;
};

export type SearchResponse = {
	query: string;
	results: SearchResult[];
};

export type EntityDetail = {
	qid: string;
	label_de: string | null;
	label_en: string | null;
	description_de: string | null;
	description_en: string | null;
	record_ids: string[];
};

export type EntityLookup =
	| { status: 'found'; entity: EntityDetail }
	| { status: 'missing' }
	| { status: 'error'; message: string };

export type RecordDetail = {
	record_id: string;
	status: 'success' | 'failed';
	processed_at: string;
	original_record: Record<string, unknown>;
	enriched_data: Record<string, unknown> | null;
	available_models: string[];
	schema_version: number | null;
};

export type RecordLookup =
	| { status: 'found'; record: RecordDetail }
	| { status: 'missing' }
	| { status: 'error'; message: string };

/** Keep opaque IDs unchanged and fetch shared records only once per search. */
export function extractRecordIds(lookups: Record<string, EntityLookup>): string[] {
	return [
		...new Set(
			Object.values(lookups).flatMap((lookup) =>
				lookup.status === 'found' ? lookup.entity.record_ids : []
			)
		)
	];
}

/** Unique entity IDs in search-result order; the original results and scores stay intact. */
export function extractSearchQids(results: readonly SearchResult[]): string[] {
	return [...new Set(results.map((result) => result.q_id))];
}
