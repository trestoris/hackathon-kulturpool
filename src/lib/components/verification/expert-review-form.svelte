<script lang="ts">
	import { Check, X } from '@lucide/svelte';
	import * as ToggleGroup from '#lib/components/ui/toggle-group/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { ReviewTarget } from '#lib/review-targets.js';
	let {
		selected,
		saving = false,
		storageReady = true,
		feedback,
		decision = $bindable(),
		note = $bindable(),
		onsave
	}: {
		selected: ReviewTarget;
		saving?: boolean;
		storageReady?: boolean;
		feedback: string;
		decision: string;
		note: string;
		onsave: () => void;
	} = $props();
</script>

<form
	id="expert-review"
	class="space-y-4 rounded-lg bg-muted/60 p-4"
	aria-labelledby="expert-review-heading"
	onsubmit={(event) => {
		event.preventDefault();
		onsave();
	}}
>
	<div class="space-y-2">
		<h3 id="expert-review-heading" class="text-lg font-semibold tracking-tight">Your review</h3>
		<p class="text-sm leading-6">
			{#if selected.context}
				Does the <span class="font-medium">{selected.context.sourceField}</span> value in this
				record refer to <span class="font-medium">{selected.name}</span>?
			{:else}
				Is this entity a relevant suggestion?
			{/if}
		</p>
	</div>
	<div class="space-y-2">
		<Label id="decision-label">Expert decision</Label>
		<ToggleGroup.Root
			type="single"
			spacing={2}
			variant="outline"
			bind:value={decision}
			disabled={saving}
			aria-labelledby="decision-label"
			class="grid w-full grid-cols-2"
		>
			<ToggleGroup.Item
				value="Relevant"
				class="h-11 w-full bg-background data-[state=on]:border-emerald-200 data-[state=on]:bg-emerald-50 data-[state=on]:text-emerald-900"
			>
				<Check />Approve match
			</ToggleGroup.Item>
			<ToggleGroup.Item
				value="Not relevant"
				class="h-11 w-full bg-background data-[state=on]:border-rose-200 data-[state=on]:bg-rose-50 data-[state=on]:text-rose-900"
			>
				<X />Reject match
			</ToggleGroup.Item>
		</ToggleGroup.Root>
	</div>
	<div class="space-y-2">
		<Label for="expert-note"
			>Your feedback <span class="font-normal text-muted-foreground">(required)</span></Label
		>
		<Textarea
			id="expert-note"
			bind:value={note}
			disabled={saving}
			placeholder="Explain your decision or suggest a correction…"
			rows={5}
			class="min-h-32 bg-background"
		/>
	</div>
	<Button
		type="submit"
		disabled={saving || !storageReady}
		aria-busy={saving}
		variant="secondary"
		class="h-auto w-full rounded-lg border-0 bg-sky-100 px-5 py-3 text-sky-900 hover:bg-sky-200 focus-visible:ring-sky-300"
	>
		{saving ? 'Saving…' : 'Save review'}
	</Button>
	{#if !storageReady}<p class="text-sm text-muted-foreground">
			Saved feedback must finish loading before you can save. If loading fails, retry in the
			feedback sidebar.
		</p>{/if}
	{#if feedback}<p role="status" class="text-sm leading-6">{feedback}</p>{/if}
</form>
