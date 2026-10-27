export const entities = [
	{
		id: 'mozart',
		name: 'Wolfgang Amadeus Mozart',
		description: 'Musiker und Komponist der Wiener Klassik',
		category: 'Music',
		initials: 'WM',
		llmDecision: 'Not relevant',
		score: '389.18',
		explanation:
			'Placeholder: the LLM explanation for this suggestion will appear here. Review its relevance and add your expert comment below.',
		color: 'mint'
	},
	{
		id: 'requiem',
		name: 'Requiem',
		description: 'Werk von Wolfgang Amadeus Mozart',
		category: 'Music',
		initials: 'RQ',
		llmDecision: 'Not relevant',
		score: '223.35',
		explanation:
			'Placeholder: the LLM explanation for this suggestion will appear here. Review its relevance and add your expert comment below.',
		color: 'blue'
	},
	{
		id: 'leopold-mozart',
		name: 'Leopold Mozart',
		description: 'Komponist der Wiener Klassik',
		category: 'Music',
		initials: 'LM',
		llmDecision: 'Not relevant',
		score: '221.89',
		explanation:
			'Placeholder: the LLM explanation for this suggestion will appear here. Review its relevance and add your expert comment below.',
		color: 'peach'
	},
	{
		id: 'lovelace',
		name: 'Ada Lovelace',
		description: 'English mathematician and writer',
		category: 'Science',
		initials: 'AL',
		llmDecision: 'Not relevant',
		score: '284.12',
		explanation:
			'Placeholder: the LLM explanation for this suggestion will appear here. Review its relevance and add your expert comment below.',
		color: 'blue'
	},
	{
		id: 'klimt',
		name: 'Gustav Klimt',
		description: 'Austrian symbolist painter',
		category: 'Art',
		initials: 'GK',
		llmDecision: 'Not relevant',
		score: '312.58',
		explanation:
			'Placeholder: the LLM explanation for this suggestion will appear here. Review its relevance and add your expert comment below.',
		color: 'peach'
	}
];
export type Entity = (typeof entities)[number];
export type Review = { decision: string; note: string; query?: string };

export type Suggestion = Pick<
	import('./review-targets.js').ReviewTarget,
	'id' | 'name' | 'description' | 'score' | 'context'
> & { llmDecision?: string };
