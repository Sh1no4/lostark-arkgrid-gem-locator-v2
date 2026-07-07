<script lang="ts">
  import { type ArkGridAttr, ArkGridAttrs } from '../../lib/constants/enums';
  import { LChaos, LOrder } from '../../lib/constants/localization';
  import {
    type ArkGridCore,
    type ArkGridCoreType,
    ArkGridCoreTypes,
  } from '../../lib/models/arkGridCores';
  import { appLocale } from '../../lib/state/locale.state.svelte';
  import type { SolveAnswer } from '../../lib/state/profile.state.svelte';
  import CoreGemEquipped from './CoreGemEquipped.svelte';

  type Props = {
    answerCores: Record<ArkGridAttr, Record<ArkGridCoreType, ArkGridCore | null>>;
    solveAnswer: SolveAnswer;
  };
  let { answerCores, solveAnswer }: Props = $props();
  let locale = $derived(appLocale.current);
  const attrLabels = { 질서: LOrder, 혼돈: LChaos };
</script>

<div class="root">
  {#each Object.values(ArkGridAttrs) as attr, i}
    <section class="attr-section">
      <div class="attr-title">{attrLabels[attr][locale]}</div>
      <div class="core-grid">
        {#each Object.values(ArkGridCoreTypes) as ctype, j}
          <CoreGemEquipped
            {attr}
            {ctype}
            core={answerCores[attr][ctype]}
            gems={solveAnswer.assignedGems[i * 3 + j]}
          ></CoreGemEquipped>
        {/each}
      </div>
    </section>
  {/each}
</div>

<style>
  .root {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
    align-items: stretch;
    width: 99%;
  }

  .attr-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
    padding: 0.9rem;
    border: 1px solid var(--reference-border, var(--border));
    border-radius: 0.8rem;
    background: var(--reference-card, var(--card));
  }

  .attr-title {
    padding-bottom: 0.6rem;
    border-bottom: 1px solid var(--reference-border, var(--border));
    font-size: 1rem;
    font-weight: 800;
    text-align: center;
  }

  .core-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(15rem, 1fr));
    gap: 0.75rem;
  }

  @media (max-width: 640px) {
    .core-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
