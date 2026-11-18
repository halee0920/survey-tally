'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('저장소 맨 위에 빈 .nojekyll 파일이 있다', () => {
  const p = path.join(__dirname, '..', '.nojekyll');
  assert.ok(fs.existsSync(p), '.nojekyll 없음');
  assert.equal(fs.statSync(p).size, 0, '.nojekyll 은 비어 있어야 함');
});
