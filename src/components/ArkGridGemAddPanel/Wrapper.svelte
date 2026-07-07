<script lang="ts">
  import { toast } from '@zerodevx/svelte-toast';

  import type { AppLocale, ArkGridAttr, LocalizationName } from '../../lib/constants/enums';
  import { LCancel, LConfirm } from '../../lib/constants/localization';
  import type { ArkGridGemName, ArkGridGemOption } from '../../lib/models/arkGridGems';
  import { appConfig, updateUI } from '../../lib/state/appConfig.state.svelte';
  import { appLocale } from '../../lib/state/locale.state.svelte';
  import { addGem } from '../../lib/state/profile.state.svelte';
  import DropdownStyle from './DropdownStyle.svelte';
  import RadioStyle from './RadioStyle.svelte';

  type Props = {
    gemAttr: ArkGridAttr;
  };

  export type GemInput = {
    name: ArkGridGemName;
    willPower: number;
    corePoint: number;
    optionA: ArkGridGemOption;
    optionB: ArkGridGemOption;
  };

  let { gemAttr }: Props = $props();

  let locale: AppLocale = $derived(appLocale.current);
  let isOpen = $state(false);
  let gemInput = $state<GemInput>({
    name: '질서의 젬 : 안정',
    willPower: 3,
    corePoint: 5,
    optionA: {
      optionType: '공격력',
      value: 1,
    },
    optionB: {
      optionType: '추가 피해',
      value: 1,
    },
  });

  const LButtonTitle: LocalizationName = {
    ko_kr: '젬 추가',
    en_us: 'Add',
    zh_cn: '添加',
  };
  const LGemAddResult: LocalizationName = {
    ko_kr: '젬 추가 완료',
    en_us: 'Astrogem Added',
    zh_cn: '护石已添加',
  };
  const LStyleTitle: LocalizationName = {
    ko_kr: '입력 방식',
    en_us: 'Input Style',
    zh_cn: '输入方式',
  };
  const LDropdownStyle: LocalizationName = {
    ko_kr: '기본',
    en_us: 'Classic',
    zh_cn: '经典',
  };
  const LRadioStyle: LocalizationName = {
    ko_kr: '새 방식',
    en_us: 'New',
    zh_cn: '新版',
  };

  function closePanel() {
    isOpen = false;
  }

  function addGemFromInput() {
    addGem({
      gemAttr,
      name: gemInput.name,
      req: gemInput.willPower,
      point: gemInput.corePoint,
      option1: gemInput.optionA,
      option2: gemInput.optionB,
    });
    toast.push(LGemAddResult[locale]);
    closePanel();
  }
</script>

<button class="add-button" onclick={() => (isOpen = true)}>{LButtonTitle[locale]}</button>

{#if isOpen}
  <div class="overlay" role="button" tabindex="0" onclick={closePanel} onkeydown={closePanel}></div>
  <div class="modal">
    <fieldset class="style-toggle">
      <legend>{LStyleTitle[locale]}</legend>
      <label class="style-option">
        <input
          type="radio"
          name="gem-add-style"
          checked={!appConfig.current.uiConfig.newGemAddStyle}
          onchange={() => updateUI('newGemAddStyle', false)}
        />
        {LDropdownStyle[locale]}
      </label>
      <label class="style-option">
        <input
          type="radio"
          name="gem-add-style"
          checked={appConfig.current.uiConfig.newGemAddStyle}
          onchange={() => updateUI('newGemAddStyle', true)}
        />
        {LRadioStyle[locale]}
      </label>
    </fieldset>

    {#if appConfig.current.uiConfig.newGemAddStyle}
      <RadioStyle {gemAttr} bind:gemInput {locale} />
    {:else}
      <DropdownStyle {gemAttr} bind:gemInput {locale} />
    {/if}

    <div class="buttons">
      <button onclick={closePanel}>{LCancel[locale]}</button>
      <button onclick={addGemFromInput}>{LConfirm[locale]}</button>
    </div>
  </div>
{/if}

<style>
  .add-button {
    background-color: var(--primary);
    color: var(--bg);
    border: none;
    padding: 0.4rem 0.8rem;
    border-radius: 0.3rem;
    cursor: pointer;
  }

  .overlay {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.35);
    z-index: 100;
  }

  .modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.25rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    box-shadow: 0 0.5rem 1.5rem rgb(0 0 0 / 0.25);
    z-index: 101;
  }

  .style-toggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    align-self: flex-end;
    font-size: 0.8rem;
    border: none;
    padding: 0;
    margin: 0;
    user-select: none;
  }

  .style-toggle legend {
    opacity: 0.7;
  }

  .style-option {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    cursor: pointer;
  }

  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .buttons button {
    padding: 0.35rem 0.8rem;
    border: 1px solid var(--border);
    border-radius: 0.25rem;
    background: var(--bg);
    color: var(--fg);
    cursor: pointer;
  }

  .buttons button:last-child {
    background: var(--primary);
    color: var(--bg);
    border-color: var(--primary);
  }
</style>
