import type { EntityDetail, EntityLookup } from './kulturpool.js';

/** Fetch each entity once, with at most three requests in flight. Never fetch records here. */
export async function loadEntityDetails(
	qids: readonly string[],
	fetcher: typeof fetch,
	signal: AbortSignal
): Promise<Record<string, EntityLookup>> {
	const queue = [...new Set(qids)];
	const results: Record<string, EntityLookup> = {};
	let next = 0;
	async function worker() {
		while (!signal.aborted && next < queue.length) {
			const qid = queue[next++];
			try {
				const response = await fetcher(`/api/entities/${encodeURIComponent(qid)}`, {
					signal,
					headers: { Accept: 'application/json' }
				});
				if (response.status === 404) {
					results[qid] = { status: 'missing' };
					continue;
				}
				const data = await response.json();
				if (!response.ok) throw new Error(data.message || 'Could not load entity details.');
				results[qid] = { status: 'found', entity: data as EntityDetail };
			} catch (cause) {
				if (signal.aborted) break;
				results[qid] = {
					status: 'error',
					message: cause instanceof Error ? cause.message : 'Could not load entity details.'
				};
			}
		}
	}
	await Promise.all(Array.from({ length: Math.min(3, queue.length) }, () => worker()));
	signal.throwIfAborted();
	return results;
}
