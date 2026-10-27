import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getKulturpoolRecord, RecordLookupError } from '../src/lib/server/kulturpool-record.ts';

const recordId = 'https://id.kulturpool.at/example/aggregation?value=A&B=%2F#part';
const record = {
	record_id: recordId,
	status: 'success',
	processed_at: '2026-04-03T05:01:09Z',
	original_record: { type: 'Preserved Specimen' },
	enriched_data: {
		type_enriched: {
			candidates: [
				{
					q_id: 'Q520937',
					score: 154.75092,
					plausibility: {
						'google/gemini-2.5-flash-lite': { plausible: false, confidence: 0.1, reason: 'Example' }
					}
				}
			]
		}
	},
	available_models: ['google/gemini-2.5-flash-lite'],
	schema_version: 2
};

test('URL record IDs are encoded as one segment on the fixed API host; original and enriched data stay intact', async () => {
	const result = await getKulturpoolRecord(recordId, async (url, init) => {
		assert.equal(url, `https://lookup.kulturpool.ai/api/records/${encodeURIComponent(recordId)}`);
		assert.ok(init?.signal);
		return Response.json(record);
	});
	assert.deepEqual(result, record);
});

test('records with failed enrichment remain valid loaded records with no fabricated assessments', async () => {
	const result = await getKulturpoolRecord(recordId, async () =>
		Response.json({
			record_id: recordId,
			status: 'failed',
			processed_at: '2026-04-03',
			original_record: {},
			enriched_data: null
		})
	);
	assert.equal(result.status, 'failed');
	assert.equal(result.enriched_data, null);
	assert.deepEqual(result.available_models, []);
});

test('invalid IDs do not call the API, and missing records differ from upstream failures', async () => {
	for (const id of ['', '   ', '.', '..']) {
		await assert.rejects(
			getKulturpoolRecord(id, async () => assert.fail('Unexpected fetch')),
			(error: unknown) => error instanceof RecordLookupError && error.status === 400
		);
	}
	for (const [status, expected] of [
		[404, 404],
		[429, 503],
		[503, 503],
		[500, 502]
	]) {
		await assert.rejects(
			getKulturpoolRecord(recordId, async () =>
				Response.json({ detail: 'private error' }, { status })
			),
			(error: unknown) =>
				error instanceof RecordLookupError &&
				error.status === expected &&
				!error.message.includes('private')
		);
	}
});

test('mismatched identities and malformed record data are rejected', async () => {
	for (const payload of [
		null,
		[],
		{},
		{ ...record, record_id: 'another-record' },
		{ ...record, original_record: [] },
		{ ...record, enriched_data: 'invalid' },
		{ ...record, status: 'unknown' },
		{ ...record, available_models: [1] },
		{ ...record, schema_version: '2' }
	]) {
		await assert.rejects(
			getKulturpoolRecord(recordId, async () => Response.json(payload)),
			(error: unknown) => error instanceof RecordLookupError && error.status === 502
		);
	}
});

test('network errors, timeouts, and cancellation are handled', async (t) => {
	await assert.rejects(
		getKulturpoolRecord(recordId, async () => {
			throw new Error('network');
		}),
		(error: unknown) => error instanceof RecordLookupError && error.status === 502
	);
	const controller = new AbortController();
	controller.abort();
	await assert.rejects(
		getKulturpoolRecord(
			recordId,
			async (_url, init) => {
				assert.equal(init?.signal?.aborted, true);
				init?.signal?.throwIfAborted();
				return Response.json(record);
			},
			controller.signal
		)
	);
	t.mock.method(AbortSignal, 'timeout', () =>
		AbortSignal.abort(new DOMException('Timed out', 'TimeoutError'))
	);
	await assert.rejects(
		getKulturpoolRecord(recordId, async (_url, init) => {
			init?.signal?.throwIfAborted();
			return Response.json(record);
		}),
		(error: unknown) => error instanceof RecordLookupError && error.status === 504
	);
});
