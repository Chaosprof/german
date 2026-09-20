// Run with: node tools/check_berlin_speech_ios.cjs
//
// The spoken-article module out of berlin-runner.html, run against a FAKE
// speech engine that reproduces the three WebKit habits an iPhone actually
// has: a speak() in the same task as a cancel() is dropped, a cancel that
// lands mid-utterance leaves the synthesiser paused, and getVoices() can stay
// empty for a whole session. A real engine cannot be tested here at all -
// headless Chrome returns zero voices and speaks nothing - so the fake is the
// only thing that can prove the phrase still comes out on a phone.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'berlin-runner.html'), 'utf8').replace(/\r\n/g, '\n');
const start = html.indexOf('  var SPEECH_SUPPORTED = typeof window.speechSynthesis');
const end = html.indexOf('  function playStumbleSound() {');
assert.ok(start > 0 && end > start, 'found the spoken-article module in the page');
const source = html.slice(start, end);

// ------------------------------------------------------------- fake clock --
function makeClock() {
  let now = 0, id = 1, timers = [];
  return {
    now: () => now,
    setTimeout(fn, ms) { timers.push({ id: id, at: now + (ms || 0), fn: fn }); return id++; },
    clearTimeout(t) { timers = timers.filter(x => x.id !== t); },
    advance(ms) {
      const until = now + ms;
      for (;;) {
        let next = null;
        for (const t of timers) if (t.at <= until && (!next || t.at < next.at)) next = t;
        if (!next) break;
        timers = timers.filter(x => x !== next);
        now = next.at;
        next.fn();
      }
      now = until;
    }
  };
}

// ------------------------------------------------------------ fake engine --
// opts.voices        - what getVoices() returns
// opts.webkitCancel  - drop any speak() issued in the same task as a cancel()
// opts.pauseOnCancel - a cancel while speaking leaves the engine paused
// opts.swallowFirst  - the first real utterance never starts (iPhone's cold engine)
// opts.coldFrame     - the first utterances are dropped in silence, warm-up
//                      included, until `coldFrame` of them have been offered:
//                      measured behaviour of an iframe on iOS
// opts.coldCancel    - a cancel() arriving before the engine has ever started
//                      an utterance wedges it for good: nothing it is handed
//                      afterwards is ever spoken
// opts.audioBlocks   - an audio context: while it is 'running' the engine
//                      speaks nothing at all, which is the page-makes-sound
//                      hypothesis stated as behaviour
// opts.onSpeak       - called with each utterance as it is offered
function makeEngine(clock, opts) {
  const spoken = [];      // every AUDIBLE utterance the engine actually started
  const offered = [];     // every utterance handed to speak(), accepted or not
  let cancelledAt = -1, current = null, swallowed = 0, everOffered = 0;
  let everStarted = false, wedged = false;
  const synth = {
    paused: false,
    speaking: false,
    pending: false,
    getVoices() { return opts.voices || []; },
    addEventListener() {},
    cancel() {
      cancelledAt = clock.now();
      if (opts.coldCancel && !everStarted) wedged = true;
      if (current && opts.pauseOnCancel) synth.paused = true;
      current = null;
      synth.speaking = false;
    },
    resume() { synth.paused = false; },
    speak(u) {
      offered.push(u);
      if (opts.onSpeak) opts.onSpeak(u);
      if (wedged) return;                        // nothing gets out, ever again
      // The page's own sound holds the engine shut.
      if (opts.audioBlocks && opts.audioBlocks.state === 'running') return;
      // A cold frame swallows the utterances it is handed first, with no start
      // and no error, and honours them once it has woken up.
      if (opts.coldFrame && everOffered++ < opts.coldFrame) return;
      // WebKit: same task as the cancel -> the utterance is simply dropped.
      if (opts.webkitCancel && clock.now() === cancelledAt) return;
      if (opts.swallowFirst && u.volume !== 0 && swallowed++ === 0) return;
      if (synth.paused) return;                  // queued behind a stuck pause
      current = u;
      synth.speaking = true;
      clock.setTimeout(function () {
        if (current !== u) return;
        everStarted = true;
        if (u.volume !== 0) spoken.push(u);   // the silent warm-up is not a phrase
        if (u.onstart) u.onstart({});
      }, 10);
      clock.setTimeout(function () {
        if (current !== u) return;
        current = null; synth.speaking = false;
        if (u.onend) u.onend({});
      }, 300);
    }
  };
  return { synth: synth, spoken: spoken, offered: offered };
}

// An AudioContext whose suspend/resume settle synchronously, so a test can
// assert on the state the engine saw without unwinding the stack.
function makeAudioContext() {
  const settled = { then(fn) { fn(); return settled; } };
  const ctx = {
    state: 'running',
    log: [],
    suspend() { ctx.state = 'suspended'; ctx.log.push('suspend'); return settled; },
    resume() { ctx.state = 'running'; ctx.log.push('resume'); return settled; }
  };
  return ctx;
}

function makeVoice(name, lang, local) {
  return { name: name, lang: lang, localService: local, default: false };
}

// ----------------------------------------------------------- module loader --
function load(opts) {
  const clock = makeClock();
  const engine = makeEngine(clock, opts);
  const btn = {
    disabled: false, title: '', attrs: {}, classes: {},
    classList: { toggle(c, on) { btn.classes[c] = !!on; } },
    setAttribute(k, v) { btn.attrs[k] = v; },
    addEventListener() {}, blur() {}
  };
  function Utterance(text) {
    this.text = text; this.lang = ''; this.voice = null;
    this.pitch = 1; this.rate = 1; this.volume = 1;
    this.onstart = null; this.onend = null; this.onerror = null;
  }
  const win = { speechSynthesis: engine.synth, SpeechSynthesisUtterance: Utterance,
                __gameAudio: opts.audio || null };
  const doc = { getElementById: () => btn, addEventListener() {}, hidden: false };
  const store = {};
  const localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const navigator = { userAgent: opts.ua, maxTouchPoints: opts.touch || 0 };

  const factory = new Function(
    'window', 'navigator', 'document', 'localStorage', 'setTimeout', 'clearTimeout',
    'SpeechSynthesisUtterance', 'unlockGameAudio', 'applyMusicGain',
    'var musicDuck = 1;\nvar gameAudio = window.__gameAudio || null;\n' + source +
    '\nreturn {\n' +
    '  speak: speakArticleWord, prime: primeSpeech, stop: stopSpeech,\n' +
    '  refresh: refreshSpeechVoice, enable: setSpeechEnabled,\n' +
    '  ready: speechReady, voice: function () { return speechVoice; },\n' +
    '  langOnly: function () { return speechLangOnly; },\n' +
    '  duck: function () { return musicDuck; },\n' +
    '  everStarted: function () { return speechEverStarted; },\n' +
    '  webkit: IS_WEBKIT_SPEECH, ios: IS_IOS_SPEECH\n' +
    '};');

  const api = factory(win, navigator, doc, localStorage, clock.setTimeout, clock.clearTimeout,
                      Utterance, function () {}, function () {});
  return { api: api, clock: clock, engine: engine, btn: btn };
}

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const WINDOWS_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const GERMAN_LIST = [makeVoice('Microsoft Hedda', 'de-DE', true), makeVoice('Microsoft Zira', 'en-US', true)];
const ENGLISH_ONLY = [makeVoice('Microsoft Zira', 'en-US', true), makeVoice('Daniel', 'en-GB', true)];

// 1. iPhone, empty voice list: the engine is there, the list is not. The
//    button has to work and the phrase has to be asked for in German.
{
  const t = load({ ua: IPHONE, voices: [], webkitCancel: true, pauseOnCancel: true });
  assert.ok(t.api.ios && t.api.webkit, 'an iPhone is detected as WebKit');
  assert.ok(t.api.langOnly(), 'an empty list on WebKit falls back to lang-only');
  assert.equal(t.api.voice(), null);
  assert.ok(t.api.ready(), 'the voice is available');
  assert.equal(t.btn.disabled, false, 'the button is enabled on an iPhone');

  t.api.prime();
  t.clock.advance(50);
  assert.equal(t.engine.offered.length, 1, 'the priming gesture speaks exactly once');
  assert.ok(t.engine.offered[0].text.length > 0, 'the warm-up is not an empty utterance');
  assert.equal(t.engine.offered[0].volume, 0, 'and it is inaudible');

  t.api.speak('der', 'Bahnhof', 1, false);
  t.clock.advance(500);
  assert.equal(t.engine.spoken.length, 1, 'a cleared gate is spoken on an iPhone');
  const u = t.engine.spoken[0];
  assert.equal(u.text, 'der Bahnhof');
  assert.equal(u.lang, 'de-DE', 'German is requested by language');
  assert.equal(u.voice, null, 'no voice object is forced on a lang-only engine');
}

// 2. The cancel -> speak drop, gate after gate. Without the deferral every one
//    of these lands in the same task as its own cancel() and is lost.
{
  const t = load({ ua: IPHONE, voices: [], webkitCancel: true, pauseOnCancel: true });
  t.api.prime();
  t.clock.advance(50);
  const words = [['der', 'Bahnhof'], ['die', 'Straße'], ['das', 'Tor'], ['der', 'Baum']];
  for (const [article, noun] of words) {
    t.api.speak(article, noun, 3, false);
    t.clock.advance(500);
  }
  assert.equal(t.engine.spoken.length, words.length, 'every gate is spoken, not only the first');
  assert.deepEqual(t.engine.spoken.map(u => u.text), words.map(w => w.join(' ')));
}

// 3. A gate arriving mid-phrase cancels it - and WebKit stays paused. The
//    next phrase must still be heard.
{
  const t = load({ ua: IPHONE, voices: [], webkitCancel: true, pauseOnCancel: true });
  t.api.prime();
  t.clock.advance(50);
  t.api.speak('der', 'Bahnhof', 1, false);
  t.clock.advance(120);                       // started, still speaking
  assert.equal(t.engine.spoken.length, 1);
  t.api.speak('die', 'Straße', 2, false); // interrupts it
  t.clock.advance(500);
  assert.equal(t.engine.spoken.length, 2, 'the interrupting phrase survives the stuck pause');
  assert.equal(t.engine.spoken[1].text, 'die Straße');
  assert.equal(t.engine.synth.paused, false, 'the synthesiser is not left paused');
}

// 4. A swallowed first utterance is said again rather than lost.
{
  const t = load({ ua: IPHONE, voices: [], webkitCancel: true, swallowFirst: true });
  t.api.prime();
  t.clock.advance(50);
  t.api.speak('das', 'Tor', 1, false);
  t.clock.advance(120);
  assert.equal(t.engine.spoken.length, 0, 'the cold engine swallowed it');
  t.clock.advance(600);
  assert.equal(t.engine.spoken.length, 1, 'and it was said once more');
  assert.equal(t.engine.spoken[0].text, 'das Tor');
  // Once only: a second retry would stack phrases on top of each other.
  t.clock.advance(2000);
  assert.equal(t.engine.offered.filter(u => u.text === 'das Tor').length, 2);
}

// 5. iPadOS reports itself as a Mac.
{
  const t = load({ ua: IPAD, touch: 5, voices: [] });
  assert.ok(t.api.ios, 'an iPad with touch points is treated as iOS');
  assert.ok(t.api.langOnly());
}

// 6. The German-only rule is intact: a readable list with no German still
//    refuses, on every platform, rather than reading German in English.
{
  const t = load({ ua: IPHONE, voices: ENGLISH_ONLY });
  assert.equal(t.api.langOnly(), false, 'a populated list is evidence, and it says no');
  assert.equal(t.api.ready(), false);
  assert.equal(t.btn.disabled, true, 'the button reports it honestly');
  assert.match(t.btn.title, /iPhone/, 'and the hint names the iPhone settings path');
  t.api.speak('der', 'Bahnhof', 1, false);
  t.clock.advance(1000);
  assert.equal(t.engine.offered.length, 0, 'nothing is spoken in an English voice');
}

// 7. Chrome with no German: an empty list there is a first-paint transient,
//    not a lazy engine, so it must NOT open the lang-only door.
{
  const t = load({ ua: WINDOWS_CHROME, voices: [] });
  assert.equal(t.api.webkit, false);
  assert.equal(t.api.langOnly(), false, 'Chrome never falls back to lang-only');
  assert.equal(t.api.ready(), false);
  assert.match(t.btn.title, /Windows/);
}

// 8. The desktop path is unchanged: a real German voice object is used, and
//    the phrase goes out in the same task (no deferral off WebKit).
{
  const t = load({ ua: WINDOWS_CHROME, voices: GERMAN_LIST });
  assert.equal(t.api.voice().name, 'Microsoft Hedda');
  t.api.speak('der', 'Bahnhof', 1, false);
  assert.equal(t.engine.offered.length, 1, 'Chrome speaks synchronously, as before');
  assert.equal(t.engine.offered[0].voice.name, 'Microsoft Hedda');
  assert.equal(t.engine.offered[0].lang, 'de-DE');
}

// 9. Praise and correction still differ, and the correction still waits for
//    the buzzer before it lands.
{
  const t = load({ ua: IPHONE, voices: [], webkitCancel: true, pauseOnCancel: true });
  t.api.prime();
  t.clock.advance(50);
  t.api.speak('die', 'Straße', 1, true);
  t.clock.advance(200);
  assert.equal(t.engine.offered.length, 1, 'the correction has not spoken over the buzzer yet');
  t.clock.advance(200);                       // 240 ms beat + the WebKit gap
  const corr = t.engine.spoken[t.engine.spoken.length - 1];
  assert.equal(corr.text, 'die Straße');
  assert.ok(corr.pitch < 0.78 && corr.rate < 0.86, 'a correction is lower and slower');
  assert.ok(t.api.duck() < 1, 'the music is ducked while it speaks');
  t.clock.advance(1000);
  assert.equal(t.api.duck(), 1, 'and comes back up afterwards');
}

// 10. Turning the voice off stops everything, including a pending deferral.
{
  const t = load({ ua: IPHONE, voices: [], webkitCancel: true, pauseOnCancel: true });
  t.api.prime();
  t.clock.advance(50);
  const before = t.engine.offered.length;
  t.api.speak('der', 'Baum', 1, false);
  t.api.enable(false);
  t.clock.advance(2000);
  assert.equal(t.engine.offered.length, before, 'the queued phrase never reaches the engine');
  assert.equal(t.api.duck(), 1, 'and the music duck is not left hanging');
}

// 11. The cold frame, which is what an iPhone actually does: the warm-up is
//     swallowed in silence, and the first gate has to survive that.
{
  const t = load({ ua: IPHONE, voices: GERMAN_LIST, coldFrame: 1, webkitCancel: true });
  t.api.prime();
  t.clock.advance(50);
  assert.equal(t.engine.spoken.length, 0, 'the warm-up was swallowed, as on the device');
  assert.equal(t.api.everStarted(), false, 'and the engine is still known to be cold');
  t.api.speak('der', 'Bahnhof', 1, false);
  t.clock.advance(2000);
  assert.equal(t.engine.spoken.length, 1, 'the first gate is still heard');
  assert.equal(t.engine.spoken[0].text, 'der Bahnhof');
  assert.ok(t.api.everStarted(), 'and the engine is now known to be awake');
}

// 12. A cold frame wants several attempts before it wakes, and the player
//     should not pay for them with the first words of the session. The loop
//     spends them while the runner is still loading, with nothing playing.
{
  const t = load({ ua: IPHONE, voices: GERMAN_LIST, coldFrame: 4 });
  t.api.prime();                              // the start card
  t.clock.advance(50);
  assert.equal(t.api.everStarted(), false, 'one warm-up is not enough for a cold frame');
  t.clock.advance(4000);                      // still loading: free attempts
  assert.ok(t.api.everStarted(), 'the loop woke the engine before the run began');
  assert.ok(t.engine.offered.length >= 4, 'it took as many tries as the engine wanted');
  assert.equal(t.engine.spoken.length, 0, 'and the player heard none of them');

  const settled = t.engine.offered.length;
  t.clock.advance(20000);
  assert.equal(t.engine.offered.length, settled, 'it stops poking the moment it is awake');

  // Which is the point of all of it: the FIRST gate is an ordinary phrase.
  t.api.speak('der', 'Bahnhof', 1, false);
  t.clock.advance(1000);
  assert.equal(t.engine.spoken.length, 1, 'the first gate of the session is spoken');
  assert.equal(t.engine.spoken[0].text, 'der Bahnhof');
}

// 12b. An engine that never wakes must not be poked forever.
{
  const t = load({ ua: IPHONE, voices: GERMAN_LIST, coldFrame: 9999 });
  t.api.prime();
  t.clock.advance(60000);
  assert.equal(t.api.everStarted(), false);
  assert.ok(t.engine.offered.length <= 14, 'the wake-up gives up: ' + t.engine.offered.length);
}

// 13. The device's actual behaviour, and the reason the game stayed mute while
//     a test frame that never cancels woke up by itself: a cancel() aimed at an
//     engine that has not spoken yet wedges it for good. The game cancelled
//     before every phrase AND before every retry, so it re-wedged it on every
//     gate. Nothing may be cancelled until a phrase has actually started.
{
  const t = load({ ua: IPHONE, voices: GERMAN_LIST, coldFrame: 4, coldCancel: true });
  t.api.prime();
  t.clock.advance(2000);
  // Four gates: the engine drops the early ones, and must not be wedged by them.
  const words = [['der', 'Bahnhof'], ['die', 'Straße'], ['das', 'Tor'], ['der', 'Baum']];
  for (const [article, noun] of words) {
    t.api.speak(article, noun, 2, false);
    t.clock.advance(2500);
  }
  assert.ok(t.engine.spoken.length > 0, 'the engine is still reachable after the cold gates');
  assert.equal(t.engine.spoken[t.engine.spoken.length - 1].text, 'der Baum',
               'and the most recent word is the one that is heard');
  // Now that it is awake, cancelling is back on: the latest word still wins.
  t.api.speak('die', 'Bank', 3, false);
  t.clock.advance(120);
  t.api.speak('das', 'Haus', 4, false);
  t.clock.advance(2000);
  assert.equal(t.engine.spoken[t.engine.spoken.length - 1].text, 'das Haus',
               'an interrupting phrase still replaces the one in progress');
}

// 14. Turning the voice off while the engine is cold must not wedge it either.
{
  const t = load({ ua: IPHONE, voices: GERMAN_LIST, coldFrame: 2, coldCancel: true });
  t.api.prime();
  t.clock.advance(1000);
  t.api.enable(false);                       // stopSpeech() on a cold engine
  t.clock.advance(1000);
  t.api.enable(true);
  t.api.speak('der', 'Bahnhof', 1, false);
  t.clock.advance(3000);
  assert.equal(t.engine.spoken.length, 1, 'the voice still works after being switched off cold');
}

// 15. The page's own sound holds the engine shut - a looping noise buffer and
//     a rumble oscillator run here from the first gesture to the end of the
//     run, whatever the music button says. After two silences the graph is
//     parked for the length of the phrase, and comes back afterwards.
{
  const audio = makeAudioContext();
  const t = load({ ua: IPHONE, voices: GERMAN_LIST, audio: audio, audioBlocks: audio,
                   onSpeak: u => { u.audioAtSpeak = audio.state; } });
  t.api.prime();
  t.clock.advance(1000);
  assert.equal(t.engine.spoken.length, 0, 'the warm-up is swallowed while the page makes sound');
  t.api.speak('der', 'Bahnhof', 1, false);
  t.clock.advance(3000);
  assert.equal(t.engine.spoken.length, 1, 'the phrase is heard once the graph is parked');
  assert.equal(t.engine.spoken[0].audioAtSpeak, 'suspended', 'and it was parked when it spoke');
  assert.equal(audio.state, 'running', 'the bed is back afterwards');
  assert.ok(t.api.everStarted());

  // Proven awake: the next phrase must not park anything.
  audio.log.length = 0;
  t.api.speak('die', 'Strasse', 2, false);
  t.clock.advance(3000);
  assert.deepEqual(audio.log, [], 'a working engine never costs the player the bed');
}

// 16. A phone where speech works normally never has its audio touched.
{
  const audio = makeAudioContext();
  const t = load({ ua: IPHONE, voices: GERMAN_LIST, audio: audio });
  t.api.prime();
  t.clock.advance(1000);
  audio.log.length = 0;
  for (const noun of ['Bahnhof', 'Tor', 'Baum']) {
    t.api.speak('der', noun, 1, false);
    t.clock.advance(2000);
  }
  assert.equal(t.engine.spoken.length, 3);
  assert.deepEqual(audio.log, [], 'the audio graph is never parked when nothing is wrong');
}

console.log('berlin speech / iOS: all checks passed');
