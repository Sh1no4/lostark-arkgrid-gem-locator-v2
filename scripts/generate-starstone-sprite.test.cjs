const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { PNG } = require('pngjs');

const { generateStarstoneSprite, validateCoordinates } = require('./generate-starstone-sprite.cjs');

function writePng(filePath, width, height, values) {
  const image = new PNG({ width, height });
  for (let index = 0; index < width * height; index += 1) {
    const value = values[index] ?? 0;
    const offset = index * 4;
    image.data[offset] = value;
    image.data[offset + 1] = value;
    image.data[offset + 2] = value;
    image.data[offset + 3] = 255;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, PNG.sync.write(image));
}

function createFixture() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arkgrid-starstone-sprite-test-'));
  const templateDir = path.join(rootDir, 'opencv-templates', 'starstone', 'zh_cn');
  const staticPath = path.join(templateDir, 'static', 'anchor.png');
  writePng(staticPath, 2, 2, [0, 255, 255, 0]);
  fs.writeFileSync(
    path.join(templateDir, 'manifest.json'),
    JSON.stringify(
      {
        locale: 'zh_cn',
        static: [{ id: 'anchor.fixture', file: 'static/anchor.png' }],
        digits: [{ idPrefix: 'digit.refresh_count', source: 'refreshCnt', expectedDigits: [0, 1] }],
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(templateDir, 'digit_templates.json'),
    JSON.stringify({
      refreshCnt: {
        w: 2,
        h: 2,
        0: [255, 0, 0, 255],
        1: [0, 255, 255, 0],
      },
    })
  );
  return rootDir;
}

function readGeneratedSprite(rootDir, fileName) {
  return fs.readFileSync(path.join(rootDir, 'public', fileName));
}

test('相同输入生成稳定的精灵图和坐标', async (t) => {
  const rootDir = createFixture();
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  const first = await generateStarstoneSprite({ rootDir });
  const firstImage = readGeneratedSprite(rootDir, first.fileName);
  const second = await generateStarstoneSprite({ rootDir });

  assert.equal(second.fileName, first.fileName);
  assert.deepEqual(second.entries, first.entries);
  assert.deepEqual(readGeneratedSprite(rootDir, second.fileName), firstImage);
  assert.deepEqual(Object.keys(first.entries), [
    'anchor.fixture',
    'digit.refresh_count.0',
    'digit.refresh_count.1',
  ]);
});

test('非法数字集合不会覆盖已有产物', async (t) => {
  const rootDir = createFixture();
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  const result = await generateStarstoneSprite({ rootDir });
  const previousImage = readGeneratedSprite(rootDir, result.fileName);
  const manifestPath = path.join(
    rootDir,
    'opencv-templates',
    'starstone',
    'zh_cn',
    'manifest.json'
  );
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.digits[0].expectedDigits = [0, 1, 2];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));

  await assert.rejects(
    () => generateStarstoneSprite({ rootDir }),
    /数字集合与 expectedDigits 不一致/
  );
  assert.deepEqual(readGeneratedSprite(rootDir, result.fileName), previousImage);
});

test('重叠坐标会被拒绝', () => {
  assert.throws(
    () =>
      validateCoordinates(
        [
          { id: 'first', x: 0, y: 0, width: 2, height: 2 },
          { id: 'second', x: 1, y: 1, width: 2, height: 2 },
        ],
        4,
        4
      ),
    /模板坐标重叠/
  );
});
