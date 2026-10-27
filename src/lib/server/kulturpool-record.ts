import type { RecordDetail } from '../kulturpool.js';

export class RecordLookupError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

function isObject(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

export async function getKulturpoolRecord(
	recordId: string,
	fetcher: typeof fetch,
	signal?: AbortSignal
): Promise<RecordDetail> {
	if (!recordId.trim() || recordId === '.' || recordId === '..') {
		throw new RecordLookupError(400, 'Invalid record ID.');
	}
	const timeout = AbortSignal.timeout(15_000);
	let data: unknown;
	try {
		// A record ID may itself be a URL. It is always an encoded path segment on this fixed API host.
		const response = await fetcher(
			`https://lookup.kulturpool.ai/api/records/${encodeURIComponent(recordId)}`,
			{
				headers: { Accept: 'application/json' },
				signal: signal ? AbortSignal.any([signal, timeout]) : timeout
			}
		);
		if (response.status === 404)
			throw new RecordLookupError(404, 'Record not found in Kulturpool.');
		if (!response.ok)
			throw new RecordLookupError(
				response.status === 429 || response.status === 503 ? 503 : 502,
				'Kulturpool record details are unavailable. Please try again.'
			);
		data = await response.json();
	} catch (cause) {
		if (cause instanceof RecordLookupError) throw cause;
		if (timeout.aborted)
			throw new RecordLookupError(504, 'Record lookup timed out. Please try again.');
		throw new RecordLookupError(502, 'Could not load Kulturpool record details. Please try again.');
	}

	if (
		!isObject(data) ||
		data.record_id !== recordId ||
		(data.status !== 'success' && data.status !== 'failed') ||
		typeof data.processed_at !== 'string' ||
		!isObject(data.original_record) ||
		(data.enriched_data != null && !isObject(data.enriched_data)) ||
		(data.available_models != null &&
			(!Array.isArray(data.available_models) ||
				data.available_models.some((model) => typeof model !== 'string'))) ||
		(data.schema_version != null && !Number.isInteger(data.schema_version))
	) {
		throw new RecordLookupError(502, 'Kulturpool returned an unexpected record response.');
	}
	return {
		...data,
		record_id: recordId,
		status: data.status,
		processed_at: data.processed_at,
		original_record: data.original_record,
		enriched_data:
			data.enriched_data == null ? null : (data.enriched_data as Record<string, unknown>),
		available_models: data.available_models == null ? [] : (data.available_models as string[]),
		schema_version: data.schema_version == null ? null : (data.schema_version as number)
	};
}
