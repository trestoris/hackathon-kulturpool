import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restoreReviews } from '../src/lib/saved-reviews.ts';
import { extractReviewTargets, REVIEW_MODEL } from '../src/lib/review-targets.ts';

function target(recordId: string) {
	return extractReviewTargets([{ q_id: 'Q254', label: 'Mozart', description: '', score: 999 }], {
		[recordId]: {
			status: 'found',
			record: {
				record_id: recordId,
				status: 'success',
				processed_at: '2026-04-01',
				original_record: { title: 'Record', creator: 'Mozart' },
				enriched_data: {
					creator: {
						candidates: [
							{
								q_id: 'Q254',
								label: 'Mozart',
								score: 154.75092,
								plausibility: {
									[REVIEW_MODEL]: { plausible: false, confidence: 0.1, reason: 'Reason' }
								}
							}
						]
					}
				},
				available_models: [REVIEW_MODEL],
				schema_version: 2
			}
		}
	})[0];
}

test('saved feedback round trips with context and stays separate for the same QID in different records', () => {
	const a = target('record-a');
	const b = target('record-b');
	const saved = {
		[a.id]: { decision: 'Relevant', note: 'Approved for A', query: 'Mozart', target: a },
		[b.id]: { decision: 'Not relevant', note: 'Rejected for B', query: 'Wolfgang', target: b }
	};
	assert.deepEqual(restoreReviews(JSON.parse(JSON.stringify(saved)), {}, []), saved);
});

test('legacy demo feedback is retained separately and updated snapshots take precedence', () => {
	const demo = {
		id: 'mozart',
		name: 'Mozart',
		description: '',
		score: '389.18',
		llmDecision: 'Not relevant',
		explanation: 'Placeholder'
	};
	const legacy = { mozart: { decision: 'Relevant', note: 'Legacy comment', query: 'Mozart' } };
	const migrated = restoreReviews({}, legacy, [demo]);
	assert.equal(migrated.mozart.target, demo);
	assert.equal(migrated.mozart.note, 'Legacy comment');
	assert.equal(
		restoreReviews({ mozart: { ...migrated.mozart, note: 'Edited comment' } }, legacy, [demo])
			.mozart.note,
		'Edited comment'
	);
});

test('malformed saved entries are skipped without losing valid feedback', () => {
	const a = target('record-a');
	const valid = { decision: 'Relevant', note: 'A comment', query: 'Mozart', target: a };
	const restored = restoreReviews(
		{
			[a.id]: valid,
			broken: null,
			wrongId: valid,
			invalid: { ...valid, target: { ...a, id: 'invalid', context: { confidence: '0.1' } } }
		},
		null,
		[]
	);
	assert.deepEqual(restored, { [a.id]: valid });
});
