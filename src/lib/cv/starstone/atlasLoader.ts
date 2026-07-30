import { getCv } from '../cvRuntime';
import {
  type StarstoneTemplateId,
  starstoneAtlasEntries,
  starstoneAtlasFileName,
  starstoneAtlasSize,
} from './atlas.generated';
import type { StarstoneAtlasStore, StarstoneTemplateMat } from './types';

class StarstoneAtlasStoreImpl implements StarstoneAtlasStore {
  private readonly templates = new Map<StarstoneTemplateId, StarstoneTemplateMat>();
  private disposed = false;

  constructor(readonly atlas: StarstoneTemplateMat) {}

  get(id: StarstoneTemplateId): StarstoneTemplateMat {
    if (this.disposed) {
      throw new Error('星石精灵图已释放');
    }

    const cached = this.templates.get(id);
    if (cached) return cached;

    const entry = starstoneAtlasEntries[id];
    if (!entry) {
      throw new Error(`未知的星石模板: ${id}`);
    }

    const cv = getCv();
    const template = this.atlas.roi(new cv.Rect(entry.x, entry.y, entry.width, entry.height));
    this.templates.set(id, template);
    return template;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    for (const template of this.templates.values()) {
      template.delete();
    }
    this.templates.clear();
    this.atlas.delete();
  }

  isDisposed(): boolean {
    return this.disposed;
  }
}

let activeStore: StarstoneAtlasStoreImpl | null = null;
let loadingPromise: Promise<StarstoneAtlasStore> | null = null;

function getAtlasUrl(): string {
  const baseUrl = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${baseUrl}${starstoneAtlasFileName}`;
}

async function createStarstoneAtlasStore(): Promise<StarstoneAtlasStoreImpl> {
  const response = await fetch(getAtlasUrl());
  if (!response.ok) {
    throw new Error(`无法加载星石精灵图: ${response.status} ${response.statusText}`);
  }

  let image: ImageBitmap | null = null;
  let rgba: StarstoneTemplateMat | null = null;
  let grayscale: StarstoneTemplateMat | null = null;

  try {
    image = await createImageBitmap(await response.blob());
    if (image.width !== starstoneAtlasSize.width || image.height !== starstoneAtlasSize.height) {
      throw new Error(`星石精灵图尺寸不符: ${image.width}x${image.height}`);
    }

    const canvas = new OffscreenCanvas(image.width, image.height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('无法创建星石精灵图 Canvas 上下文');
    }

    context.drawImage(image, 0, 0);
    const cv = getCv();
    rgba = cv.matFromImageData(context.getImageData(0, 0, image.width, image.height));
    grayscale = new cv.Mat();
    cv.cvtColor(rgba, grayscale, cv.COLOR_RGBA2GRAY);
    rgba.delete();
    rgba = null;

    if (
      grayscale.cols !== starstoneAtlasSize.width ||
      grayscale.rows !== starstoneAtlasSize.height
    ) {
      throw new Error('星石精灵图 OpenCV 尺寸不符');
    }

    return new StarstoneAtlasStoreImpl(grayscale);
  } catch (error) {
    grayscale?.delete();
    rgba?.delete();
    throw error;
  } finally {
    image?.close();
  }
}

export function loadStarstoneAtlas(): Promise<StarstoneAtlasStore> {
  if (activeStore && !activeStore.isDisposed()) {
    return Promise.resolve(activeStore);
  }
  if (loadingPromise) return loadingPromise;

  loadingPromise = createStarstoneAtlasStore()
    .then((store) => {
      activeStore = store;
      return store;
    })
    .finally(() => {
      loadingPromise = null;
    });

  return loadingPromise;
}
