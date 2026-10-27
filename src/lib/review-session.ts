import type { ReviewTarget } from './review-targets.js';
import type { SavedReview } from './saved-reviews.js';

/** Both entry points open the same dialog with a complete assessment, never just a QID. */
export function prepareReviewSession(target: ReviewTarget, query: string, saved?: SavedReview) {
	// One entity can appear in different records, fields, or model assessments.
	const matchingReview = saved?.target.id === target.id ? saved : undefined;
	return {
		selected: target,
		reviewQuery: query,
		note: matchingReview?.note ?? '',
		decision: matchingReview?.decision ?? ''
	};
}
