import { json } from '@sveltejs/kit';
import { resolve } from 'node:path';
import type { RequestHandler } from './$types';
import { parseReviews } from '#lib/saved-reviews.js';
import { createReviewStore } from '#lib/server/review-store.js';

const store = createReviewStore(
	resolve(process.env.REVIEWS_FILE || 'data/reviews.json'),
	parseReviews
);
const headers = { 'Cache-Control': 'no-store' };

export const GET: RequestHandler = async () => {
	try {
		return json({ reviews: await store.read() }, { headers });
	} catch {
		return json(
			{ message: 'Could not read the feedback file. Existing data has been left unchanged.' },
			{ status: 503, headers }
		);
	}
};

export const POST: RequestHandler = async ({ request, url }) => {
	// This local endpoint must not accept writes initiated by another website.
	if (request.headers.get('origin') !== url.origin) {
		return json({ message: 'Invalid request origin.' }, { status: 403, headers });
	}
	if (!request.headers.get('content-type')?.startsWith('application/json')) {
		return json({ message: 'Expected JSON.' }, { status: 415, headers });
	}
	let reviews;
	try {
		const body = await request.json();
		if (body.mode !== 'save') throw new Error('Invalid operation.');
		reviews = parseReviews(body.reviews);
		if (Object.keys(reviews).length !== 1 || !Object.values(reviews)[0].note.trim()) {
			throw new Error('Provide one review with a comment.');
		}
	} catch {
		return json(
			{ message: 'Invalid feedback. Check the decision and comment, then try again.' },
			{ status: 400, headers }
		);
	}
	try {
		return json({ reviews: await store.update(reviews) }, { headers });
	} catch {
		return json(
			{
				message:
					'Could not save to the feedback file. Your changes have not been saved. Please retry.'
			},
			{ status: 503, headers }
		);
	}
};
