const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { PNG } = require('pngjs');
const Spritesmith = require('spritesmith');

const SPRITE_PREFIX = 'opencv_starstone_zh_cn_';
const GENERATED_FILE = 'atlas.generated.ts';
const PADDING = 2;

function fail(message) {
  throw new Error(`[starstone-sprite] ${message}`);
}

function compareNumbers(left, right) {
  return left - right;
}

function resolveInside(rootDir, relativePath) {
  const resolvedPath = path.resolve(rootDir, relativePath);
  const relative = path.relative(rootDir, resolvedPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    fail(`模板路径超出清单目录: ${relativePath}`);
  }
  return resolvedPath;
}

function readJson(filePath, description) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`无法读取${description}: ${filePath} (${error.message})`);
  }
}

function readPng(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`模板文件不存在: ${filePath}`);
  }

  let image;
  try {
    image = PNG.sync.read(fs.readFileSync(filePath));
  } catch (error) {
    fail(`模板不是有效 PNG: ${filePath} (${error.message})`);
  }

  if (image.width <= 0 || image.height <= 0) {
    fail(`模板尺寸无效: ${filePath}`);
  }

  const hasVisiblePixel = image.data.some((_, index) => index % 4 === 3 && image.data[index] !== 0);
  if (!hasVisiblePixel) {
    fail(`模板完全透明: ${filePath}`);
  }

  return image;
}

function validateExpectedDigits(expectedDigits, source) {
  if (!Array.isArray(expectedDigits) || expectedDigits.length === 0) {
    fail(`数字组 ${source} 缺少 expectedDigits`);
  }

  const normalized = expectedDigits.map((digit) => {
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
      fail(`数字组 ${source} 的 expectedDigits 包含非法值: ${digit}`);
    }
    return digit;
  });

  const unique = [...new Set(normalized)].sort(compareNumbers);
  if (unique.length !== normalized.length) {
    fail(`数字组 ${source} 的 expectedDigits 含重复数字`);
  }

  return unique;
}

function validateDigitGroup(group, source, expectedDigits) {
  if (
    !group ||
    !Number.isInteger(group.w) ||
    !Number.isInteger(group.h) ||
    group.w <= 0 ||
    group.h <= 0
  ) {
    fail(`数字组 ${source} 的尺寸无效`);
  }

  const actualDigits = Object.keys(group)
    .filter((key) => /^\d+$/.test(key))
    .map(Number)
    .sort(compareNumbers);

  if (
    actualDigits.length !== expectedDigits.length ||
    actualDigits.some((digit, index) => digit !== expectedDigits[index])
  ) {
    fail(`数字组 ${source} 的数字集合与 expectedDigits 不一致`);
  }

  for (const digit of expectedDigits) {
    const pixels = group[String(digit)];
    if (!Array.isArray(pixels) || pixels.length !== group.w * group.h) {
      fail(`数字组 ${source}.${digit} 的像素矩阵尺寸不符`);
    }
    if (pixels.some((pixel) => pixel !== 0 && pixel !== 255)) {
      fail(`数字组 ${source}.${digit} 包含非二值像素`);
    }
  }
}

function writeDigitPng(filePath, pixels, width, height) {
  const image = new PNG({ width, height });
  for (let index = 0; index < pixels.length; index += 1) {
    const value = pixels[index];
    const offset = index * 4;
    image.data[offset] = value;
    image.data[offset + 1] = value;
    image.data[offset + 2] = value;
    image.data[offset + 3] = 255;
  }
  fs.writeFileSync(filePath, PNG.sync.write(image));
}

function runSpritesmith(sourcePaths) {
  return new Promise((resolve, reject) => {
    Spritesmith.run(
      {
        src: sourcePaths,
        padding: PADDING,
        algorithm: 'top-down',
        algorithmOpts: { sort: false },
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      }
    );
  });
}

function writeFileReplacing(filePath, content) {
  const directory = path.dirname(filePath);
  const temporaryPath = path.join(directory, `.${path.basename(filePath)}.${process.pid}.tmp`);
  const backupPath = `${filePath}.${process.pid}.bak`;
  fs.writeFileSync(temporaryPath, content);

  try {
    if (fs.existsSync(filePath)) {
      fs.renameSync(filePath, backupPath);
    }
    fs.renameSync(temporaryPath, filePath);
    fs.rmSync(backupPath, { force: true });
  } catch (error) {
    fs.rmSync(temporaryPath, { force: true });
    if (!fs.existsSync(filePath) && fs.existsSync(backupPath)) {
      fs.renameSync(backupPath, filePath);
    }
    throw error;
  }
}

function createGeneratedModule(fileName, width, height, entries) {
  const quote = (value) => `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
  const entryLines = Object.entries(entries)
    .map(
      ([id, rect]) =>
        `  ${quote(id)}: {\n` +
        `    x: ${rect.x},\n` +
        `    y: ${rect.y},\n` +
        `    width: ${rect.width},\n` +
        `    height: ${rect.height},\n` +
        `  },`
    )
    .join('\n');

  return (
    `// 此文件由 scripts/generate-starstone-sprite.cjs 自动生成，请勿手工修改。\n\n` +
    `export const starstoneAtlasFileName = ${quote(fileName)} as const;\n\n` +
    `export const starstoneAtlasSize = { width: ${width}, height: ${height} } as const;\n\n` +
    `export const starstoneAtlasEntries = {\n${entryLines}\n} as const;\n\n` +
    `export type StarstoneTemplateId = keyof typeof starstoneAtlasEntries;\n` +
    `export type StarstoneTemplateRect = (typeof starstoneAtlasEntries)[StarstoneTemplateId];\n`
  );
}

function cleanupPreviousSprites(publicDir, fileName) {
  for (const entry of fs.readdirSync(publicDir, { withFileTypes: true })) {
    if (
      !entry.isFile() ||
      entry.name === fileName ||
      !new RegExp(`^${SPRITE_PREFIX}[a-f0-9]{16}\\.png$`).test(entry.name)
    ) {
      continue;
    }
    fs.rmSync(path.join(publicDir, entry.name));
  }
}

function validateCoordinates(coordinateEntries, atlasWidth, atlasHeight) {
  for (const entry of coordinateEntries) {
    if (
      entry.x < 0 ||
      entry.y < 0 ||
      entry.width <= 0 ||
      entry.height <= 0 ||
      entry.x + entry.width > atlasWidth ||
      entry.y + entry.height > atlasHeight
    ) {
      fail(`模板坐标无效: ${entry.id}`);
    }
  }

  for (let leftIndex = 0; leftIndex < coordinateEntries.length; leftIndex += 1) {
    const left = coordinateEntries[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < coordinateEntries.length; rightIndex += 1) {
      const right = coordinateEntries[rightIndex];
      const overlaps =
        left.x < right.x + right.width &&
        left.x + left.width > right.x &&
        left.y < right.y + right.height &&
        left.y + left.height > right.y;
      if (overlaps) {
        fail(`模板坐标重叠: ${left.id} 与 ${right.id}`);
      }
    }
  }
}

async function generateStarstoneSprite(options = {}) {
  const rootDir = options.rootDir ?? path.resolve(__dirname, '..');
  const templateDir =
    options.templateDir ?? path.join(rootDir, 'opencv-templates', 'starstone', 'zh_cn');
  const publicDir = options.publicDir ?? path.join(rootDir, 'public');
  const generatedDir = options.generatedDir ?? path.join(rootDir, 'src', 'lib', 'cv', 'starstone');
  const manifestPath = path.join(templateDir, 'manifest.json');
  const digitTemplatePath = path.join(templateDir, 'digit_templates.json');
  const manifest = readJson(manifestPath, '模板清单');
  const digitTemplates = readJson(digitTemplatePath, '数字模板');

  if (
    manifest.locale !== 'zh_cn' ||
    !Array.isArray(manifest.static) ||
    !Array.isArray(manifest.digits)
  ) {
    fail('模板清单必须包含 locale: zh_cn、static 和 digits');
  }

  fs.mkdirSync(publicDir, { recursive: true });
  fs.mkdirSync(generatedDir, { recursive: true });
  const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arkgrid-starstone-sprite-'));
  const entries = [];
  const templateIds = new Set();

  function addEntry(id, sourcePath) {
    if (typeof id !== 'string' || id.length === 0) {
      fail('模板 ID 不能为空');
    }
    if (templateIds.has(id)) {
      fail(`模板 ID 重复: ${id}`);
    }
    readPng(sourcePath);
    templateIds.add(id);
    entries.push({ id, sourcePath });
  }

  try {
    for (const staticEntry of manifest.static) {
      if (!staticEntry || typeof staticEntry.file !== 'string') {
        fail('静态模板条目必须包含 file');
      }
      addEntry(staticEntry.id, resolveInside(templateDir, staticEntry.file));
    }

    for (const digitEntry of manifest.digits) {
      if (
        !digitEntry ||
        typeof digitEntry.idPrefix !== 'string' ||
        typeof digitEntry.source !== 'string'
      ) {
        fail('数字模板条目必须包含 idPrefix 和 source');
      }
      const expectedDigits = validateExpectedDigits(digitEntry.expectedDigits, digitEntry.source);
      const group = digitTemplates[digitEntry.source];
      validateDigitGroup(group, digitEntry.source, expectedDigits);

      for (const digit of expectedDigits) {
        const sourcePath = path.join(
          temporaryDir,
          `${digitEntry.idPrefix.replaceAll('.', '_')}_${digit}.png`
        );
        writeDigitPng(sourcePath, group[String(digit)], group.w, group.h);
        addEntry(`${digitEntry.idPrefix}.${digit}`, sourcePath);
      }
    }

    entries.sort((left, right) => left.id.localeCompare(right.id));
    const sourcePaths = entries.map((entry) => entry.sourcePath);
    const sprite = await runSpritesmith(sourcePaths);
    if (
      !sprite.image ||
      !sprite.properties ||
      sprite.properties.width <= 0 ||
      sprite.properties.height <= 0
    ) {
      fail('Spritesmith 未生成有效精灵图');
    }

    const hash = crypto.createHash('sha256').update(sprite.image).digest('hex').slice(0, 16);
    const fileName = `${SPRITE_PREFIX}${hash}.png`;
    const outputPath = path.join(publicDir, fileName);
    const generatedEntries = {};
    const coordinateEntries = [];

    for (const entry of entries) {
      const coordinates = sprite.coordinates[entry.sourcePath];
      if (!coordinates) {
        fail(`缺少模板坐标: ${entry.id}`);
      }
      const generatedEntry = {
        x: coordinates.x,
        y: coordinates.y,
        width: coordinates.width,
        height: coordinates.height,
      };
      generatedEntries[entry.id] = generatedEntry;
      coordinateEntries.push({ id: entry.id, ...generatedEntry });
    }
    validateCoordinates(coordinateEntries, sprite.properties.width, sprite.properties.height);

    if (!fs.existsSync(outputPath)) {
      writeFileReplacing(outputPath, sprite.image);
    }

    const generatedModule = createGeneratedModule(
      fileName,
      sprite.properties.width,
      sprite.properties.height,
      generatedEntries
    );
    writeFileReplacing(path.join(generatedDir, GENERATED_FILE), generatedModule);
    cleanupPreviousSprites(publicDir, fileName);

    return {
      fileName,
      outputPath,
      entries: generatedEntries,
      width: sprite.properties.width,
      height: sprite.properties.height,
    };
  } finally {
    fs.rmSync(temporaryDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  generateStarstoneSprite()
    .then((result) => {
      console.log(
        `Generated ${result.fileName} (${result.width}x${result.height}, ${Object.keys(result.entries).length} templates)`
      );
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}

module.exports = {
  generateStarstoneSprite,
  validateCoordinates,
  validateDigitGroup,
  validateExpectedDigits,
};
