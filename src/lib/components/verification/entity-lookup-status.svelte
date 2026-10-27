<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import type { EntityLookup } from '#lib/kulturpool.js';
	let {
		loading,
		lookups,
		onretry
	}: {
		loading: boolean;
		lookups: Record<string, EntityLookup>;
		onretry: () => void;
	} = $props();
	const entries = $derived(Object.values(lookups));
	const found = $derived(entries.filter((entry) => entry.status === 'found').length);
	const missing = $derived(entries.filter((entry) => entry.status === 'missing').length);
	const failed = $derived(entries.filter((entry) => entry.status === 'error').length);
</script>

<div class="space-y-2 text-sm text-muted-foreground">
	<p role="status" aria-live="polite">
		{#if loading}
			Loading entity details…
		{:else if entries.length}
			Entity details loaded for {found} of {entries.length} results.
			{#if missing}{missing} not found in Kulturpool’s stored entities.{/if}
		{/if}
	</p>
	{#if failed}
		<p role="alert" class="text-destructive">Could not load entity details for {failed} results.</p>
		<Button variant="outline" size="sm" onclick={onretry}>Retry search</Button>
	{/if}
</div>
