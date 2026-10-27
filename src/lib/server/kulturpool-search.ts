import type { SearchResponse, SearchResult } from '../kulturpool.js';

export class SearchError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

export async function searchKulturpool(
	query: string,
	fetcher: typeof fetch,
	signal?: AbortSignal
): Promise<SearchResponse> {
	query = query.trim();
	if (!query) throw new SearchError(400, 'Enter a search term.');

	const url = new URL('https://lookup.kulturpool.ai/api/search');
	url.search = new URLSearchParams({ query, languages: 'de,en', size: '10' }).toString();
	const timeout = AbortSignal.timeout(15_000);
	let response: Response;
	let data: unknown;
	try {
		response = await fetcher(url, {
			headers: { Accept: 'application/json' },
			signal: signal ? AbortSignal.any([signal, timeout]) : timeout
		});
		if (!response.ok) {
			throw new SearchError(
				response.status === 429 || response.status === 503 ? 503 : 502,
				'Kulturpool search is unavailable. Please try again.'
			);
		}
		data = await response.json();
	} catch (cause) {
		if (cause instanceof SearchError) throw cause;
		if (timeout.aborted) throw new SearchError(504, 'Search timed out. Please try again.');
		throw new SearchError(502, 'Could not reach Kulturpool search. Please try again.');
	}

	if (!data || typeof data !== 'object' || !('results' in data) || !Array.isArray(data.results)) {
		throw new SearchError(502, 'Kulturpool returned an unexpected search response.');
	}
	const results: SearchResult[] = data.results.map((item: unknown) => {
		if (
			!item ||
			typeof item !== 'object' ||
			!('q_id' in item) ||
			typeof item.q_id !== 'string' ||
			!/^Q[1-9]\d*$/.test(item.q_id) ||
			!('label' in item) ||
			typeof item.label !== 'string' ||
			!('score' in item) ||
			typeof item.score !== 'number' ||
			!Number.isFinite(item.score) ||
			('description' in item && item.description != null && typeof item.description !== 'string')
		)
			throw new SearchError(502, 'Kulturpool returned an unexpected search response.');
		return {
			q_id: item.q_id,
			label: item.label,
			score: item.score,
			description:
				'description' in item && typeof item.description === 'string' ? item.description : null
		};
	});
	return { query, results };
}
