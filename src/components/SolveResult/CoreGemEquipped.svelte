<script lang="ts">
  import { type ArkGridAttr } from '../../lib/constants/enums';
  import { formatCoreType } from '../../lib/constants/localization';
  import {
    type ArkGridCore,
    type ArkGridCoreType,
    getDefaultCoreEnergy,
  } from '../../lib/models/arkGridCores';
  import { type ArkGridGem } from '../../lib/models/arkGridGems';
  import { appLocale } from '../../lib/state/locale.state.svelte';
  import ArkGridGemDetail from '../ArkGridGemDetail.svelte';

  let {
    attr,
    ctype,
    core,
    gems,
  }: {
    attr: ArkGridAttr;
    ctype: ArkGridCoreType;
    core: ArkGridCore | null;
    gems: ArkGridGem[];
  } = $props();

  let corePoint = $derived.by(() => {
    return gems.reduce((sum, gem) => {
      return sum + gem.point;
    }, 0);
  });
  let usedPower = $derived.by(() => {
    return gems.reduce((sum, gem) => {
      return sum + gem.req;
    }, 0);
  });
  let locale = $derived(appLocale.current);
  const LTitle = $derived(formatCoreType(attr, ctype, locale));
  const LPoint = $derived(
    {
      ko_kr: '포인트',
      en_us: 'Points',
      zh_cn: '点数',
    }[locale]
  );
  const LCosts = $derived(
    {
      ko_kr: '의지력',
      en_us: 'Costs',
      zh_cn: '消耗',
    }[locale]
  );
</script>

<div class="root">
  <div class="title">
    <div class="name">
      {LTitle}
    </div>
  </div>
  <div class="core-point-and-power">
    <div class="item" hidden={!core}>{LPoint} {corePoint}</div>
    <div class="item" hidden={!core}>
      {LCosts}
      {usedPower}/{getDefaultCoreEnergy(core)}
    </div>
  </div>
  <div class="gems">
    {#each gems as gem}
      <ArkGridGemDetail {gem} showDeleteButton={false}></ArkGridGemDetail>
    {/each}
  </div>
</div>

<style>
  .root {
    width: 100%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    padding: 0.9rem;
    min-height: 21rem;
    box-sizing: border-box;
    border: 1px solid var(--reference-border, var(--border));
    border-radius: 0.7rem;
    background: color-mix(
      in srgb,
      var(--reference-muted, var(--card-inner)) 52%,
      var(--reference-card, var(--card))
    );
    box-shadow: none;
  }
  .title {
    font-weight: 800;
    font-size: 0.95rem;
    align-self: center;
    text-align: center;
  }
  .gems {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    min-width: 0;
  }

  .gems :global(.gem-box) {
    width: 100%;
    min-width: 15rem;
    max-width: none;
    height: 3.6rem;
    min-height: 3.6rem;
    max-height: 3.6rem;
    box-sizing: border-box;
  }
  .gems :global(.gem) {
    row-gap: 0.15rem;
  }
  .gems :global(.gem > .gem-spec > .text) {
    line-height: 1.15;
    transform: none;
  }
  .core-point-and-power {
    width: 100%;
    font-size: 0.85rem;
    display: flex;
    flex-direction: row;
    justify-content: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    color: var(--subtle-text);
  }
  .core-point-and-power > .item {
    padding: 0.25rem 0.55rem;
    border: 1px solid var(--reference-border, var(--border));
    border-radius: 999px;
    background: var(--reference-card, var(--card));
  }
  @media (max-width: 960px) {
    .root {
      min-height: 0;
    }
  }
</style>
