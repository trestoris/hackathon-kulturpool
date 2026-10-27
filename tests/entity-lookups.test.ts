import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadEntityDetails } from '../src/lib/entity-lookups.ts';

test('unique entity requests run at most three at once and never fetch records', async () => {
	const calls: string[] = [];
	let active = 0;
	let peak = 0;
	const lookups = await loadEntityDetails(
		['Q1', 'Q2', 'Q1', 'Q3', 'Q4', 'Q5'],
		async (url) => {
			calls.push(String(url));
			active++;
			peak = Math.max(peak, active);
			await new Promise((resolve) => setImmediate(resolve));
			active--;
			return Response.json({ qid: String(url).split('/').at(-1), record_ids: ['some-record'] });
		},
		new AbortController().signal
	);
	assert.equal(peak, 3);
	assert.deepEqual(
		calls,
		['Q1', 'Q2', 'Q3', 'Q4', 'Q5'].map((qid) => `/api/entities/${qid}`)
	);
	assert.equal(Object.keys(lookups).length, 5);
	assert.ok(Object.values(lookups).every((value) => value.status === 'found'));
});

test('partial failures preserve successful results and distinguish missing entities', async () => {
	const results = await loadEntityDetails(
		['Q1', 'Q2', 'Q3', 'Q4'],
		async (url) => {
			if (url === '/api/entities/Q1') return Response.json({ qid: 'Q1', record_ids: [] });
			if (url === '/api/entities/Q2') return new Response(null, { status: 404 });
			if (url === '/api/entities/Q3')
				return Response.json({ message: 'Unavailable' }, { status: 503 });
			throw new TypeError('Network unavailable');
		},
		new AbortController().signal
	);
	assert.equal(results.Q1.status, 'found');
	assert.equal(results.Q2.status, 'missing');
	assert.equal(results.Q3.status, 'error');
	assert.equal(results.Q4.status, 'error');
});

test('cancelling prevents queued lookups and rejects instead of publishing partial stale data', async () => {
	const controller = new AbortController();
	let calls = 0;
	const pending = loadEntityDetails(
		['Q1', 'Q2', 'Q3', 'Q4'],
		async (_url, init) => {
			calls++;
			await new Promise((_, reject) =>
				init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
			);
			return Response.json({});
		},
		controller.signal
	);
	controller.abort();
	await assert.rejects(pending, { name: 'AbortError' });
	assert.equal(calls, 3);
	assert.deepEqual(
		await loadEntityDetails(
			[],
			async () => assert.fail('Unexpected fetch'),
			new AbortController().signal
		),
		{}
	);
});
