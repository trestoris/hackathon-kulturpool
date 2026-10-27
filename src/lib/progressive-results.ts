/** Keep visible positions stable when later records arrive or failed records are retried. */
export function appendUniqueRows<T extends { id: string }>(
	existing: readonly T[],
	incoming: readonly T[]
): T[] {
	const rows = new Map(existing.map((row) => [row.id, row]));
	for (const row of incoming) rows.set(row.id, row);
	return [...rows.values()];
}

export function pageWindow(count: number, requestedPage: number, perPage = 20) {
	const page = Math.max(1, Math.min(requestedPage, Math.ceil(count / perPage) || 1));
	const start = (page - 1) * perPage;
	return { page, start, end: Math.min(start + perPage, count) };
}
