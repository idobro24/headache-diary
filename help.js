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

function showPhrase(i) {
  const el = $('phrase');
  phraseIndex = (i + phraseList.length) % phraseList.length;
  if (noMotion()) {
    el.textContent = phraseList[phraseIndex];
    return;
  }
  el.classList.add('fading');
  setTimeout(() => {
    el.textContent = phraseList[phraseIndex];
    el.classList.remove('fading');
  }, 800);
}

function restartPhraseTimer() {
  clearInterval(phraseTimer);
  phraseTimer = setInterval(() => showPhrase(phraseIndex + 1), PHRASE_INTERVAL);
}

function startPhrases() {
  phraseList = buildPhraseList();
  phraseIndex = 0;
  $('phrase').textContent = phraseList[0];
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

// --- Звуки: шум генерируется прямо в браузере, файлы не нужны ---

let audioCtx = null;
let gainNode = null;
let noiseSource = null;
let currentSound = null;

function noiseBuffer(type) {
  const length = audioCtx.sampleRate * 8;
  const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (type === 'white') {
      data[i] = white * 0.4;
    } else if (type === 'pink') {
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    } else {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
  }
  return buffer;
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
  noiseSource.buffer = noiseBuffer(type);
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
