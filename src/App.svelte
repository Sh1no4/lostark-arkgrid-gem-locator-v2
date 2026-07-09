<script lang="ts">
  import { SvelteToast } from '@zerodevx/svelte-toast';
  import { onMount } from 'svelte';

  import ArkGridAllGemListPanel from './components/ArkGridAllGemListPanel.svelte';
  import ArkGridCoreEditPanel from './components/ArkGridCoreEditPanel.svelte';
  import GemRecognitionPanel from './components/GemRecognition/Panel.svelte';
  import AppToolbar from './components/Header/AppToolbar.svelte';
  import SolvePanel from './components/SolvePanel.svelte';
  import { type LocalizationName } from './lib/constants/enums';
  import { appConfig, enableDarkMode } from './lib/state/appConfig.state.svelte';
  import { appLocale, setLocale } from './lib/state/locale.state.svelte';
  import { type CharacterProfile, getCurrentProfile } from './lib/state/profile.state.svelte';

  let locale = $derived(appLocale.current);
  const LTitle: LocalizationName = {
    ko_kr: '아크 그리드 전투력 최적화',
    en_us: 'Ark Grid Combat Power Optimizer',
    zh_cn: '命运方舟护石优化器',
  };
  const LSubtitle: LocalizationName = {
    ko_kr: '젬 가공 시뮬레이터 - 아크 그리드',
    en_us: 'Astrogem processing simulator - Ark Grid',
    zh_cn: '护石加工模拟器 - 方舟棋盘',
  };
  const LManualInputTitle: LocalizationName = {
    ko_kr: '수동 입력',
    en_us: 'Manual Input',
    zh_cn: '手动输入',
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

    // 다크 모드
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      enableDarkMode();
    }

    // 언어 감지
    const lang = navigator.language.toLowerCase(); // 예: 'ko-KR' 또는 'en-US'
    if (lang.startsWith('ko')) {
      setLocale('ko_kr');
    } else if (lang.startsWith('zh')) {
      setLocale('zh_cn');
    } else {
      setLocale('en_us');
    }
  });
  const pageTitle = $derived(
    {
      ko_kr: '아크 그리드 전투력 최적화',
      en_us: 'Ark Grid Combat Power Optimizer',
      zh_cn: '命运方舟护石优化器',
    }[appLocale.current]
  );
</script>

<svelte:head>
  <title>{pageTitle}</title>
</svelte:head>

<main>
  <SvelteToast options={{ reversed: true, intro: { y: 192 } }} />
  <div class="reference-page">
    <AppToolbar></AppToolbar>

    <section class="reference-shell" aria-labelledby="workflow-title">
      <div class="reference-title-row">
        <div class="reference-title-row__icon" aria-hidden="true">✦</div>
        <h1 id="workflow-title">{LTitle[locale]}</h1>
      </div>

      <div class="reference-content">
        <aside class="reference-left-column" aria-label={LSubtitle[locale]}>
          <GemRecognitionPanel></GemRecognitionPanel>
        </aside>

        <section class="manual-input-panel" aria-labelledby="manual-input-title">
          <div class="reference-panel-title" id="manual-input-title">{LManualInputTitle[locale]}</div>
          {#if currentProfile}
            <div class="manual-input-panel__content">
              <ArkGridCoreEditPanel profile={currentProfile}></ArkGridCoreEditPanel>
              <ArkGridAllGemListPanel gems={currentProfile.gems}></ArkGridAllGemListPanel>
            </div>
          {/if}
        </section>

        {#if currentProfile}
          <section class="optimization-panel" aria-label="Optimization">
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

  .reference-shell {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    min-height: calc(100vh - 4rem);
    padding: clamp(1rem, 1.6vw, 1.5rem);
    border: 1px solid var(--reference-border, var(--border));
    border-radius: 0.95rem;
    background: var(--reference-shell, var(--bg));
    box-shadow: 0 1px 2px rgba(84, 55, 24, 0.08);
  }

  .reference-title-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.85rem;
    text-align: center;
  }

  .reference-title-row__icon {
    display: grid;
    place-items: center;
    width: 2.7rem;
    height: 2.7rem;
    border-radius: 50%;
    color: white;
    background: radial-gradient(circle at 35% 35%, #7557ff 0%, #3f247f 62%, #c79643 65%);
    border: 2px solid #d9b76f;
    font-size: 1.1rem;
    box-shadow: 0 2px 3px rgba(84, 55, 24, 0.18);
  }

  .reference-title-row h1 {
    margin: 0;
    font-weight: 850;
    font-size: clamp(1.65rem, 3vw, 2rem);
    letter-spacing: -0.035em;
    word-break: keep-all;
    overflow-wrap: break-word;
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
    border-radius: 0.75rem;
    background: var(--reference-card, var(--card));
    box-shadow: 0 2px 4px rgba(84, 55, 24, 0.04);
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
      border-radius: 0.75rem;
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
  }

  @media (max-width: 767px) {
    .reference-page {
      width: 100%;
    }

    .reference-title-row {
      justify-content: flex-start;
      text-align: left;
    }
  }

  :root {
    --toastContainerTop: auto;
    --toastContainerRight: auto;
    --toastContainerBottom: 8rem;
    --toastContainerLeft: calc(50vw - 8rem);
  }
</style>
