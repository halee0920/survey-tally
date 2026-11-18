'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCore } = require('./load-core');

const T = loadCore();
// vm 안에서 만든 배열은 다른 realm 이라 deepStrictEqual 이 프로토타입 차이로 실패하므로 JSON 으로 옮긴다.
const plain = (x) => JSON.parse(JSON.stringify(x));
const row = (q) => [q.name, q.valid, q.average, q.blank, q.excluded];
const table = (text) => plain(T.tally(text).questions.map(row));

test('classifyCell: 1~5 는 유효', () => {
  for (const v of ['1', '2', '3', '4', '5']) {
    assert.deepEqual(plain(T.classifyCell(v)), { kind: 'valid', value: Number(v) });
  }
});

test('classifyCell: 앞뒤 공백을 지우고 판정', () => {
  assert.deepEqual(plain(T.classifyCell('  3 ')), { kind: 'valid', value: 3 });
  assert.deepEqual(plain(T.classifyCell(' 4　')), { kind: 'valid', value: 4 });
});

test('classifyCell: 비었거나 공백만 있으면 빈 응답', () => {
  for (const v of ['', ' ', '   ', '　', undefined, null]) {
    assert.equal(T.classifyCell(v).kind, 'blank', JSON.stringify(v));
  }
});

test('classifyCell: 그 밖의 값은 제외', () => {
  for (const v of ['0', '6', '3.0', '1.5', '-1', '+3', '03', '１', 'a', '3점', '1 2', '５', 'N/A']) {
    assert.equal(T.classifyCell(v).kind, 'excluded', v);
  }
});

test('formatAverage: 유효 0 이면 "-"', () => {
  assert.equal(T.formatAverage(0, 0), '-');
});

test('formatAverage: 둘째 자리까지, 셋째 자리에서 반올림', () => {
  assert.equal(T.formatAverage(9, 3), '3.00');
  assert.equal(T.formatAverage(8, 3), '2.67'); // 2.666…
  assert.equal(T.formatAverage(7, 3), '2.33'); // 2.333…
  assert.equal(T.formatAverage(5, 2), '2.50');
  assert.equal(T.formatAverage(5, 1), '5.00');
  assert.equal(T.formatAverage(1, 1), '1.00');
});

test('formatAverage: 셋째 자리가 정확히 5 이면 올림(부동소수 오차 없음)', () => {
  // 1.005, 2.675 등은 Number#toFixed 로는 내림되는 대표적 사례
  assert.equal(T.formatAverage(201, 200), '1.01'); // 1.005
  assert.equal(T.formatAverage(535, 200), '2.68'); // 2.675
  assert.equal(T.formatAverage(1001, 1000 / 1), '1.00'); // 1.001
  assert.equal(T.formatAverage(4009, 1000), '4.01'); // 4.009
  assert.equal(T.formatAverage(4005, 1000), '4.01'); // 4.005
  assert.equal(T.formatAverage(4004, 1000), '4.00'); // 4.004
  assert.equal(T.formatAverage(4995, 1000), '5.00'); // 4.995
});

test('parseTSV: 탭·줄바꿈 종류', () => {
  assert.deepEqual(plain(T.parseTSV('a\tb\r\nc\td\r\n')), [['a', 'b'], ['c', 'd']]);
  assert.deepEqual(plain(T.parseTSV('a\tb\nc\td')), [['a', 'b'], ['c', 'd']]);
  assert.deepEqual(plain(T.parseTSV('a\tb\rc\td\r')), [['a', 'b'], ['c', 'd']]);
  assert.deepEqual(plain(T.parseTSV('a\t\t')), [['a', '', '']]);
  assert.deepEqual(plain(T.parseTSV('')), []);
});

test('parseTSV: 엑셀식 따옴표 칸', () => {
  assert.deepEqual(plain(T.parseTSV('번호\t"만족\n정도"\t"말 ""인용"""\n1\t3\t4')),
    [['번호', '만족\n정도', '말 "인용"'], ['1', '3', '4']]);
  // 닫히지 않은 따옴표나 칸 중간의 따옴표는 글자 그대로
  assert.deepEqual(plain(T.parseTSV('a"b\t"c\n1\t2')), [['a"b', '"c'], ['1', '2']]);
});

test('tally: 기본 집계 — 첫 열은 집계하지 않음', () => {
  const text = [
    '응답번호\t문항1\t문항2',
    '1\t5\t4',
    '2\t3\t2',
    '3\t4\t',
  ].join('\r\n') + '\r\n';
  const r = T.tally(text);
  assert.equal(r.ok, true);
  assert.equal(r.responseCount, 3);
  assert.deepEqual(table(text), [
    ['문항1', 3, '4.00', 0, 0],
    ['문항2', 2, '3.00', 1, 0],
  ]);
});

test('tally: 빈 응답과 제외 구분, 앞뒤 공백 허용', () => {
  const text = [
    '번호\tQ1\tQ2\tQ3',
    '1\t 1 \t   \t6',
    '2\t2\t\t0',
    '3\t3.0\tx\t ',
    '4\t5\t \t-',
  ].join('\n');
  assert.deepEqual(table(text), [
    ['Q1', 3, '2.67', 0, 1],
    ['Q2', 0, '-', 3, 1],
    ['Q3', 0, '-', 1, 3],
  ]);
});

test('tally: 칸이 모자란 줄은 모자란 칸을 빈 응답으로', () => {
  const text = [
    '번호\tA\tB\tC',
    '1\t4\t4\t4',
    '2\t2',
    '3',
  ].join('\n');
  assert.deepEqual(table(text), [
    ['A', 2, '3.00', 1, 0],
    ['B', 1, '4.00', 2, 0],
    ['C', 1, '4.00', 2, 0],
  ]);
});

test('tally: 머리글보다 많은 칸은 무시', () => {
  const text = '번호\tA\n1\t3\t5\t9';
  assert.deepEqual(table(text), [['A', 1, '3.00', 0, 0]]);
});

test('tally: 응답번호 열 값은 판정에 쓰지 않음', () => {
  const text = '번호\tA\nabc\t2\n\t4';
  // 두 번째 응답은 번호가 비었지만 A 칸이 있으므로 응답 줄이다
  assert.deepEqual(table(text), [['A', 2, '3.00', 0, 0]]);
});

test('tally: 모든 칸이 빈 줄(끝 줄바꿈·빈 행)은 응답으로 세지 않음', () => {
  const text = '번호\tA\tB\r\n1\t5\t\r\n\t\t\r\n\r\n   \r\n2\t1\t3\r\n\r\n';
  const r = T.tally(text);
  assert.equal(r.responseCount, 2);
  assert.deepEqual(table(text), [
    ['A', 2, '3.00', 0, 0],
    ['B', 1, '3.00', 1, 0],
  ]);
});

test('tally: 문항 이름 공백 제거, 빈 이름은 (N열)', () => {
  const text = '번호\t  만족도 \t\n1\t3\t4';
  assert.deepEqual(table(text), [
    ['만족도', 1, '3.00', 0, 0],
    ['(3열)', 1, '4.00', 0, 0],
  ]);
});

test('tally: 머리글만 있으면 문항마다 0건, 평균 "-"', () => {
  const r = T.tally('번호\tA\tB\n');
  assert.equal(r.ok, true);
  assert.equal(r.responseCount, 0);
  assert.deepEqual(table('번호\tA\tB\n'), [['A', 0, '-', 0, 0], ['B', 0, '-', 0, 0]]);
});

test('tally: 빈 입력·문항 열 없음은 안내 문구', () => {
  for (const t of ['', '   ', '\n\n', '\t\t\n']) {
    const r = T.tally(t);
    assert.equal(r.ok, false);
    assert.match(r.message, /붙여넣은 내용이 없습니다/);
  }
  const r = T.tally('응답번호\n1\n2');
  assert.equal(r.ok, false);
  assert.match(r.message, /문항 열이 없습니다/);
});

test('tally: 칸마다 유효+빈 응답+제외 = 응답 줄 수', () => {
  const lines = ['번호\tA\tB\tC\tD'];
  const pool = ['1', '2', '3', '4', '5', '', ' ', '6', 'x', '2.5'];
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 200; i++) {
    const cells = [String(i + 1)];
    const len = Math.floor(rnd() * 5);
    for (let k = 0; k < len; k++) cells.push(pool[Math.floor(rnd() * pool.length)]);
    lines.push(cells.join('\t'));
  }
  const r = T.tally(lines.join('\n'));
  assert.equal(r.responseCount, 200);
  for (const q of r.questions) assert.equal(q.valid + q.blank + q.excluded, 200, q.name);
});
