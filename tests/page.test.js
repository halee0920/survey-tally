'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readHtml, extractCore } = require('./load-core');

const html = readHtml();
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');

test('외부 자원을 불러오지 않는다(스크립트·글꼴·스타일·이미지)', () => {
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc=/i, '외부 스크립트');
  assert.doesNotMatch(html, /<link\b/i, 'link 태그');
  assert.doesNotMatch(html, /@import|@font-face|url\(/i, 'CSS 외부 참조');
  assert.doesNotMatch(html, /<(img|iframe|object|embed|video|audio|source)\b/i, '외부 매체 태그');
  assert.doesNotMatch(html, /(https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}/i, '외부 주소');
});

test('데이터를 내보내거나 저장하는 API 를 쓰지 않는다', () => {
  for (const api of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource',
    'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'caches.', 'serviceWorker',
    'postMessage', 'window.open', 'innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'eval(', 'new Function']) {
    assert.ok(!scripts.includes(api), api);
  }
});

test('CSP 로 외부 요청을 막는다', () => {
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
  assert.ok(m, 'CSP 메타 태그 없음');
  assert.match(m[1], /default-src 'none'/);
  assert.doesNotMatch(m[1], /connect-src|https?:/);
});

test('입력란은 자동완성·맞춤법 검사를 끈다', () => {
  const ta = html.match(/<textarea\b[^>]*>/)[0];
  assert.match(ta, /autocomplete="off"/);
  assert.match(ta, /spellcheck="false"/);
});

test('계산 로직은 DOM 을 쓰지 않는다', () => {
  const core = extractCore(html);
  assert.doesNotMatch(core, /\b(document|window|navigator|location)\b/);
});

test('결과 표 머리글 순서', () => {
  const heads = [...html.match(/<thead>[\s\S]*?<\/thead>/)[0].matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((m) => m[1]);
  assert.deepEqual(heads, ['문항', '유효 응답', '평균', '빈 응답', '제외']);
});
