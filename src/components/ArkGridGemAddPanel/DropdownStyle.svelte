<script lang="ts">
  import imgCorePoint from '../../assets/corepoint.png';
  import imgWillPower from '../../assets/willpower.png';
  import type { AppLocale, ArkGridAttr } from '../../lib/constants/enums';
  import {
    type ArkGridGemName,
    ArkGridGemOptionNames,
    ArkGridGemOptionTypes,
    ArkGridGemSpecs,
    getGemImage,
  } from '../../lib/models/arkGridGems';
  import type { GemInput } from './Wrapper.svelte';

  type Props = {
    gemAttr: ArkGridAttr;
    gemInput: GemInput;
    locale: AppLocale;
  };
  let { gemAttr, gemInput = $bindable(), locale }: Props = $props();

  function enforceSingleDigit(value: number, minimum: number, maximum: number) {
    if (value > 10) {
      value = value % 10;
    }
    return Math.min(maximum, Math.max(minimum, value));
  }

  let availableGemSpecs = $derived(
    Object.entries(ArkGridGemSpecs)
      .filter(([, spec]) => spec.attr === gemAttr)
      .map(([key, spec]) => ({
        key: key as ArkGridGemName,
        spec,
      }))
  );

  $effect(() => {
    if (!availableGemSpecs.some((availableGemSpec) => availableGemSpec.key === gemInput.name)) {
      gemInput.name = availableGemSpecs[0]?.key;
    }
  });

  let gemSpec = $derived(ArkGridGemSpecs[gemInput.name]);
  let availableGemOptionTypes = $derived(gemSpec.availableOptions);

  $effect(() => {
    if (!availableGemOptionTypes.some((optionType) => optionType === gemInput.optionA.optionType)) {
      gemInput.optionA.optionType =
        gemInput.optionB.optionType === availableGemOptionTypes[0]
          ? availableGemOptionTypes[1]
          : availableGemOptionTypes[0];
      gemInput.optionA.value = 1;
    }
    if (!availableGemOptionTypes.some((optionType) => optionType === gemInput.optionB.optionType)) {
      gemInput.optionB.optionType =
        gemInput.optionA.optionType === availableGemOptionTypes[0]
          ? availableGemOptionTypes[1]
          : availableGemOptionTypes[0];
      gemInput.optionB.value = 1;
    }
  });

  $effect(() => {
    if (gemInput.willPower < ArkGridGemSpecs[gemInput.name].req - 5) {
      gemInput.willPower = ArkGridGemSpecs[gemInput.name].req - 5;
    }
    if (gemInput.willPower > ArkGridGemSpecs[gemInput.name].req - 1) {
      gemInput.willPower = ArkGridGemSpecs[gemInput.name].req - 1;
    }
  });
</script>

<div class="content">
  <div class="col">
    <div class="image-wrapper">
      <img src={getGemImage(gemAttr, gemInput.name)} alt={gemInput.name} />
    </div>
    <label>
      <select bind:value={gemInput.name}>
        {#each availableGemSpecs as spec}
          <option value={spec.key}>{spec.spec.name[locale].split(' ').at(-1)}</option>
        {/each}
      </select>
    </label>
  </div>
  <div class="col">
    <div class="row">
      <label>
        <input
          bind:value={
            () => gemInput.willPower,
            (value) =>
              (gemInput.willPower = enforceSingleDigit(value, gemSpec.req - 5, gemSpec.req - 1))
          }
          type="number"
          min={gemSpec.req - 5}
          max={gemSpec.req - 1}
        />
      </label>
      <div class="image-wrapper">
        <img src={imgWillPower} alt="Willpower" />
      </div>
    </div>
    <div class="row">
      <label>
        <input
          bind:value={
            () => gemInput.corePoint,
            (value) => (gemInput.corePoint = enforceSingleDigit(value, 1, 5))
          }
          type="number"
          min="1"
          max="5"
        />
      </label>
      <div class="image-wrapper">
        <img src={imgCorePoint} alt="Core point" />
      </div>
    </div>
  </div>
  <div class="col">
    {#each [gemInput.optionA, gemInput.optionB] as gemOption}
      <div class="row">
        <label>
          <select bind:value={gemOption.optionType}>
            {#each Object.values(ArkGridGemOptionNames) as optionName}
              <option
                value={optionName}
                disabled={!availableGemOptionTypes.some((optionType) => optionType === optionName)}
                >{ArkGridGemOptionTypes[optionName].name[locale]}</option
              >
            {/each}
          </select>
        </label>
        <label>
          Lv.
          <input
            bind:value={
              () => gemOption.value,
              (value) => (gemOption.value = enforceSingleDigit(value, 1, 5))
            }
            type="number"
            min="1"
            max="5"
          />
        </label>
      </div>
    {/each}
  </div>
</div>

<style>
  .content {
    display: flex;
    flex-direction: row;
    gap: 1rem;
  }

  .col {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    justify-content: center;
    align-items: center;
  }

  .row {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    gap: 1rem;
  }

  .image-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .image-wrapper img {
    margin: auto;
  }

  input,
  option,
  select {
    font-size: 1rem;
    width: 8.5rem;
  }

  input[type='number'] {
    width: 2rem;
  }
</style>
