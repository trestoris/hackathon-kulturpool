import {
	extractSearchQids,
	extractRecordIds,
	type SearchResponse,
	type EntityLookup,
	type RecordLookup
} from './kulturpool.js';
import { loadEntityDetails } from './entity-lookups.js';
import { loadRecordDetails } from './record-lookups.js';
import { buildReviewQueue, extractReviewTargets, type ReviewTarget } from './review-targets.js';
import { appendUniqueRows } from './progressive-results.js';

export function createSearch() {
	let result = $state<SearchResponse | null>(null);
	const qids = $derived(extractSearchQids(result?.results ?? []));
	let loading = $state(false);
	let entityLoading = $state(false);
	let entityLookups = $state<Record<string, EntityLookup>>({});
	const recordIds = $derived(extractRecordIds(entityLookups));
	let recordLookups = $state<Record<string, RecordLookup>>({});
	const reviewQueue = $derived(buildReviewQueue(result, recordLookups));
	let reviewTargets = $state<ReviewTarget[]>([]);
	let recordLoading = $state(false);
	let recordsCompleted = $state(0);
	let error = $state('');
	let submittedQuery = $state('');
	let activeRequest: AbortController | undefined;

	function reset() {
		activeRequest?.abort();
		activeRequest = undefined;
		result = null;
		loading = false;
		entityLoading = false;
		entityLookups = {};
		recordLookups = {};
		reviewTargets = [];
		recordLoading = false;
		recordsCompleted = 0;
		error = '';
		submittedQuery = '';
	}

	async function submit(query: string) {
		reset();
		const term = query.trim();
		if (!term) return;
		const request = new AbortController();
		activeRequest = request;
		submittedQuery = term;
		loading = true;
		try {
			// This serializes one request; it is not reactive UI state.
			// eslint-disable-next-line svelte/prefer-svelte-reactivity
			const response = await fetch(`/api/search?${new URLSearchParams({ query: term })}`, {
				signal: request.signal,
				headers: { Accept: 'application/json' }
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.message || 'Search failed. Please try again.');
			if (activeRequest !== request) return;
			result = data as SearchResponse;
			loading = false;
			entityLoading = qids.length > 0;
			const details = await loadEntityDetails(qids, fetch, request.signal);
			if (activeRequest !== request) return;
			entityLookups = details;
			entityLoading = false;
			await fetchRecords(recordIds, request);
		} catch (cause) {
			if (activeRequest === request && !request.signal.aborted) {
				error = cause instanceof Error ? cause.message : 'Search failed. Please try again.';
			}
		} finally {
			if (activeRequest === request) {
				loading = false;
				entityLoading = false;
			}
		}
	}

	async function fetchRecords(ids: string[], request: AbortController) {
		const previouslyCompleted = recordIds.length - ids.length;
		recordsCompleted = previouslyCompleted;
		recordLoading = ids.length > 0;
		try {
			await loadRecordDetails(ids, fetch, request.signal, (completed, id, lookup) => {
				if (activeRequest !== request) return;
				recordsCompleted = previouslyCompleted + completed;
				recordLookups = { ...recordLookups, [id]: lookup };
				// Process only the newly completed record; retain the position of existing rows.
				reviewTargets = appendUniqueRows(
					reviewTargets,
					extractReviewTargets(result?.results ?? [], { [id]: lookup })
				);
			});
		} catch (cause) {
			if (!request.signal.aborted) throw cause;
		} finally {
			if (activeRequest === request) recordLoading = false;
		}
	}

	async function retryRecords() {
		if (!activeRequest || recordLoading || entityLoading) return;
		const failedIds = recordIds.filter((id) => recordLookups[id]?.status === 'error');
		await fetchRecords(failedIds, activeRequest);
	}

	return {
		get result() {
			return result;
		},
		get qids() {
			return qids;
		},
		get entityLookups() {
			return entityLookups;
		},
		get entityLoading() {
			return entityLoading;
		},
		get recordIds() {
			return recordIds;
		},
		get recordLookups() {
			return recordLookups;
		},
		get reviewTargets() {
			return reviewTargets;
		},
		get reviewQueue() {
			return reviewQueue;
		},
		get recordLoading() {
			return recordLoading;
		},
		get recordsCompleted() {
			return recordsCompleted;
		},
		get loading() {
			return loading;
		},
		get error() {
			return error;
		},
		get submittedQuery() {
			return submittedQuery;
		},
		submit,
		retryRecords,
		reset
	};
}
