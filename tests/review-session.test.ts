import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareReviewSession } from '../src/lib/review-session.ts';
import { restoreReviews } from '../src/lib/saved-reviews.ts';
import { reviewTargetId, type ReviewTarget } from '../src/lib/review-targets.ts';
import type { SavedReview } from '../src/lib/saved-reviews.ts';

function target(recordId = 'record-a', sourceField = 'subject'): ReviewTarget {
	const context = {
		qid: 'Q254',
		recordId,
		recordTitle: recordId,
		recordDescription: 'Record description',
		sourceField,
		fieldKey: sourceField,
		originalValue: 'Mozart',
		valueIdentity: '["Mozart",null]',
		model: 'google/gemini-2.5-flash-lite',
		confidence: 0.1321,
		analyzedAt: '2026-04-03',
		recordImage: { url: 'https://museum.example/record.jpg', attribution: 'Museum', rights: '' }
	};
	return {
		id: reviewTargetId(context),
		name: 'Wolfgang Amadeus Mozart',
		description: 'Composer',
		score: '1320.9994',
		llmDecision: 'Relevant',
		explanation: 'This field refers to Mozart.',
		context
	};
}
function saved(target: ReviewTarget): SavedReview {
	return { target, query: 'mozrt', note: 'Saved expert comment', decision: 'Not relevant' };
}

test('sidebar snapshot opens the same complete dialog session after storage reload without search results', () => {
	const entity = target();
	const review = saved(entity);
	const restored = restoreReviews(JSON.parse(JSON.stringify({ [entity.id]: review })), {}, [])[
		entity.id
	];
	const fromTable = prepareReviewSession(entity, review.query, review);
	const fromSidebar = prepareReviewSession(restored.target, restored.query, restored);
	assert.deepEqual(fromSidebar, fromTable);
	assert.equal(fromSidebar.selected.context?.confidence, 0.1321);
	assert.equal(fromSidebar.selected.context?.recordImage?.url, 'https://museum.example/record.jpg');
	assert.equal(fromSidebar.note, review.note);
	assert.equal(fromSidebar.decision, review.decision);
});

test('reviews of the same QID in different records or fields cannot borrow one another’s feedback', () => {
	const a = target();
	for (const b of [target('record-b'), target('record-a', 'creator')]) {
		assert.equal(a.context?.qid, b.context?.qid);
		const session = prepareReviewSession(b, 'current search', saved(a));
		assert.equal(session.selected, b);
		assert.equal(session.selected.context?.recordId, b.context?.recordId);
		assert.equal(session.selected.context?.sourceField, b.context?.sourceField);
		assert.equal(session.note, '');
		assert.equal(session.decision, '');
	}
});

test('old saved feedback remains editable without inventing a record or borrowing a current entity match', () => {
	const legacy = { ...target(), id: 'mozart', context: undefined };
	const review = saved(legacy);
	const session = prepareReviewSession(review.target, review.query, review);
	assert.equal(session.selected.context, undefined);
	assert.equal(session.selected.id, 'mozart');
	assert.equal(session.note, review.note);
});
