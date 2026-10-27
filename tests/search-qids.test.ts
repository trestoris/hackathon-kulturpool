import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractSearchQids } from '../src/lib/kulturpool.ts';
import { searchKulturpool } from '../src/lib/server/kulturpool-search.ts';

test('validated search results produce unique QIDs without losing scores or changing order', async () => {
	const response = await searchKulturpool('Mozart', async () =>
		Response.json({
			results: [
				{ q_id: 'Q254', label: 'Mozart', score: 389.18 },
				{ q_id: 'Q207875', label: 'Requiem', score: 223.35 },
				{ q_id: 'Q254', label: 'Mozart', score: 154.75092 },
				{ q_id: 'Q156280', label: 'Leopold Mozart', score: 221.89 }
			]
		})
	);
	const original = structuredClone(response.results);
	assert.deepEqual(extractSearchQids(response.results), ['Q254', 'Q207875', 'Q156280']);
	assert.deepEqual(response.results, original);
});

test('each QID list belongs only to its own search, including empty results', () => {
	const mozart = [{ q_id: 'Q254', label: 'Mozart', description: null, score: 389.18 }];
	const klimt = [{ q_id: 'Q34661', label: 'Klimt', description: null, score: 357.9318 }];
	assert.deepEqual(extractSearchQids(mozart), ['Q254']);
	assert.deepEqual(extractSearchQids(klimt), ['Q34661']);
	assert.deepEqual(extractSearchQids([]), []);
});
