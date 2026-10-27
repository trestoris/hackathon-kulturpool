<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { cubicInOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { createSearch } from '#lib/search.svelte.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import SearchHero from '#lib/components/verification/search-hero.svelte';
	import EntityLookupStatus from '#lib/components/verification/entity-lookup-status.svelte';
	import RecordLookupStatus from '#lib/components/verification/record-lookup-status.svelte';
	import SuggestionsTable from '#lib/components/verification/suggestions-table.svelte';
	import FeedbackSidebar from '#lib/components/verification/feedback-sidebar.svelte';
	import ReviewDialog from '#lib/components/verification/review-dialog.svelte';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import { type ReviewTarget } from '#lib/review-targets.js';
	import { parseReviews, type SavedReview } from '#lib/saved-reviews.js';
	import { prepareReviewSession } from '#lib/review-session.js';

	const search = createSearch();
	onDestroy(search.reset);
	let query = $state('');
	const hasSubmittedQuery = $derived(search.submittedQuery.length > 0);
	let searchSidebarOpen = $state(true);
	let landingSidebarOpen = $state(false);
	let reviewOpen = $state(false);
	let reviewQuery = $state('');
	let statusFilter = $state('all');
	let selected = $state<ReviewTarget | null>(null);
	let note = $state('');
	let decision = $state('');
	let reviews = $state<Record<string, SavedReview>>({});
	let feedback = $state('');
	let reviewsLoading = $state(true);
	let reviewsReady = $state(false);
	let reviewsError = $state('');
	let saving = $state(false);
	const reviewTargets = $derived(search.reviewTargets);
	const expertFeedback = $derived(Object.values(reviews));
	const reviewed = $derived(reviewTargets.filter((target) => !!reviews[target.id]).length);
	const tableEntities = $derived(
		reviewTargets.filter(
			(target) =>
				statusFilter === 'all' ||
				(statusFilter === 'reviewed' ? !!reviews[target.id] : !reviews[target.id])
		)
	);

	function openReview(target: ReviewTarget, contextQuery: string, saved?: SavedReview) {
		const session = prepareReviewSession(target, contextQuery, saved);
		selected = session.selected;
		note = session.note;
		decision = session.decision;
		feedback = '';
		reviewQuery = session.reviewQuery;
		reviewOpen = true;
	}

	function openSuggestion(id: string) {
		const target = reviewTargets.find((item) => item.id === id);
		if (target) openReview(target, search.result?.query ?? query.trim(), reviews[id]);
	}

	function openSavedReview(review: SavedReview) {
		// The sidebar owns the complete saved snapshot, including the precise record and field.
		// Reopening it must also work after clearing or changing the search.
		openReview(review.target, review.query, review);
	}

	async function reviewRequest(mode?: 'save', incoming?: Record<string, SavedReview>) {
		const response = await fetch(
			'/api/reviews',
			mode
				? {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ mode, reviews: incoming })
					}
				: { cache: 'no-store' }
		);
		const data = await response.json();
		if (!response.ok) throw new Error(data.message || 'Feedback storage is unavailable.');
		return parseReviews(data.reviews);
	}

	async function loadReviews() {
		reviewsLoading = true;
		reviewsReady = false;
		reviewsError = '';
		try {
			reviews = await reviewRequest();
			reviewsReady = true;
		} catch (cause) {
			reviewsError = cause instanceof Error ? cause.message : 'Could not load saved feedback.';
		} finally {
			reviewsLoading = false;
		}
	}

	onMount(() => {
		void loadReviews();
	});

	async function save() {
		if (!selected || saving || !reviewsReady) return;
		if (!note.trim() || (decision !== 'Relevant' && decision !== 'Not relevant')) {
			feedback = 'Add a comment and choose Approve or Reject to save your review.';
			return;
		}
		const target = selected;
		const review: SavedReview = { note: note.trim(), decision, query: reviewQuery, target };
		saving = true;
		feedback = '';
		try {
			reviews = await reviewRequest('save', { [target.id]: review });
			if (selected?.id === target.id) feedback = 'Your review is saved.';
		} catch (cause) {
			if (selected?.id === target.id)
				feedback =
					cause instanceof Error ? cause.message : 'Could not save your review. Please retry.';
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Veryfake — Verify search suggestions</title>
	<meta name="description" content="Review search suggestions and record your expert assessment." />
</svelte:head>

<Sidebar.Provider
	class="min-h-dvh"
	style="--sidebar-width: 20rem;"
	open={hasSubmittedQuery ? searchSidebarOpen : landingSidebarOpen}
	onOpenChange={(open) => {
		if (hasSubmittedQuery) searchSidebarOpen = open;
		else landingSidebarOpen = open;
	}}
>
	<main class="min-w-0 flex-1 bg-muted/30">
		<SearchHero
			bind:query
			submitted={hasSubmittedQuery}
			loading={search.loading}
			onsearch={() => search.submit(query)}
			onquerychange={() => {
				search.reset();
				statusFilter = 'all';
			}}
		/>

		{#if hasSubmittedQuery}
			<section
				class="mx-auto max-w-7xl space-y-4 p-4 sm:p-6 lg:p-8"
				aria-label="Entity verification"
				inert={!hasSubmittedQuery}
				in:fly={{
					y: prefersReducedMotion.current ? 0 : 16,
					delay: prefersReducedMotion.current ? 0 : 120,
					duration: prefersReducedMotion.current ? 0 : 360,
					easing: cubicInOut
				}}
				out:fade={{ duration: prefersReducedMotion.current ? 0 : 160, easing: cubicInOut }}
			>
				{#if search.loading}
					<p role="status" aria-live="polite" class="text-sm text-muted-foreground">
						Searching Kulturpool for “{search.submittedQuery}”…
					</p>
				{:else if search.error}
					<div class="space-y-3 rounded-xl border border-destructive/20 bg-card p-6">
						<p role="alert" class="text-sm text-destructive">{search.error}</p>
						<Button variant="outline" onclick={() => search.submit(query)}>Try again</Button>
					</div>
				{:else if search.result}
					{#if search.entityLoading}
						<div class="h-5">
							<p role="status" class="sr-only">Loading entity details…</p>
						</div>
					{/if}
					{#if !search.entityLoading}
						<SuggestionsTable
							query={search.result.query}
							loading={search.recordLoading}
							recordsCompleted={search.recordsCompleted}
							recordsTotal={search.recordIds.length}
							{tableEntities}
							{reviews}
							{reviewed}
							matchCount={reviewTargets.length}
							totalCount={reviewTargets.length}
							bind:statusFilter
							onreview={openSuggestion}
							emptyTitle={reviewTargets.length
								? 'No matching suggestions'
								: 'No candidates below 0.3 confidence'}
							emptyDescription={reviewTargets.length
								? 'Try another review filter.'
								: 'No matching assessments from google/gemini-2.5-flash-lite were found in the loaded records.'}
							onreset={() => {
								query = '';
								search.reset();
								statusFilter = 'all';
							}}
						/>
						{#if search.qids.length}
							<footer
								aria-label="Lookup summary"
								aria-hidden={search.recordLoading}
								class="space-y-3 border-t pt-4"
								class:invisible={search.recordLoading}
							>
								<EntityLookupStatus
									loading={false}
									lookups={search.entityLookups}
									onretry={() => search.submit(query)}
								/>
								<RecordLookupStatus
									loading={search.recordLoading}
									completed={search.recordsCompleted}
									total={search.recordIds.length}
									lookups={search.recordLookups}
									onretry={search.retryRecords}
								/>
							</footer>
						{/if}
					{/if}
				{:else}
					<p class="text-sm text-muted-foreground">
						Press Enter or the search button to search Kulturpool.
					</p>
				{/if}
			</section>
		{/if}
	</main>

	<FeedbackSidebar
		reviews={expertFeedback}
		onreview={openSavedReview}
		loading={reviewsLoading}
		error={reviewsError}
		onretry={loadReviews}
	/>
</Sidebar.Provider>

{#if selected}
	<ReviewDialog
		{selected}
		{feedback}
		{saving}
		storageReady={reviewsReady}
		bind:reviewOpen
		bind:decision
		bind:note
		onsave={save}
	/>
{/if}
