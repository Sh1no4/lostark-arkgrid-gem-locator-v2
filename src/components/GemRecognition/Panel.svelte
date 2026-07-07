<script lang="ts">
  import { onDestroy } from 'svelte';

  import {
    type ArkGridAttr,
    type GemRecognitionLocale,
    GemRecognitionLocaleTypes,
    type LocalizationName,
    supportedGemRecognitionLocales,
  } from '../../lib/constants/enums';
  import { CaptureController } from '../../lib/cv/captureController';
  import { type ArkGridGem, isSameArkGridGem } from '../../lib/models/arkGridGems';
  import {
    appConfig,
    toggleDeferredScreenSharingInit,
  } from '../../lib/state/appConfig.state.svelte';
  import {
    appLocale,
    gemRecognitionLocale,
    setGemRecognitionLocale,
  } from '../../lib/state/locale.state.svelte';
  import { replaceGems } from '../../lib/state/profile.state.svelte';

  let locale = $derived(appLocale.current);
  let recognitionLocale = $derived(gemRecognitionLocale.current);
  const LTitle: LocalizationName = {
    ko_kr: '젬 화면 인식',
    en_us: 'Astrogem Recognition Screen',
    zh_cn: '护石界面识别',
  };
  const LStartCapture: LocalizationName = {
    ko_kr: '화면 공유 시작',
    en_us: 'Start Screen Sharing',
    zh_cn: '开始屏幕共享',
  };
  const LStopCapture: LocalizationName = {
    ko_kr: '화면 공유 종료',
    en_us: 'Stop Screen Sharing',
    zh_cn: '停止屏幕共享',
  };
  const LShowScreen: LocalizationName = {
    ko_kr: '공유 중인 화면 보기',
    en_us: 'Display Sharing Screen',
    zh_cn: '显示共享屏幕',
  };
  const LHideScreen: LocalizationName = {
    ko_kr: '공유 중인 화면 끄기',
    en_us: 'Hide Sharing Screen',
    zh_cn: '隐藏共享屏幕',
  };
  const LThreshold: LocalizationName = {
    ko_kr: '허용 오차 범위',
    en_us: 'Recongition Tolerance Range',
    zh_cn: '识别容差范围',
  };
  const LRecognitionLanguage: LocalizationName = {
    ko_kr: '인식 언어',
    en_us: 'Recognition Language',
    zh_cn: '识别语言',
  };
  const LRecognitionLanguageHint = $derived(
    {
      ko_kr: '게임 클라이언트 언어에 맞춰 선택하세요.',
      en_us: 'Match the language used by your game client.',
      zh_cn: '请选择与游戏客户端一致的识别语言。',
    }[locale]
  );
  const LDetectionMargin = {
    ko_kr: ['일반', '여유', '최대'],
    en_us: ['Normal', 'Sparse', 'Maximum'],
    zh_cn: ['普通', '宽松', '最大'],
  };
  const LFirefoxNotSupported = $derived(
    {
      ko_kr: '파이어폭스 브라우저는 지원하지 않습니다. 크롬 혹은 엣지 브라우저를 이용해주세요.',
      en_us: 'Sorry, Firefox broswer is not supported. Please use Chromium browser.',
      zh_cn: '抱歉，不支持 Firefox 浏览器。请使用 Chrome 或 Edge 浏览器。',
    }[locale]
  );
  const LSupportedClient = $derived(
    {
      ko_kr: '지원 클라이언트: 한국어, 영어, 중국어 간체, 러시아어, 러시아 서버 중국어 번역판',
      en_us: 'Supported Clients: Korean, English, Simplified Chinese, Russian, Russian Server (Chinese Translation)',
      zh_cn: '支持客户端：韩语、英语、简体中文、俄语、俄服汉化',
    }[locale]
  );
  const LControllerLazyLoading = $derived(
    {
      ko_kr: '화면 공유시 튕김 방지',
      en_us: 'Prevent Screen Sharing Crash',
      zh_cn: '防止屏幕共享崩溃',
    }[locale]
  );
  const LReadyStatus = $derived(
    {
      ko_kr: '화면 공유 시작 버튼을 누르고 LOST ARK가 실행 중인 화면을 선택해주세요.',
      en_us: 'Press Start Screen Sharing and choose the screen running LOST ARK.',
      zh_cn: '点击开始屏幕共享，并选择正在运行 LOST ARK 的画面。',
    }[locale]
  );
  const LRecordingStatus = $derived(
    {
      ko_kr: '자동 추적 중입니다. 젬 목록을 스크롤하며 인식 결과를 확인해주세요.',
      en_us: 'Auto tracking is active. Scroll the astrogem list and review the results.',
      zh_cn: '正在自动追踪。请滚动宝石列表并确认识别结果。',
    }[locale]
  );
  const LDiagnostics = $derived(
    {
      ko_kr: '진단 도구',
      en_us: 'Diagnostics',
      zh_cn: '诊断工具',
    }[locale]
  );
  const LStartCaptureErrors = $derived(
    {
      ko_kr: {
        recording: '이미 녹화 중입니다.',
        'screen-permission-denied': '화면 공유를 거부하였습니다.',
        'worker-init-failed': '분석 엔진을 준비하는데 실패하였습니다.',
        unknown: '알 수 없는 에러가 발생하였습니다.',
      },
      en_us: {
        recording: 'Screen sharing is already running.',
        'screen-permission-denied': 'Screen sharing was canceled or denied.',
        'worker-init-failed': 'Failed to prepare the recognition engine.',
        unknown: 'An unknown error occurred.',
      },
      zh_cn: {
        recording: '屏幕共享已在运行。',
        'screen-permission-denied': '已取消或拒绝屏幕共享。',
        'worker-init-failed': '识别引擎准备失败。',
        unknown: '发生未知错误。',
      },
    }[locale]
  );
  let debugCanvas: HTMLCanvasElement | null;
  let totalOrderGems = $state<ArkGridGem[]>([]);
  let totalChaosGems = $state<ArkGridGem[]>([]);
  let isRecording = $state<boolean>(false);
  let isDebugging = $state<boolean>(false);
  let isLoading = $state<boolean>(false);
  let showDiagnostics = $state<boolean>(false);
  let showRecognitionLocaleMenu = $state<boolean>(false);
  let detectionMargin = $state<number>(0);
  let recognitionLocaleMenuElement = $state<HTMLDivElement | null>(null);

  let _captureController: CaptureController | null = null;
  let _prevGem: string | null = null;
  let _lastAddedGemSequence: string | null = null;
  const manuallyRemovedGemKeys = new Set<string>();

  async function getCaptureController() {
    if (_captureController) return _captureController;
    _captureController = new CaptureController(debugCanvas);
    return _captureController;
  }

  $effect(() => {
    _captureController?.setDebugCanvas(debugCanvas ?? null);
  });

  $effect(() => {
    if (isRecording) showRecognitionLocaleMenu = false;
  });

  $effect(() => {
    window.addEventListener('pointerdown', handleRecognitionLocaleDocumentPointerDown);
    return () => {
      window.removeEventListener('pointerdown', handleRecognitionLocaleDocumentPointerDown);
    };
  });

  function selectRecognitionLocale(locale: GemRecognitionLocale) {
    setGemRecognitionLocale(locale);
    showRecognitionLocaleMenu = false;
  }

  function handleRecognitionLocaleDocumentPointerDown(event: PointerEvent) {
    if (!showRecognitionLocaleMenu) return;
    const eventTarget = event.target;
    if (eventTarget instanceof Node && recognitionLocaleMenuElement?.contains(eventTarget)) return;
    showRecognitionLocaleMenu = false;
  }

  function createGemRecognitionKey(gem: ArkGridGem) {
    return JSON.stringify({
      gemAttr: gem.gemAttr,
      name: gem.name,
      req: gem.req,
      point: gem.point,
      option1: gem.option1,
      option2: gem.option2,
    });
  }

  function removeGemFromRecognitionCache(gem: ArkGridGem) {
    const totalGems = gem.gemAttr == '질서' ? totalOrderGems : totalChaosGems;
    const gemIndex = totalGems.findIndex((recognizedGem) => isSameArkGridGem(recognizedGem, gem));
    if (gemIndex !== -1) totalGems.splice(gemIndex, 1);
  }

  function resetRecognitionSession() {
    totalOrderGems.length = 0;
    totalChaosGems.length = 0;
    _prevGem = null;
    _lastAddedGemSequence = null;
    manuallyRemovedGemKeys.clear();
  }

  function handleManualGemChange(event: Event) {
    const detail = (event as CustomEvent).detail as
      | { type: 'delete'; gemAttr: ArkGridAttr; gem: ArkGridGem }
      | { type: 'clear'; gemAttr?: ArkGridAttr; gems: ArkGridGem[] };

    _prevGem = null;
    _lastAddedGemSequence = null;

    if (detail.type === 'delete') {
      manuallyRemovedGemKeys.add(createGemRecognitionKey(detail.gem));
      removeGemFromRecognitionCache(detail.gem);
      replaceGems(detail.gemAttr, detail.gemAttr == '질서' ? totalOrderGems : totalChaosGems);
      return;
    }

    for (const gem of detail.gems) {
      manuallyRemovedGemKeys.add(createGemRecognitionKey(gem));
    }
    if (!detail.gemAttr || detail.gemAttr === '질서') totalOrderGems.length = 0;
    if (!detail.gemAttr || detail.gemAttr === '혼돈') totalChaosGems.length = 0;
  }

  $effect(() => {
    window.addEventListener('arkgrid:gems-manual-change', handleManualGemChange);
    return () => {
      window.removeEventListener('arkgrid:gems-manual-change', handleManualGemChange);
    };
  });

  function applyCurrentGems(gemAttr: ArkGridAttr, currentGems: ArkGridGem[]) {
    const availableCurrentGems = currentGems.filter(
      (gem) => !manuallyRemovedGemKeys.has(createGemRecognitionKey(gem))
    );
    const gemKey = JSON.stringify(availableCurrentGems);
    if (_prevGem === null) _prevGem = gemKey;
    else {
      if (_prevGem == gemKey) {
        return;
      } else {
        _prevGem = gemKey;
      }
    }
    const totalGems = gemAttr == '질서' ? totalOrderGems : totalChaosGems;
    const syncRecognizedGems = () => {
      replaceGems(gemAttr, totalGems);
    };
    // 젬 추가
    const SAME_COUNT_THRESHOLD = 4;
    if (totalGems.length == 0 && availableCurrentGems.length > 0) {
      // 현재 젬이 없다면 화면에 있는 젬으로 갈아치움
      // 이땐 개수가 꼭 9개가 아니어도 됨 (애초에 젬을 적게 깎은 사람들)
      for (const gem of availableCurrentGems) {
        totalGems.push(gem);
      }
      syncRecognizedGems();
      _lastAddedGemSequence = gemKey;
      // console.log($state.snapshot(totalGems));
    } else {
      if (availableCurrentGems.length == 9 && totalGems.length < 100) {
        // 정상적으로 9개의 젬이 모두 인식된 경우에만 진행

        // 如果这个序列刚刚添加过，跳过以防止重复
        if (_lastAddedGemSequence === gemKey) {
          return;
        }

        // Q. 내 화면의 첫 젬이 전체 젬의 어디에 위치하는가?
        // 동일한 옵션의 젬이 2개 이상 있는 경우를 위해 후보를 모두 저장함
        let foundIndices: number[] = [];
        for (let i = 0; i < totalGems.length; i++) {
          if (isSameArkGridGem(totalGems[i], availableCurrentGems[0])) {
            foundIndices.push(i);
          }
        }
        
        // 找到最佳匹配（匹配数量最多的那个）
        let bestMatch: { index: number; count: number } | null = null;
        for (let foundIndex of foundIndices) {
          let sameCount = 1;
          for (let i = 1; i < availableCurrentGems.length; i++) {
            if (foundIndex + i >= totalGems.length) break;
            if (isSameArkGridGem(totalGems[foundIndex + i], availableCurrentGems[i])) {
              sameCount += 1;
            } else {
              break;
            }
          }
          
          if (!bestMatch || sameCount > bestMatch.count) {
            bestMatch = { index: foundIndex, count: sameCount };
          }
        }

        // 只使用最佳匹配进行添加
        if (bestMatch) {
          const { index: foundIndex, count: sameCount } = bestMatch;
          
          // 현재 화면에 있는 모든 젬이 이미 연속적으로 추가된 젬인 경우, 그냥 넘어감
          if (sameCount == 9) {
            return;
          }

          // 스크롤을 너무 빠르게 내린 경우를 제외하기 위해서
          // 내 화면에 있는 젬 중 최소한 4개는 이미 알고 있는 경우에만 수행
          // 추가로 동일한 옵션의 젬을 오판정한 index인 경우 sameCount = 1이라서 걸러야 함
          if (sameCount >= SAME_COUNT_THRESHOLD) {
            // 检查是否真的有新护石需要添加
            let hasNewGems = false;
            for (let i = sameCount; i < 9; i++) {
              if (foundIndex + i >= totalGems.length || 
                  !isSameArkGridGem(totalGems[foundIndex + i], availableCurrentGems[i])) {
                hasNewGems = true;
                break;
              }
            }
            
            if (hasNewGems) {
              // 내 화면의 sameCount부터 끝에 있는 젬들까지 추가 대상임
              for (let i = sameCount; i < 9; i++) {
                totalGems.push(availableCurrentGems[i]);
                // console.log('추가:', currentGems[i]);
              }
              syncRecognizedGems();
              _lastAddedGemSequence = gemKey;
              // console.log($state.snapshot(totalGems));
            }
          }
        }

        if (foundIndices.length == 0) {
          // 만약 내 화면의 첫 젬이 아예 없다면 거꾸로 스크롤하는 것이라고 가정
          // 마지막 젬이 알고 있는지 확인
          let reverseFoundIndices: number[] = [];
          for (let i = 0; i < totalGems.length; i++) {
            if (isSameArkGridGem(totalGems[i], availableCurrentGems[8])) {
              reverseFoundIndices.push(i);
            }
          }
          
          // 找到反向滚动的最佳匹配
          let bestReverseMatch: { index: number; count: number } | null = null;
          for (let foundIndex of reverseFoundIndices) {
            let sameCount = 1;
            for (let i = 1; i < availableCurrentGems.length; i++) {
              if (foundIndex - i < 0) break;
              if (isSameArkGridGem(totalGems[foundIndex - i], availableCurrentGems[8 - i])) {
                sameCount += 1;
              } else {
                break;
              }
            }
            
            if (!bestReverseMatch || sameCount > bestReverseMatch.count) {
              bestReverseMatch = { index: foundIndex, count: sameCount };
            }
          }
          
          if (bestReverseMatch) {
            const { index: foundIndex, count: sameCount } = bestReverseMatch;
            
            if (sameCount == 9) {
              return;
            }
            
            if (sameCount >= SAME_COUNT_THRESHOLD) {
              // 检查是否真的有新护石需要添加
              let hasNewGems = false;
              for (let i = 0; i < 9 - sameCount; i++) {
                if (foundIndex - (9 - sameCount - 1 - i) < 0 || 
                    !isSameArkGridGem(totalGems[foundIndex - (9 - sameCount - 1 - i)], availableCurrentGems[i])) {
                  hasNewGems = true;
                  break;
                }
              }
              
              if (hasNewGems) {
                // 내 화면의 0부터 9-sameCount-1에 있는 젬들까지 추가 대상임
                for (let i = 9 - sameCount - 1; i >= 0; i--) {
                  totalGems.unshift(availableCurrentGems[i]);
                  // console.log('추가:', currentGems[i]);
                }
                syncRecognizedGems();
                _lastAddedGemSequence = gemKey;
                // console.log($state.snapshot(totalGems));
              }
            }
          }
        }
      }
    }
  }

  async function startGemCapture() {
    const isFirefox = typeof (window as any).InstallTrigger !== 'undefined';
    if (isFirefox) {
      window.alert(LFirefoxNotSupported);
      return;
    }
    // 젬 캡쳐 시작
    const controller = await getCaptureController();
    resetRecognitionSession();
    // UI 잠금
    isLoading = true;

    // register callbacks
    controller.onLoad = () => {
      // 로딩 끝나면 UI 로딩 해제
      isLoading = false;
    };
    controller.onStartCaptureError = (err) => {
      window.alert(LStartCaptureErrors[err] ?? LStartCaptureErrors.unknown);
      isLoading = false;
    };
    controller.onReady = () => {
      // 첫 프레임 소비 이후 초록불 ON
      isRecording = true;
    };
    controller.onFrameDone = (gemAttr, gems) => {
      // 분석 이후 현재 임시 젬 저장소에 반영
      applyCurrentGems(gemAttr, gems);
    };
    controller.onStop = () => {
      isRecording = false;
    };
    await controller.startCapture(
      recognitionLocale,
      appConfig.current.uiConfig.deferredScreenSharingInit
    );
  }

  async function stopGemCapture() {
    const controller = await getCaptureController();
    if (controller.isRecording()) {
      // controller 중단 요청 및 완료 이후 중단
      await controller.stopCapture();
      isRecording = false;
      debugCanvas?.getContext('2d')?.reset();
    }
  }
  async function toggleDrawDebug() {
    const controller = await getCaptureController();
    controller.setDebugCanvas(debugCanvas ?? null);
    isDebugging = controller.toggleDrawDebug();
  }
  async function updateControllerDetectionMargin(detectionMargin: number) {
    const controller = await getCaptureController();
    controller.detectionMargin = detectionMargin;
  }
  onDestroy(async () => {
    const controller = await getCaptureController();
    await controller.stopCapture();
  });
</script>

<div class="panel recognition-panel">
  {#if isLoading}
    <div class="overlay">
      <div class="spinner"></div>
    </div>
  {/if}
  <div class="recognition-header">
    <div class="title">
      <span class="status-dot" class:online={isRecording} class:offline={!isRecording}></span>
      <span class="recognition-title-text">{LTitle[locale]}</span>
      <span class="tooltip">
        <i class="fa-solid fa-circle-info info-icon"></i>
        <span class="tooltip-text">{LSupportedClient}</span>
      </span>
    </div>
  </div>
  <div class="content recognition-content">
    <section class="recognition-control-card">
      <div class="recognition-primary-row">
        {#if !isRecording}
          <button class="primary-capture-button" onclick={startGemCapture} data-track="start-capture"
            >🖥️ {LStartCapture[locale]}</button
          >
        {:else}
          <button class="primary-capture-button" onclick={stopGemCapture}
            >🖥️ {LStopCapture[locale]}</button
          >
        {/if}
      </div>
      <div class="recognition-locale-row">
        <span class="recognition-locale-copy">
          <span class="recognition-locale-icon" aria-hidden="true">🌐</span>
          <span class="recognition-locale-text">
            <span class="recognition-locale-title">{LRecognitionLanguage[locale]}</span>
            <span class="recognition-locale-hint">{LRecognitionLanguageHint}</span>
          </span>
        </span>
        <div
          class="recognition-locale-inline-menu"
          class:open={showRecognitionLocaleMenu}
          bind:this={recognitionLocaleMenuElement}
        >
          <button
            type="button"
            class="recognition-locale-value"
            disabled={isRecording}
            aria-haspopup="listbox"
            aria-expanded={showRecognitionLocaleMenu}
            onclick={() => (showRecognitionLocaleMenu = !showRecognitionLocaleMenu)}
          >
            <span class="recognition-locale-current"
              >{GemRecognitionLocaleTypes[recognitionLocale].name[locale]}</span
            >
            <span class="recognition-locale-arrow" aria-hidden="true"></span>
          </button>
          {#if showRecognitionLocaleMenu && !isRecording}
            <div class="recognition-locale-options" role="listbox">
              {#each supportedGemRecognitionLocales as supportedRecognitionLocale}
                <button
                  type="button"
                  class="recognition-locale-option"
                  class:active={supportedRecognitionLocale === recognitionLocale}
                  role="option"
                  aria-selected={supportedRecognitionLocale === recognitionLocale}
                  onclick={() => selectRecognitionLocale(supportedRecognitionLocale)}
                >
                  <span>{GemRecognitionLocaleTypes[supportedRecognitionLocale].name[locale]}</span>
                  {#if supportedRecognitionLocale === recognitionLocale}
                    <span class="recognition-locale-selected" aria-hidden="true">✓</span>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
      <div class="recognition-status" class:recording={isRecording}>
        {isRecording ? LRecordingStatus : LReadyStatus}
      </div>
      <button class="diagnostics-toggle" onclick={() => (showDiagnostics = !showDiagnostics)}>
        ⚙ {LDiagnostics}
      </button>
    </section>

    <div hidden={!showDiagnostics}>
      <div class="debug-screen">
        <button class:active={isDebugging} onclick={toggleDrawDebug}>
          🔨 {isDebugging ? LHideScreen[locale] : LShowScreen[locale]}
        </button>
        <button onclick={toggleDeferredScreenSharingInit}>
          {LControllerLazyLoading}
          <i
            class="fa-solid"
            class:fa-circle-dot={appConfig.current.uiConfig.deferredScreenSharingInit}
            class:fa-circle={!appConfig.current.uiConfig.deferredScreenSharingInit}
          ></i>
        </button>
        <div class="threshold-controller">
          <input
            id="slider"
            type="range"
            min="0"
            max="2"
            step="1"
            bind:value={detectionMargin}
            oninput={async () => {
              await updateControllerDetectionMargin(detectionMargin / 10);
            }}
          />
          <label for="slider"
            >{LThreshold[locale]}: {LDetectionMargin[locale][detectionMargin]}</label
          >
        </div>
        <canvas bind:this={debugCanvas} style="border: 1px black solid;"></canvas>
      </div>
    </div>
  </div>
</div>

<style>
  /* 오버레이 + 중앙 정렬 */
  .panel {
    position: relative;
  }

  .recognition-panel {
    box-sizing: border-box;
    width: 100%;
    max-width: none;
    min-width: 0;
    padding: 0;
    background: transparent;
    border: none;
    box-shadow: none;
  }

  .recognition-header {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .recognition-header > div {
    display: flex;
    gap: 0;
  }

  .recognition-header .title {
    box-sizing: border-box;
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.55rem;
    min-width: 0;
    padding: 0.45rem 0.6rem;
    border: 1px solid var(--reference-border, var(--border));
    border-radius: 999px;
    background: color-mix(
      in srgb,
      var(--reference-muted, var(--card-inner)) 40%,
      var(--reference-card, var(--card))
    );
    font-size: 1.1rem;
    font-weight: 800;
  }

  .recognition-title-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* .panel > .title > .title-with-dot {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  } */

  .title .tooltip-text {
    bottom: -200%;
  }
  .status-dot {
    width: 0.72rem;
    height: 0.72rem;
    flex: 0 0 0.72rem;
    border-radius: 50%;
    display: block;
    box-shadow: 0 0 0 0.18rem color-mix(in srgb, currentColor 12%, transparent);
  }
  .status-dot.online {
    background-color: #22c55e; /* 녹색 */
  }
  .status-dot.offline {
    background-color: #9ca3af; /* 회색 */
  }

  .panel > .recognition-content {
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow-y: visible;
  }

  .recognition-control-card {
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    background: var(--card);
    overflow: visible;
  }

  .recognition-control-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.8rem;
    padding: 0.9rem;
  }

  .recognition-primary-row {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .recognition-locale-row {
    box-sizing: border-box;
    width: min(100%, 48rem);
    max-width: 100%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.65rem;
    padding: 0.7rem 0.8rem;
    border: 1px solid var(--reference-border, var(--border));
    border-radius: 0.7rem;
    background: color-mix(
      in srgb,
      var(--reference-muted, var(--card-inner)) 42%,
      var(--reference-card, var(--card))
    );
    color: var(--text);
    font-weight: 700;
  }

  .recognition-locale-copy {
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
    max-width: 100%;
    min-width: 0;
  }

  .recognition-locale-icon {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    flex-shrink: 0;
    border-radius: 50%;
    background: var(--reference-muted, var(--card-inner));
    font-size: 1rem;
  }

  .recognition-locale-text {
    display: flex;
    flex-direction: column;
    gap: 0.12rem;
    max-width: 100%;
    min-width: 0;
  }

  .recognition-locale-title {
    font-size: 0.9rem;
    font-weight: 850;
    line-height: 1.2;
  }

  .recognition-locale-hint {
    color: var(--subtle-text);
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .recognition-locale-inline-menu {
    box-sizing: border-box;
    position: relative;
    width: 100%;
    max-width: 100%;
    min-width: 0;
  }

  .recognition-locale-value {
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    min-height: 2.35rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.65rem;
    border: 1px solid var(--reference-border, var(--border));
    border-radius: 999px;
    background: color-mix(
      in srgb,
      var(--reference-card, var(--card)) 86%,
      var(--reference-muted, var(--card-inner))
    );
    color: var(--text);
    padding: 0.48rem 0.85rem;
    outline: none;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
    font-size: 0.86rem;
    font-weight: 700;
    cursor: pointer;
    text-align: left;
    transition:
      border-color 0.15s ease,
      background-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .recognition-locale-current {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .recognition-locale-value:hover:not(:disabled),
  .recognition-locale-inline-menu.open > .recognition-locale-value {
    border-color: color-mix(in srgb, var(--reference-accent, var(--primary)) 48%, var(--border));
    background: var(--reference-card, var(--card));
  }

  .recognition-locale-value:focus-visible {
    border-color: var(--reference-accent, var(--primary));
    box-shadow: 0 0 0 2px
      color-mix(in srgb, var(--reference-accent, var(--primary)) 18%, transparent);
  }

  .recognition-locale-value:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  .recognition-locale-arrow {
    display: inline-block;
    width: 0;
    height: 0;
    flex-shrink: 0;
    border-left: 0.26rem solid transparent;
    border-right: 0.26rem solid transparent;
    border-top: 0.34rem solid var(--subtle-text);
    color: var(--subtle-text);
    transform: translateY(0.02rem);
  }

  .recognition-locale-options {
    position: absolute;
    z-index: 20;
    top: calc(100% + 0.35rem);
    right: 0;
    width: 100%;
    box-sizing: border-box;
    padding: 0.3rem;
    border: 1px solid var(--reference-border, var(--border));
    border-radius: 0.75rem;
    background: color-mix(
      in srgb,
      var(--reference-card, var(--card)) 90%,
      var(--reference-muted, var(--card-inner))
    );
    box-shadow: 0 0.6rem 1.2rem rgba(68, 46, 20, 0.12);
  }

  .recognition-locale-option {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.65rem;
    padding: 0.52rem 0.6rem;
    border: none;
    border-radius: 0.5rem;
    background: transparent;
    color: var(--text);
    font-size: 0.82rem;
    font-weight: 700;
    text-align: left;
  }

  .recognition-locale-option:hover {
    background: var(--reference-muted, var(--card-inner));
  }

  .recognition-locale-option.active {
    color: var(--reference-accent, var(--primary));
    background: color-mix(
      in srgb,
      var(--reference-accent, var(--primary)) 10%,
      var(--reference-card, var(--card))
    );
  }

  .recognition-locale-selected {
    font-size: 0.8rem;
    font-weight: 900;
  }

  .primary-capture-button {
    padding: 0.7rem 1.35rem;
    color: white;
    background: var(--primary);
    border-color: var(--primary);
    border-radius: 0.55rem;
    font-size: 1rem;
    font-weight: 800;
    box-shadow: none;
  }

  .primary-capture-button:hover {
    filter: brightness(1.04);
    background: var(--primary);
  }

  .recognition-status {
    width: min(100%, 48rem);
    padding: 0.75rem 0.9rem;
    border-radius: 0.6rem;
    color: var(--subtle-text);
    background: var(--card);
    border: 1px solid var(--border);
    text-align: center;
    line-height: 1.5;
  }

  .recognition-status.recording {
    color: var(--text);
    border-color: color-mix(in srgb, #22c55e 45%, var(--border));
    background: color-mix(in srgb, #22c55e 12%, var(--card));
  }

  .debug-screen {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    justify-content: center;
  }
  .debug-screen > canvas {
    width: auto;
  }
  .debug-screen > .threshold-controller {
    display: flex;
    /* height: 60px; */
    align-items: center;
    gap: 1rem;
  }
  .debug-screen > .threshold-controller > label {
    width: 20rem;
  }
  .debug-screen > .threshold-controller > input {
    transform: translateY(2px);
  }

  @media (max-width: 767px) {
    .recognition-header {
      flex-direction: column;
    }

  }

  .recognition-header {
    padding: 0 0.15rem;
  }

  .recognition-header .title {
    font-size: 0.95rem;
    letter-spacing: -0.02em;
  }

  .panel > .recognition-content {
    gap: 0.75rem;
  }

  .recognition-control-card {
    border-color: var(--reference-border, var(--border));
    background: var(--reference-card, var(--card));
    box-shadow: 0 2px 4px rgba(84, 55, 24, 0.04);
  }

  .recognition-control-card {
    gap: 0.7rem;
    padding: 0.75rem;
    border-radius: 0.75rem;
  }

  .recognition-primary-row,
  .recognition-primary-row > button,
  .diagnostics-toggle {
    width: 100%;
  }

  .primary-capture-button {
    min-height: 3.65rem;
    border-radius: 0.55rem;
    background: var(--reference-accent, var(--primary));
    border-color: var(--reference-accent, var(--primary));
    font-size: 1.1rem;
    letter-spacing: 0.02em;
  }

  .primary-capture-button:hover {
    background: var(--reference-accent-hover, var(--primary));
  }

  .recognition-status,
  .diagnostics-toggle {
    border-color: var(--reference-border, var(--border));
    border-radius: 0.55rem;
    background: var(--reference-card, var(--card));
    color: var(--subtle-text);
    font-size: 0.85rem;
  }

  .recognition-status {
    padding: 0.55rem 0.75rem;
  }

  .debug-screen {
    padding: 0.75rem;
    border: 1px solid var(--reference-border, var(--border));
    border-radius: 0.75rem;
    background: var(--reference-card, var(--card));
  }
</style>
