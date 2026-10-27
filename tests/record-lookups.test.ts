import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractRecordIds, type EntityLookup } from '../src/lib/kulturpool.ts';
import { loadRecordDetails } from '../src/lib/record-lookups.ts';

test('publishes completed record details before slower requests finish, including missing and error results', async () => {
	const releases = new Map<string, (response: Response) => void>();
	const updates: Array<{ completed: number; id: string; status: string }> = [];
	let finished = false;
	const pending = loadRecordDetails(
		['slow', 'fast', 'missing', 'failed'],
		async (url) => new Promise<Response>((resolve) => releases.set(String(url), resolve)),
		new AbortController().signal,
		(completed, id, lookup) => updates.push({ completed, id, status: lookup.status })
	).then((results) => {
		finished = true;
		return results;
	});
	releases.get('/api/records/fast')!(Response.json({ record_id: 'fast', enriched_data: {} }));
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(finished, false);
	assert.deepEqual(updates, [{ completed: 1, id: 'fast', status: 'found' }]);
	releases.get('/api/records/missing')!(new Response(null, { status: 404 }));
	releases.get('/api/records/failed')!(Response.json({ message: 'Unavailable' }, { status: 503 }));
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(finished, false);
	assert.deepEqual(
		updates.map((update) => update.status),
		['found', 'missing', 'error']
	);
	releases.get('/api/records/slow')!(Response.json({ record_id: 'slow', enriched_data: {} }));
	const results = await pending;
	assert.equal(results.slow.status, 'found');
	assert.deepEqual(
		updates.map((update) => update.completed),
		[1, 2, 3, 4]
	);
});

test('abort after the first result suppresses late results even if the fetcher ignores abort', async () => {
	const controller = new AbortController();
	const releases: Array<(response: Response) => void> = [];
	const updates: string[] = [];
	const pending = loadRecordDetails(
		['first', 'late', 'later', 'never-started'],
		async () => new Promise<Response>((resolve) => releases.push(resolve)),
		controller.signal,
		(_completed, id) => {
			updates.push(id);
			controller.abort();
		}
	);
	releases[0](Response.json({ record_id: 'first', enriched_data: {} }));
	await new Promise((resolve) => setImmediate(resolve));
	releases[1](Response.json({ record_id: 'late', enriched_data: {} }));
	releases[2](Response.json({ record_id: 'later', enriched_data: {} }));
	await assert.rejects(pending, { name: 'AbortError' });
	assert.deepEqual(updates, ['first']);
	assert.equal(releases.length, 3);
});

test('collects shared record IDs once while retaining exact IDs and entity associations', () => {
	const entity = {
		qid: 'Q1',
		label_de: null,
		label_en: null,
		description_de: null,
		description_en: null
	};
	const lookups: Record<string, EntityLookup> = {
		Q1: { status: 'found', entity: { ...entity, record_ids: ['https://example/a%2Fb', 'shared'] } },
		Q2: { status: 'found', entity: { ...entity, qid: 'Q2', record_ids: ['shared', 'last'] } },
		Q3: { status: 'missing' },
		Q4: { status: 'error', message: 'Unavailable' }
	};
	const original = structuredClone(lookups);
	assert.deepEqual(extractRecordIds(lookups), ['https://example/a%2Fb', 'shared', 'last']);
	assert.deepEqual(lookups, original);
	assert.deepEqual(extractRecordIds({}), []);
});

test('record loading deduplicates requests, limits concurrency, and reports completed progress', async () => {
	const calls: string[] = [];
	const progress: number[] = [];
	let active = 0;
	let peak = 0;
	const ids = ['https://id.kulturpool.at/a/aggregation', 'b', 'c', 'b', 'd'];
	const records = await loadRecordDetails(
		ids,
		async (url) => {
			calls.push(String(url));
			active++;
			peak = Math.max(active, peak);
			await new Promise((resolve) => setImmediate(resolve));
			active--;
			return Response.json({
				record_id: decodeURIComponent(String(url).slice('/api/records/'.length)),
				enriched_data: {}
			});
		},
		new AbortController().signal,
		(completed) => progress.push(completed)
	);
	assert.equal(peak, 3);
	assert.deepEqual(
		calls,
		[...new Set(ids)].map((id) => `/api/records/${encodeURIComponent(id)}`)
	);
	assert.deepEqual(progress, [1, 2, 3, 4]);
	assert.equal(Object.keys(records).length, 4);
});

test('mixed record results preserve successes and allow retrying just failed IDs', async () => {
	const records = await loadRecordDetails(
		['a', 'b', 'c'],
		async (url) => {
			if (url === '/api/records/a') return Response.json({ record_id: 'a', enriched_data: {} });
			if (url === '/api/records/b') return new Response(null, { status: 404 });
			return Response.json({ message: 'Unavailable' }, { status: 503 });
		},
		new AbortController().signal
	);
	assert.equal(records.a.status, 'found');
	assert.equal(records.b.status, 'missing');
	assert.equal(records.c.status, 'error');
	const failedIds = Object.keys(records).filter((id) => records[id].status === 'error');
	const retried = await loadRecordDetails(
		failedIds,
		async (url) => {
			assert.equal(url, '/api/records/c');
			return Response.json({ record_id: 'c', enriched_data: {} });
		},
		new AbortController().signal
	);
	const merged = { ...records, ...retried };
	assert.equal(merged.a, records.a);
	assert.equal(merged.b.status, 'missing');
	assert.equal(merged.c.status, 'found');
});

test('aborting stops the record queue and prevents stale progress updates', async () => {
	const controller = new AbortController();
	let calls = 0;
	let progress = 0;
	const pending = loadRecordDetails(
		['a', 'b', 'c', 'd'],
		async (_url, init) => {
			calls++;
			await new Promise((_, reject) =>
				init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
			);
			return Response.json({});
		},
		controller.signal,
		() => progress++
	);
	controller.abort();
	await assert.rejects(pending, { name: 'AbortError' });
	assert.equal(calls, 3);
	assert.equal(progress, 0);
	assert.deepEqual(
		await loadRecordDetails(
			[],
			async () => assert.fail('Unexpected fetch'),
			new AbortController().signal
		),
		{}
	);
});
