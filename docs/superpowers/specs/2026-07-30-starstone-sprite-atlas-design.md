# 星石加工简中精灵图设计

## 1. 目标

为“星石加工助手”建立独立、可复现的简体中文精灵图资产管线，并提供 Web Worker 可调用的 OpenCV.js 运行时加载接口。

本阶段只解决以下问题：

- 将锚点、星石标题、属性文字、菱形类型以及各识别字段的数字模板打入同一张精灵图。
- 自动生成带类型的坐标和元数据，避免手写坐标。
- 在 Worker 内一次加载、按坐标复用，并在停止或重启时完整释放 OpenCV 资源。
- 为后续面板定位和字段识别提供稳定接口，但不在本阶段实现完整识别流程。

项目方已确认有权复用参考项目中的模板、规则和数字模板数据。本功能仅面向国服简体中文、1080p SDR，不考虑 HDR。

## 2. 约束与边界

- 星石加工精灵图与现有“护石配置优化”精灵图完全隔离。
- 不修改现有 `scripts/generate-sprite.cjs` 的行为，不复用其全局清理逻辑。
- 不增加运行时依赖；新增的 `pngjs` 仅作为开发依赖，用于把数字矩阵编码为 PNG。
- 继续使用已有 `spritesmith` 完成精灵图排布和输出。
- 所有条目必须进入一张简中精灵图；不同字段的数字字形不能错误合并为同一套。
- 生成结果由内容哈希命名，输入不变时文件名、坐标和内容均保持不变。
- 本阶段不实现屏幕采集、面板定位、OCR 状态机、成本累计、策略计算或 UI 接入。

## 3. 目录与产物

新增以下结构：

```text
opencv-templates/
  starstone/
    zh_cn/
      manifest.json
      digit_templates.json
      static/
        anchor/
        gem-title/
        diamond-type/
        label/
scripts/
  generate-starstone-sprite.cjs
src/lib/cv/starstone/
  atlas.generated.ts
  atlasLoader.ts
  types.ts
  generate-starstone-sprite.test.cjs
public/
  opencv_starstone_zh_cn_<content-hash>.png
```

`digit_templates.json` 是经授权复制到本仓库的生成输入，生成脚本不能依赖工作区外的 `G:\Git\gempago-sours` 路径。静态模板也必须进入本仓库后再参与生成，保证其他开发者和 CI 可以复现产物。

## 4. 模板清单

`manifest.json` 是生成管线的唯一入口，记录静态图片和数字模板来源。条目使用稳定、与界面文案解耦的 ID，例如：

```json
{
  "locale": "zh_cn",
  "static": [
    { "id": "anchor.dot_grid", "file": "static/anchor/dot_grid.png" },
    { "id": "title.stable", "file": "static/gem-title/stable.png" },
    { "id": "diamond.attack", "file": "static/diamond-type/attack.png" }
  ],
  "digits": [
    { "idPrefix": "digit.candidate.red", "source": "card_digit_red", "expectedDigits": [1, 2, 3, 4] },
    { "idPrefix": "digit.candidate.yellow", "source": "card_digit_yellow", "expectedDigits": [1, 2, 3, 4] },
    { "idPrefix": "digit.candidate.green", "source": "card_digit_green", "expectedDigits": [1, 2, 3, 4] },
    { "idPrefix": "digit.candidate.blue", "source": "card_digit_blue", "expectedDigits": [1, 2, 3, 4] },
    { "idPrefix": "digit.candidate.refresh", "source": "card_refresh_digit", "expectedDigits": [1, 2] },
    { "idPrefix": "digit.refresh_count", "source": "refreshCnt", "expectedDigits": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
    { "idPrefix": "digit.remaining_attempts", "source": "remainingAttempts", "expectedDigits": [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    { "idPrefix": "digit.max_attempts", "source": "maxAttempts", "expectedDigits": [5, 7, 9] },
    { "idPrefix": "digit.cost", "source": "costVal", "expectedDigits": [8, 9] },
    { "idPrefix": "digit.diamond_top", "source": "diamondTopLv", "expectedDigits": [1, 2, 3, 4, 5] },
    { "idPrefix": "digit.diamond_bottom", "source": "diamondBotLv", "expectedDigits": [1, 2, 3, 4, 5] },
    { "idPrefix": "digit.diamond_left", "source": "diamondLeftLv", "expectedDigits": [1, 2, 3, 4, 5] },
    { "idPrefix": "digit.diamond_right", "source": "diamondRightLv", "expectedDigits": [1, 2, 3, 4, 5] }
  ]
}
```

数字条目按各字段的 `expectedDigits` 展开。生成器要求源数据与声明集合完全一致，既不能漏掉合法数字，也不能悄悄接受业务上不会出现的数字。所有已授权参考数字模板都进入同一张精灵图，但不同字段仍保留独立字形。

`digit.refresh_count.0` 是必需条目，语义为免费刷新次数已耗尽。后续识别状态机把它映射为“付费刷新可用”，并以配置的重置或加工费用计入成本；该业务映射不属于本阶段实现。候选卡片的 `digit.candidate.refresh` 仍只包含 `1`、`2`，不得为了表达付费刷新而虚构 `0` 字形。

首批静态条目以已确认的识别范围为准：

- 面板定位锚点。
- 六类星石标题：稳定、侵蚀、坚固、歪曲、不变、崩塌。
- 六类属性：攻击力、追加伤害、首领伤害、烙印力、队友攻击强化、队友伤害强化。
- 重置和加工状态所需的稳定文字或图形锚点。
- 所有字段专用数字模板。

实际简中文案以国服截图为准，不直接把韩服文字图片作为简中模板。

## 5. 生成流程

`generate-starstone-sprite.cjs` 按以下顺序执行：

1. 读取并校验 `manifest.json`。
2. 读取静态 PNG，检查文件存在、ID 唯一且图片非空。
3. 读取数字模板 JSON，校验每组的 `w`、`h`、声明数字集合和像素矩阵长度。
4. 使用 `pngjs` 将每个数字矩阵转换为临时 RGBA PNG；像素值保持 `0/255`，不缩放、不插值。
5. 按模板 ID 排序后交给 `spritesmith`，统一使用固定 padding 排布。
6. 校验所有生成坐标均在图内、无重复 ID、宽高与源模板一致。
7. 对精灵图内容计算短 SHA-256，生成 `opencv_starstone_zh_cn_<hash>.png`。
8. 生成 `atlas.generated.ts`，导出文件名、图像尺寸、条目坐标和 `StarstoneTemplateId` 联合类型。
9. 所有检查通过后原子替换产物，再清理当前目录中其他 `opencv_starstone_zh_cn_*.png`。

清理范围只能匹配星石专用前缀，不得删除 `opencv_template_*.png` 或其他公共资源。临时目录使用系统临时目录创建，并在成功或失败后清理。

## 6. 生成元数据

`atlas.generated.ts` 只保存生成事实，不包含运行时状态：

```ts
export const starstoneAtlasFileName = 'opencv_starstone_zh_cn_ab12cd34.png';

export const starstoneAtlasSize = { width: 1024, height: 256 } as const;

export const starstoneAtlasEntries = {
  'anchor.dot_grid': { x: 0, y: 0, width: 20, height: 18 },
  'digit.cost.0': { x: 24, y: 0, width: 10, height: 15 }
} as const;

export type StarstoneTemplateId = keyof typeof starstoneAtlasEntries;
```

生成文件顶部必须标注“自动生成，请勿手工修改”。坐标字段统一使用 `width`、`height`，不与现有文件中的 `w`、`h` 混用。

## 7. Worker 运行时接口

新增 `StarstoneAtlasStore`，由识别 Worker 持有：

```ts
interface StarstoneAtlasStore {
  readonly atlas: CvMat;
  get(id: StarstoneTemplateId): CvMat;
  dispose(): void;
}

function loadStarstoneAtlas(): Promise<StarstoneAtlasStore>;
```

加载流程：

1. 使用 `import.meta.env.BASE_URL` 与生成文件名构造 URL，从 `public` 加载精灵图，兼容子路径部署。
2. 使用 `createImageBitmap` 和 `OffscreenCanvas` 读取像素。
3. 创建一份 atlas `cv.Mat`，按识别需要统一转换为灰度或保留 RGBA。
4. `get(id)` 延迟创建并缓存对应 ROI `Mat`，同一 ID 重复调用返回同一实例。
5. Worker 停止时调用 `dispose()`，依次删除缓存 ROI 和 atlas。

Loader 使用模块级初始化 Promise 去重并发加载。初始化失败后必须清除 Promise，允许下一次 Worker 重建时重试。

ROI `Mat` 依赖父 atlas 的内存，因此必须先删除所有 ROI，再删除 atlas。Store 拥有 `get()` 返回对象的生命周期，调用方不得自行调用 `delete()`。`dispose()` 必须幂等；释放后调用 `get()` 应立即抛出明确错误。

## 8. 错误处理

生成器采用失败即停止原则：

- 清单语法错误、未知字段或重复 ID：失败。
- 静态模板缺失、为空或无法解码：失败。
- 数字组缺少 `w`、`h` 或 `expectedDigits` 声明的任一模板：失败。
- 数字组包含未在 `expectedDigits` 中声明的模板：失败。
- 数字像素矩阵长度不等于 `w * h`：失败。
- 坐标越界、重复或输出图为空：失败。
- 失败时保留上一份可用精灵图和生成元数据。

Loader 的边界错误必须带上资源名或模板 ID：

- HTTP 加载失败或响应不是图片。
- 图片尺寸与生成元数据不一致。
- 请求未知模板 ID。
- OpenCV 尚未初始化。
- Store 已释放。

加载中创建的任意 `ImageBitmap` 或 `cv.Mat` 在异常路径上都必须释放，不允许吞掉异常或返回伪成功状态。

## 9. 测试与验证

生成器使用 Node 内置 `node:test`，不增加测试框架。最小覆盖：

- 相同输入两次生成相同哈希、坐标和字节内容。
- 修改任一模板后内容哈希变化。
- 每个数字组完整生成其 `expectedDigits` 声明的数字集合。
- `digit.refresh_count.0` 存在，且只归属于刷新次数字段。
- 数字矩阵编码后像素值和尺寸保持不变。
- 坐标全部在 atlas 尺寸内且 ID 唯一。
- 缺文件、重复 ID、尺寸错误和空模板均失败。
- 失败生成不会覆盖上一份有效产物。

运行时部分优先拆出纯函数验证坐标和状态；依赖 OpenCV.js、`OffscreenCanvas` 的实际加载在后续 Worker 集成阶段做浏览器验证。本阶段最低验证命令为：

```text
pnpm generate:starstone-sprite
pnpm test:starstone-sprite
pnpm check
```

不以手工查看精灵图代替坐标和像素测试。

## 10. 实施范围

第一阶段只修改或新增：

- `package.json`、`pnpm-lock.yaml`：声明 `pngjs` 开发依赖和生成／测试命令。
- `opencv-templates/starstone/zh_cn/`：生成输入和清单。
- `scripts/generate-starstone-sprite.cjs`：独立生成器。
- `public/opencv_starstone_zh_cn_<hash>.png`：生成产物。
- `src/lib/cv/starstone/atlas.generated.ts`：生成坐标和类型。
- `src/lib/cv/starstone/atlasLoader.ts`、`types.ts`：Worker 运行时接口。
- 生成器的定向测试文件。

不会修改现有护石识别页面、`captureWorker.ts`、策略求解器或 UI。Worker 接线、面板识别和 Debug 展示属于后续阶段。
