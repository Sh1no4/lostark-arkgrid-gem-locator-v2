<script lang="ts">
  import { SvelteToast } from '@zerodevx/svelte-toast';
  import { onMount } from 'svelte';

  import ArkGridAllGemListPanel from './components/ArkGridAllGemListPanel.svelte';
  import ArkGridCoreEditPanel from './components/ArkGridCoreEditPanel.svelte';
  import GemRecognitionPanel from './components/GemRecognition/Panel.svelte';
  import AppToolbar from './components/Header/AppToolbar.svelte';
  import SolvePanel from './components/SolvePanel.svelte';
  import { type LocalizationName } from './lib/constants/enums';
  import { LChaos, LOrder } from './lib/constants/localization';
  import { appConfig, enableDarkMode } from './lib/state/appConfig.state.svelte';
  import { appLocale, setLocale } from './lib/state/locale.state.svelte';
  import { type CharacterProfile, getCurrentProfile } from './lib/state/profile.state.svelte';

  let locale = $derived(appLocale.current);
  const LSkipToContent: LocalizationName = {
    ko_kr: '본문으로 건너뛰기',
    en_us: 'Skip to content',
    zh_cn: '跳到主要内容',
  };
  const LWorkflow: LocalizationName = {
    ko_kr: '작업 흐름',
    en_us: 'Workflow',
    zh_cn: '工作流',
  };
  const LStepRecognition: LocalizationName = {
    ko_kr: '1. 인식',
    en_us: '1. Capture',
    zh_cn: '1. 识别',
  };
  const LStepReview: LocalizationName = {
    ko_kr: '2. 확인',
    en_us: '2. Review',
    zh_cn: '2. 核对',
  };
  const LStepOptimize: LocalizationName = {
    ko_kr: '3. 최적화',
    en_us: '3. Optimize',
    zh_cn: '3. 优化',
  };
  const LManualInputTitle: LocalizationName = {
    ko_kr: '2. 확인 및 편집',
    en_us: '2. Review & Edit',
    zh_cn: '2. 核对与编辑',
  };
  const LNeedGems: LocalizationName = {
    ko_kr: '젬을 인식하거나 추가하세요',
    en_us: 'Capture or add astrogems',
    zh_cn: '先识别或手动添加护石',
  };
  const LReadyReview: LocalizationName = {
    ko_kr: '코어와 젬을 확인하세요',
    en_us: 'Check cores and astrogems',
    zh_cn: '核对核心和护石',
  };
  const LHasResult: LocalizationName = {
    ko_kr: '결과가 있습니다',
    en_us: 'Result ready',
    zh_cn: '已有优化结果',
  };
  const LNoResult: LocalizationName = {
    ko_kr: '아직 실행하지 않음',
    en_us: 'Not run yet',
    zh_cn: '尚未执行优化',
  };
  let currentProfile = $state<CharacterProfile>(getCurrentProfile());
  $effect(() => {
    currentProfile = getCurrentProfile();
  });

  $effect(() => {
    document.documentElement.classList.toggle('dark-mode', appConfig.current.uiConfig.darkMode);
  });

  onMount(() => {
    // data-track 이라는 attr이 달린 것만 수집
    if (import.meta.env.PROD) {
      document.addEventListener('click', (e) => {
        const el = e.target as HTMLElement | null;
        const target = el?.closest('[data-track]');
        if (!target) return; // data-track 없는 건 무시

        const label = (target as HTMLElement).dataset.track; // data-track 값
        (window as any).gtag('event', 'click', {
          event_label: label,
        });
      });
    }

    // 只在本版本首次访问时跟随系统，之后不再覆盖用户选择
    if (!localStorage.getItem('arkgrid-preferences-initialized')) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        enableDarkMode();
      }

      const lang = navigator.language.toLowerCase();
      if (lang.startsWith('ko')) {
        setLocale('ko_kr');
      } else if (lang.startsWith('zh')) {
        setLocale('zh_cn');
      } else {
        setLocale('en_us');
      }
      localStorage.setItem('arkgrid-preferences-initialized', '1');
    }
  });
  const pageTitle = $derived(
    {
      ko_kr: '아크 그리드 전투력 최적화',
      en_us: 'Ark Grid Combat Power Optimizer',
      zh_cn: '命运方舟护石优化器',
    }[appLocale.current]
  );
  const orderCount = $derived(currentProfile?.gems.orderGems.length ?? 0);
  const chaosCount = $derived(currentProfile?.gems.chaosGems.length ?? 0);
  const gemCount = $derived(orderCount + chaosCount);
  const hasSolveResult = $derived(Boolean(currentProfile?.solveInfo.after?.solveAnswer));
  const recognitionMeta = $derived(`${LOrder[locale]} ${orderCount} · ${LChaos[locale]} ${chaosCount}`);
  const reviewMeta = $derived(gemCount > 0 ? LReadyReview[locale] : LNeedGems[locale]);
  const optimizeMeta = $derived(hasSolveResult ? LHasResult[locale] : LNoResult[locale]);
</script>

<svelte:head>
  <title>{pageTitle}</title>
</svelte:head>

<a class="skip-link" href="#step-review">{LSkipToContent[locale]}</a>

<main>
  <SvelteToast options={{ reversed: true, intro: { y: 192 } }} />
  <div class="reference-page">
    <AppToolbar></AppToolbar>

    <nav class="workflow-strip" aria-label={LWorkflow[locale]}>
      <a
        class="workflow-step"
        class:complete={gemCount > 0}
        href="#step-recognition"
      >
        <span class="workflow-step__index" aria-hidden="true">1</span>
        <span class="workflow-step__copy">
          <span class="workflow-step__title">{LStepRecognition[locale]}</span>
          <span class="workflow-step__meta">{recognitionMeta}</span>
        </span>
      </a>
      <a class="workflow-step" class:complete={gemCount > 0} href="#step-review">
        <span class="workflow-step__index" aria-hidden="true">2</span>
        <span class="workflow-step__copy">
          <span class="workflow-step__title">{LStepReview[locale]}</span>
          <span class="workflow-step__meta">{reviewMeta}</span>
        </span>
      </a>
      <a
        class="workflow-step"
        class:complete={hasSolveResult}
        href="#step-optimize"
      >
        <span class="workflow-step__index" aria-hidden="true">3</span>
        <span class="workflow-step__copy">
          <span class="workflow-step__title">{LStepOptimize[locale]}</span>
          <span class="workflow-step__meta">{optimizeMeta}</span>
        </span>
      </a>
    </nav>

    <section class="reference-shell" aria-label={pageTitle}>
      <div class="reference-content">
        <aside
          id="step-recognition"
          class="reference-left-column"
          aria-label={LStepRecognition[locale]}
        >
          <GemRecognitionPanel></GemRecognitionPanel>
        </aside>

        <section
          id="step-review"
          class="manual-input-panel"
          aria-labelledby="manual-input-title"
        >
          <div class="reference-panel-title" id="manual-input-title">{LManualInputTitle[locale]}</div>
          {#if currentProfile}
            <div class="manual-input-panel__content">
              <ArkGridCoreEditPanel profile={currentProfile}></ArkGridCoreEditPanel>
              <ArkGridAllGemListPanel gems={currentProfile.gems}></ArkGridAllGemListPanel>
            </div>
          {/if}
        </section>

        {#if currentProfile}
          <section
            id="step-optimize"
            class="optimization-panel"
            aria-label={LStepOptimize[locale]}
          >
            <SolvePanel bind:profile={currentProfile}></SolvePanel>
          </section>
        {/if}
      </div>
    </section>
  </div>
</main>
<style>
  .reference-page {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    width: min(100% - 1.5rem, 112rem);
    max-width: none;
    margin: 0 auto;
    padding: 0.5rem 0 0;
  }

  .workflow-strip {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.55rem;
  }

  .workflow-step {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 0.7rem;
    min-width: 0;
    padding: 0.7rem 0.8rem;
    border: 1px solid var(--reference-border, var(--border));
    border-radius: var(--radius-md);
    background: var(--reference-card, var(--card));
    color: inherit;
    text-decoration: none;
    scroll-margin-top: 0.75rem;
    transition:
      border-color 180ms var(--ease-out),
      background-color 180ms var(--ease-out);
  }

  .workflow-step:hover {
    border-color: color-mix(in srgb, var(--reference-accent, var(--primary)) 42%, var(--border));
  }

  .workflow-step.complete {
    border-color: color-mix(in srgb, var(--reference-success) 45%, var(--reference-border, var(--border)));
  }

  .workflow-step__index {
    display: grid;
    place-items: center;
    width: 1.65rem;
    height: 1.65rem;
    flex: 0 0 1.65rem;
    border-radius: 999px;
    background: var(--reference-muted, var(--card-inner));
    font-size: 0.8rem;
    font-weight: 800;
  }

  .workflow-step.complete .workflow-step__index {
    color: white;
    background: var(--reference-success);
  }

  .workflow-step__copy {
    display: flex;
    flex-direction: column;
    gap: 0.12rem;
    min-width: 0;
  }

  .workflow-step__title {
    font-size: 0.92rem;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .workflow-step__meta {
    color: var(--subtle-text);
    font-size: 0.75rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .reference-shell {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: clamp(1rem, 1.6vw, 1.5rem);
    border: 1px solid var(--reference-border, var(--border));
    border-radius: var(--radius-lg);
    background: var(--reference-shell, var(--bg));
    box-shadow: var(--shadow-sm);
  }

  .reference-content {
    display: grid;
    grid-template-columns: minmax(15.5rem, 0.24fr) minmax(0, 1fr);
    grid-template-areas:
      'recognition manual'
      'optimization optimization';
    gap: 1rem;
    align-items: stretch;
  }

  .reference-left-column,
  .manual-input-panel,
  .optimization-panel {
    scroll-margin-top: 0.75rem;
  }

  .reference-left-column {
    grid-area: recognition;
    min-width: 0;
  }

  .manual-input-panel {
    grid-area: manual;
    min-width: 0;
    min-height: 32rem;
    padding: 1rem;
    border: 1px solid var(--reference-border, var(--border));
    border-radius: var(--radius-md);
    background: var(--reference-card, var(--card));
    box-shadow: var(--shadow-sm);
  }

  .reference-panel-title {
    margin-bottom: 0.75rem;
    font-size: 1rem;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .manual-input-panel__content {
    display: grid;
    grid-template-columns: minmax(22rem, 1.08fr) minmax(20rem, 0.92fr);
    gap: 1rem;
    align-items: stretch;
  }

  .optimization-panel {
    grid-area: optimization;
    min-width: 0;
  }

  @media (max-width: 1040px) {
    .reference-page {
      padding: 0;
    }

    .reference-shell {
      padding: 0.75rem;
      border-radius: var(--radius-md);
    }

    .reference-content {
      grid-template-columns: 1fr;
      grid-template-areas:
        'recognition'
        'manual'
        'optimization';
    }

    .manual-input-panel__content {
      grid-template-columns: 1fr;
    }

    .workflow-strip {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 767px) {
    .reference-page {
      width: 100%;
    }
  }

  :root {
    --toastContainerTop: auto;
    --toastContainerRight: auto;
    --toastContainerBottom: 8rem;
    --toastContainerLeft: calc(50vw - 8rem);
  }
</style>
