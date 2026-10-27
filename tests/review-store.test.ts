import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, readdir, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createReviewStore } from '../src/lib/server/review-store.ts';
import { parseReviews, type SavedReview } from '../src/lib/saved-reviews.ts';

function review(id: string, note = 'Verified against the source'): SavedReview {
	return {
		decision: 'Relevant',
		note,
		query: 'Mozart',
		target: {
			id,
			name: 'Mozart',
			description: 'Composer',
			score: '154.75092',
			llmDecision: 'Not relevant',
			explanation: 'Model explanation'
		}
	};
}

async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
	const dir = await mkdtemp(join(tmpdir(), 'verifake-reviews-'));
	t.after(() => rm(dir, { recursive: true, force: true }));
	const file = join(dir, 'reviews.json');
	return { dir, file, store: createReviewStore(file, parseReviews) };
}

test('reviews persist in JSON across store instances and edits retain other assessments', async (t) => {
	const { file, store, dir } = await fixture(t);
	assert.deepEqual(await store.read(), {});
	await store.update({ a: review('a'), b: review('b') });
	const restarted = createReviewStore(file, parseReviews);
	await restarted.update({ a: review('a', 'Updated feedback') });
	assert.deepEqual(await store.read(), { a: review('a', 'Updated feedback'), b: review('b') });
	assert.equal(JSON.parse(await readFile(file, 'utf8')).version, 1);
	assert.deepEqual(await readdir(dir), ['reviews.json']);
});

test('concurrent writers preserve all reviews, including across independent store instances', async (t) => {
	const { file, store } = await fixture(t);
	await Promise.all(
		Array.from({ length: 12 }, (_, i) =>
			createReviewStore(file, parseReviews).update({ [`id-${i}`]: review(`id-${i}`) })
		)
	);
	assert.equal(Object.keys(await store.read()).length, 12);
});

test('deleting the file keeps reads empty without recreating it; only a new save creates it', async (t) => {
	const { store, file, dir } = await fixture(t);
	await store.update({ a: review('a') });
	await rm(file);
	assert.deepEqual(await store.read(), {});
	assert.deepEqual(await createReviewStore(file, parseReviews).read(), {});
	assert.deepEqual(await readdir(dir), []);
	await store.update({ b: review('b') });
	assert.deepEqual(await store.read(), { b: review('b') });
});

test('malformed or invalid files are preserved and rejected rather than silently repaired', async (t) => {
	const { store, file, dir } = await fixture(t);
	for (const source of [
		'broken JSON',
		JSON.stringify({ version: 1, reviews: { invalid: {} } }),
		JSON.stringify({ version: 2, reviews: {} })
	]) {
		await writeFile(file, source);
		await assert.rejects(store.read());
		await assert.rejects(store.update({ a: review('a') }));
		assert.equal(await readFile(file, 'utf8'), source);
		assert.deepEqual(await readdir(dir), ['reviews.json']);
	}
});

test('invalid incoming data cannot replace saved feedback and failed writes release the lock', async (t) => {
	const { store, file, dir } = await fixture(t);
	await store.update({ a: review('a') });
	await assert.rejects(store.update({ wrongId: review('a') }));
	assert.deepEqual(await store.read(), { a: review('a') });
	await rm(file);
	await mkdir(file);
	await assert.rejects(store.update({ b: review('b') }));
	assert.deepEqual(await readdir(dir), ['reviews.json']);
	await rm(file, { recursive: true });
	await store.update({ b: review('b') });
	assert.deepEqual(await store.read(), { b: review('b') });
});
