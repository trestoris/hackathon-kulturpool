/** A small, process-local cache of successful lookups. Nothing is written to disk. */
export function createLookupCache<T>(
	maxEntries = 200,
	ttlMs = 5 * 60 * 1000,
	now: () => number = Date.now
) {
	const entries = new Map<string, { value: T; expiresAt: number }>();
	const pending = new Map<string, Promise<T>>();

	async function get(key: string, load: () => Promise<T>): Promise<T> {
		const cached = entries.get(key);
		if (cached && cached.expiresAt > now()) {
			// Refresh eviction order without extending the freshness deadline.
			entries.delete(key);
			entries.set(key, cached);
			return cached.value;
		}
		entries.delete(key);
		const running = pending.get(key);
		if (running) return running;

		const request = Promise.resolve()
			.then(load)
			.then((value) => {
				const time = now();
				for (const [id, entry] of entries) {
					if (entry.expiresAt <= time) entries.delete(id);
				}
				entries.set(key, { value, expiresAt: time + ttlMs });
				while (entries.size > maxEntries) entries.delete(entries.keys().next().value!);
				return value;
			})
			.finally(() => pending.delete(key));
		pending.set(key, request);
		return request;
	}

	return { get };
}
