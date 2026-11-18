'use strict';
// index.html 안의 <script id="gomoku-core"> 만 꺼내 DOM 없이 시험한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const core = html.match(/<script id="gomoku-core">([\s\S]*?)<\/script>/)[1];
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(core, sandbox);
const G = sandbox.Gomoku;
const plain = (x) => JSON.parse(JSON.stringify(x));

// moves: [[r,c], ...] 를 흑부터 번갈아 둔다
function playAll(game, moves) {
  for (const [r, c] of moves) assert.ok(game.play(r, c), `둘 수 없음: ${r},${c}`);
}

test('새 게임: 10x10 빈 판, 흑 차례', () => {
  const s = G.createGame().state();
  assert.equal(s.size, 10);
  assert.equal(s.board.length, 10);
  assert.ok(s.board.every((row) => row.length === 10 && row.every((v) => v === G.EMPTY)));
  assert.equal(s.turn, G.BLACK);
  assert.equal(s.winner, G.EMPTY);
  assert.equal(s.lastMove, null);
});

test('번갈아 두고, 이미 돌이 있거나 판 밖이면 둘 수 없다', () => {
  const g = G.createGame();
  assert.ok(g.play(4, 4));
  assert.equal(g.state().turn, G.WHITE);
  assert.equal(g.play(4, 4), false);
  assert.equal(g.play(-1, 0), false);
  assert.equal(g.play(0, 10), false);
  assert.equal(g.state().turn, G.WHITE, '실패한 수는 차례를 바꾸지 않음');
  assert.ok(g.play(5, 5));
  assert.equal(g.state().board[4][4], G.BLACK);
  assert.equal(g.state().board[5][5], G.WHITE);
  assert.deepEqual(plain(g.state().lastMove), [5, 5]);
});

const lines = {
  가로: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
  세로: [[5, 9], [6, 9], [7, 9], [8, 9], [9, 9]],
  대각선: [[2, 2], [3, 3], [4, 4], [5, 5], [6, 6]],
  역대각선: [[1, 8], [2, 7], [3, 6], [4, 5], [5, 4]],
};
for (const [name, black] of Object.entries(lines)) {
  test(`흑 ${name} 다섯 개면 승리`, () => {
    const g = G.createGame();
    const white = [[9, 0], [9, 2], [8, 0], [8, 2]];
    for (let i = 0; i < 5; i++) {
      g.play(...black[i]);
      if (i < 4) g.play(...white[i]);
    }
    const s = g.state();
    assert.equal(s.winner, G.BLACK);
    assert.deepEqual(plain(s.winLine), black.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]));
  });
}

test('네 개는 승리가 아니다', () => {
  const g = G.createGame();
  playAll(g, [[0, 0], [9, 9], [0, 1], [9, 8], [0, 2], [9, 7], [0, 3]]);
  assert.equal(g.state().winner, G.EMPTY);
});

test('백도 이길 수 있다', () => {
  const g = G.createGame();
  playAll(g, [[0, 0], [5, 0], [0, 2], [5, 1], [0, 4], [5, 2], [0, 6], [5, 3], [9, 9], [5, 4]]);
  assert.equal(g.state().winner, G.WHITE);
});

test('여섯 개 이상(장목)도 승리, 사이를 메워 이어도 승리', () => {
  const g = G.createGame();
  // 흑: 0,1,2 와 4,5 를 놓고 3 을 메워 여섯 줄
  playAll(g, [[3, 0], [9, 0], [3, 1], [9, 2], [3, 2], [9, 4], [3, 4], [9, 6], [3, 5], [9, 8], [3, 3]]);
  const s = g.state();
  assert.equal(s.winner, G.BLACK);
  assert.equal(s.winLine.length, 6);
});

test('승부가 나면 더 둘 수 없다', () => {
  const g = G.createGame();
  playAll(g, [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2], [0, 3], [1, 3], [0, 4]]);
  assert.equal(g.play(5, 5), false);
  assert.equal(g.state().moveCount, 9);
});

test('색이 섞인 줄은 승리가 아니다', () => {
  const g = G.createGame();
  // 흑 0,0~0,3, 백 0,4, 흑 0,5 → 흑 4개 + 1개
  playAll(g, [[0, 0], [0, 4], [0, 1], [9, 9], [0, 2], [9, 8], [0, 3]]);
  assert.equal(g.state().winner, G.EMPTY);
  g.play(9, 7); g.play(0, 5);
  assert.equal(g.state().winner, G.EMPTY);
});

test('무르기: 마지막 수를 되돌리고 차례도 돌아온다', () => {
  const g = G.createGame();
  assert.equal(g.undo(), false, '빈 판은 무를 수 없음');
  playAll(g, [[4, 4], [5, 5]]);
  assert.ok(g.undo());
  let s = g.state();
  assert.equal(s.board[5][5], G.EMPTY);
  assert.equal(s.turn, G.WHITE);
  assert.deepEqual(plain(s.lastMove), [4, 4]);
  assert.ok(g.undo());
  s = g.state();
  assert.equal(s.turn, G.BLACK);
  assert.equal(s.moveCount, 0);
});

test('무르기로 승리를 취소할 수 있다', () => {
  const g = G.createGame();
  playAll(g, [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2], [0, 3], [1, 3], [0, 4]]);
  assert.equal(g.state().winner, G.BLACK);
  g.undo();
  const s = g.state();
  assert.equal(s.winner, G.EMPTY);
  assert.equal(s.winLine.length, 0);
  assert.equal(s.turn, G.BLACK);
  assert.ok(g.play(5, 5));
});

test('새 게임: 판을 비우고 흑부터', () => {
  const g = G.createGame();
  playAll(g, [[4, 4], [5, 5], [6, 6]]);
  g.reset();
  const s = g.state();
  assert.equal(s.moveCount, 0);
  assert.equal(s.turn, G.BLACK);
  assert.ok(s.board.every((row) => row.every((v) => v === G.EMPTY)));
});

test('판이 다 차도록 승부가 없으면 무승부', () => {
  const g = G.createGame();
  // (c + 2r) mod 4 < 2 이면 흑: 가로·세로·두 대각선 모두 같은 색이 최대 2개까지만 이어진다
  const color = (r, c) => ((c + 2 * r) % 4 < 2 ? G.BLACK : G.WHITE);
  const blacks = [], whites = [];
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) (color(r, c) === G.BLACK ? blacks : whites).push([r, c]);
  assert.equal(blacks.length, 50);
  for (let i = 0; i < 50; i++) { g.play(...blacks[i]); g.play(...whites[i]); }
  const s = g.state();
  assert.equal(s.winner, G.EMPTY);
  assert.equal(s.moveCount, 100);
  assert.equal(s.draw, true);
});

test('state() 는 복사본을 돌려준다', () => {
  const g = G.createGame();
  g.state().board[0][0] = G.WHITE;
  assert.equal(g.state().board[0][0], G.EMPTY);
});

test('페이지는 외부 자원을 불러오지 않는다', () => {
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc=|<link\b|@import|url\(|https?:\/\//i);
});
