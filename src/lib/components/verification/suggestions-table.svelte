<script lang="ts">
	import { Search, ArrowUpRight, Info, LoaderCircle } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Pagination from '#lib/components/ui/pagination/index.js';
	import { pageWindow } from '#lib/progressive-results.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import * as ToggleGroup from '#lib/components/ui/toggle-group/index.js';
	import * as Empty from '#lib/components/ui/empty/index.js';
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';
	import { CONFIDENCE_THRESHOLD } from '#lib/review-targets.js';
	import ReviewCell from '#lib/components/review-cell.svelte';
	import DecisionBadge from './decision-badge.svelte';
	import type { Suggestion, Review } from '#lib/entities.js';
	let {
		query,
		loading = false,
		recordsCompleted = 0,
		recordsTotal = 0,
		tableEntities,
		reviews,
		matchCount,
		totalCount,
		reviewed,
		statusFilter = $bindable(),
		onreview,
		onreset,
		reviewEnabled = true,
		emptyTitle = 'No matching suggestions',
		emptyDescription = 'Try another search or review filter.'
	}: {
		loading?: boolean;
		recordsCompleted?: number;
		recordsTotal?: number;
		reviewEnabled?: boolean;
		emptyTitle?: string;
		emptyDescription?: string;
		query: string;
		tableEntities: Suggestion[];
		reviews: Record<string, Review>;
		matchCount: number;
		totalCount: number;
		reviewed: number;
		statusFilter: string;
		onreview: (id: string) => void;
		onreset: () => void;
	} = $props();
	let confidenceInfoOpen = $state(false);
	// Persist a clamped page after removals; a writable derived would reset navigation as rows arrive.
	// eslint-disable-next-line svelte/prefer-writable-derived
	let page = $state(1);
	const window = $derived(pageWindow(tableEntities.length, page));
	const visibleRows = $derived(tableEntities.slice(window.start, window.end));
	// A review can remove the last row on the last page of a filtered list.
	$effect(() => {
		page = window.page;
	});
</script>

<div class="flex flex-wrap items-center justify-between gap-4">
	<div class="flex items-center gap-3">
		<h2 class="min-w-0 text-xl leading-relaxed font-semibold tracking-tight">
			{reviewEnabled ? 'Entities to verify' : 'Search results for query'}

			<span
				class="ml-2 rounded-md bg-muted px-2 py-1 tabular-nums"
				aria-label={`${matchCount} ${reviewEnabled ? 'assessments to verify' : 'search results'}`}
				>{matchCount}</span
			>
		</h2>
		{#if reviewEnabled}
			<Tooltip.Root bind:open={confidenceInfoOpen} disableCloseOnTriggerClick>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="ghost"
							size="icon-sm"
							class="text-muted-foreground"
							aria-label="About the LLM confidence filter"
							onclick={() => (confidenceInfoOpen = true)}
							><Info class="size-4" aria-hidden="true" /></Button
						>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="bottom" sideOffset={8} class="max-w-64 leading-5 text-pretty">
					Showing assessments with LLM confidence below {CONFIDENCE_THRESHOLD}.
				</Tooltip.Content>
			</Tooltip.Root>
		{/if}
	</div>
	{#if reviewEnabled}
		<ToggleGroup.Root
			type="single"
			variant="outline"
			spacing={2}
			value={statusFilter}
			onValueChange={(value) => {
				statusFilter = value || 'all';
				page = 1;
			}}
			aria-label="Filter reviews"
		>
			<ToggleGroup.Item value="all">All</ToggleGroup.Item>
			<ToggleGroup.Item value="pending">To review</ToggleGroup.Item>
			<ToggleGroup.Item value="reviewed">Reviewed</ToggleGroup.Item>
		</ToggleGroup.Root>
	{/if}
</div>
<!-- Keep the same space during and after loading so the table does not jump. -->
<div class="min-h-5">
	<p class="text-xs leading-5 text-muted-foreground tabular-nums">
		{tableEntities.length ? window.start + 1 : 0}–{window.end} of {tableEntities.length} suggestions{loading
			? ' so far'
			: ''}
		{#if statusFilter !== 'all'}
			· {totalCount} total{/if}
		{#if reviewEnabled}
			· {reviewed} reviewed{/if}
	</p>
	<p role="status" class="sr-only">
		{#if loading}{matchCount} found so far · {recordsCompleted}/{recordsTotal} records checked{/if}
	</p>
</div>
<div class="overflow-hidden rounded-xl border bg-card">
	<Table.Root aria-label="Search suggestions" class="min-w-[880px]">
		<Table.Header class="bg-muted/50">
			<Table.Row>
				<Table.Head class="h-12 px-4">Entity</Table.Head>
				<Table.Head class="h-12 px-4">Source record</Table.Head>
				<Table.Head class="h-12 px-4">LLM decision</Table.Head>
				<Table.Head class="h-12 px-4">Expert decision</Table.Head>
				<Table.Head class="h-12 px-4">Comment</Table.Head>
				<Table.Head class="h-12 px-4 text-right"><span class="sr-only">Actions</span></Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each visibleRows as entity (entity.id)}
				{@const reviewLabel = entity.context
					? `${entity.name} — ${entity.context.recordTitle}, ${entity.context.sourceField}: ${entity.context.originalValue}`
					: entity.name}
				<Table.Row>
					<ReviewCell
						disabled={!reviewEnabled}
						label={'Review entity: ' + reviewLabel}
						onclick={() => onreview(entity.id)}
					>
						<span class="block max-w-48 min-w-40 font-medium break-words whitespace-normal"
							>{entity.name}</span
						>
						<span class="mt-1 block max-w-48 truncate text-xs text-muted-foreground"
							>{entity.description}</span
						>
					</ReviewCell>
					<ReviewCell
						disabled={!reviewEnabled}
						label={'Review source record for ' + reviewLabel}
						onclick={() => onreview(entity.id)}
					>
						<span class="block max-w-56 min-w-44 font-medium break-words whitespace-normal">
							{entity.context?.recordTitle || 'Not available'}
						</span>
						{#if entity.context}
							<span class="mt-1 block text-xs break-words whitespace-normal text-muted-foreground">
								Field: {entity.context.sourceField}
							</span>
						{/if}
					</ReviewCell>
					<ReviewCell
						disabled={!reviewEnabled}
						label={'Review LLM decision for ' + reviewLabel}
						onclick={() => onreview(entity.id)}
					>
						<DecisionBadge
							decision={entity.llmDecision}
							size="comfortable"
							label={!reviewEnabled ? 'Not available' : undefined}
						/>
					</ReviewCell>
					<ReviewCell
						disabled={!reviewEnabled}
						label={'Review expert decision for ' + reviewLabel}
						onclick={() => onreview(entity.id)}
					>
						<DecisionBadge
							decision={reviews[entity.id]?.decision}
							size="comfortable"
							label={!reviewEnabled ? '—' : undefined}
						/>
					</ReviewCell>
					<ReviewCell
						disabled={!reviewEnabled}
						label={'Edit comment for ' + reviewLabel}
						onclick={() => onreview(entity.id)}
					>
						<span class="block max-w-40 truncate text-muted-foreground"
							>{reviews[entity.id]?.note || '—'}</span
						>
					</ReviewCell>
					<ReviewCell
						disabled={!reviewEnabled}
						label={'Review ' + reviewLabel}
						onclick={() => onreview(entity.id)}
					>
						<span class="flex items-center justify-end gap-1 font-medium"
							>{#if reviewEnabled}{reviews[entity.id]?.decision ? 'Edit' : 'Review'}<ArrowUpRight
									class="size-4"
								/>{:else}—{/if}</span
						>
					</ReviewCell>
				</Table.Row>
			{:else}
				<Table.Row
					><Table.Cell colspan={6}>
						<Empty.Root>
							<Empty.Header
								><Empty.Media variant="icon"
									>{#if loading}<LoaderCircle
											class="animate-spin motion-reduce:animate-none"
										/>{:else}<Search />{/if}</Empty.Media
								><Empty.Title>{loading ? 'Checking records…' : emptyTitle}</Empty.Title
								><Empty.Description
									>{loading
										? 'Matching suggestions will appear here as records are checked.'
										: emptyDescription}</Empty.Description
								></Empty.Header
							>
							{#if !loading}<Empty.Content
									><Button variant="outline" onclick={onreset}>Reset filters</Button></Empty.Content
								>{/if}
						</Empty.Root>
					</Table.Cell></Table.Row
				>
			{/each}
		</Table.Body>
	</Table.Root>
	{#if tableEntities.length > 20}
		<div class="flex justify-end border-t px-4 py-3">
			<Pagination.Root
				count={tableEntities.length}
				perPage={20}
				bind:page
				siblingCount={0}
				class="mx-0 w-auto"
				aria-label="Suggestions pages"
			>
				{#snippet children({ pages, currentPage })}
					<Pagination.Content>
						<Pagination.Item><Pagination.Previous /></Pagination.Item>
						{#each pages as item (item.key)}
							<Pagination.Item>
								{#if item.type === 'ellipsis'}<Pagination.Ellipsis />
								{:else}<Pagination.Link page={item} isActive={currentPage === item.value}
										>{item.value}</Pagination.Link
									>{/if}
							</Pagination.Item>
						{/each}
						<Pagination.Item><Pagination.Next /></Pagination.Item>
					</Pagination.Content>
				{/snippet}
			</Pagination.Root>
		</div>
	{/if}
</div>
