<script lang="ts">
	import { ArrowUpRight } from '@lucide/svelte';
	let { qid }: { qid: string } = $props();
	let source = $state<{ qid: string; url: string } | null>(null);
	let loading = $state(false);

	$effect(() => {
		const requestedQid = qid;
		const controller = new AbortController();
		source = null;
		loading = true;
		async function loadSource() {
			try {
				const response = await fetch(`/api/entity-sources/${encodeURIComponent(requestedQid)}`, {
					signal: controller.signal,
					headers: { Accept: 'application/json' }
				});
				if (!response.ok) return;
				const data = await response.json();
				if (
					!controller.signal.aborted &&
					data.qid === requestedQid &&
					typeof data.wikidata_url === 'string'
				) {
					source = { qid: requestedQid, url: data.wikidata_url };
				}
			} catch {
				// Missing or unavailable API evidence never falls back to a constructed URL.
			} finally {
				if (!controller.signal.aborted) loading = false;
			}
		}
		void loadSource();
		return () => controller.abort();
	});
</script>

<div class="min-h-5 text-sm">
	{#if source && source.qid === qid}
		<a
			href={source.url}
			target="_blank"
			rel="noreferrer"
			class="inline-flex w-fit items-center gap-1 font-medium underline underline-offset-4"
		>
			View on Wikidata<ArrowUpRight class="size-3.5" />
		</a>
	{:else}
		<p class="text-muted-foreground" role="status">
			{loading ? 'Loading entity source…' : 'Entity source link unavailable.'}
		</p>
	{/if}
</div>
