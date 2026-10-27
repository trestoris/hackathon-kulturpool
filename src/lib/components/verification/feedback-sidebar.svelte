<script lang="ts">
	import { tick } from 'svelte';
	import { MessageSquareText } from '@lucide/svelte';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import * as Empty from '#lib/components/ui/empty/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import FeedbackCard from './feedback-card.svelte';
	import type { SavedReview } from '#lib/saved-reviews.js';
	let {
		reviews,
		loading = false,
		error = '',
		onretry,
		onreview
	}: {
		reviews: SavedReview[];
		loading?: boolean;
		error?: string;
		onretry?: () => void;
		onreview: (review: SavedReview) => void;
	} = $props();
	const sidebar = Sidebar.useSidebar();

	async function editReview(review: SavedReview) {
		if (sidebar.openMobile) {
			// Release the sheet's modal layer and focus trap before opening the review dialog.
			sidebar.setOpenMobile(false);
			await tick();
		}
		onreview(review);
	}
</script>

<Sidebar.Root side="right" collapsible="offcanvas" class="h-auto overflow-hidden bg-sidebar">
	<Sidebar.Header class="p-4">
		<div class="flex items-center justify-between gap-3">
			<h2 class="text-base leading-snug font-semibold">Your saved feedback</h2>
			<div class="flex shrink-0 items-center gap-2">
				<Badge variant="secondary" aria-label={`${reviews.length} expert reviews`}
					>{reviews.length}</Badge
				>
				<Sidebar.Trigger aria-label="Collapse saved feedback" />
			</div>
		</div>
	</Sidebar.Header>
	<Sidebar.Separator />
	<Sidebar.Content class="gap-5 overscroll-contain p-4">
		{#if loading}<p role="status" class="text-sm text-muted-foreground">
				Loading saved feedback…
			</p>{/if}
		{#if error}<div class="space-y-3">
				<p role="alert" class="text-sm text-destructive">{error}</p>
				<Button variant="outline" size="sm" disabled={loading} onclick={onretry}
					>Retry loading feedback</Button
				>
			</div>{/if}
		{#each reviews as review (review.target.id)}
			<FeedbackCard entity={review.target} {review} onedit={() => editReview(review)} />
		{:else}
			{#if !loading && !error}
				<Empty.Root class="gap-4 border border-dashed p-4 md:p-4">
					<Empty.Header
						><Empty.Media variant="icon"><MessageSquareText /></Empty.Media><Empty.Title
							class="text-sm">No expert feedback yet</Empty.Title
						><Empty.Description
							>Save a review to collect your feedback by entity and source record.</Empty.Description
						></Empty.Header
					>
				</Empty.Root>
			{/if}
		{/each}
	</Sidebar.Content>
</Sidebar.Root>
