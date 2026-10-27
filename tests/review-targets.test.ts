import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	buildReviewQueue,
	extractReviewTargets,
	extractRecordImage,
	isRecordImage,
	REVIEW_MODEL
} from '../src/lib/review-targets.ts';
import type {
	RecordDetail,
	RecordLookup,
	SearchResult,
	SearchResponse
} from '../src/lib/kulturpool.ts';

const search: SearchResult[] = [
	{
		q_id: 'Q520937',
		label: 'Francis Preserved Leavenworth',
		description: 'Search description',
		score: 999
	}
];
function candidate(confidence: unknown = 0.1, extra: Record<string, unknown> = {}) {
	return {
		q_id: 'Q520937',
		label: 'Francis Preserved Leavenworth',
		description: 'US-amerikanischer Astronom',
		score: 154.75092,
		plausibility: {
			[REVIEW_MODEL]: {
				plausible: false,
				confidence,
				reason: 'Does not match Preserved Specimen.',
				analyzed_at: '2026-04-03T05:01:09Z'
			}
		},
		...extra
	};
}
function record(enriched: Record<string, unknown>, id = 'record-a'): RecordDetail {
	return {
		record_id: id,
		status: 'success',
		processed_at: '2026-04-08',
		original_record: {
			aggregatedCHO: {
				title: ['Rubus floribundus Ley'],
				description: [{ '@value': 'A preserved specimen.', '@language': 'en' }]
			}
		},
		enriched_data: enriched,
		available_models: [REVIEW_MODEL],
		schema_version: 2
	};
}
function lookup(record: RecordDetail): RecordLookup {
	return { status: 'found', record };
}
function field(candidates: unknown[]) {
	return { source_field: 'dcType', values: [{ value: 'Preserved Specimen', candidates }] };
}

test('extracts the selected enriched assessment, preserves Wiki score separately, and supplies record context', () => {
	const [target] = extractReviewTargets(search, {
		a: lookup(record({ type_enriched: field([candidate()]) }))
	});
	assert.equal(target.score, '154.75092');
	assert.equal(target.context?.confidence, 0.1);
	assert.equal(target.description, 'US-amerikanischer Astronom');
	assert.equal(target.llmDecision, 'Not relevant');
	assert.equal(target.explanation, 'Does not match Preserved Specimen.');
	assert.equal(target.context?.originalValue, 'Preserved Specimen');
	assert.equal(target.context?.sourceField, 'dcType');
	assert.equal(target.context?.recordTitle, 'Rubus floribundus Ley');
	assert.equal(target.context?.recordDescription, 'A preserved specimen.');
});

test('strict confidence threshold excludes 0.3, missing and invalid values without filtering by Wiki score', () => {
	for (const [confidence, expected] of [
		[0, 1],
		[0.299999, 1],
		[0.3, 0],
		[0.9, 0],
		[-0.1, 0],
		[NaN, 0],
		[Infinity, 0],
		[null, 0],
		['0.1', 0]
	]) {
		const targets = extractReviewTargets([{ ...search[0], score: 0.01 }], {
			a: lookup(record({ type_enriched: field([candidate(confidence)]) }))
		});
		assert.equal(targets.length, expected, `confidence ${confidence}`);
	}
	const missing = candidate();
	delete (missing.plausibility[REVIEW_MODEL] as Record<string, unknown>).confidence;
	assert.equal(
		extractReviewTargets(search, { a: lookup(record({ type_enriched: field([missing]) })) }).length,
		0
	);
});

test('does not borrow another model, use legacy flat confidence, or include unrelated QIDs', () => {
	const candidates = [
		candidate(0.1, { q_id: 'Q254' }),
		candidate(0.1, { plausibility: { 'another-model': { plausible: false, confidence: 0.1 } } }),
		candidate(0.1, { plausibility: null, confidence: 0.1, plausible: false }),
		candidate(0.1, { score: '154.75092' }),
		candidate(0.1, { plausibility: { [REVIEW_MODEL]: { confidence: 0.1, plausible: 'false' } } })
	];
	assert.deepEqual(
		extractReviewTargets(search, { a: lookup(record({ type_enriched: field(candidates) })) }),
		[]
	);
});

test('separate records, fields, original values and assessment revisions get independent review IDs', () => {
	const a = record({ type_enriched: field([candidate()]), other_field: field([candidate()]) });
	const b = record({ type_enriched: field([candidate()]) }, 'record-b');
	const targets = extractReviewTargets(search, { a: lookup(a), b: lookup(b) });
	assert.equal(targets.length, 3);
	assert.equal(new Set(targets.map((target) => target.id)).size, 3);
	const changedValue = record({
		type_enriched: {
			source_field: 'dcType',
			values: [{ value: 'Different value', candidates: [candidate()] }]
		}
	});
	const [different] = extractReviewTargets(search, { a: lookup(changedValue) });
	assert.ok(!targets.some((target) => target.id === different.id));
	const changed = candidate();
	changed.plausibility[REVIEW_MODEL].analyzed_at = '2026-04-09';
	const [revision] = extractReviewTargets(search, {
		a: lookup(record({ type_enriched: field([changed]) }))
	});
	assert.ok(!targets.some((target) => target.id === revision.id));
});

test('reordering or duplicate candidate results do not duplicate or reassign the same assessment', () => {
	const a = record({ type_enriched: field([candidate(), candidate()]) });
	const b = record({ type_enriched: field([candidate()]) }, 'record-b');
	const forward = extractReviewTargets(search, { a: lookup(a), b: lookup(b) });
	const reverse = extractReviewTargets(search, { b: lookup(b), a: lookup(a) });
	assert.equal(forward.length, 2);
	assert.deepEqual(forward, reverse);
});

test('supports direct candidate fields, maps plausible true, and tolerates missing explanations', () => {
	const positive = candidate();
	positive.plausibility[REVIEW_MODEL].plausible = true;
	positive.plausibility[REVIEW_MODEL].reason = '';
	const direct = record({ dcType: { candidates: [positive] } });
	direct.original_record = { title: 'A record', dcType: 'Original field value' };
	const [target] = extractReviewTargets(search, { a: lookup(direct) });
	assert.equal(target.llmDecision, 'Relevant');
	assert.equal(target.context?.originalValue, 'Original field value');
	assert.equal(target.explanation, 'No explanation was provided for this assessment.');
});

test('missing, failed and malformed records do not fabricate review suggestions', () => {
	const failed = record({ type_enriched: field([candidate()]) });
	failed.status = 'failed';
	assert.deepEqual(
		extractReviewTargets(search, {
			a: { status: 'missing' },
			b: { status: 'error', message: 'Unavailable' },
			c: lookup(failed),
			d: lookup(record({ bad: null, other: { values: [null, 'text', { candidates: [null] }] } }))
		}),
		[]
	);
});

test('groups distinct record assessments into one entity with exact per-match confidence and scores', () => {
	const positive = candidate(0.1321);
	positive.plausibility[REVIEW_MODEL].plausible = true;
	const lookups = {
		a: lookup(record({ type_enriched: field([positive, positive]) })),
		b: lookup(record({ type_enriched: field([candidate(0.299999)]) }, 'record-b'))
	};
	const queue = buildReviewQueue({ query: 'preserved', results: [...search, ...search] }, lookups);
	assert.equal(queue.query, 'preserved');
	assert.equal(queue.model, REVIEW_MODEL);
	assert.equal(queue.confidenceThreshold, 0.3);
	assert.equal(queue.entities.length, 1);
	const entity = queue.entities[0];
	assert.equal(entity.qid, 'Q520937');
	assert.equal(entity.description, 'Search description');
	assert.equal(entity.searchScore, 999);
	assert.equal(entity.llmDecision, 'Mixed');
	assert.equal(entity.matches.length, 2);
	assert.deepEqual(
		entity.matches.map((match) => match.confidence),
		[0.1321, 0.299999]
	);
	assert.deepEqual(
		entity.matches.map((match) => match.plausible),
		[true, false]
	);
	assert.ok(entity.matches.every((match) => match.matchScore === 154.75092));
	assert.ok(!('confidence' in entity));
	assert.deepEqual(JSON.parse(JSON.stringify(queue)), queue);
	// Grouping must not change IDs that existing saved feedback uses.
	assert.deepEqual(
		entity.matches.map((match) => match.id),
		extractReviewTargets(search, lookups).map((target) => target.id)
	);
});

test('one low-confidence match keeps an entity eligible regardless of its other assessments', () => {
	const queue = buildReviewQueue(
		{ query: 'test', results: search },
		{
			low: lookup(record({ type_enriched: field([candidate(0.1)]) }, 'low')),
			high: lookup(record({ type_enriched: field([candidate(0.95)]) }, 'high')),
			boundary: lookup(record({ type_enriched: field([candidate(0.3)]) }, 'boundary')),
			missing: lookup(record({ type_enriched: field([candidate(null)]) }, 'missing')),
			otherModel: lookup(
				record(
					{
						type_enriched: field([
							candidate(0.1, {
								plausibility: { 'another-model': { plausible: false, confidence: 0.1 } }
							})
						])
					},
					'other-model'
				)
			)
		}
	);
	assert.equal(queue.entities.length, 1);
	assert.deepEqual(
		queue.entities[0].matches.map((match) => match.recordId),
		['low']
	);
	assert.equal(queue.entities[0].llmDecision, 'Not relevant');
});

test('positive low-confidence decisions also enter the queue and fields stay independent', () => {
	const positive = candidate(0);
	positive.plausibility[REVIEW_MODEL].plausible = true;
	const queue = buildReviewQueue(
		{ query: 'test', results: search },
		{
			a: lookup(record({ type_enriched: field([positive]), other_field: field([positive]) }))
		}
	);
	assert.equal(queue.entities.length, 1);
	assert.equal(queue.entities[0].llmDecision, 'Relevant');
	assert.equal(queue.entities[0].matches.length, 2);
	assert.equal(new Set(queue.entities[0].matches.map((match) => match.id)).size, 2);
	assert.ok(queue.entities[0].matches.every((match) => match.confidence === 0));
});

test('groups by QID rather than label and preserves search order across record arrival order', () => {
	const results = [
		{ ...search[0], q_id: 'Q254', label: 'Same label', score: 70.23868 },
		{ ...search[0], label: 'Same label' }
	];
	const a = lookup(record({ type_enriched: field([candidate()]) }));
	const b = lookup(record({ type_enriched: field([candidate(0.1, { q_id: 'Q254' })]) }, 'b'));
	const forward = buildReviewQueue({ query: 'test', results }, { a, b });
	const reverse = buildReviewQueue({ query: 'test', results }, { b, a });
	assert.deepEqual(forward, reverse);
	assert.deepEqual(
		forward.entities.map((entity) => entity.qid),
		['Q254', 'Q520937']
	);
	assert.equal(forward.entities[0].searchScore, 70.23868);
});

test('empty, reset, and nonqualifying searches produce no entity groups', () => {
	const valid = { a: lookup(record({ type_enriched: field([candidate()]) })) };
	assert.deepEqual(buildReviewQueue(null, valid), {
		query: '',
		model: REVIEW_MODEL,
		confidenceThreshold: 0.3,
		entities: []
	});
	assert.deepEqual(buildReviewQueue({ query: 'new query', results: [] }, valid).entities, []);
	assert.deepEqual(buildReviewQueue({ query: 'test', results: search }, {}).entities, []);
	assert.deepEqual(
		buildReviewQueue(
			{ query: 'test', results: search },
			{
				a: lookup(record({ type_enriched: field([candidate(0.9)]) }))
			}
		).entities,
		[]
	);
});

test('record images prefer API previews, preserve exact URLs and carry source attribution', () => {
	const original = {
		object: {
			'@id': 'https://museum.example/image?id=42&size=preview',
			dcRights: [{ '@value': 'Museum collection' }],
			edmRights: 'https://creativecommons.org/licenses/by/4.0/'
		},
		isShownBy: { id: 'https://museum.example/full.jpg' },
		dataProvider: 'Museum'
	};
	const media = extractRecordImage(original)!;
	assert.equal(media.url, original.object['@id']);
	assert.equal(media.attribution, 'Museum collection');
	assert.equal(media.rightsUrl, original.object.edmRights);
	assert.ok(isRecordImage(media));
});

test('image fallback accepts explicit image metadata and omits non-image or unsafe resources', () => {
	assert.equal(extractRecordImage({}), undefined);
	for (const url of [
		'javascript:alert(1)',
		'data:image/png,test',
		'//museum.example/a.jpg',
		'https://user:secret@museum.example/a.jpg'
	]) {
		assert.equal(extractRecordImage({ object: url }), undefined);
		assert.equal(isRecordImage({ url, attribution: '', rights: '' }), false);
	}
	for (const resource of [
		{ id: 'https://museum.example/a.pdf' },
		{ id: 'https://museum.example/media', dcType: 'VIDEO' },
		{ id: 'https://museum.example/media', format: 'audio/mpeg' }
	]) {
		assert.equal(extractRecordImage({ isShownBy: resource }), undefined);
	}
	const url = 'https://museum.example/image-service?id=42';
	assert.equal(
		extractRecordImage({
			object: [],
			isShownBy: { '@id': url, dcType: [{ '@value': 'IMAGE' }] },
			dataProvider: 'Museum'
		})?.url,
		url
	);
	assert.equal(extractRecordImage({ object: ['invalid', url] })?.url, url);
	assert.equal(extractRecordImage({ hasView: [{ id: url, format: 'image/jpeg' }] })?.url, url);
	assert.equal(isRecordImage({ url, attribution: {}, rights: '' }), false);
	assert.equal(
		isRecordImage({ url, attribution: '', rights: 'license', rightsUrl: 'javascript:alert(1)' }),
		false
	);
});

test('media is attached to review context without changing assessment identity or confidence', () => {
	const detail = record({ type_enriched: field([candidate()]) });
	const before = extractReviewTargets(search, { a: lookup(detail) })[0];
	detail.original_record.object = { id: 'https://museum.example/preview.jpg' };
	const after = extractReviewTargets(search, { a: lookup(detail) })[0];
	assert.equal(after.id, before.id);
	assert.equal(after.context.confidence, before.context.confidence);
	assert.equal(after.context.recordImage?.url, 'https://museum.example/preview.jpg');
	const queue = buildReviewQueue({ query: 'test', results: search } as SearchResponse, {
		a: lookup(detail)
	});
	assert.deepEqual(queue.entities[0].matches[0].recordImage, after.context.recordImage);
});
