<script lang="ts">
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Separator } from '#lib/components/ui/separator/index.js';
	import ReviewContext from './review-context.svelte';
	import ReviewAssessment from './review-assessment.svelte';
	import ExpertReviewForm from './expert-review-form.svelte';
	import EntitySourceLink from './entity-source-link.svelte';
	import type { ReviewTarget } from '#lib/review-targets.js';
	let {
		selected,
		saving = false,
		storageReady = true,
		feedback,
		reviewOpen = $bindable(),
		decision = $bindable(),
		note = $bindable(),
		onsave
	}: {
		selected: ReviewTarget;
		saving?: boolean;
		storageReady?: boolean;
		feedback: string;
		reviewOpen: boolean;
		decision: string;
		note: string;
		onsave: () => void;
	} = $props();
</script>

<Dialog.Root bind:open={reviewOpen}>
	<Dialog.Content class="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
		<div class="grid min-h-0 overflow-y-auto md:grid-cols-2">
			<div class="min-w-0 space-y-7 p-6 sm:p-8">
				<Dialog.Header class="space-y-3 text-left">
					<div class="flex flex-wrap items-center justify-between gap-2 pr-6 md:pr-0">
						<div class="flex items-center gap-2">
							<p class="text-sm font-medium text-foreground">Entity</p>
							{#if selected.context}<Badge variant="secondary">{selected.context.qid}</Badge>{/if}
						</div>
						{#if selected.context}
							<div class="ml-auto text-right"><EntitySourceLink qid={selected.context.qid} /></div>
						{/if}
					</div>
					<Dialog.Title
						class="text-2xl leading-tight font-semibold tracking-tight break-words sm:text-3xl"
					>
						{selected.name}
					</Dialog.Title>
					<Dialog.Description class="text-sm leading-6">
						{selected.description}
					</Dialog.Description>
				</Dialog.Header>
				{#if selected.context}
					<Separator />
					<ReviewContext context={selected.context} />
				{/if}
			</div>
			<div class="min-w-0 space-y-7 border-t p-6 sm:p-8 md:border-t-0 md:border-l">
				<ReviewAssessment {selected} />
				<Separator />
				<ExpertReviewForm
					{selected}
					{feedback}
					{saving}
					{storageReady}
					bind:decision
					bind:note
					{onsave}
				/>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
