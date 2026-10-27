<script lang="ts">
	import { Search, X, ArrowRight, LoaderCircle } from '@lucide/svelte';
	import * as InputGroup from '#lib/components/ui/input-group/index.js';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	let {
		query = $bindable(),
		submitted = false,
		loading = false,
		onsearch,
		onquerychange
	}: {
		query: string;
		submitted?: boolean;
		loading?: boolean;
		onsearch: () => void;
		onquerychange: () => void;
	} = $props();
	function search(event: SubmitEvent) {
		event.preventDefault();
		if (query.trim() && !loading) onsearch();
	}
</script>

<header
	class="search-hero relative isolate overflow-hidden bg-neutral-800 text-white"
	data-searching={submitted}
>
	<img
		src="/images/wien-museum.avif"
		alt=""
		class="absolute inset-0 -z-20 size-full object-cover object-top"
	/>
	<div class="absolute inset-0 -z-10 bg-black/40"></div>
	<nav class="flex items-center justify-between px-6 py-6 sm:px-8" aria-label="Main navigation">
		<a href="/" class="text-xl font-semibold tracking-tight">Veryfake</a>
		<Sidebar.Trigger
			class="hover:bg-white/15 hover:text-white"
			aria-label="Toggle saved feedback"
		/>
	</nav>
	<div
		class="absolute top-1/2 left-1/2 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 space-y-6 px-6 text-center"
	>
		<h1 class="text-3xl font-semibold tracking-tight">Verify the search suggestions</h1>
		<form onsubmit={search} role="search">
			<!-- A disabled submit button must not fade the editable search field. -->
			<InputGroup.Root
				class="h-12 bg-background text-foreground has-disabled:bg-background has-disabled:opacity-100 dark:bg-background dark:has-disabled:bg-background"
			>
				<InputGroup.Input
					aria-label="Search in Kulturpool"
					placeholder="Search in Kulturpool"
					bind:value={query}
					oninput={onquerychange}
				/>
				<InputGroup.Addon><Search /></InputGroup.Addon>
				<InputGroup.Addon align="inline-end">
					{#if query}<InputGroup.Button
							size="icon-sm"
							aria-label="Clear search"
							onclick={() => {
								query = '';
								onquerychange();
							}}><X /></InputGroup.Button
						>{/if}
					<InputGroup.Button
						type="submit"
						variant="default"
						size="icon-sm"
						aria-label="Search"
						disabled={loading || !query.trim()}
						>{#if loading}<LoaderCircle
								class="animate-spin motion-reduce:animate-none"
							/>{:else}<ArrowRight />{/if}</InputGroup.Button
					>
				</InputGroup.Addon>
			</InputGroup.Root>
		</form>
	</div>
</header>

<style>
	.search-hero {
		height: 100dvh;
		min-height: 20rem;
		transition: height 520ms cubic-bezier(0.65, 0, 0.35, 1);
	}
	.search-hero[data-searching='true'] {
		height: 20rem;
	}
	@media (prefers-reduced-motion: reduce) {
		.search-hero {
			transition: none;
		}
	}
</style>
