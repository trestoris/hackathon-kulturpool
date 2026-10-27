<script lang="ts">
	import ValueBadge from './value-badge.svelte';
	let {
		decision,
		label,
		size = 'default'
	}: {
		decision?: string;
		label?: string;
		size?: 'default' | 'comfortable' | 'metric';
	} = $props();
	const tone = $derived(
		decision === 'Not relevant' ? 'negative' : decision === 'Relevant' ? 'positive' : 'neutral'
	);
</script>

<ValueBadge {tone} {size}>
	{label ?? (decision || 'Not reviewed')}
</ValueBadge>
