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
      getContext: () => new Proxy({globalAlpha:1}, {get: (target, key) => key in target ? target[key] : (...args) => {
        el.drawCalls++;
        assert.ok(args.every(arg=>typeof arg!=='number' || Number.isFinite(arg)), 'Рисование не должно получать неверные координаты');
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
    console, Math: Object.create(Math), Date, innerWidth: 390, innerHeight: 844, devicePixelRatio: 1,
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
  let seed=12345;
  context.Math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  vm.createContext(context);
  if(file==='games/fishing.html') vm.runInContext(fs.readFileSync(path.join(root,'games/fishing-species.js'),'utf8'),context);
  const code = scripts(file).at(-1);
  const end = code.lastIndexOf('})();');
  const insertion = end > 0 ? end : code.length;
  vm.runInContext(code.slice(0, insertion) + '\nwindow.testGame = ' + expose + ';\n' + code.slice(insertion), context);
  return {api: context.testGame, elements, timers, oscillators,
    time:()=>now,
    step(ms=1000/60) { now+=ms; context.testGame.update(ms/1000); },
    frame(ms=1000/60) { now+=ms; context.testGame.loop(now); },
    viewport(width,height) { context.innerWidth=width; context.innerHeight=height; context.testGame.resize(); },
    visibility(hidden, time) { now=time; context.document.hidden=hidden; documentEvents.visibilitychange(); }};
}

for (const file of ['index.html', ...fs.readdirSync(path.join(root, 'games')).filter(f => f.endsWith('.html')).map(f => 'games/' + f)]) {
  for (const code of scripts(file)) new vm.Script(code, {filename: file});
}

const fishing = loadGame('games/fishing.html', `{
  missedBite, update, loop, doCatch, resize, hookIt, reelTap,
  species:FishingSpecies,
  bite() { currentFish=mkFish(FISH[0]); phase='bite'; biteEndTime=1; },
  catchFish(junk=false) { currentFish=mkFish(FISH.find(f=>!!f.junk===junk)); score=20; doCatch(); },
  prepare(index,edge=1) { currentFish=mkFish(FISH[index]); currentFish.hp=FISH[index].fightHP*1.3; floatTargetX=edge<0?22:W-22; floatTargetY=H*.6; startNibble(); },
  stats() { return {phase,id:currentFish.id,tension:tensionPct,hp:fishHP,inRun:performance.now()<fishRunUntil,x:floatX,y:floatY,elapsed:performance.now()-fightStartTime}; },
  breakAtFinish() { fishHP=0; tensionPct=100; },
  paint(index) { drawFishByName(ctx,FISH[index].name,200,200,110,.1,1); },
  phase() { return phase; }, score() { return score; },
  deadlines() { return [biteEndTime, fightEndTime, nextFishRunTime, pullStart,nibbleStartTime,biteStartTime,fightStartTime]; }
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

const species=fishing.api.species;
assert.equal(species.fish.filter(f=>!f.junk).length,16);
assert.equal(new Set(species.fish.map(f=>f.id)).size,17);
assert.equal(new Set(Object.values(species.profiles).map(p=>JSON.stringify(p.stages))).size,17,'Поклёвки должны различаться');
let weightBefore=0;
const totalWeight=species.fish.reduce((sum,f)=>sum+f.rarity,0);
for(const fish of species.fish){
  assert.equal(species.choose(()=>(weightBefore+fish.rarity/2)/totalWeight).id,fish.id,'Каждый вид должен выпадать');
  weightBefore+=fish.rarity;
  const profile=species.profiles[fish.id];
  assert.ok(profile.strike.window>=2300,'На телефоне должно быть время подсечь');
  for(const direction of [-1,1]) for(let ms=0;ms<profile.nibbleMs;ms+=40){
    const pose=species.pose(profile,'nibble',ms,1,direction);
    assert.ok([pose.depth,pose.side,pose.tilt].every(Number.isFinite));
  }
}
assert.ok(species.pose(species.profiles.bream,'bite',800).depth<0,'Лещ поднимает поплавок');
assert.ok(species.pose(species.profiles.pike,'bite',800).side>50,'Щука уводит поплавок в сторону');
assert.ok(species.pose(species.profiles.catfish,'bite',800).depth>40,'Сом топит поплавок');

for(const fps of [30,60,120]){
  fishing.viewport(fps===30?320:390,844);
  for(let index=0;index<species.fish.length;index++){
    const fish=species.fish[index];
    fishing.api.prepare(index,index%2?-1:1);
    const selected=fishing.api.stats().id;
    for(let step=0;step<fps*6 && fishing.api.phase()==='nibble';step++) fishing.step(1000/fps);
    assert.equal(fishing.api.phase(),'bite',fish.name+': должна начаться поклёвка');
    assert.equal(fishing.api.stats().id,selected,'Рыба не должна заменяться при подсечке');
    fishing.api.paint(index);
    fishing.api.hookIt();
    if(fish.junk){ assert.equal(fishing.api.phase(),'catch'); continue; }
    const before=fishing.api.stats().hp;
    fishing.api.reelTap(); const firstTap=fishing.api.stats().hp;
    fishing.api.reelTap();
    assert.ok(firstTap<before);
    assert.equal(fishing.api.stats().hp,firstTap,'Двойное событие касания не должно ускорять ловлю');
    for(let step=0;step<fps*55 && fishing.api.phase()==='fight';step++){
      const state=fishing.api.stats();
      if(!state.inRun && state.tension<30) fishing.api.reelTap();
      fishing.step(1000/fps);
      const after=fishing.api.stats();
      assert.ok(after.x>=22 && after.x<=(fps===30?320:390)-22,'Поплавок должен оставаться на экране');
    }
    assert.equal(fishing.api.phase(),'pulling',fish.name+': должна вылавливаться при спокойной ловле, '+fps+' кадров/с '+JSON.stringify(fishing.api.stats()));
    assert.ok(fishing.api.stats().elapsed>=species.profiles[fish.id].minFight*1000);
    for(let step=0;step<fps*3 && fishing.api.phase()==='pulling';step++) fishing.step(1000/fps);
    assert.equal(fishing.api.phase(),'catch',fish.name+': должен появиться улов');
    assert.equal(fishing.elements.get('revealBehavior').textContent,species.profiles[fish.id].note);
  }
}
fishing.api.prepare(0); fishing.api.hookIt(); fishing.api.breakAtFinish(); fishing.step();
assert.equal(fishing.api.phase(),'miss','Разрыв лески важнее одновременной победы');
fishing.api.prepare(9); fishing.api.hookIt();
fishing.viewport(844,390); fishing.step();
assert.ok(fishing.api.stats().y>0 && fishing.api.stats().y<390,'При повороте телефона рыба остаётся в воде на экране');
fishing.viewport(320,568); fishing.step();
assert.ok(fishing.api.stats().x>=22 && fishing.api.stats().x<=298);
fishing.frame(16); fishing.api.prepare(0); fishing.api.hookIt();
const tensionBefore=fishing.api.stats().tension;
fishing.frame(1000);
assert.ok(tensionBefore-fishing.api.stats().tension>=16,'При редкой отрисовке леска должна ослабевать с той же скоростью');

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
console.log('Проверены 16 рыб при 30, 60 и 120 кадрах/с: поклёвки, вываживание, рисунки, границы экрана, пауза и разрыв лески. Проверены мотор и синтаксис всех страниц.');
