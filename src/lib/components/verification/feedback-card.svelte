<script lang="ts">
	import { ArrowUpRight } from '@lucide/svelte';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import DecisionBadge from './decision-badge.svelte';
	import type { Review } from '#lib/entities.js';
	import type { ReviewTarget } from '#lib/review-targets.js';
	let { entity, review, onedit }: { entity: ReviewTarget; review: Review; onedit: () => void } =
		$props();
</script>

<Card.Root class="min-w-0 shrink-0 gap-5 ring-0">
	<Card.Header class="gap-3">
		<div class="flex flex-wrap items-center gap-2">
			<h3 class="text-xl font-semibold tracking-tight">Entity</h3>
			{#if entity.context}<Badge variant="secondary">{entity.context.qid}</Badge>{/if}
		</div>
		<Card.Title>
			<p class="text-sm leading-6 font-medium [overflow-wrap:anywhere]">
				{entity.name}
			</p>
		</Card.Title>
		{#if entity.description}
			<Card.Description class="text-xs leading-5 [overflow-wrap:anywhere]">
				{entity.description}
			</Card.Description>
		{/if}
	</Card.Header>
	<Card.Content class="min-w-0 space-y-5">
		{#if entity.context}
			<section aria-label="Source record" class="space-y-2">
				<h3 class="text-xl font-semibold tracking-tight">Source record</h3>
				<p class="text-sm leading-6 font-medium [overflow-wrap:anywhere]">
					{entity.context.recordTitle}
				</p>
				<dl class="space-y-1.5 text-xs leading-5">
					<div class="flex flex-wrap items-baseline gap-x-2">
						<dt class="text-muted-foreground">Field</dt>
						<dd class="font-medium [overflow-wrap:anywhere]">{entity.context.sourceField}</dd>
					</div>
				</dl>
			</section>
		{/if}
		<section aria-label="Your review" class="space-y-4 rounded-lg bg-muted/60 p-4">
			<h4 class="text-base font-semibold tracking-tight">Your review</h4>
			<dl class="grid grid-cols-2 gap-2 text-xs">
				<div class="min-w-0 space-y-2">
					<dt class="text-muted-foreground">LLM decision</dt>
					<dd><DecisionBadge decision={entity.llmDecision} size="comfortable" /></dd>
				</div>
				<div class="min-w-0 space-y-2">
					<dt class="font-medium">Your decision</dt>
					<dd>
						<DecisionBadge decision={review.decision} size="comfortable" />
					</dd>
				</div>
			</dl>
			<div class="space-y-1.5">
				<h5 class="text-xs font-medium text-muted-foreground">Your feedback</h5>
				<p class="text-sm leading-6 [overflow-wrap:anywhere] whitespace-pre-wrap">
					{review.note}
				</p>
			</div>
		</section>
	</Card.Content>
	<Card.Footer class="justify-end border-0 bg-transparent pt-0">
		<Button
			variant="ghost"
			size="sm"
			onclick={onedit}
			aria-label={entity.context
				? `Edit review: ${entity.name} — ${entity.context.recordTitle}, ${entity.context.sourceField}`
				: `Edit expert review for ${entity.name}`}
		>
			Edit review<ArrowUpRight />
		</Button>
	</Card.Footer>
</Card.Root>
