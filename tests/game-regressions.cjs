const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function scripts(file) {
  return [...fs.readFileSync(path.join(root, file), 'utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
    .map(match => match[1]).filter(code => code.trim());
}

// Проверяем настоящие функции игры без браузера, подставляя только экран и звук.
function loadGame(file, expose, saved = {}) {
  const elements = new Map(), timers = new Map(), oscillators = [];
  let timerId = 0, now = 10000;
  const documentEvents = {};
  function element(id) {
    if (elements.has(id)) return elements.get(id);
    const classes = new Set();
    const el = {style: {}, textContent: '', innerHTML: '', listeners: {}, drawCalls: 0,
      classList: {add: (...names) => names.forEach(n => classes.add(n)),
        remove: (...names) => names.forEach(n => classes.delete(n)), contains: n => classes.has(n)},
      addEventListener: (name, fn) => { el.listeners[name] = fn; }, appendChild() {},
      getContext: () => new Proxy({}, {get: (_, key) => (...args) => {
        el.drawCalls++;
        if (String(key).includes('Gradient')) return {addColorStop() {}};
        if (key === 'measureText') return {width: String(args[0]).length * 8};
      }})};
    elements.set(id, el);
    return el;
  }
  function audioNode() {
    const param = {value: 0, setValueAtTime() {}, setTargetAtTime() {}, exponentialRampToValueAtTime() {}};
    return {gain: param, frequency: param, stopped: 0, disconnected: 0,
      connect() {}, start() {}, stop() { this.stopped++; }, disconnect() { this.disconnected++; }};
  }
  const context = {
    console, Math, Date, innerWidth: 390, innerHeight: 844, devicePixelRatio: 1,
    performance: {now: () => now}, navigator: {vibrate() {}},
    document: {hidden: false, addEventListener: (event, fn) => { documentEvents[event] = fn; },
      getElementById: element, createElement: () => element(Symbol()), querySelectorAll: () => []},
    localStorage: {getItem: key => saved[key] ?? null, setItem: (key, value) => { saved[key] = String(value); }, removeItem: key => { delete saved[key]; }},
    requestAnimationFrame() {}, addEventListener() {}, Image: class {},
    setTimeout: (fn, ms) => { timers.set(++timerId, {fn, ms}); return timerId; },
    clearTimeout: id => timers.delete(id),
    AudioContext: class {
      currentTime = 0; state = 'running'; destination = {};
      suspend() { this.state='suspended'; return Promise.resolve(); }
      resume() { this.state='running'; return Promise.resolve(); }
      createOscillator() { const n = audioNode(); oscillators.push(n); return n; }
      createGain() { return audioNode(); }
      createBiquadFilter() { return audioNode(); }
    }
  };
  context.window = context;
  vm.createContext(context);
  const code = scripts(file).at(-1);
  const end = code.lastIndexOf('})();');
  const insertion = end > 0 ? end : code.length;
  vm.runInContext(code.slice(0, insertion) + '\nwindow.testGame = ' + expose + ';\n' + code.slice(insertion), context);
  return {api: context.testGame, elements, timers, oscillators,
    visibility(hidden, time) { now=time; context.document.hidden=hidden; documentEvents.visibilitychange(); }};
}

for (const file of ['index.html', ...fs.readdirSync(path.join(root, 'games')).filter(f => f.endsWith('.html')).map(f => 'games/' + f)]) {
  for (const code of scripts(file)) new vm.Script(code, {filename: file});
}

const fishing = loadGame('games/fishing.html', `{
  missedBite, update, doCatch,
  bite() { phase='bite'; biteEndTime=1; },
  catchFish(junk=false) { currentFish=mkFish(FISH[junk ? 6 : 0]); score=20; doCatch(); },
  phase() { return phase; }, score() { return score; },
  deadlines() { return [biteEndTime, fightEndTime, nextFishRunTime, pullStart]; }
}`, {fishingM2: '1'});
fishing.api.bite();
for (let frame = 0; frame < 60; frame++) fishing.api.update(1 / 60);
assert.equal(fishing.api.phase(), 'miss');
assert.equal([...fishing.timers.values()].filter(t => t.ms === 800).length, 1, 'Пропущенная поклёвка должна возвращать удочку один раз');
fishing.api.catchFish();
assert.ok(fishing.elements.get('reveal').classList.contains('show'));
assert.ok(fishing.elements.get('revealCv').drawCalls > 5, 'Рыба должна быть нарисована сразу при показе улова');
fishing.api.catchFish(true);
assert.equal(Number(fishing.elements.get('vScore').textContent), fishing.api.score(), 'Штраф за сапог должен обновлять счёт на экране');
const deadlines = Array.from(fishing.api.deadlines());
fishing.visibility(true, 10000);
fishing.visibility(false, 70000);
assert.deepEqual(Array.from(fishing.api.deadlines()), deadlines.map(t => t + 60000), 'В фоне время поклёвки и вываживания не должно истекать');

const race = loadGame('games/car-runner.html', `{
  startEngine, stopEngine,
  mute(value) { muted=value; },
  engine() { return engine; }
}`);
race.api.startEngine();
race.api.mute(true);
race.api.stopEngine();
assert.equal(race.api.engine(), null);
assert.ok(race.oscillators.every(o => o.stopped === 1 && o.disconnected === 1), 'Выключение звука должно останавливать оба генератора мотора');
race.api.mute(false);
race.api.startEngine();
assert.equal(race.oscillators.length, 4);
for (const {fn} of race.timers.values()) fn();
assert.ok(race.oscillators.slice(2).every(o => o.stopped === 0), 'Предыдущий мотор не должен выключать новый');
race.api.stopEngine();
race.api.stopEngine();
assert.ok(race.oscillators.every(o => o.stopped === 1));
race.api.startEngine();
race.visibility(true, 10000);
assert.equal(race.api.engine(), null, 'Мотор должен выключаться при уходе из игры');
race.visibility(false, 70000);
const ttt = loadGame('games/tictactoe.html', '{loadTTT, board:()=>board}', {
  bear_ttt: JSON.stringify({board:['X','','','','','','','',''], mode:'bot', myMark:'X', currentMark:'X', myTurn:false})
});
assert.equal(ttt.api.loadTTT(), true);
const botTurn = [...ttt.timers.values()].find(t => t.fn.name === 'botMove');
assert.ok(botTurn, 'После восстановления партии компьютер должен продолжать прерванный ход');
botTurn.fn();
assert.ok(ttt.api.board().includes('O'));
console.log('Проверены сценарии рыбалки, выключение и повторный запуск мотора, синтаксис всех страниц.');
