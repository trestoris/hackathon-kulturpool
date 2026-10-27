import type { RecordDetail, RecordLookup } from './kulturpool.js';

export async function loadRecordDetails(
	recordIds: readonly string[],
	fetcher: typeof fetch,
	signal: AbortSignal,
	onProgress?: (completed: number, id: string, lookup: RecordLookup) => void
): Promise<Record<string, RecordLookup>> {
	const queue = [...new Set(recordIds)];
	const results = new Map<string, RecordLookup>();
	let next = 0;
	async function worker() {
		while (!signal.aborted && next < queue.length) {
			const id = queue[next++];
			let lookup: RecordLookup;
			try {
				const response = await fetcher(`/api/records/${encodeURIComponent(id)}`, {
					signal,
					headers: { Accept: 'application/json' }
				});
				if (response.status === 404) {
					lookup = { status: 'missing' };
				} else {
					const data = await response.json();
					if (!response.ok) throw new Error(data.message || 'Could not load record details.');
					lookup = { status: 'found', record: data as RecordDetail };
				}
			} catch (cause) {
				if (signal.aborted) break;
				lookup = {
					status: 'error',
					message: cause instanceof Error ? cause.message : 'Could not load record details.'
				};
			}
			if (signal.aborted) break;
			results.set(id, lookup);
			onProgress?.(results.size, id, lookup);
		}
	}
	await Promise.all(Array.from({ length: Math.min(3, queue.length) }, () => worker()));
	signal.throwIfAborted();
	return Object.fromEntries(results);
}
