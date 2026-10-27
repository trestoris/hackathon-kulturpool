<script lang="ts">
	import DecisionBadge from './decision-badge.svelte';
	import ValueBadge from './value-badge.svelte';
	import { CONFIDENCE_THRESHOLD, type ReviewTarget } from '#lib/review-targets.js';
	let { selected }: { selected: ReviewTarget } = $props();
</script>

<section aria-label="Model assessment" class="space-y-5">
	<div class="space-y-2.5 pr-5">
		<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
			<h3 class="text-lg font-semibold tracking-tight">Model assessment</h3>
			{#if selected.context}
				<p class="text-xs leading-5 break-words text-muted-foreground">
					Model: {selected.context.model}
				</p>
			{/if}
		</div>
		{#if selected.context && selected.context.confidence < CONFIDENCE_THRESHOLD}
			<p class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm leading-6">
				<span class="font-medium text-foreground">Needs your review</span>
				<span class="text-muted-foreground">Low reported confidence</span>
			</p>
		{/if}
	</div>
	<dl class="flex flex-wrap items-start gap-x-6 gap-y-4">
		<div class="space-y-2">
			<dt class="text-sm text-muted-foreground">LLM decision</dt>
			<dd><DecisionBadge decision={selected.llmDecision} size="metric" /></dd>
		</div>
		{#if selected.context}
			<div class="space-y-2">
				<dt class="text-sm text-muted-foreground">Reported confidence</dt>
				<dd>
					<ValueBadge tone="negative" size="metric" numeric>
						{selected.context.confidence}
					</ValueBadge>
				</dd>
			</div>
		{/if}
	</dl>
	<div class="space-y-2">
		<h4 class="text-lg font-semibold tracking-tight">LLM explanation</h4>
		<p class="text-sm leading-6 break-words whitespace-pre-wrap">{selected.explanation}</p>
	</div>
</section>
