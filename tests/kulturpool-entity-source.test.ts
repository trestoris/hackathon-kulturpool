import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	getKulturpoolEntitySource,
	EntitySourceError
} from '../src/lib/server/kulturpool-entity-source.ts';

const response = (data: unknown, status = 200) =>
	(async () => Response.json(data, { status })) as typeof fetch;

test('uses the API-supplied URL exactly and requests only the fixed entity-information endpoint', async () => {
	const supplied = 'https://www.wikidata.org/entity/Q254';
	const result = await getKulturpoolEntitySource('Q254', (async (url, options) => {
		assert.equal(String(url), 'https://lookup.kulturpool.ai/api/resolve/entity/Q254');
		assert.ok(options?.signal);
		return Response.json({ qid: 'Q254', wikidata_url: supplied });
	}) as typeof fetch);
	assert.deepEqual(result, { qid: 'Q254', wikidata_url: supplied });
});

test('missing, mismatched and unsafe API URLs are not replaced by guessed links', async () => {
	for (const data of [
		{},
		null,
		{ qid: 'Q254' },
		{ qid: 'Q254', wikidata_url: null },
		{ qid: 'Q5', wikidata_url: 'https://www.wikidata.org/wiki/Q254' },
		...[
			'javascript:alert(1)',
			'/wiki/Q254',
			'https://example.com/wiki/Q254',
			'https://www.wikidata.org/wiki/Q5',
			'https://user:pass@www.wikidata.org/wiki/Q254',
			'http://www.wikidata.org/wiki/Q254'
		].map((wikidata_url) => ({ qid: 'Q254', wikidata_url }))
	]) {
		await assert.rejects(
			getKulturpoolEntitySource('Q254', response(data)),
			(error: unknown) => error instanceof EntitySourceError && error.status === 502
		);
	}
});

test('invalid QIDs do not trigger a request and unavailable sources return safe errors', async () => {
	await assert.rejects(
		getKulturpoolEntitySource('../Q254', (async () => {
			assert.fail('Should not fetch an invalid QID');
		}) as typeof fetch),
		(error: unknown) => error instanceof EntitySourceError && error.status === 400
	);
	await assert.rejects(
		getKulturpoolEntitySource('Q254', response({}, 404)),
		(error: unknown) => error instanceof EntitySourceError && error.status === 404
	);
	await assert.rejects(
		getKulturpoolEntitySource('Q254', response({}, 503)),
		(error: unknown) => error instanceof EntitySourceError && error.status === 502
	);
	await assert.rejects(
		getKulturpoolEntitySource('Q254', (async () => {
			throw new Error('Internal details');
		}) as typeof fetch),
		(error: unknown) =>
			error instanceof EntitySourceError && !error.message.includes('Internal details')
	);
});

test('source lookup forwards cancellation to the upstream fetch', async () => {
	const controller = new AbortController();
	const pending = getKulturpoolEntitySource(
		'Q254',
		((_url, options) =>
			new Promise((_resolve, reject) => {
				options?.signal?.addEventListener('abort', () => reject(new Error('Aborted')), {
					once: true
				});
			})) as typeof fetch,
		controller.signal
	);
	controller.abort();
	await assert.rejects(pending, EntitySourceError);
});
