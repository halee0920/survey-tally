'use strict';
// index.html 안의 <script id="tally-core"> 만 꺼내 DOM 없는 vm 에서 실행한다.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const HTML_PATH = path.join(__dirname, '..', 'index.html');

function readHtml() {
  return fs.readFileSync(HTML_PATH, 'utf8');
}

function extractCore(html) {
  const m = html.match(/<script id="tally-core">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('index.html 에 <script id="tally-core"> 가 없습니다');
  return m[1];
}

function loadCore() {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(extractCore(readHtml()), sandbox, { filename: 'index.html#tally-core' });
  if (!sandbox.SurveyTally) throw new Error('SurveyTally 가 정의되지 않았습니다');
  return sandbox.SurveyTally;
}

module.exports = { HTML_PATH, readHtml, extractCore, loadCore };
