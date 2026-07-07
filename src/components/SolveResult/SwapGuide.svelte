<script lang="ts">
  import { type ArkGridAttr, ArkGridAttrs } from '../../lib/constants/enums';
  import { formatCoreType } from '../../lib/constants/localization';
  import { type ArkGridCoreType, ArkGridCoreTypes } from '../../lib/models/arkGridCores';
  import type { ArkGridGem } from '../../lib/models/arkGridGems';
  import { appLocale } from '../../lib/state/locale.state.svelte';
  import type { SolveAnswer } from '../../lib/state/profile.state.svelte';
  import ArkGridGemDetail from '../ArkGridGemDetail.svelte';

  type SwapEntry = {
    attr: ArkGridAttr;
    ctype: ArkGridCoreType;
    oldGem: ArkGridGem;
    newGem: ArkGridGem;
  };

  type Props = { solveAnswer: SolveAnswer };
  let { solveAnswer }: Props = $props();
  let locale = $derived(appLocale.current);

  const swapData = $derived.by(() => {
    const entries: SwapEntry[] = [];
    const attrs = Object.values(ArkGridAttrs);
    const coreTypes = Object.values(ArkGridCoreTypes);
    attrs.forEach((attr, attrIndex) => {
      coreTypes.forEach((ctype, coreTypeIndex) => {
        const slotGems = solveAnswer.assignedGems[attrIndex * 3 + coreTypeIndex] ?? [];
        for (const gem of slotGems) {
          if (gem.isNew && gem.replaces) {
            entries.push({ attr, ctype, oldGem: gem.replaces, newGem: gem });
          }
        }
      });
    });
    return entries;
  });

  const LTitle = $derived(
    {
      ko_kr: '교체 가이드',
      en_us: 'Swap Guide',
      zh_cn: '替换指南',
    }[locale]
  );
  const LRemove = $derived(
    {
      ko_kr: '해제',
      en_us: 'Remove',
      zh_cn: '卸下',
    }[locale]
  );
  const LEquip = $derived(
    {
      ko_kr: '장착',
      en_us: 'Equip',
      zh_cn: '装备',
    }[locale]
  );
  const LCount = $derived(
    {
      ko_kr: `${swapData.length}개`,
      en_us: `${swapData.length} items`,
      zh_cn: `共 ${swapData.length} 项`,
    }[locale]
  );
</script>

{#if swapData.length > 0}
  <div class="root">
    <section class="guide-card">
      <div class="header">
        <div class="title">{LTitle}</div>
        <div class="count">{LCount}</div>
      </div>
      <div class="list">
        {#each swapData as entry}
          <div class="entry">
            <div class="core-name">{formatCoreType(entry.attr, entry.ctype, locale)}</div>
            <div class="pair">
              <div class="side">
                <span class="label remove">{LRemove}</span>
                <ArkGridGemDetail gem={entry.oldGem} showDeleteButton={false} isReplaced={true} />
              </div>
              <span class="arrow">-&gt;</span>
              <div class="side">
                <span class="label equip">{LEquip}</span>
                <ArkGridGemDetail gem={entry.newGem} showDeleteButton={false} />
              </div>
            </div>
          </div>
        {/each}
      </div>
    </section>
  </div>
{/if}

<style>
  .root {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
    width: 99%;
    min-width: 0;
  }

  .guide-card {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    padding: 0.9rem;
    box-sizing: border-box;
    border: 1px solid var(--reference-border, var(--border));
    border-radius: 0.75rem;
    background: color-mix(
      in srgb,
      var(--reference-card, var(--card)) 82%,
      var(--reference-muted, var(--card-inner))
    );
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .title {
    font-weight: 800;
    font-size: 1rem;
  }

  .count {
    flex-shrink: 0;
    padding: 0.2rem 0.55rem;
    border: 1px solid var(--reference-border, var(--border));
    border-radius: 999px;
    color: var(--subtle-text);
    background: var(--reference-muted, var(--card-inner));
    font-size: 0.78rem;
    font-weight: 700;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    max-height: 28rem;
    overflow-y: auto;
    padding-right: 0;
    scrollbar-gutter: stable;
  }

  .entry {
    display: grid;
    grid-template-columns: minmax(7rem, 11rem) minmax(0, 1fr);
    align-items: center;
    gap: 0.55rem;
    min-height: 4.35rem;
    padding: 0.55rem;
    border: 1px solid var(--reference-border, var(--border));
    border-radius: 0.6rem;
    background: var(--reference-card, var(--card));
  }

  .core-name {
    min-width: 0;
    color: var(--subtle-text);
    font-size: 0.8rem;
    font-weight: 800;
    line-height: 1.25;
  }

  .pair {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.45rem;
    min-width: 0;
  }

  .side {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.3rem;
    flex: 1;
    min-width: 0;
  }

  .label {
    flex-shrink: 0;
    min-width: 1.5rem;
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    opacity: 0.75;
  }

  .label.remove {
    color: #c0392b;
  }

  .label.equip {
    color: #27ae60;
  }

  .arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    color: var(--subtle-text);
    font-size: 1.2rem;
    flex-shrink: 0;
  }

  .side :global(.gem-box) {
    width: 100%;
    min-width: 0;
    max-width: none;
    height: 3.45rem;
    min-height: 3.45rem;
    max-height: 3.45rem;
    padding: 0.45rem;
    box-sizing: border-box;
  }

  .side :global(.gem) {
    column-gap: 0.55rem;
  }

  .side :global(.gem > .gem-spec) {
    gap: 0.25rem;
  }

  .side :global(.gem > .gem-spec > .text) {
    line-height: 1.18;
    transform: none;
  }

  .side :global(.swap-badge) {
    top: 0.08rem;
    right: 0.08rem;
  }

  @media (max-width: 900px) {
    .entry {
      grid-template-columns: 1fr;
      align-items: stretch;
    }

    .pair {
      flex-wrap: wrap;
    }

    .root {
      width: 100%;
    }
  }
</style>
