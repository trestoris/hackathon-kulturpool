import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getKulturpoolRecord, RecordLookupError } from '#lib/server/kulturpool-record.js';
import { createLookupCache } from '#lib/server/lookup-cache.js';
import type { RecordDetail } from '#lib/kulturpool.js';

const cache = createLookupCache<RecordDetail>(500);

export const GET: RequestHandler = async ({ params, fetch, request }) => {
	try {
		request.signal.throwIfAborted();
		// Finish and cache active lookups even if one caller leaves; other callers can share them.
		const record = await cache.get(params.recordId, () =>
			getKulturpoolRecord(params.recordId, fetch)
		);
		return json(record, {
			headers: { 'Cache-Control': 'no-store' }
		});
	} catch (cause) {
		if (!(cause instanceof RecordLookupError)) throw cause;
		return json({ message: cause.message }, { status: cause.status });
	}
};
