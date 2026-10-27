export class EntitySourceError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

/** Read the explicit source URL from the API; never derive a destination from a QID. */
export async function getKulturpoolEntitySource(
	qid: string,
	fetcher: typeof fetch,
	signal?: AbortSignal
): Promise<{ qid: string; wikidata_url: string }> {
	if (!/^Q[1-9]\d*$/.test(qid)) throw new EntitySourceError(400, 'Invalid entity ID.');
	const timeout = AbortSignal.timeout(15_000);
	let data: unknown;
	try {
		const response = await fetcher(`https://lookup.kulturpool.ai/api/resolve/entity/${qid}`, {
			headers: { Accept: 'application/json' },
			signal: signal ? AbortSignal.any([signal, timeout]) : timeout
		});
		if (response.status === 404) throw new EntitySourceError(404, 'Entity source unavailable.');
		if (!response.ok) throw new EntitySourceError(502, 'Could not load the entity source.');
		data = await response.json();
	} catch (cause) {
		if (cause instanceof EntitySourceError) throw cause;
		throw new EntitySourceError(timeout.aborted ? 504 : 502, 'Could not load the entity source.');
	}
	if (
		!data ||
		typeof data !== 'object' ||
		!('qid' in data) ||
		data.qid !== qid ||
		!('wikidata_url' in data) ||
		typeof data.wikidata_url !== 'string'
	) {
		throw new EntitySourceError(502, 'The API did not supply a valid entity source.');
	}
	try {
		const url = new URL(data.wikidata_url);
		if (
			url.protocol !== 'https:' ||
			!['www.wikidata.org', 'wikidata.org'].includes(url.hostname) ||
			url.username ||
			url.password ||
			url.port ||
			![`/wiki/${qid}`, `/entity/${qid}`].includes(url.pathname)
		)
			throw new Error('Invalid source');
	} catch {
		throw new EntitySourceError(502, 'The API did not supply a valid entity source.');
	}
	return { qid, wikidata_url: data.wikidata_url };
}
