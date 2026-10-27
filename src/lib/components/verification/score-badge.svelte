<script lang="ts">
	import ValueBadge from './value-badge.svelte';
	let { score, showLabel = false }: { score: string; showLabel?: boolean } = $props();
</script>

<ValueBadge tone="positive" numeric>{showLabel ? 'Wiki score: ' : ''}{score}</ValueBadge>
