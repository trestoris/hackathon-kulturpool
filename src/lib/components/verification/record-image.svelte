<script lang="ts">
	import { ImageOff, LoaderCircle } from '@lucide/svelte';
	import { isRecordImage, type RecordImage } from '#lib/review-targets.js';
	let { image, title }: { image: RecordImage; title: string } = $props();
	let loaded = $state(false);
	let failed = $state(false);
	const media = $derived(isRecordImage(image) ? image : null);
</script>

{#if media}
	<figure class="min-w-0 space-y-2">
		<div
			class="relative flex h-44 items-center justify-center overflow-hidden rounded-lg bg-muted/50 sm:h-48"
		>
			{#if failed}
				<p class="flex items-center gap-2 text-xs text-muted-foreground" role="status">
					<ImageOff class="size-4" /> Image unavailable
				</p>
			{:else}
				{#if !loaded}
					<LoaderCircle
						class="absolute size-4 animate-spin text-muted-foreground motion-reduce:animate-none"
						aria-label="Loading record image"
					/>
				{/if}
				<a
					href={media.url}
					target="_blank"
					rel="noreferrer"
					class="relative block h-full w-full rounded-lg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
					aria-label={`Open full image: ${title}`}
				>
					<img
						src={media.url}
						alt={title}
						loading="lazy"
						decoding="async"
						referrerpolicy="no-referrer"
						class="h-full w-full object-contain"
						class:opacity-0={!loaded}
						onload={() => (loaded = true)}
						onerror={() => (failed = true)}
					/>
				</a>
			{/if}
		</div>
		{#if media.attribution || media.rights}
			<figcaption
				class="space-y-1 text-xs leading-5 [overflow-wrap:anywhere] text-muted-foreground"
			>
				{#if media.attribution}<p>{media.attribution}</p>{/if}
				{#if media.rightsUrl}
					<a
						href={media.rightsUrl}
						target="_blank"
						rel="noreferrer"
						class="underline underline-offset-4 hover:text-foreground">{media.rights}</a
					>
				{:else if media.rights}<p>{media.rights}</p>{/if}
			</figcaption>
		{/if}
	</figure>
{/if}
