const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
const studioSource = html.split('/* ============================== silk studio ============================== */')[1]
  .split('/* ============================== render ============================== */')[0];
const tuningSource = html.match(/const SCALES=\[[\s\S]*?(?=const ROOT_PC)/)[0];
const voicesSource = html.match(/const VOICES=\[[\s\S]*?(?=function driveCurve)/)[0];

// Exercise the production event handlers with only their browser/audio boundaries mocked.
function harness() {
  class Element {
    constructor(tagName = 'div') {
      this.tagName = tagName.toUpperCase();
      this.children = [];
      this.dataset = {};
      this.attributes = {};
      this.listeners = new Map();
      this.captures = new Set();
      this.classes = new Set();
      this.classList = {
        add: name => this.classes.add(name),
        remove: name => this.classes.delete(name),
        contains: name => this.classes.has(name)
      };
      this.style = { setProperty() {} };
    }
    set className(value) { this.classes = new Set(value.split(' ')); }
    set innerHTML(value) { assert.equal(value, ''); this.children = []; }
    append(...children) { for (const child of children) this.appendChild(child); }
    appendChild(child) { child.parent = this; this.children.push(child); return child; }
    setAttribute(name, value) { this.attributes[name] = value; }
    closest(selector) {
      if (selector === '.studio-pad' && this.classList.contains('studio-pad')) return this;
      return this.parent?.closest(selector) || null;
    }
    contains(child) { return child === this || this.children.some(item => item.contains(child)); }
    getBoundingClientRect() { return { left: 20, width: 60 }; }
    addEventListener(name, callback) {
      if (!this.listeners.has(name)) this.listeners.set(name, []);
      this.listeners.get(name).push(callback);
    }
    emit(name, properties = {}) {
      const event = { target: this, preventDefault() { this.defaultPrevented = true; }, ...properties };
      for (const callback of this.listeners.get(name) || []) callback(event);
      return event;
    }
    setPointerCapture(id) { this.captures.add(id); }
    hasPointerCapture(id) { return this.captures.has(id); }
    showModal() { this.open = true; }
    close() { this.open = false; this.emit('close'); }
    focus() { this.focused = true; }
  }

  const elements = Object.fromEntries(['studio', 'studioPads', 'studioVoice', 'studioRegister',
    'bStudio', 'studioClose', 'studioInfo'].map(id => [id, new Element()]));
  elements.studioVoice.tagName = elements.studioRegister.tagName = 'SELECT';
  elements.studioRegister.value = '-1';
  const document = new Element();
  document.getElementById = id => elements[id];
  document.createElement = tag => new Element(tag);
  document.elementFromPoint = () => document.hit || null;
  const window = new Element();
  let now = 100000, nextTimer = 0;
  const timers = new Map();
  const plucks = [], drones = [], chains = [];
  const webHolds = new Map();
  const looper = { t0: 90, tracks: [{ recStart: -1 }, { recStart: 98 }, { recStart: 0 }] };
  const context = vm.createContext({
    document, W: 800, looper, holds: webHolds,
    endHold: event => webHolds.delete(event.pointerId),
    addEventListener: (...args) => window.addEventListener(...args),
    perf: () => now / 1000,
    initAudio() {}, AC: { state: 'running', resume() { this.state = 'running'; } },
    createVoiceChain(tone) {
      const chain = { tone, in: {}, disconnected: false };
      chain.nodes = [{ disconnect() { chain.disconnected = true; } }];
      chains.push(chain);
      return chain;
    },
    playTone: (...args) => plucks.push(args),
    startTone(...args) {
      const drone = { args, stops: 0, stop() { this.stops++; } };
      drones.push(drone);
      return drone;
    },
    setTimeout(callback, delay) {
      const id = ++nextTimer;
      timers.set(id, { at: now + delay, callback });
      return id;
    },
    clearTimeout: id => timers.delete(id)
  });
  vm.runInContext(tuningSource + voicesSource + '\nlet webRoot=ROOTS[0],webScale=SCALES[0];\n' +
    studioSource + '\nglobalThis.api={studio,studioNotes,noteName,ROOTS,SCALES,VOICES};', context);
  function advance(milliseconds) {
    const until = now + milliseconds;
    while (true) {
      const next = [...timers].filter(([, timer]) => timer.at <= until)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      now = next[1].at;
      timers.delete(next[0]);
      next[1].callback();
    }
    now = until;
  }
  function pointer(type, id, pad, properties = {}) {
    document.hit = pad;
    return elements.studioPads.emit(type, { pointerId: id, pointerType: 'touch', button: 0,
      clientX: 20, clientY: 20, ...properties });
  }
  return { ...context.api, context, elements, document, window, looper, webHolds,
    plucks, drones, chains, timers, advance, pointer };
}

test('every web tuning has 15 exact, labelled pitches across three octave rows in each register', () => {
  const h = harness();
  h.studio.show();
  const rootMidi = { E: 52, F: 53, G: 55, A: 57, B: 59, C: 60, D: 62 };
  const pitchNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  let count = 0, lowest = Infinity, highest = -Infinity;
  for (const [root, name] of h.ROOTS) for (const scale of h.SCALES) for (const register of [-2, -1, 0]) {
    const notes = Array.from(h.studioNotes(root, scale.iv, register));
    assert.equal(notes.length, 15);
    assert.equal(new Set(notes).size, 15);
    const base = rootMidi[name] + register * 12;
    assert.deepEqual(notes, [2, 1, 0].flatMap(row => Array.from(scale.iv, semi => base + row * 12 + semi)));
    h.studio.root = root;
    h.studio.scale = scale;
    h.elements.studioRegister.value = String(register);
    h.studio.paint();
    for (const [i, midi] of notes.entries()) {
      const pad = h.elements.studioPads.children[i];
      const label = pitchNames[midi % 12] + (Math.floor(midi / 12) - 1);
      assert.equal(+pad.dataset.freq, 440 * 2 ** ((midi - 69) / 12));
      assert.equal(pad.attributes['aria-label'], label);
      assert.equal(pad.children[0].textContent, label);
    }
    lowest = Math.min(lowest, ...notes);
    highest = Math.max(highest, ...notes);
    count++;
  }
  assert.equal(count, 63);
  assert.equal(lowest, 28); // E1
  assert.equal(highest, 96); // C7, in D minor pentatonic's high register
});

test('touches sound independently, including two fingers sharing one pad', () => {
  const h = harness();
  h.studio.show();
  const [first, second] = h.elements.studioPads.children;
  h.pointer('pointerdown', 1, first);
  h.pointer('pointerdown', 2, first);
  h.pointer('pointerdown', 3, second);
  assert.equal(h.studio.holds.size, 3);
  assert.equal(h.plucks.length, 3);
  h.advance(299);
  assert.equal(h.drones.length, 0);
  h.advance(1);
  assert.equal(h.drones.length, 3);
  h.pointer('pointerup', 1, first);
  assert.equal(h.drones[0].stops, 1);
  assert.equal(h.drones[1].stops, 0);
  assert.equal(first.classList.contains('on'), true);
  h.pointer('pointerup', 2, first);
  assert.equal(first.classList.contains('on'), false);
  assert.equal(second.classList.contains('on'), true);
  h.pointer('pointerup', 3, second);
  assert.equal(h.studio.holds.size, 0);
  assert.ok(h.drones.every(drone => drone.stops === 1));
});

test('glissando releases the previous note, ignores repeated hits, and stops outside the grid', () => {
  const h = harness();
  h.studio.show();
  const [first, second] = h.elements.studioPads.children;
  h.pointer('pointermove', 99, first);
  assert.equal(h.plucks.length, 0);
  h.pointer('pointerdown', 1, first);
  h.advance(300);
  h.pointer('pointermove', 1, first);
  assert.equal(h.plucks.length, 1);
  h.pointer('pointermove', 1, second.children[0]);
  assert.equal(h.drones[0].stops, 1);
  assert.equal(first.classList.contains('on'), false);
  assert.equal(second.classList.contains('on'), true);
  assert.equal(h.plucks.length, 2);
  h.pointer('pointermove', 1, null);
  h.advance(300);
  assert.equal(h.drones.length, 1);
  assert.equal(h.studio.holds.size, 0);
  assert.equal(second.classList.contains('on'), false);
});

test('tap release, pointer cancellation and capture loss cancel pending sustain', () => {
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    const h = harness();
    h.studio.show();
    const pad = h.elements.studioPads.children[0];
    h.pointer('pointerdown', 1, pad);
    h.advance(299);
    h.pointer(event, 1, pad);
    h.advance(1000);
    assert.equal(h.drones.length, 0, event);
    assert.equal(h.studio.holds.size, 0, event);
    assert.equal(pad.classList.contains('on'), false, event);
  }
});

test('changing voice or register releases both pending and sustained notes', () => {
  for (const setting of ['studioVoice', 'studioRegister']) {
    const h = harness();
    h.studio.show();
    const [first, second] = h.elements.studioPads.children;
    h.studio.start(1, first);
    h.advance(300);
    h.studio.start(2, second);
    h.elements[setting].value = setting === 'studioVoice' ? '1' : '0';
    h.elements[setting].emit('change');
    assert.equal(h.studio.holds.size, 0, setting);
    assert.equal(h.drones[0].stops, 1, setting);
    h.advance(1600);
    assert.equal(h.drones.length, 1, setting);
    assert.equal(first.classList.contains('on'), false, setting);
    assert.equal(second.classList.contains('on'), false, setting);
    if (setting === 'studioVoice') {
      assert.equal(h.chains[0].disconnected, true);
      h.studio.start(3, h.elements.studioPads.children[0]);
      assert.equal(h.plucks.at(-1)[3], h.VOICES[1]);
      assert.equal(h.plucks.at(-1)[4], h.chains[1].in);
    } else {
      assert.equal(+h.elements.studioPads.children[0].dataset.freq, +first.dataset.freq * 2);
    }
  }
});

test('blur, hiding the document, Escape and dialog close clean up every hold', () => {
  const actions = {
    blur: h => h.window.emit('blur'),
    hidden: h => { h.document.hidden = true; h.document.emit('visibilitychange'); },
    cancel: h => { assert.equal(h.elements.studio.emit('cancel').defaultPrevented, true); },
    close: h => h.elements.studio.close()
  };
  for (const [name, action] of Object.entries(actions)) {
    const h = harness();
    h.studio.show();
    h.studio.start(1, h.elements.studioPads.children[0]);
    h.advance(300);
    h.studio.start(2, h.elements.studioPads.children[1]);
    action(h);
    assert.equal(h.studio.holds.size, 0, name);
    assert.equal(h.drones[0].stops, 1, name);
    h.advance(2000);
    assert.equal(h.drones.length, 1, name);
    if (name === 'cancel' || name === 'close') {
      assert.equal(h.studio.open, false, name);
      assert.equal(h.chains[0].disconnected, true, name);
    }
  }
});

test('closing resumes loop and recording clocks after the time spent in the studio', () => {
  const h = harness();
  h.webHolds.set(7, {});
  h.elements.bStudio.emit('click');
  assert.equal(h.webHolds.size, 0);
  assert.equal(h.studio.open, true);
  h.advance(1000);
  h.studio.show(); // Opening an already open studio must not reset its pause time.
  h.advance(4000);
  h.elements.studioClose.emit('click');
  assert.equal(h.looper.t0, 95);
  assert.deepEqual(h.looper.tracks.map(track => track.recStart), [-1, 103, 5]);
  assert.equal(h.elements.bStudio.focused, true);
  h.advance(2000);
  h.studio.close(); // Native close events and redundant calls must not shift clocks twice.
  assert.equal(h.looper.t0, 95);
  assert.deepEqual(h.looper.tracks.map(track => track.recStart), [-1, 103, 5]);
});

test('keyboard chords release independently and preserve select controls', () => {
  const h = harness();
  h.studio.show();
  const dialog = h.elements.studio;
  dialog.emit('keydown', { key: 'q', code: 'KeyQ' });
  dialog.emit('keydown', { key: 'Q', code: 'KeyQ', repeat: true });
  dialog.emit('keydown', { key: 'a', code: 'KeyA' });
  assert.equal(h.studio.holds.size, 2);
  assert.equal(h.plucks.length, 2);
  dialog.emit('keydown', { key: 'z', code: 'KeyZ', target: h.elements.studioVoice });
  dialog.emit('keydown', { key: 'w', code: 'KeyW', ctrlKey: true });
  assert.equal(h.plucks.length, 2);
  h.advance(300);
  dialog.emit('keyup', { key: 'q', code: 'KeyQ' });
  assert.equal(h.studio.holds.size, 1);
  assert.equal(h.drones[0].stops, 1);
  assert.equal(h.drones[1].stops, 0);
  dialog.emit('keyup', { key: 'a', code: 'KeyA' });
  assert.equal(h.studio.holds.size, 0);
});
