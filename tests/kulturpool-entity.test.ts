import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getKulturpoolEntity, EntityLookupError } from '../src/lib/server/kulturpool-entity.ts';

test('entity lookup preserves record IDs and optional entity details', async () => {
	const record = 'https://id.kulturpool.at/example/aggregation';
	const entity = await getKulturpoolEntity('Q254', async (url, init) => {
		assert.equal(url, 'https://lookup.kulturpool.ai/api/entities/Q254');
		assert.ok(init?.signal);
		return Response.json({
			qid: 'Q254',
			label_de: 'Mozart',
			record_ids: [record],
			entity_data: { occupations: ['Komponist'] }
		});
	});
	assert.equal(entity.qid, 'Q254');
	assert.equal(entity.label_de, 'Mozart');
	assert.equal(entity.description_de, null);
	assert.deepEqual(entity.record_ids, [record]);
	assert.deepEqual(await getKulturpoolEntity('Q254', async () => Response.json({ qid: 'Q254' })), {
		qid: 'Q254',
		label_de: null,
		label_en: null,
		description_de: null,
		description_en: null,
		record_ids: []
	});
});

test('invalid QIDs never trigger an upstream request', async () => {
	for (const id of ['', 'q254', 'Q0', '../records', 'Q254?query=foo']) {
		await assert.rejects(
			getKulturpoolEntity(id, async () => assert.fail('Unexpected fetch')),
			(error: unknown) => error instanceof EntityLookupError && error.status === 400
		);
	}
});

test('not found is distinct from unavailable and malformed responses', async () => {
	for (const [upstream, expected] of [
		[404, 404],
		[429, 503],
		[503, 503],
		[500, 502]
	]) {
		await assert.rejects(
			getKulturpoolEntity('Q254', async () =>
				Response.json({ detail: 'private upstream error' }, { status: upstream })
			),
			(error: unknown) =>
				error instanceof EntityLookupError &&
				error.status === expected &&
				!error.message.includes('private')
		);
	}
	for (const payload of [
		null,
		[],
		{},
		{ qid: 'Q5' },
		{ qid: 'Q254', record_ids: null },
		{ qid: 'Q254', record_ids: [45] },
		{ qid: 'Q254', record_ids: [''] },
		{ qid: 'Q254', label_de: 42 }
	]) {
		await assert.rejects(
			getKulturpoolEntity('Q254', async () => Response.json(payload)),
			(error: unknown) => error instanceof EntityLookupError && error.status === 502
		);
	}
});

test('network failures and timed-out lookups return safe errors', async (t) => {
	await assert.rejects(
		getKulturpoolEntity('Q254', async () => {
			throw new TypeError('network');
		}),
		(error: unknown) => error instanceof EntityLookupError && error.status === 502
	);
	t.mock.method(AbortSignal, 'timeout', () =>
		AbortSignal.abort(new DOMException('Timed out', 'TimeoutError'))
	);
	await assert.rejects(
		getKulturpoolEntity('Q254', async (_url, init) => {
			init?.signal?.throwIfAborted();
			return Response.json({});
		}),
		(error: unknown) => error instanceof EntityLookupError && error.status === 504
	);
});
