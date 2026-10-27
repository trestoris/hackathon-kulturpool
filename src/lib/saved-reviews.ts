import type { ReviewTarget, ReviewContext } from './review-targets.js';

export const REVIEW_STORAGE_KEY = 'veryfake-reviews-v2';
export type SavedReview = {
	decision: 'Relevant' | 'Not relevant';
	note: string;
	query: string;
	target: ReviewTarget;
};

function object(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isTarget(value: unknown): value is ReviewTarget {
	if (!object(value)) return false;
	for (const key of ['id', 'name', 'description', 'score', 'llmDecision', 'explanation']) {
		if (typeof value[key] !== 'string') return false;
	}
	if (value.context !== undefined) {
		if (!object(value.context)) return false;
		const context = value.context;
		const keys: (keyof ReviewContext)[] = [
			'qid',
			'recordId',
			'recordTitle',
			'recordDescription',
			'fieldKey',
			'sourceField',
			'originalValue',
			'valueIdentity',
			'model',
			'analyzedAt'
		];
		if (
			keys.some((key) => typeof context[key] !== 'string') ||
			typeof context.confidence !== 'number' ||
			!Number.isFinite(context.confidence) ||
			context.confidence < 0 ||
			context.confidence > 1
		)
			return false;
	}
	return true;
}

/** Saved snapshots keep feedback readable and editable after clearing a search or reloading. */
export function restoreReviews(
	current: unknown,
	legacy: unknown,
	demoEntities: ReviewTarget[]
): Record<string, SavedReview> {
	const restored = new Map<string, SavedReview>();
	if (object(legacy)) {
		for (const entity of demoEntities) {
			const review = legacy[entity.id];
			if (
				object(review) &&
				(review.decision === 'Relevant' || review.decision === 'Not relevant') &&
				typeof review.note === 'string'
			) {
				restored.set(entity.id, {
					target: entity,
					decision: review.decision,
					note: review.note,
					query: typeof review.query === 'string' ? review.query : ''
				});
			}
		}
	}
	if (object(current)) {
		for (const [id, review] of Object.entries(current)) {
			if (
				!object(review) ||
				!isTarget(review.target) ||
				review.target.id !== id ||
				(review.decision !== 'Relevant' && review.decision !== 'Not relevant') ||
				typeof review.note !== 'string' ||
				typeof review.query !== 'string'
			)
				continue;
			restored.set(id, {
				target: review.target,
				decision: review.decision,
				note: review.note,
				query: review.query
			});
		}
	}
	return Object.fromEntries(restored);
}

/** File/API data must be wholly valid: never silently discard entries before rewriting a file. */
export function parseReviews(value: unknown): Record<string, SavedReview> {
	if (!object(value)) throw new Error('Expected a collection of reviews.');
	const reviews = restoreReviews(value, {}, []);
	if (Object.keys(reviews).length !== Object.keys(value).length) {
		throw new Error('The review collection contains invalid entries.');
	}
	return reviews;
}
