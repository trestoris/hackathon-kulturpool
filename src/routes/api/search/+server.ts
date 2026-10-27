import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchKulturpool, SearchError } from '#lib/server/kulturpool-search.js';

export const GET: RequestHandler = async ({ url, fetch, request }) => {
	try {
		return json(
			await searchKulturpool(url.searchParams.get('query') ?? '', fetch, request.signal),
			{
				headers: { 'Cache-Control': 'no-store' }
			}
		);
	} catch (cause) {
		if (!(cause instanceof SearchError)) throw cause;
		return json({ message: cause.message }, { status: cause.status });
	}
};
