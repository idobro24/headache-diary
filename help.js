// Экран «Помощь»: фразы поддержки, дыхание, звуки, самопомощь

const PHRASES = [
  'Эта боль временная. Она пройдёт.',
  'Ты уже проходила через это, и каждый раз становилось легче.',
  'Сейчас не нужно ничего делать. Просто будь.',
  'Ты сделала всё, что могла. Остальное — дело времени.',
  'Медленный вдох. Ещё медленнее выдох.',
  'Позволь себе отдохнуть. Дела подождут.',
  'С каждой минутой ты ближе к моменту, когда станет легче.',
  'Ты не одна, и ты справляешься.',
  'Можно закрыть глаза. Я буду здесь.'
];

const SELF_HELP = [
  'Выпить стакан воды',
  'Холодный компресс на лоб или тёплый на шею',
  'Приглушить свет',
  'Открыть окно, впустить свежий воздух',
  'Отложить телефон и экраны',
  'Лечь в тихом тёмном месте'
];

const SOUNDS = [
  { id: 'rain', label: 'Дождь' },
  { id: 'forest', label: 'Дождь в лесу' },
  { id: 'fire', label: 'Камин' },
  { id: 'white', label: 'Белый шум' },
  { id: 'pink', label: 'Мягкий шум' },
  { id: 'brown', label: 'Как водопад' }
];

// --- Фразы поддержки ---

const PHRASE_INTERVAL = 25000;
let phraseList = PHRASES;
let phraseIndex = 0;
let phraseTimer = null;

function noMotion() {
  return document.body.classList.contains('no-motion');
}

function buildPhraseList() {
  const personal = [];
  const last = Store.lastEnded();
  const active = Store.active();
  if (last) {
    const dur = formatDuration(new Date(last.end) - new Date(last.start));
    personal.push('Твой прошлый приступ закончился через ' + dur + '. Этот тоже закончится.');
    if (active) {
      const days = Math.floor((new Date(active.start) - new Date(last.end)) / 86400000);
      if (days >= 1) {
        personal.push('До этого у тебя было ' + days + ' ' + daysWord(days) + ' без боли. Такие дни вернутся.');
      }
    }
  }
  return [...personal, ...PHRASES];
}

let phraseBusy = false; // идёт ли смена фразы
let phraseSwap = null;  // отложенный шаг смены

// Показать фразу сразу, без анимации
function setPhraseNow(text) {
  clearTimeout(phraseSwap);
  phraseBusy = false;
  const el = $('phrase');
  el.classList.remove('fading');
  el.textContent = text;
}

// Фраза плавно гаснет (через цвет текста), меняется, пока невидима, и плавно проявляется
function showPhrase(i) {
  if (phraseBusy) return;
  phraseIndex = (i + phraseList.length) % phraseList.length;
  const text = phraseList[phraseIndex];
  if (noMotion()) {
    setPhraseNow(text);
    return;
  }
  phraseBusy = true;
  const el = $('phrase');
  el.classList.add('fading');
  phraseSwap = setTimeout(() => {
    el.textContent = text;
    phraseSwap = setTimeout(() => {
      el.classList.remove('fading');
      phraseSwap = setTimeout(() => { phraseBusy = false; }, 850);
    }, 50);
  }, 850);
}

function restartPhraseTimer() {
  clearInterval(phraseTimer);
  phraseTimer = setInterval(() => showPhrase(phraseIndex + 1), PHRASE_INTERVAL);
}

function startPhrases() {
  phraseList = buildPhraseList();
  phraseIndex = 0;
  phraseBusy = false;
  setPhraseNow(phraseList[0]);
  restartPhraseTimer();
}

function stopPhrases() {
  clearInterval(phraseTimer);
  phraseTimer = null;
}

$('phrase').addEventListener('click', () => {
  showPhrase(phraseIndex + 1);
  restartPhraseTimer();
});

// --- Дыхание: вдох 4 секунды, выдох 6 секунд ---

const BREATH = {
  in: { seconds: 4, label: 'Вдох' },
  out: { seconds: 6, label: 'Выдох' }
};
let breathTimer = null;
let breathPhase = 'in';
let breathLeft = 0;

function setBreathPhase(phase) {
  breathPhase = phase;
  breathLeft = BREATH[phase].seconds;
  const ring = $('breath-ring');
  ring.style.transitionDuration = BREATH[phase].seconds + 's';
  ring.classList.toggle('inhale', phase === 'in');
  ring.classList.toggle('exhale', phase === 'out');
  $('breath-label').textContent = BREATH[phase].label;
  $('breath-count').textContent = breathLeft;
}

function startBreathing() {
  setBreathPhase('in');
  breathTimer = setInterval(() => {
    breathLeft--;
    if (breathLeft <= 0) setBreathPhase(breathPhase === 'in' ? 'out' : 'in');
    else $('breath-count').textContent = breathLeft;
  }, 1000);
  $('breath-toggle').textContent = 'Остановить';
}

function stopBreathing() {
  clearInterval(breathTimer);
  breathTimer = null;
  const ring = $('breath-ring');
  ring.classList.remove('inhale', 'exhale');
  ring.style.transitionDuration = '1s';
  $('breath-label').textContent = 'Дыхание';
  $('breath-count').textContent = '4 / 6';
  $('breath-toggle').textContent = 'Начать дыхание';
}

$('breath-toggle').addEventListener('click', () => {
  if (breathTimer) stopBreathing(); else startBreathing();
});

// --- Звуки: всё генерируется прямо в браузере, файлы не нужны ---

let audioCtx = null;
let gainNode = null;
let noiseSource = null;
let currentSound = null;

const LOOP_SECONDS = 12;   // длина звуковой петли
const FADE_SECONDS = 0.5;  // плавная склейка конца петли с началом
const soundCache = {};

// Коэффициент простого фильтра для заданной частоты среза
function onePole(cutoff, sr) {
  return 1 - Math.exp(-2 * Math.PI * cutoff / sr);
}

function whiteSource() {
  return () => Math.random() * 2 - 1;
}

function pinkSource() {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  return () => {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.96900 * b2 + w * 0.1538520;
    b3 = 0.86650 * b3 + w * 0.3104856;
    b4 = 0.55000 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.0168980;
    const out = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
    return out;
  };
}

function brownSource() {
  let last = 0;
  return () => {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    return last * 3.5;
  };
}

function normalizeRms(data, target) {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
  const rms = Math.sqrt(sum / data.length) || 1;
  const k = target / rms;
  for (let i = 0; i < data.length; i++) data[i] *= k;
}

// Короткий всплеск с затуханием: капля дождя или треск дерева
function addBurst(data, start, amp, decaySec, cutoff, sr) {
  const decay = decaySec * sr;
  const a = onePole(cutoff, sr);
  const comp = 1 / Math.sqrt(a / (2 - a)); // чтобы низкие капли не были тише высоких
  const end = Math.min(data.length, start + Math.floor(decay * 6));
  let lp = 0;
  for (let i = start; i < end; i++) {
    lp += a * ((Math.random() * 2 - 1) - lp);
    data[i] += lp * comp * 0.3 * amp * Math.exp(-(i - start) / decay);
  }
}

function genNoise(data, source) {
  for (let i = 0; i < data.length; i++) data[i] = source();
}

function genRain(data, sr, forest) {
  // Ровный шелест: розовый шум без самых низких и самых высоких частот
  const noise = pinkSource();
  const rumble = brownSource();
  const aLow = onePole(forest ? 1400 : 5000, sr);
  const aHigh = onePole(forest ? 120 : 350, sr);
  let lp = 0, hp = 0;
  for (let i = 0; i < data.length; i++) {
    lp += aLow * (noise() - lp);
    hp += aHigh * (lp - hp);
    let s = lp - hp;
    if (forest) {
      const t = i / sr;
      s = s * (0.8 + 0.2 * Math.sin(2 * Math.PI * t * 0.11)) + rumble() * 0.02;
    }
    data[i] = s;
  }
  normalizeRms(data, 0.1);

  // Капли: в городе мелкие и частые, в лесу крупные и редкие (с листьев)
  const seconds = data.length / sr;
  const drops = Math.floor(seconds * (forest ? 14 : 55));
  for (let d = 0; d < drops; d++) {
    const start = Math.floor(Math.random() * data.length);
    if (forest) {
      addBurst(data, start, 0.25 + Math.random() * 0.45, 0.01 + Math.random() * 0.02,
               700 + Math.random() * 1300, sr);
    } else {
      addBurst(data, start, 0.08 + Math.random() * 0.3, 0.003 + Math.random() * 0.005,
               3000 + Math.random() * 4000, sr);
    }
  }
}

function genFire(data, sr) {
  // Тихий низкий гул пламени, который слегка «дышит»
  const noise = brownSource();
  const a = onePole(250, sr);
  let lp = 0;
  for (let i = 0; i < data.length; i++) {
    lp += a * (noise() - lp);
    const t = i / sr;
    data[i] = lp * (0.75 + 0.25 * Math.sin(2 * Math.PI * t * 0.23) * Math.sin(2 * Math.PI * t * 0.37 + 1));
  }
  normalizeRms(data, 0.06);

  // Треск: неравномерные щелчки, иногда сериями, изредка громкий «щелчок полена»
  let pos = 0;
  while (pos < data.length) {
    pos += Math.floor(sr * (0.015 + Math.random() * Math.random() * 0.5));
    const pop = Math.random() < 0.06;
    addBurst(data, pos,
             pop ? 0.5 + Math.random() * 0.3 : 0.08 + Math.random() * 0.25,
             pop ? 0.006 : 0.001 + Math.random() * 0.0015,
             pop ? 2500 : 4000 + Math.random() * 5000, sr);
    if (Math.random() < 0.25) {
      const n = 2 + Math.floor(Math.random() * 4);
      let p = pos;
      for (let k = 0; k < n; k++) {
        p += Math.floor(sr * (0.008 + Math.random() * 0.04));
        addBurst(data, p, 0.05 + Math.random() * 0.15, 0.001, 6000, sr);
      }
    }
  }
}

// Плавно склеиваем конец с началом, чтобы при повторе не было щелчка
function makeLoop(data, sr) {
  const f = Math.floor(FADE_SECONDS * sr);
  const out = new Float32Array(data.length - f);
  out.set(data.subarray(0, out.length));
  for (let i = 0; i < f; i++) {
    const t = i / f;
    out[i] = data[i] * Math.sqrt(t) + data[data.length - f + i] * Math.sqrt(1 - t);
  }
  return out;
}

function getSamples(type, sr) {
  const key = type + sr;
  if (soundCache[key]) return soundCache[key];
  const data = new Float32Array(Math.floor((LOOP_SECONDS + FADE_SECONDS) * sr));
  if (type === 'white') genNoise(data, whiteSource());
  else if (type === 'pink') genNoise(data, pinkSource());
  else if (type === 'brown') genNoise(data, brownSource());
  else if (type === 'rain') genRain(data, sr, false);
  else if (type === 'forest') genRain(data, sr, true);
  else if (type === 'fire') genFire(data, sr);
  normalizeRms(data, 0.12); // все звуки примерно одинаковой громкости
  for (let i = 0; i < data.length; i++) data[i] = Math.tanh(data[i]); // мягко срезаем пики
  soundCache[key] = makeLoop(data, sr);
  return soundCache[key];
}

function playSound(type) {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      alert('Этот браузер не поддерживает звуки.');
      return;
    }
    audioCtx = new Ctx();
    gainNode = audioCtx.createGain();
    gainNode.connect(audioCtx.destination);
  }
  audioCtx.resume();
  stopSound(true);

  noiseSource = audioCtx.createBufferSource();
  const samples = getSamples(type, audioCtx.sampleRate);
  const buffer = audioCtx.createBuffer(1, samples.length, audioCtx.sampleRate);
  buffer.getChannelData(0).set(samples);
  noiseSource.buffer = buffer;
  noiseSource.loop = true;
  noiseSource.connect(gainNode);

  const now = audioCtx.currentTime;
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(Number($('volume').value), now + 1.5); // плавное начало
  noiseSource.start();
  currentSound = type;
  renderSounds();
}

function stopSound(immediate) {
  if (!noiseSource) return;
  const src = noiseSource;
  noiseSource = null;
  currentSound = null;
  if (immediate) {
    src.stop();
  } else {
    const now = audioCtx.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.6); // плавное затухание
    src.stop(now + 0.7);
  }
  renderSounds();
}

function renderSounds() {
  const box = $('sounds');
  box.innerHTML = '';
  SOUNDS.forEach(s => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = s.label;
    chip.classList.toggle('selected', currentSound === s.id);
    chip.addEventListener('click', () => {
      if (currentSound === s.id) stopSound(false); else playSound(s.id);
    });
    box.appendChild(chip);
  });
}

$('volume').addEventListener('input', e => {
  if (!gainNode || !noiseSource) return;
  const now = audioCtx.currentTime;
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setTargetAtTime(Number(e.target.value), now, 0.1);
});

// --- Чек-лист самопомощи (сбрасывается при перезапуске) ---

function renderChecklist() {
  const box = $('checklist');
  box.innerHTML = '';
  SELF_HELP.forEach(item => {
    const label = document.createElement('label');
    label.className = 'check-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    const span = document.createElement('span');
    span.textContent = item;
    label.append(cb, span);
    box.appendChild(label);
  });
}

// --- Режим без анимации ---

function applyNoMotion(on) {
  document.body.classList.toggle('no-motion', on);
}

let savedNoMotion = false;
try { savedNoMotion = localStorage.getItem('hd.noMotion') === '1'; } catch (e) {}
$('no-motion').checked = savedNoMotion;
applyNoMotion(savedNoMotion);

$('no-motion').addEventListener('change', e => {
  applyNoMotion(e.target.checked);
  try { localStorage.setItem('hd.noMotion', e.target.checked ? '1' : '0'); } catch (err) {}
});

// --- Вход на экран и выход с него ---

function helpShown() {
  startPhrases();
}

function helpHidden() {
  stopPhrases();
  if (breathTimer) stopBreathing();
}

renderSounds();
renderChecklist();
