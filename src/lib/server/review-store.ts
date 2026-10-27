import { mkdir, readFile, writeFile, rename, rm, rmdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { SavedReview } from '../saved-reviews.js';

type Reviews = Record<string, SavedReview>;

/** The validator is shared with the API; injecting it also lets the file store run without SvelteKit. */
export function createReviewStore(file: string, validate: (value: unknown) => Reviews) {
	const lock = `${file}.lock`;

	async function read(): Promise<Reviews> {
		let source: string;
		try {
			source = await readFile(file, 'utf8');
		} catch (cause) {
			if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return {};
			throw cause;
		}
		const data = JSON.parse(source);
		if (!data || data.version !== 1) throw new Error('Unsupported review file format.');
		return validate(data.reviews);
	}

	async function update(incoming: Reviews): Promise<Reviews> {
		const entries = validate(incoming);
		await mkdir(dirname(file), { recursive: true });
		const deadline = Date.now() + 5000;
		// A filesystem lock also coordinates separate local dev servers/processes.
		while (true) {
			try {
				await mkdir(lock);
				break;
			} catch (cause) {
				if ((cause as NodeJS.ErrnoException).code !== 'EEXIST') throw cause;
				if (Date.now() >= deadline)
					throw new Error('Review file is busy. Please retry.', { cause });
				await delay(50);
			}
		}
		const temporary = `${file}.${randomUUID()}.tmp`;
		try {
			const existing = await read();
			const merged = { ...existing, ...entries };
			await writeFile(temporary, JSON.stringify({ version: 1, reviews: merged }, null, 2) + '\n', {
				encoding: 'utf8',
				mode: 0o600,
				flag: 'wx'
			});
			// Readers see either the complete old file or the complete new file.
			await rename(temporary, file);
			return merged;
		} finally {
			try {
				await rm(temporary, { force: true });
			} finally {
				await rmdir(lock);
			}
		}
	}

	return { read, update };
}
