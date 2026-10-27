<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { cn } from '#lib/utils.js';

	// Shared presentation for decisions and numeric values across the review UI.
	let {
		tone = 'neutral',
		size = 'default',
		numeric = false,
		children
	}: {
		tone?: 'positive' | 'negative' | 'info' | 'neutral';
		size?: 'default' | 'comfortable' | 'metric';
		numeric?: boolean;
		children: Snippet;
	} = $props();

	const tones = {
		positive: 'bg-emerald-50 text-emerald-900',
		negative: 'bg-rose-50 text-rose-900',
		info: 'bg-sky-50 text-sky-900',
		neutral: 'bg-muted text-muted-foreground'
	};
	const sizes = {
		default: 'px-2.5 py-1 text-xs leading-4 font-medium',
		comfortable: 'max-w-full px-3 py-2 text-xs leading-4 font-medium whitespace-normal',
		metric: 'px-5 py-3 text-2xl leading-8 font-semibold tracking-tight whitespace-normal'
	};
</script>

<Badge
	variant="secondary"
	class={cn('h-auto rounded-lg border-0', tones[tone], sizes[size], numeric && 'tabular-nums')}
>
	{@render children()}
</Badge>
