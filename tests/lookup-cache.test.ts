import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLookupCache } from '../src/lib/server/lookup-cache.ts';

test('successful lookups are reused for five minutes; reads do not extend freshness', async () => {
	let time = 0;
	let requests = 0;
	const cache = createLookupCache<number>(10, 300_000, () => time);
	const load = async () => ++requests;
	assert.equal(await cache.get('record-a', load), 1);
	time = 299_999;
	assert.equal(await cache.get('record-a', load), 1);
	time = 300_000;
	assert.equal(await cache.get('record-a', load), 2);
});

test('overlapping callers share one request and freshness starts when it completes', async () => {
	let time = 0;
	let requests = 0;
	let finish!: (value: string) => void;
	const cache = createLookupCache<string>(10, 100, () => time);
	const first = cache.get('same-record', () => {
		requests++;
		return new Promise<string>((resolve) => {
			finish = resolve;
		});
	});
	const second = cache.get('same-record', async () => {
		throw new Error('Duplicate fetch');
	});
	await Promise.resolve();
	time = 500;
	finish('loaded');
	assert.deepEqual(await Promise.all([first, second]), ['loaded', 'loaded']);
	assert.equal(requests, 1);
	time = 599;
	assert.equal(await cache.get('same-record', async () => 'too soon'), 'loaded');
	time = 600;
	assert.equal(await cache.get('same-record', async () => 'fresh'), 'fresh');
});

test('failed requests are shared while pending but are never cached', async () => {
	const cache = createLookupCache<string>();
	let requests = 0;
	const load = async () => {
		requests++;
		throw new Error('Unavailable');
	};
	const results = await Promise.allSettled([cache.get('a', load), cache.get('a', load)]);
	assert.equal(requests, 1);
	assert.ok(results.every((result) => result.status === 'rejected'));
	assert.equal(await cache.get('a', async () => 'Recovered'), 'Recovered');
});

test('cache is bounded and evicts least recently used entries without mixing IDs', async () => {
	const cache = createLookupCache<string>(2);
	await cache.get('a', async () => 'A');
	await cache.get('b', async () => 'B');
	assert.equal(await cache.get('a', async () => 'Unexpected'), 'A');
	await cache.get('c', async () => 'C');
	assert.equal(await cache.get('a', async () => 'Unexpected'), 'A');
	assert.equal(await cache.get('b', async () => 'B refetched'), 'B refetched');
});

test('new server instances start empty', async () => {
	await createLookupCache<string>().get('a', async () => 'Old');
	assert.equal(await createLookupCache<string>().get('a', async () => 'New'), 'New');
});
