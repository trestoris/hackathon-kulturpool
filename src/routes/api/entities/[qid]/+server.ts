import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getKulturpoolEntity, EntityLookupError } from '#lib/server/kulturpool-entity.js';
import { createLookupCache } from '#lib/server/lookup-cache.js';
import type { EntityDetail } from '#lib/kulturpool.js';

const cache = createLookupCache<EntityDetail>(100);

export const GET: RequestHandler = async ({ params, fetch, request }) => {
	try {
		request.signal.throwIfAborted();
		// Shared work uses the lookup's own timeout, not one browser request's abort signal.
		const entity = await cache.get(params.qid, () => getKulturpoolEntity(params.qid, fetch));
		return json(entity, {
			headers: { 'Cache-Control': 'no-store' }
		});
	} catch (cause) {
		if (!(cause instanceof EntityLookupError)) throw cause;
		return json({ message: cause.message }, { status: cause.status });
	}
};
