import {
  DEFAULT_GEM_RECOGNITION_LOCALE,
  type ArkGridAttr,
  type GemRecognitionLocale,
} from '../constants/enums';
import { type ArkGridGem } from '../models/arkGridGems';
import type { CaptureWorkerRequest, CaptureWorkerResponse } from './types';

const START_CAPTURE_ERROR_TYPES = [
  'recording',
  'worker-init-failed',
  'screen-permission-denied',
  'unknown',
] as const;

type StartCaptureErrorType = (typeof START_CAPTURE_ERROR_TYPES)[number];

export class CaptureController {
  private state: 'idle' | 'loading' | 'recording' | 'closing' = 'idle';

  // 화면 녹화 기능들
  private reader: ReadableStreamDefaultReader<VideoFrame> | null = null;
  private track: MediaStreamVideoTrack | null = null;

  // web worker
  private worker: Worker | null = null;
  detectionMargin: number = 0;
  private recognitionLocale: GemRecognitionLocale = DEFAULT_GEM_RECOGNITION_LOCALE;

  // debug
  private drawDebug: boolean = false;
  private debugCanvas: HTMLCanvasElement | null = null;

  // 👇 기다리는 Promise들의 resolver
  private awaitWorkerInitialization: {
    resolve: () => void;
    reject: (reason: StartCaptureErrorType) => void;
  } | null = null;
  private awaitFrameCompletion: (() => void) | null = null;

  // 외부 등록 콜백
  onFrameDone: ((gemAttr: ArkGridAttr, gems: ArkGridGem[]) => void) | null = null; // 분석 완료
  onLoad: (() => void) | null = null; // worker 준비 완료
  onStartCaptureError: ((err: StartCaptureErrorType) => void) | null = null; // worker 준비 실패
  onReady: (() => void) | null = null; // 프레임 소비 완료
  onStop: (() => void) | null = null; // 녹화 중단

  constructor(debugCanvas?: HTMLCanvasElement | null) {
    if (debugCanvas) this.debugCanvas = debugCanvas;
  }

  setDebugCanvas(debugCanvas: HTMLCanvasElement | null) {
    this.debugCanvas = debugCanvas;
  }

  // type-safe wrapper
  private postMessage(msg: CaptureWorkerRequest) {
    if (!this.worker) throw Error('worker is not set');
    this.worker.postMessage(msg);
  }

  private handleWorkerMessage(e: MessageEvent<CaptureWorkerResponse>) {
    const data = e.data;

    switch (data.type) {
      case 'init:done':
        this.awaitWorkerInitialization?.resolve();
        this.awaitWorkerInitialization = null;
        const onLoad = this.onLoad;
        if (onLoad) {
          queueMicrotask(() => onLoad());
        }
        break;

      case 'frame:done':
        // release lock
        this.awaitFrameCompletion?.();
        this.awaitFrameCompletion = null;

        // 외부에서 등록된 콜백 불러줌

        /* 
        queueMicrotask(() => { ... }) 안의 코드는:

        지금 실행 ❌
        현재 call stack 끝난 뒤 실행 ⭕

        TypeScript는 이렇게 생각해:

        “이 콜백이 실행될 때까지
        this.onFrameDone이나 data.result가
        바뀌지 않는다는 보장이 없다.”
        */
        if (this.state === 'recording') {
          // recording일 때에만 onFrameDone 불러줌
          const result = data.result;
          const onFrameDone = this.onFrameDone;
          if (onFrameDone && result) {
            queueMicrotask(() => {
              onFrameDone(result.gemAttr, result.gems);
            });
          }
        }
        break;

      case 'init:error':
        if (this.awaitWorkerInitialization) {
          this.awaitWorkerInitialization.reject('worker-init-failed');
          this.awaitWorkerInitialization = null;
        }
        break;

      case 'debug':
        try {
          if (data.message) console.log(data.message);
          if (data.image && this.debugCanvas) {
            if (this.state == 'recording') {
              this.debugCanvas.width = data.image.width;
              this.debugCanvas.height = data.image.height;
              this.debugCanvas.getContext('2d')?.drawImage(data.image, 0, 0);
            }
          }
        } finally {
          if (data.image) data.image.close();
        }
    }
  }

  private async requestDisplayMedia() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
      });
      if (!stream) {
        throw Error('No stream');
      }
      this.track = stream.getVideoTracks()[0];
      if (!this.track) {
        throw Error('No video track');
      }
      const processor = new MediaStreamTrackProcessor({ track: this.track });
      this.reader = processor.readable.getReader();
    } catch (err: any) {
      throw err;
    }
    return;
  }

  isStartCaptureError(err: unknown): err is StartCaptureErrorType {
    // 에러가 내가 발생시킨 StartCaptureErrorType중 하나인지?
    return (
      typeof err === 'string' && START_CAPTURE_ERROR_TYPES.includes(err as StartCaptureErrorType)
    );
  }

  private classifyCaptureError(err: unknown): StartCaptureErrorType {
    if (err instanceof DOMException) {
      if (err.name === 'NotAllowedError') {
        return 'screen-permission-denied';
      }
    }

    if (this.isStartCaptureError(err)) {
      return err; // 🔥 그대로 통과
    }

    return 'unknown';
  }

  async startCapture(
    recognitionLocale: GemRecognitionLocale,
    deferDisplayRequest: boolean = false
  ) {
    // idle 상태에서만 가능
    // 녹화를 시작합니다.
    // worker를 생성하고 어셋 로드를 시킨 뒤, 사용자에게 화면 공유를 요청합니다.
    // 둘 다 완료되면 루프를 시작합니다.

    try {
      if (this.state !== 'idle') {
        throw 'recording' satisfies StartCaptureErrorType;
      }

      // loading으로 전환 (lock)
      this.state = 'loading';
      this.recognitionLocale = recognitionLocale;

      // worker 생성 이후 handler 등록
      if (!this.worker) {
        this.worker = new Worker(new URL('./captureWorker.ts', import.meta.url), {
          type: 'module',
        });
        this.worker.onmessage = this.handleWorkerMessage.bind(this);
      }
      // worker의 init을 기다리는 promise 만든 후 init 요청 보냄
      // (worker의 응답에 따라서 reject될 수도 있음!)
      const waitForInit = new Promise<void>((resolve, reject) => {
        this.awaitWorkerInitialization = { resolve, reject };
      });
      this.postMessage({ type: 'init' });

      if (deferDisplayRequest) {
        await waitForInit;
        await this.requestDisplayMedia();
      } else {
        // 초기화되는 동안 사용자에게 화면 공유 요청하고 둘을 모두 기다림
        await Promise.all([this.requestDisplayMedia(), waitForInit]);
      }

      // 완료되면 reader가 설정되어서 읽을 수 있음
      if (!this.reader) {
        throw Error('reader is not ready');
      }

      // 첫 프레임을 읽을 수 있을 때까지 대기
      const { value, done } = await this.reader.read();
      if (done) {
        throw Error('Failed to read even a frame');
      }
      value?.close();

      // 프레임도 읽을 수 있고 worker도 준비가 끝난 경우 onReady 부름
      const onReady = this.onReady;
      if (onReady) {
        queueMicrotask(() => {
          onReady();
        });
      }

      // 프레임 캡쳐 및 전송 loop로 이동
      this.state = 'recording';
      this.loop();
    } catch (err) {
      // 초기화 도중 에러 발생하면 분류해서 onStartCaptureError 불러줌
      const classified = this.classifyCaptureError(err);
      this.onStartCaptureError?.(classified);
    } finally {
      // 시작에 실패했을 경우 다시 idle로
      if (this.state == 'loading') {
        this.state = 'idle';
      }
    }
  }

  private async loop() {
    // state가 recording이라면, reader로부터 프레임을 읽어서 worker에게 전달 및 결과를 기다린다.
    while (this.state == 'recording') {
      if (!this.reader) {
        throw Error('reader not exists');
      }
      let value: VideoFrame | undefined;
      try {
        if (!this.worker) throw Error('worker not exists');
        const result = await this.reader.read();
        value = result.value;
        const done = result.done;
        if (done) break; // 사용자가 화면 공유 중단시 여기서 break
        if (!value) break;

        // 분석이 끝나면 resolve되는 promise 생성
        const waitForAnalysis = new Promise<void>((resolve) => {
          this.awaitFrameCompletion = resolve;
        });
        // 현재 frame을 postMessage
        this.worker.postMessage(
          {
            type: 'frame',
            frame: value,
            drawDebug: this.drawDebug,
            detectionMargin: this.detectionMargin,
            recognitionLocale: this.recognitionLocale,
          } satisfies CaptureWorkerRequest,
          [value]
        );
        value = undefined;
        // 주의: value 소유권은 worker에게 넘어갔으니 더 이상 건드리면 안 되기에 undefined
        await waitForAnalysis;
      } finally {
        // 모종의 사유로 value의 소유권이 넘어가지 않았으면 controller에서 종료
        value?.close();
      }
    }
    // loop가 탈출되면 idle로 설정
    this.track?.stop();
    this.track = null;
    const onStop = this.onStop;
    if (onStop) {
      queueMicrotask(() => {
        onStop();
      });
    }
    this.state = 'idle';
  }

  async stopCapture() {
    // 위 루프에서 read나 waitForAnalysis같은 Promise는 취소할 수 없기 때문에,
    // 애초에 promise를 만들 때부터 취소 신호를 가진 Promise와 race 시켜야 한다.
    // (취소 신호를 가진 Promise가 먼저 reject되면 원본은 기다리지 않고 탈출하기 때문에 취소 효과가 됨)
    // 너무 장황해지는 거 같아서 loop 종료로...
    if (this.state === 'recording') {
      this.state = 'closing'; // 추후 loop 탈출 이후 idle로 가는 것을 기대
    }
  }
  isIdle() {
    return this.state === 'idle';
  }
  isRecording() {
    return this.state == 'recording';
  }
  toggleDrawDebug() {
    this.drawDebug = !this.drawDebug;
    return this.drawDebug;
  }
}
