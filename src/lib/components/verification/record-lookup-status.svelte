<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import type { RecordLookup } from '#lib/kulturpool.js';
	let {
		loading,
		completed,
		total,
		lookups,
		onretry
	}: {
		loading: boolean;
		completed: number;
		total: number;
		lookups: Record<string, RecordLookup>;
		onretry: () => void;
	} = $props();
	const entries = $derived(Object.values(lookups));
	const found = $derived(entries.filter((entry) => entry.status === 'found').length);
	const missing = $derived(entries.filter((entry) => entry.status === 'missing').length);
	const failed = $derived(entries.filter((entry) => entry.status === 'error').length);
</script>

<div class="space-y-2 text-sm text-muted-foreground">
	<p role="status" aria-live="polite">
		{#if loading}Loading linked records… {completed} of {total} checked.
		{:else if total === 0}No linked records found.
		{:else}Loaded {found} of {total} linked records.
			{#if missing}{missing} records not found.{/if}
		{/if}
	</p>
	{#if failed && !loading}
		<p role="alert" class="text-destructive">Could not load {failed} records.</p>
		<Button variant="outline" size="sm" onclick={onretry}>Retry failed records</Button>
	{/if}
</div>
