import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchKulturpool, SearchError } from '../src/lib/server/kulturpool-search.ts';

function responder(data: unknown, status = 200): typeof fetch {
	return async () => Response.json(data, { status });
}

test('blank queries never reach the upstream API', async () => {
	await assert.rejects(
		searchKulturpool('  ', async () => {
			assert.fail('Should not fetch');
		}),
		(error: unknown) => error instanceof SearchError && error.status === 400
	);
});

test('encodes query text and preserves QIDs, descriptions and unrounded Wiki scores', async () => {
	const query = '  Mozart & Söhne?  ';
	const result = await searchKulturpool(query, async (input, init) => {
		const url = new URL(String(input));
		assert.equal(url.origin, 'https://lookup.kulturpool.ai');
		assert.equal(url.pathname, '/api/search');
		assert.equal(url.searchParams.get('query'), query.trim());
		assert.equal(url.searchParams.get('languages'), 'de,en');
		assert.equal(url.searchParams.get('size'), '10');
		assert.ok(init?.signal);
		return Response.json({
			results: [
				{ q_id: 'Q254', label: 'Mozart', description: 'Komponist', score: 154.75092 },
				{ q_id: 'Q207875', label: 'Requiem', description: null, score: 0 }
			]
		});
	});
	assert.equal(result.query, query.trim());
	assert.equal(result.results[0].score, 154.75092);
	assert.equal(result.results[0].q_id, 'Q254');
	assert.equal(result.results[0].description, 'Komponist');
	assert.equal(result.results[1].description, null);
	assert.ok(!('confidence' in result.results[0]));
});

test('empty results are a successful search', async () => {
	assert.deepEqual(await searchKulturpool('unknown', responder({ results: [] })), {
		query: 'unknown',
		results: []
	});
});

test('upstream failures return a safe retryable message', async () => {
	for (const status of [401, 429, 500, 503]) {
		await assert.rejects(
			searchKulturpool('Mozart', responder({ secret: 'internal detail' }, status)),
			(error: unknown) =>
				error instanceof SearchError &&
				error.status === ([429, 503].includes(status) ? 503 : 502) &&
				!error.message.includes('internal detail')
		);
	}
});

test('network failures and malformed upstream payloads are handled', async () => {
	await assert.rejects(
		searchKulturpool('Mozart', async () => {
			throw new TypeError('network');
		}),
		(error: unknown) => error instanceof SearchError && error.status === 502
	);
	const valid = { q_id: 'Q254', label: 'Mozart', score: 389.18 };
	for (const body of [
		null,
		{},
		{ results: null },
		{ results: [null] },
		{ results: [{ ...valid, score: '0.1' }] },
		{ results: [{ ...valid, q_id: '../records' }] }
	]) {
		await assert.rejects(
			searchKulturpool('Mozart', responder(body)),
			(error: unknown) => error instanceof SearchError && error.status === 502
		);
	}
});

test('request cancellation reaches the upstream fetch', async () => {
	const controller = new AbortController();
	controller.abort();
	await assert.rejects(
		searchKulturpool(
			'Mozart',
			async (_input, init) => {
				assert.equal(init?.signal?.aborted, true);
				init?.signal?.throwIfAborted();
				throw new Error('unreachable');
			},
			controller.signal
		)
	);
});
