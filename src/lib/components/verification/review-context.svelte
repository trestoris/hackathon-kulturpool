<script lang="ts">
	import { ArrowUpRight } from '@lucide/svelte';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import type { ReviewContext } from '#lib/review-targets.js';
	import RecordImage from './record-image.svelte';
	let { context }: { context: ReviewContext } = $props();
	const recordUrl = $derived.by(() => {
		try {
			const url = new URL(context.recordId);
			return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
		} catch {
			return null;
		}
	});
</script>

<section class="space-y-4" aria-label="Source record">
	<div class="space-y-3">
		<h3 class="text-2xl font-semibold tracking-tight">Source record</h3>
		{#if recordUrl}<a
				href={recordUrl}
				target="_blank"
				rel="noreferrer"
				class="inline-flex items-start gap-2 text-lg font-semibold tracking-tight break-words underline decoration-border underline-offset-4 hover:decoration-current"
				>{context.recordTitle}<ArrowUpRight class="mt-1 size-4 shrink-0" /></a
			>
		{:else}<p class="text-lg font-semibold tracking-tight break-words">
				{context.recordTitle}
			</p>{/if}
		{#if context.recordImage}
			{#key context.recordImage.url}
				<RecordImage image={context.recordImage} title={context.recordTitle} />
			{/key}
		{/if}
		{#if context.recordDescription}<p class="text-sm leading-6 break-words whitespace-pre-wrap">
				{context.recordDescription}
			</p>{/if}
	</div>
	<dl class="space-y-4 rounded-lg bg-muted/60 p-4 text-sm">
		<div class="flex flex-wrap items-center gap-2">
			<dt class="text-muted-foreground">Field</dt>
			<dd><Badge variant="outline" class="bg-background">{context.sourceField}</Badge></dd>
		</div>
		<div class="space-y-1.5">
			<dt class="text-xs font-medium text-muted-foreground">Original value in this record</dt>
			<dd class="text-base leading-6 font-medium break-words whitespace-pre-wrap">
				{context.originalValue || 'Not provided'}
			</dd>
		</div>
	</dl>
</section>
