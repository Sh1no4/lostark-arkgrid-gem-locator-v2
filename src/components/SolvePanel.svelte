<script lang="ts">
  import { onDestroy } from 'svelte';

  import { type AppLocale, ArkGridAttrs } from '../lib/constants/enums';
  import { ArkGridCoreTypes } from '../lib/models/arkGridCores';
  import { type ArkGridGem, gemFingerprint } from '../lib/models/arkGridGems';
  import { SolverController } from '../lib/solver/solverController';
  import type { SolverProgress, SolverProgressStage } from '../lib/solver/types';
  import { appLocale } from '../lib/state/locale.state.svelte';
  import {
    type CharacterProfile,
    type SolveAfter,
    updateSolveAfter,
  } from '../lib/state/profile.state.svelte';
  import SolveCoreEdit from './SolveCoreEdit.svelte';
  import SolveResult from './SolveResult/SolveResult.svelte';

  type Props = {
    profile: CharacterProfile;
  };
  type ProgressLogEntry = {
    header: string;
    text: string;
  };
  let { profile = $bindable() }: Props = $props();

  let locale = $derived(appLocale.current);
  const LTitle = $derived(
    {
      ko_kr: '최적화 설정',
      en_us: 'Optimization Settings',
      zh_cn: '优化设置',
    }[locale]
  );
  const LSubtitle = $derived(
    {
      ko_kr: '코어별 최소 포인트 설정',
      en_us: 'Minimum Core Points',
      zh_cn: '核心最小点数设置',
    }[locale]
  );
  const LRunSolve = $derived(
    {
      ko_kr: '최적화 실행',
      en_us: 'Run Optimization',
      zh_cn: '执行优化',
    }[locale]
  );
  const LOptimizeHint = $derived(
    {
      ko_kr: '이전 결과가 저장됩니다',
      en_us: 'Previous results are saved',
      zh_cn: '会保存上一次优化结果',
    }[locale]
  );
  const LOptimizeTooltip = $derived(
    {
      ko_kr:
        '최적화 결과와 젬 목록의 스냅샷이 저장됩니다. 동점일 경우, 이전 배치에서 젬 이동이 가장 적은 배치를 우선합니다. 이전 스냅샷에 없는 새 젬은 결과에서 금색 테두리로 강조 표시됩니다.',
      en_us:
        'Your optimization result and astrogem list are snapshotted. On a tie, the optimizer prefers the assignment that moves the fewest gems from your previous result. Newly added astrogems not present in the previous snapshot are highlighted with a gold border in the results.',
      zh_cn:
        '会保存优化结果和护石列表快照。分数相同时，优化器会优先选择相对上一次结果移动护石最少的方案。上一次快照中不存在的新护石会在结果中以金色边框标记。',
    }[locale]
  );
  const LRunning = $derived(
    {
      ko_kr: '계산 중...',
      en_us: 'Optimizing...',
      zh_cn: '正在优化...',
    }[locale]
  );
  const LProgressTitle = $derived(
    {
      ko_kr: '진행 상황',
      en_us: 'Optimization Progress',
      zh_cn: '优化进度',
    }[locale]
  );
  const LFailed = $derived(
    {
      ko_kr: '목표 포인트를 조절해보세요.',
      en_us: 'Please adjust the minimum core points.',
      zh_cn: '请调整最小核心点数。',
    }[locale]
  );
  const LOrderFailed = $derived(
    {
      ko_kr: '질서 배치 실패',
      en_us: 'Order cores optimization failed',
      zh_cn: '秩序核心优化失败',
    }[locale]
  );
  const LChaosFailed = $derived(
    {
      ko_kr: '혼돈 배치 실패',
      en_us: 'Chaos cores optimization failed',
      zh_cn: '混沌核心优化失败',
    }[locale]
  );

  let solveAfter = $state<SolveAfter | undefined>(profile.solveInfo.after);
  let activeProfileName = $state(profile.characterName);

  let failedSign = $derived.by(() => {
    if (!solveAfter) return { order: false, chaos: false };
    const answerCores = solveAfter.answerCores;
    const allOrderCoresNull =
      !answerCores || Object.values(answerCores['질서']).every((v) => v == null);
    const allChaosCoresNull =
      !answerCores || Object.values(answerCores['혼돈']).every((v) => v == null);
    return {
      order: solveAfter.solveAnswer?.gemSetPackTuple.gsp1 === null && !allOrderCoresNull,
      chaos: solveAfter.solveAnswer?.gemSetPackTuple.gsp2 === null && !allChaosCoresNull,
    };
  });
  const solverController = new SolverController();
  let isSolving = $state(false);
  let solveProgress = $state<SolverProgress | null>(null);
  let progressLog = $state<ProgressLogEntry[]>([]);

  $effect(() => {
    if (activeProfileName === profile.characterName) {
      solveAfter = profile.solveInfo.after;
      return;
    }

    activeProfileName = profile.characterName;
    solveAfter = profile.solveInfo.after;
    solveProgress = null;
    progressLog = [];
  });

  solverController.onProgress = (progress: SolverProgress) => {
    solveProgress = progress;
    const header = getProgressLogKey(progress);
    const text = `${progress.stagePercent}% ${getProgressLabel(progress)}`;
    const index = progressLog.findIndex((entry) => entry.header === header);

    // progress가 새로 온 거면 하단에 추가, 이미 있는 거면 텍스트만 바꿔치기
    if (index === -1) {
      progressLog = [...progressLog, { header, text }];
      return;
    }

    if (progressLog[index].text === text) {
      return;
    }

    progressLog = progressLog.map((entry, entryIndex) =>
      entryIndex === index ? { ...entry, text } : entry
    );
  };

  onDestroy(() => {
    solverController.destroy();
  });

  function buildAssignedGems(
    assignedGemIndexes: number[][],
    previousPerSlot: ArkGridGem[][] | undefined
  ): ArkGridGem[][] {
    const orderGems = profile.gems.orderGems;
    const chaosGems = profile.gems.chaosGems;
    const gemPools = [orderGems, orderGems, orderGems, chaosGems, chaosGems, chaosGems];

    return assignedGemIndexes.map((indexes, coreIndex) => {
      const newGems = indexes.map((gemIndex) => gemPools[coreIndex][gemIndex]);
      const oldGems: ArkGridGem[] = previousPerSlot?.[coreIndex] ?? [];

      if (!previousPerSlot) {
        return newGems.map(
          (gem) =>
            JSON.parse(JSON.stringify({ ...gem, assign: coreIndex, isNew: false })) as ArkGridGem
        );
      }

      const oldCounts = new Map<string, number>();
      for (const gem of oldGems) {
        const fingerprint = gemFingerprint(gem);
        oldCounts.set(fingerprint, (oldCounts.get(fingerprint) ?? 0) + 1);
      }

      const newCounts = new Map<string, number>();
      for (const gem of newGems) {
        const fingerprint = gemFingerprint(gem);
        newCounts.set(fingerprint, (newCounts.get(fingerprint) ?? 0) + 1);
      }

      const remainingOldCounts = new Map(oldCounts);
      for (const [fingerprint, count] of newCounts) {
        const oldCount = remainingOldCounts.get(fingerprint) ?? 0;
        if (oldCount <= count) remainingOldCounts.delete(fingerprint);
        else remainingOldCounts.set(fingerprint, oldCount - count);
      }

      const droppedGems: ArkGridGem[] = [];
      for (const gem of oldGems) {
        const fingerprint = gemFingerprint(gem);
        const count = remainingOldCounts.get(fingerprint) ?? 0;
        if (count > 0) {
          droppedGems.push(gem);
          remainingOldCounts.set(fingerprint, count - 1);
        }
      }

      let droppedGemIndex = 0;
      const oldCountsForNew = new Map(oldCounts);
      return newGems.map((gem) => {
        const fingerprint = gemFingerprint(gem);
        const oldCount = oldCountsForNew.get(fingerprint) ?? 0;
        if (oldCount > 0) {
          oldCountsForNew.set(fingerprint, oldCount - 1);
          return JSON.parse(
            JSON.stringify({ ...gem, assign: coreIndex, isNew: false })
          ) as ArkGridGem;
        }

        const replaces: ArkGridGem | undefined = droppedGems[droppedGemIndex++];
        return JSON.parse(
          JSON.stringify({ ...gem, assign: coreIndex, isNew: true, replaces })
        ) as ArkGridGem;
      });
    });
  }

  function getProgressLabel(progress: SolverProgress | null) {
    if (!progress) {
      return '';
    }

    const LProgressStage: Record<AppLocale, Record<SolverProgressStage, string>> = {
      ko_kr: {
        preparing: '입력 정리 중',
        searching_order_packs: '질서 최적 조합 탐색 중',
        searching_chaos_packs: '혼돈 최적 조합 탐색 중',
        combining_results: '두 조합을 모두 고려하여 최적해 탐색 중',
        simulating_launcher_gems: '젬 추가 시뮬레이션 중',
        finalizing: '결과 정리 중',
      },
      en_us: {
        preparing: 'Preparing inputs',
        searching_order_packs: 'Searching for Order combinations',
        searching_chaos_packs: 'Searching for Chaos combinations',
        combining_results: 'Merging both combinations',
        simulating_launcher_gems: 'Simulating Next Astrogem Preview',
        finalizing: 'Finalizing result',
      },
      zh_cn: {
        preparing: '准备输入中',
        searching_order_packs: '搜索秩序最佳组合中',
        searching_chaos_packs: '搜索混沌最佳组合中',
        combining_results: '综合两个组合搜索最佳解中',
        simulating_launcher_gems: '追加宝石模拟中',
        finalizing: '整理结果中',
      },
    };
    const baseLabel = LProgressStage[locale][progress.stage];

    if (progress.stage !== 'simulating_launcher_gems' || !progress.total || !progress.current) {
      return baseLabel;
    }

    const attrLabel =
      {
        ko_kr: {
          질서: '질서',
          혼돈: '혼돈',
        },
        en_us: {
          질서: 'Order',
          혼돈: 'Chaos',
        },
        zh_cn: {
          질서: '秩序',
          혼돈: '混沌',
        },
      }[locale]?.[progress.attr ?? '질서'] || '';

    return `${baseLabel} (${attrLabel} ${progress.current}/${progress.total})`;
  }

  function getProgressLogKey(progress: SolverProgress | null) {
    if (!progress) {
      return '';
    }

    if (progress.stage !== 'simulating_launcher_gems') {
      return progress.stage;
    }

    return `${progress.stage}:${progress.attr ?? ''}`;
  }

  async function runSolve() {
    if (isSolving) return;

    isSolving = true;
    progressLog = [];
    solveProgress = {
      stage: 'preparing',
      totalPercent: 0,
      stagePercent: 0,
    };

    try {
      const previousAssignedGems = profile.solveInfo.after?.solveAnswer?.assignedGems;
      const result = await solverController.runSolve(profile);
      const assignedGems = buildAssignedGems(result.assignedGemIndexes, previousAssignedGems);

      let swapIndex = 1;
      for (const slotGems of assignedGems) {
        for (const gem of slotGems) {
          if (gem.isNew && gem.replaces) gem.swapIndex = swapIndex++;
        }
      }

      const nextSolveAfter: SolveAfter = {
        solveAnswer: {
          assignedGems,
          gemSetPackTuple: result.gemSetPackTuple,
        },
        scoreSet: result.scoreSet,
        answerCores: JSON.parse(JSON.stringify(profile.cores)),
        additionalGemResult: result.additionalGemResult,
        needLauncherGem: result.needLauncherGem,
      };
      updateSolveAfter(nextSolveAfter);
      solveAfter = nextSolveAfter;
    } catch (error) {
      console.error(error);
    } finally {
      isSolving = false;
      if (solveProgress) {
        solverController.onProgress?.({
          ...solveProgress,
          stage: 'finalizing',
          totalPercent: 100,
          stagePercent: 100,
        });
      }
    }
  }
</script>

<div class="panel">
  <div class="title">{LTitle}</div>
  <div class="container">
    <div class="core-solve-goal-edit">
      <div class="title">{LSubtitle}</div>
      <div class="container">
        {#each Object.values(ArkGridAttrs) as attr}
          {#each Object.values(ArkGridCoreTypes) as ctype}
            <SolveCoreEdit {attr} {ctype} bind:core={profile.cores[attr][ctype]}></SolveCoreEdit>
          {/each}
        {/each}
      </div>
    </div>
    {#if failedSign.order || failedSign.chaos}
      <div class="failed-sign">
        {#if failedSign.order}
          <div class="big">⚠️ {LOrderFailed} ⚠️</div>
        {/if}
        {#if failedSign.chaos}
          <div class="big">⚠️ {LChaosFailed} ⚠️</div>
        {/if}
        <div class="small">{LFailed}</div>
      </div>
    {/if}
    <button class="solve-button" onclick={runSolve} disabled={isSolving} data-track="run-solve"
      >{isSolving ? LRunning : LRunSolve}</button
    >
    <div class="optimize-hint">
      {LOptimizeHint}
      <span class="tooltip">
        <i class="fa-solid fa-circle-info info-icon"></i>
        <span class="tooltip-text">{LOptimizeTooltip}</span>
      </span>
    </div>
    {#if solveProgress || progressLog.length > 0}
      <div class="solve-progress">
        <div class="title">{LProgressTitle}</div>
        {#if solveProgress}
          <div class="progress-label">
            <span>{getProgressLabel(solveProgress)}</span>
            <span>{solveProgress.stagePercent}%</span>
          </div>
          <div
            class="progress-bar"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={solveProgress.totalPercent}
          >
            <div class="fill" style={`width: ${solveProgress.totalPercent}%`}></div>
          </div>
        {/if}
        <div class="progress-log">
          {#each progressLog as entry}
            <div class="progress-log-entry">{entry.text}</div>
          {/each}
        </div>
      </div>
    {/if}
    {#if solveAfter}
      <SolveResult {solveAfter}></SolveResult>
    {/if}
  </div>
</div>

<style>
  .panel {
    width: 100%;
    max-width: none;
    min-height: 13.5rem;
    box-sizing: border-box;
    padding: 1.4rem;
    border-color: var(--reference-border, var(--border));
    border-radius: 0.8rem;
    background: var(--reference-card, var(--card));
    box-shadow: 0 2px 4px rgba(84, 55, 24, 0.04);
    overflow: visible;
  }

  .panel > .title {
    align-self: flex-start;
    font-size: 1rem;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .solve-button {
    width: min(18rem, 100%);
    min-height: 3.4rem;
    align-self: center;
    color: white;
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--reference-accent, var(--primary)) 92%, white),
      var(--reference-accent, var(--primary))
    );
    border-color: color-mix(in srgb, var(--reference-accent, var(--primary)) 82%, black);
    border-radius: 0.55rem;
    font-size: 1.15rem;
    font-weight: 800;
    letter-spacing: 0.02em;
    box-shadow: 0 2px 6px rgba(84, 55, 24, 0.12);
  }

  .solve-button:hover {
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--reference-accent-hover, var(--primary)) 92%, white),
      var(--reference-accent-hover, var(--primary))
    );
  }

  .optimize-hint {
    font-size: 0.85rem;
    color: var(--subtle-text);
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
  .tooltip {
    position: relative;
    display: inline-flex;
    align-items: center;
  }
  .info-icon {
    cursor: help;
    opacity: 0.75;
  }
  .tooltip-text {
    visibility: hidden;
    opacity: 0;
    width: min(28rem, 80vw);
    background: var(--reference-card, var(--card));
    color: var(--text);
    border: 1px solid var(--reference-border, var(--border));
    border-radius: 0.6rem;
    padding: 0.75rem;
    position: absolute;
    z-index: 10;
    bottom: 140%;
    left: 50%;
    transform: translateX(-50%);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    line-height: 1.4;
    transition:
      opacity 120ms ease-out,
      visibility 120ms ease-out;
  }
  .tooltip:hover .tooltip-text,
  .tooltip:focus-within .tooltip-text {
    visibility: visible;
    opacity: 1;
  }
  .solve-progress {
    width: 100%;
    background: var(--reference-muted, var(--card-inner));
    border: 1px solid var(--reference-border, var(--border));
    border-radius: 0.65rem;
    box-shadow: none;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .solve-progress > .title {
    font-size: 1rem;
    font-weight: 600;
  }
  .progress-label {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.95rem;
  }
  .progress-bar {
    width: 100%;
    height: 0.75rem;
    border-radius: 999px;
    background: color-mix(
      in srgb,
      var(--reference-muted, var(--card-inner)) 68%,
      var(--reference-border, var(--border))
    );
    overflow: hidden;
  }
  .progress-bar > .fill {
    height: 100%;
    background: linear-gradient(
      90deg,
      var(--reference-accent, var(--primary)),
      var(--reference-accent-hover, var(--primary))
    );
    transition: width 160ms ease-out;
  }
  .progress-log {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    max-height: 10rem;
    overflow: auto;
    padding-top: 0.25rem;
    border-top: 1px solid var(--reference-border, var(--border));
  }
  .progress-log-entry {
    font-size: 0.9rem;
    color: var(--subtle-text);
    line-height: 1.3;
  }

  .panel > .container {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.9rem;
  }

  .core-solve-goal-edit {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    padding: 0.25rem 0 0.4rem;
  }
  .core-solve-goal-edit > .title {
    color: var(--subtle-text);
    font-size: 0.9rem;
    font-weight: 700;
    text-align: center;
  }
  .core-solve-goal-edit > .container {
    display: grid;
    grid-template-columns: repeat(6, minmax(6.25rem, 1fr));
    gap: 0.65rem;
  }
  .failed-sign {
    background: color-mix(
      in srgb,
      var(--reference-warning) 10%,
      var(--reference-card, var(--card))
    );
    border: 1px solid
      color-mix(in srgb, var(--reference-warning) 38%, var(--reference-border, var(--border)));
    border-radius: 0.65rem;
    box-shadow: none;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
  }
  .failed-sign > .big {
    font-weight: 500;
    font-size: 1.2rem;
  }
  .failed-sign > .small {
    font-size: 1rem;
  }

  .panel :global(.root) {
    box-shadow: none;
    border-color: var(--reference-border, var(--border));
    border-radius: 0.6rem;
    background: color-mix(
      in srgb,
      var(--reference-muted, var(--card-inner)) 72%,
      var(--reference-card, var(--card))
    );
    padding: 0.7rem;
  }

  .panel :global(.root > .title) {
    font-size: 0.9rem;
    font-weight: 700;
  }

  .panel :global(select) {
    border-radius: 999px;
    color: var(--text);
    background: var(--reference-card, var(--card));
    border: 1px solid var(--reference-border, var(--border));
    box-shadow: inset 0 1px 1px rgba(84, 55, 24, 0.04);
  }

  @media (max-width: 960px) {
    .core-solve-goal-edit > .container {
      grid-template-columns: repeat(3, minmax(6.25rem, 1fr));
    }
  }

  @media (max-width: 640px) {
    .core-solve-goal-edit > .container {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
