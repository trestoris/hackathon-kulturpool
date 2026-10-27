<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Table from '#lib/components/ui/table/index.js';
	import { Button } from '#lib/components/ui/button/index.js';

	let {
		label,
		onclick,
		children,
		disabled = false
	}: { label: string; onclick: () => void; children: Snippet; disabled?: boolean } = $props();
</script>

<Table.Cell class="relative p-0">
	{#if !disabled}
		<Button
			variant="ghost"
			class="absolute inset-0 size-full cursor-pointer rounded-none hover:bg-transparent focus-visible:z-10 focus-visible:ring-inset dark:hover:bg-transparent"
			aria-label={label}
			aria-haspopup="dialog"
			{onclick}
		/>
	{/if}
	<div class="pointer-events-none relative px-4 py-5">{@render children()}</div>
</Table.Cell>
