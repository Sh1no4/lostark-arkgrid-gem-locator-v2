<script lang="ts">
  import ProfileEdit from './ProfileEditor.svelte';

  import { type LocalizationName } from '../../lib/constants/enums';
  import { appConfig, toggleDarkMode, toggleUI } from '../../lib/state/appConfig.state.svelte';
  import { appLocale, toggleLocale } from '../../lib/state/locale.state.svelte';

  let locale = $derived(appLocale.current);

  const LTitle: LocalizationName = {
    ko_kr: '아크 그리드 전투력 최적화',
    en_us: 'Ark Grid Combat Power Optimizer',
    zh_cn: '命运方舟护石优化器',
  };

  const LDarkMode: LocalizationName = {
    ko_kr: '다크 모드',
    en_us: 'Dark Mode',
    zh_cn: '暗黑模式',
  };

  const LLocaleName: LocalizationName = {
    ko_kr: '한국어',
    en_us: 'English',
    zh_cn: '中文',
  };

  const LToggleLocale: LocalizationName = {
    ko_kr: '언어 변경',
    en_us: 'Change language',
    zh_cn: '切换语言',
  };
</script>

<div class="app-toolbar">
  <div class="app-toolbar__brand">
    <div class="app-toolbar__name">Arkgrid</div>
    <h1 class="app-toolbar__product">{LTitle[locale]}</h1>
  </div>
  <div class="app-toolbar__controls">
    <ProfileEdit></ProfileEdit>
    <button hidden={!appConfig.current.uiConfig.debugMode} onclick={() => toggleUI('debugMode')}
      >开发者模式 {appConfig.current.uiConfig.debugMode ? '关闭' : '开启'}</button
    >
    <button
      type="button"
      onclick={toggleDarkMode}
      aria-pressed={appConfig.current.uiConfig.darkMode}
      aria-label={LDarkMode[locale]}
    >
      {LDarkMode[locale]}
      <i
        class="fa-solid"
        class:fa-toggle-on={appConfig.current.uiConfig.darkMode}
        class:fa-toggle-off={!appConfig.current.uiConfig.darkMode}
      ></i>
    </button>
    <button
      type="button"
      onclick={toggleLocale}
      aria-label={`${LToggleLocale[locale]}: ${LLocaleName[locale]}`}>{LLocaleName[locale]}</button
    >
  </div>
</div>

<style>
  .app-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    min-height: 2.75rem;
  }

  .app-toolbar__brand {
    display: flex;
    align-items: baseline;
    gap: 0.8rem;
    min-width: 0;
    font-weight: 800;
  }

  .app-toolbar__name {
    font-size: 1.2rem;
    letter-spacing: -0.03em;
  }

  .app-toolbar__product {
    margin: 0;
    min-width: 0;
    color: var(--subtle-text);
    font-size: 0.95rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    overflow-wrap: anywhere;
  }

  .app-toolbar__controls {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  .app-toolbar__controls :global(.root) {
    gap: 0.5rem;
  }

  .app-toolbar__controls :global(.root > .title) {
    display: none;
  }

  @media (max-width: 767px) {
    .app-toolbar {
      align-items: flex-start;
    }

    .app-toolbar__controls {
      justify-content: flex-start;
    }
  }
</style>
