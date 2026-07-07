<script lang="ts">
  import { type ArkGridAttr } from '../lib/constants/enums';
  import { formatCoreType } from '../lib/constants/localization';
  import {
    type ArkGridCore,
    type ArkGridCoreCoeffs,
    type ArkGridCoreType,
    getDefaultCoreEnergy,
    getMaxCorePoint,
  } from '../lib/models/arkGridCores';
  import { Core } from '../lib/solver/models';
  import { appLocale } from '../lib/state/locale.state.svelte';

  interface Props {
    attr: ArkGridAttr;
    ctype: ArkGridCoreType;
    core: ArkGridCore | null;
  }
  let { attr, ctype, core = $bindable() }: Props = $props();
  const targetPoints = [20, 19, 18, 17, 14, 10, 0];
  let showGoalPointMenu = $state(false);
  let goalPointMenuElement = $state<HTMLDivElement | null>(null);

  $effect(() => {
    if (!core) {
      showGoalPointMenu = false;
      return;
    }
    const maxPoint = getMaxCorePoint(core);
    if (core.goalPoint > maxPoint) {
      core.goalPoint = maxPoint;
    }
  });

  $effect(() => {
    window.addEventListener('pointerdown', handleGoalPointDocumentPointerDown);
    return () => {
      window.removeEventListener('pointerdown', handleGoalPointDocumentPointerDown);
    };
  });

  let locale = $derived(appLocale.current);
  const LTitle = $derived(formatCoreType(attr, ctype, locale, true));
  let maxCorePoint = $derived(getMaxCorePoint(core));

  function buildCoreArray(coeffs: ArkGridCoreCoeffs): number[] {
    const arr = new Array(21).fill(0);
    arr.fill(coeffs.p10, 10, 14);
    arr.fill(coeffs.p14, 14, 17);
    arr[17] = coeffs.p17;
    arr[18] = coeffs.p18;
    arr[19] = coeffs.p19;
    arr[20] = coeffs.p20;
    return arr;
  }
  export function convertToSolverCore(): Core | null {
    if (!core) return null;
    return new Core(getDefaultCoreEnergy(core), core.goalPoint, buildCoreArray(core.coeffs));
  }

  function selectGoalPoint(targetPoint: number) {
    if (!core || targetPoint > maxCorePoint) return;
    core.goalPoint = targetPoint;
    showGoalPointMenu = false;
  }

  function handleGoalPointDocumentPointerDown(event: PointerEvent) {
    if (!showGoalPointMenu) return;
    const eventTarget = event.target;
    if (eventTarget instanceof Node && goalPointMenuElement?.contains(eventTarget)) return;
    showGoalPointMenu = false;
  }
</script>

<div class="root">
  <div class="title">{LTitle}</div>
  <div>
    {#if core}
      <div class="goal-point-menu" class:open={showGoalPointMenu} bind:this={goalPointMenuElement}>
        <button
          type="button"
          class="goal-point-value"
          aria-haspopup="listbox"
          aria-expanded={showGoalPointMenu}
          onclick={() => (showGoalPointMenu = !showGoalPointMenu)}
        >
          <span>{core.goalPoint}</span>
          <span class="goal-point-arrow" aria-hidden="true"></span>
        </button>
        {#if showGoalPointMenu}
          <div class="goal-point-options" role="listbox">
            {#each targetPoints as targetPoint}
              <button
                type="button"
                class="goal-point-option"
                class:active={targetPoint === core.goalPoint}
                disabled={targetPoint > maxCorePoint}
                role="option"
                aria-selected={targetPoint === core.goalPoint}
                onclick={() => selectGoalPoint(targetPoint)}
              >
                <span>{targetPoint}</span>
                {#if targetPoint === core.goalPoint}
                  <span class="goal-point-selected" aria-hidden="true">✓</span>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <div>-</div>
    {/if}
  </div>
</div>

<style>
  .root {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.45rem;
    background: color-mix(
      in srgb,
      var(--reference-muted, var(--card-inner)) 72%,
      var(--reference-card, var(--card))
    );
    border: 1px solid var(--reference-border, var(--border));
    border-radius: 0.6rem;
    box-shadow: none;
    padding: 0.7rem;
  }
  .root > .title {
    color: var(--text);
    font-weight: 700;
    font-size: 0.9rem;
  }

  .goal-point-menu {
    position: relative;
    width: 4rem;
  }

  .goal-point-value {
    box-sizing: border-box;
    width: 100%;
    min-height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.42rem;
    color: var(--text);
    background: color-mix(
      in srgb,
      var(--reference-card, var(--card)) 88%,
      var(--reference-muted, var(--card-inner))
    );
    border: 1px solid var(--reference-border, var(--border));
    border-radius: 999px;
    padding: 0.32rem 0.45rem;
    box-shadow: inset 0 1px 1px rgba(84, 55, 24, 0.04);
    font-size: 0.9rem;
    font-weight: 800;
    cursor: pointer;
  }

  .goal-point-value:hover,
  .goal-point-menu.open > .goal-point-value {
    border-color: color-mix(in srgb, var(--reference-accent, var(--primary)) 48%, var(--border));
    background: var(--reference-card, var(--card));
  }

  .goal-point-value:focus-visible {
    outline: none;
    border-color: var(--reference-accent, var(--primary));
    box-shadow: 0 0 0 2px
      color-mix(in srgb, var(--reference-accent, var(--primary)) 18%, transparent);
  }

  .goal-point-arrow {
    display: inline-block;
    width: 0;
    height: 0;
    flex-shrink: 0;
    border-left: 0.25rem solid transparent;
    border-right: 0.25rem solid transparent;
    border-top: 0.32rem solid var(--subtle-text);
    color: var(--subtle-text);
    margin-left: 0.04rem;
    transform: translateY(0.02rem);
  }

  .goal-point-options {
    position: absolute;
    z-index: 20;
    top: calc(100% + 0.3rem);
    right: 0;
    width: 100%;
    box-sizing: border-box;
    padding: 0.25rem;
    border: 1px solid var(--reference-border, var(--border));
    border-radius: 0.65rem;
    background: color-mix(
      in srgb,
      var(--reference-card, var(--card)) 90%,
      var(--reference-muted, var(--card-inner))
    );
    box-shadow: 0 0.55rem 1rem rgba(68, 46, 20, 0.12);
  }

  .goal-point-option {
    width: 100%;
    min-height: 1.8rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.25rem;
    padding: 0.35rem 0.42rem;
    border: none;
    border-radius: 0.45rem;
    background: transparent;
    color: var(--text);
    font-size: 0.84rem;
    font-weight: 800;
    text-align: left;
  }

  .goal-point-option:hover:not(:disabled) {
    background: var(--reference-muted, var(--card-inner));
  }

  .goal-point-option.active {
    color: var(--reference-accent, var(--primary));
    background: color-mix(
      in srgb,
      var(--reference-accent, var(--primary)) 10%,
      var(--reference-card, var(--card))
    );
  }

  .goal-point-option:disabled {
    opacity: 0.42;
    cursor: not-allowed;
  }

  .goal-point-selected {
    font-size: 0.72rem;
    font-weight: 900;
  }
</style>
