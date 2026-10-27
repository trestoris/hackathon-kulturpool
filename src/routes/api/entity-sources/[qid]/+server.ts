import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	EntitySourceError,
	getKulturpoolEntitySource
} from '#lib/server/kulturpool-entity-source.js';

export const GET: RequestHandler = async ({ params, fetch, request }) => {
	try {
		return json(await getKulturpoolEntitySource(params.qid, fetch, request.signal), {
			headers: { 'Cache-Control': 'no-store' }
		});
	} catch (cause) {
		if (!(cause instanceof EntitySourceError)) throw cause;
		return json({ message: cause.message }, { status: cause.status });
	}
};
