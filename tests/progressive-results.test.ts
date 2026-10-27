import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendUniqueRows, pageWindow } from '../src/lib/progressive-results.ts';

test('late high-score rows and retries preserve visible positions and exact assessment identity', () => {
	const initial = [
		{ id: 'record-b:subject:Q254', score: 10 },
		{ id: 'record-b:title:Q254', score: 20 }
	];
	const merged = appendUniqueRows(initial, [
		{ id: 'record-a:subject:Q254', score: 1000 },
		{ id: 'record-b:subject:Q254', score: 30 }
	]);
	assert.deepEqual(
		merged.map((row) => row.id),
		[initial[0].id, initial[1].id, 'record-a:subject:Q254']
	);
	assert.equal(merged[0].score, 30);
	assert.equal(initial[0].score, 10);
});

test('pagination keeps the current page during growth and clamps after filtering or reviewing', () => {
	assert.deepEqual(pageWindow(34, 2), { page: 2, start: 20, end: 34 });
	assert.deepEqual(pageWindow(146, 2), { page: 2, start: 20, end: 40 });
	assert.deepEqual(pageWindow(20, 2), { page: 1, start: 0, end: 20 });
	assert.deepEqual(pageWindow(0, 2), { page: 1, start: 0, end: 0 });
	assert.deepEqual(pageWindow(146, 8), { page: 8, start: 140, end: 146 });
});
