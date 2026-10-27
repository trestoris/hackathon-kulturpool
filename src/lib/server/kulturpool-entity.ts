import type { EntityDetail } from '../kulturpool.js';

export class EntityLookupError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

export async function getKulturpoolEntity(
	qid: string,
	fetcher: typeof fetch,
	signal?: AbortSignal
): Promise<EntityDetail> {
	if (!/^Q[1-9]\d*$/.test(qid)) throw new EntityLookupError(400, 'Invalid entity ID.');
	const timeout = AbortSignal.timeout(15_000);
	let data: unknown;
	try {
		const response = await fetcher(`https://lookup.kulturpool.ai/api/entities/${qid}`, {
			headers: { Accept: 'application/json' },
			signal: signal ? AbortSignal.any([signal, timeout]) : timeout
		});
		if (response.status === 404)
			throw new EntityLookupError(404, 'Entity not found in Kulturpool.');
		if (!response.ok)
			throw new EntityLookupError(
				response.status === 429 || response.status === 503 ? 503 : 502,
				'Kulturpool entity details are unavailable. Please try again.'
			);
		data = await response.json();
	} catch (cause) {
		if (cause instanceof EntityLookupError) throw cause;
		if (timeout.aborted)
			throw new EntityLookupError(504, 'Entity lookup timed out. Please try again.');
		throw new EntityLookupError(502, 'Could not load Kulturpool entity details. Please try again.');
	}

	if (
		!data ||
		typeof data !== 'object' ||
		Array.isArray(data) ||
		!('qid' in data) ||
		data.qid !== qid
	) {
		throw new EntityLookupError(502, 'Kulturpool returned an unexpected entity response.');
	}
	const raw = data as Record<string, unknown>;
	const recordIds = raw.record_ids ?? [];
	if (
		(raw.record_ids !== undefined && raw.record_ids === null) ||
		!Array.isArray(recordIds) ||
		recordIds.some((id) => typeof id !== 'string' || !id.trim())
	) {
		throw new EntityLookupError(502, 'Kulturpool returned invalid record IDs.');
	}
	function text(field: string): string | null {
		const value = raw[field];
		if (value == null) return null;
		if (typeof value !== 'string')
			throw new EntityLookupError(502, 'Kulturpool returned an unexpected entity response.');
		return value;
	}
	return {
		...raw,
		qid,
		label_de: text('label_de'),
		label_en: text('label_en'),
		description_de: text('description_de'),
		description_en: text('description_en'),
		record_ids: recordIds
	};
}
