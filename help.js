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

// Звуки по группам: [id, подпись]
const SOUND_GROUPS = [
  { title: 'Дождь', items: [['rain', 'Дождь'], ['umbrella', 'Под зонтом'], ['car', 'По стеклу в машине'],
                            ['forest', 'Дождь в лесу'], ['drops', 'Редкие капли']] },
  { title: 'Природа', items: [['woods', 'Лес за окном'], ['surf', 'Прибой вдалеке']] },
  { title: 'Уют', items: [['fire', 'Камин'], ['purr', 'Мурчание кота'], ['child', 'Дыхание ребёнка'],
                          ['dog', 'Сопение собаки']] },
  { title: 'Шумы', items: [['white', 'Белый шум'], ['pink', 'Мягкий шум'], ['brown', 'Как водопад']] }
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

function normalizePeak(data, target) {
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  if (!peak) return;
  const k = target / peak;
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

// Треск: короткий всплеск шума в полосе частот (без самых высоких, чтобы не шипело)
function addCrackle(data, start, amp, decaySec, lowCut, highCut, sr) {
  const len = Math.floor(decaySec * sr * 6);
  if (start + len >= data.length) return;
  const aLo = onePole(lowCut, sr), aHi = onePole(highCut, sr);
  const burst = new Float32Array(len);
  let lo = 0, hi = 0, peak = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    hi += aHi * (w - hi);
    lo += aLo * (w - lo);
    const v = (hi - lo) * Math.exp(-i / (decaySec * sr));
    burst[i] = v;
    peak = Math.max(peak, Math.abs(v));
  }
  const k = peak ? amp / peak : 0;
  for (let i = 0; i < len; i++) data[start + i] += burst[i] * k;
}

function genFire(data, sr) {
  // Фон почти тихий: лишь еле уловимое тепло огня между щелчками
  const noise = brownSource();
  const a = onePole(250, sr);
  let lp = 0;
  for (let i = 0; i < data.length; i++) {
    lp += a * (noise() - lp);
    const t = i / sr;
    data[i] = lp * (0.75 + 0.25 * Math.sin(2 * Math.PI * t * 0.23) * Math.sin(2 * Math.PI * t * 0.37 + 1));
  }
  normalizeRms(data, 0.006);

  // Треск дров как в живом камине: короткая серия потрескиваний, затем спокойная пауза 1–4 секунды.
  // Ритма нет: длина серий, промежутки и сила щелчков каждый раз разные
  const seconds = data.length / sr;
  let t = 0.3;
  while (t < seconds) {
    const n = 2 + Math.floor(Math.random() * 6);
    for (let k = 0; k < n; k++) {
      t += 0.06 + Math.random() * Math.random() * 0.45;
      if (t >= seconds) break;
      addCrackle(data, Math.floor(t * sr), 0.12 + Math.random() * 0.33,
                 0.002 + Math.random() * 0.003, 300, 1800 + Math.random() * 600, sr);
    }
    // иногда — мягкий щелчок полена
    if (Math.random() < 0.25) {
      t += 0.1 + Math.random() * 0.3;
      if (t < seconds) addCrackle(data, Math.floor(t * sr), 0.45 + Math.random() * 0.2,
                                  0.006 + Math.random() * 0.004, 150, 1000, sr);
    }
    // тихая пауза
    t += 1.2 + Math.random() * 2.8;
  }
}

// Плавно склеиваем конец с началом, чтобы при повторе не было щелчка

// Полосовой шум: белый шум без самых низких и самых высоких частот
function bandSource(lowCut, highCut, sr) {
  const aLo = onePole(lowCut, sr), aHi = onePole(highCut, sr);
  let lo = 0, hi = 0;
  return () => {
    const w = Math.random() * 2 - 1;
    hi += aHi * (w - hi);
    lo += aLo * (w - lo);
    return hi - lo;
  };
}

// Плавный «холм» от 0 до 1 и обратно на отрезке x от 0 до 1
function bump(x) {
  return x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x) ** 2;
}

// Расписание циклов (волн, вдохов), которое ровно укладывается в петлю: тогда повтор незаметен
function cycleSchedule(total, meanPeriod, spread) {
  const periods = [];
  let sum = 0;
  while (sum < total - meanPeriod / 2) {
    const p = meanPeriod * (1 + (Math.random() * 2 - 1) * spread);
    periods.push(p);
    sum += p;
  }
  const k = total / sum;
  let t = 0;
  return periods.map(p => {
    const c = { start: t, length: p * k };
    t += p * k;
    return c;
  });
}

function cycleAt(schedule, total, time) {
  const t = time % total;
  for (let i = 0; i < schedule.length; i++) {
    const c = schedule[i];
    if (t < c.start + c.length) return { index: i, x: (t - c.start) / c.length };
  }
  return { index: schedule.length - 1, x: 1 };
}

// Дождь под зонтом: глухие удары капель по ткани и крупные капли с края
function genUmbrella(data, sr) {
  const noise = pinkSource();
  const aL = onePole(2200, sr), aH = onePole(150, sr);
  let lp = 0, hp = 0;
  for (let i = 0; i < data.length; i++) {
    lp += aL * (noise() - lp);
    hp += aH * (lp - hp);
    data[i] = lp - hp;
  }
  normalizeRms(data, 0.05);
  const sec = data.length / sr;
  for (let k = 0; k < sec * 45; k++) {
    addCrackle(data, Math.floor(Math.random() * data.length), 0.08 + Math.random() * 0.22,
               0.004 + Math.random() * 0.008, 250, 1200 + Math.random() * 600, sr);
  }
  for (let k = 0; k < sec * 0.6; k++) {
    addCrackle(data, Math.floor(Math.random() * data.length), 0.35 + Math.random() * 0.2,
               0.015 + Math.random() * 0.015, 120, 700, sr);
  }
}

// Дождь по стеклу в машине: приглушённый шум снаружи, капли по стеклу и редкие стекающие струйки
function genCar(data, sr) {
  const noise = pinkSource();
  const aL = onePole(900, sr), aH = onePole(80, sr);
  const total = data.length / sr;
  let lp = 0, hp = 0;
  for (let i = 0; i < data.length; i++) {
    lp += aL * (noise() - lp);
    hp += aH * (lp - hp);
    const t = i / sr;
    data[i] = (lp - hp) * (0.85 + 0.15 * Math.sin(2 * Math.PI * t * 2 / total));
  }
  normalizeRms(data, 0.06);
  for (let k = 0; k < total * 28; k++) {
    addCrackle(data, Math.floor(Math.random() * data.length), 0.06 + Math.random() * 0.2,
               0.002 + Math.random() * 0.004, 600, 2600, sr);
  }
  for (let k = 0; k < total * 0.3; k++) {
    let pos = Math.floor(Math.random() * data.length);
    const n = 6 + Math.floor(Math.random() * 5);
    for (let j = 0; j < n; j++) {
      pos += Math.floor(sr * (0.02 + Math.random() * 0.04));
      addCrackle(data, pos, 0.05 + Math.random() * 0.05, 0.003, 800, 2200, sr);
    }
  }
}

// Одна капля: мягкий «плюх» с тоном, который чуть поднимается
function addPlink(data, start, amp, f0, sr) {
  const len = Math.floor(0.12 * sr);
  if (start + len >= data.length) return;
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const f = f0 * (1 + 0.8 * t / 0.12);
    phase += 2 * Math.PI * f / sr;
    const attack = Math.min(1, i / (0.002 * sr));
    data[start + i] += amp * attack * Math.exp(-t / 0.025) * Math.sin(phase);
  }
}

// Редкие капли: тихая морось вдалеке и отдельные мягкие глухие капли по мокрым листьям и подоконнику
function genDrops(data, sr) {
  const noise = pinkSource();
  const aL = onePole(1200, sr), aH = onePole(200, sr);
  let lp = 0, hp = 0;
  for (let i = 0; i < data.length; i++) {
    lp += aL * (noise() - lp);
    hp += aH * (lp - hp);
    data[i] = lp - hp;
  }
  normalizeRms(data, 0.012);
  let pos = Math.floor(0.3 * sr);
  while (pos < data.length - 0.2 * sr) {
    const big = Math.random() < 0.25;
    addCrackle(data, pos,
               big ? 0.4 + Math.random() * 0.2 : 0.18 + Math.random() * 0.2,
               big ? 0.012 + Math.random() * 0.008 : 0.005 + Math.random() * 0.005,
               big ? 120 : 250, big ? 900 : 1600, sr);
    pos += Math.floor(sr * (0.5 + Math.random() * 1.6));
  }
}

// Птица: короткая негромкая фраза из нескольких посвистов
function addBirdPhrase(data, start, sr) {
  const n = 2 + Math.floor(Math.random() * 4);
  const base = 2600 + Math.random() * 1400;
  const up = Math.random() < 0.5;
  const amp = 0.03 + Math.random() * 0.03;
  let pos = Math.floor(start);
  for (let k = 0; k < n; k++) {
    const len = Math.floor((0.06 + Math.random() * 0.07) * sr);
    if (pos + len >= data.length) return;
    const f0 = base * (1 + (Math.random() - 0.5) * 0.15);
    const f1 = f0 * (up ? 1.25 : 0.8);
    let phase = 0;
    for (let i = 0; i < len; i++) {
      const x = i / len;
      phase += 2 * Math.PI * (f0 + (f1 - f0) * x) / sr;
      data[pos + i] += amp * bump(x) * Math.sin(phase);
    }
    pos += len + Math.floor((0.04 + Math.random() * 0.08) * sr);
  }
}

// Лес за окном: шелест листвы порывами и редкие тихие птицы
function genWoods(data, sr) {
  const leaves = bandSource(300, 2200, sr);
  const total = data.length / sr;
  const aF = onePole(6, sr);
  let flutter = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    flutter += aF * ((Math.random() * 2 - 1) - flutter);
    // почти ровный тихий шелест, как в самые спокойные моменты, лишь едва заметно «дышит»
    const gust = 0.9 + 0.06 * Math.sin(2 * Math.PI * 2 * t / total) + 0.04 * Math.sin(2 * Math.PI * 3 * t / total + 1);
    data[i] = leaves() * gust * (0.9 + 1.5 * flutter);
  }
  normalizeRms(data, 0.03);
  let t = 1 + Math.random() * 2;
  while (t < total - 1.5) {
    addBirdPhrase(data, t * sr, sr);
    t += 4 + Math.random() * 6;
  }
}

// Прибой вдалеке: волна накатывает и отступает каждые 8–11 секунд
function genSurf(data, sr) {
  const total = SOUND_SETTINGS.surf.seconds;
  const waves = cycleSchedule(total, 9.5, 0.15);
  const brown = brownSource(), pink = pinkSource();
  let lp = 0;
  for (let i = 0; i < data.length; i++) {
    const { x } = cycleAt(waves, total, i / sr);
    const env = x < 0.35 ? Math.sin(Math.PI * x / 0.7) ** 2 : Math.cos(Math.PI / 2 * (x - 0.35) / 0.65) ** 2;
    const a = onePole(350 + 900 * env, sr);
    lp += a * ((0.6 * brown() + 0.4 * pink()) - lp);
    data[i] = lp * (0.25 + 0.75 * env);
  }
}

// Дыхание: вдох и выдох — мягкий шум воздуха, который плавно нарастает и затихает
function genBreathing(data, sr, opts) {
  const total = opts.seconds;
  const cycles = cycleSchedule(total, opts.period, 0.08);
  const inhale = bandSource(opts.inLow, opts.inHigh, sr);
  const exhaleRaw = bandSource(opts.outLow, opts.outHigh, sr);
  // приглушение выдоха: дополнительно сглаживаем, чтобы «ррр» звучало мягко, как через шёрстку
  const aMuffle = opts.muffle ? onePole(opts.muffle, sr) : 0;
  let muffled = 0;
  const exhale = () => {
    const v = exhaleRaw();
    if (!aMuffle) return v;
    muffled += aMuffle * (v - muffled);
    return muffled * 2;
  };
  const room = pinkSource();
  const sighs = new Set(cycles.map((c, i) => i).filter(i => opts.sighEvery && i % opts.sighEvery === opts.sighEvery - 1));
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const { index, x } = cycleAt(cycles, total, t);
    const inEnv = bump(x / opts.inShare);
    const outX = (x - opts.inShare - 0.04) / opts.outShare;
    const sigh = sighs.has(index) ? 1.4 : 1;
    let outEnv = bump(outX) * sigh;
    // сопение: на выдохе воздух слегка «дрожит»
    if (opts.snore) {
      const depth = opts.snoreDepth || 0.35;
      outEnv *= 1 - depth + depth * (0.5 + 0.5 * Math.sin(2 * Math.PI * opts.snore * t)) ** 2;
    }
    data[i] = (opts.inGain || 0.7) * inEnv * inhale() + outEnv * exhale() + 0.004 * room();
  }
}

// Мурчание кота: на вдохе тихое бархатное «ррр», на выдохе — такое же мягкое приглушённое «ррр»,
// как в сопении собаки, затем спокойная пауза перед следующим вдохом
function genPurr(data, sr) {
  const total = SOUND_SETTINGS.purr.seconds;
  const cycles = cycleSchedule(total, 6.0, 0.12);
  // вдох: низкий шум, сглаженный «через шёрстку»
  const body = bandSource(60, 420, sr);
  const aSoft = onePole(380, sr);
  let soft = 0;
  // выдох: та же цепочка, что у собаки (полоса 120–700 Гц и дополнительное приглушение)
  const outRaw = bandSource(120, 700, sr);
  const aMuffle = onePole(450, sr);
  let muffled = 0;
  let phase = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const { x } = cycleAt(cycles, total, t);
    soft += aSoft * (body() - soft);
    muffled += aMuffle * (outRaw() - muffled);
    if (x < 0.22) {
      // вдох
      phase += 2 * Math.PI * 21 / sr;
      const pulse = (0.5 + 0.5 * Math.sin(phase)) ** 2;
      data[i] = bump(x / 0.22) ** 0.5 * 0.55 * (0.7 + 0.3 * pulse) * soft;
    } else {
      // выдох с мягкой вибрацией, как у собаки, и пауза после него
      phase += 2 * Math.PI * 24 / sr;
      const pulse = (0.5 + 0.5 * Math.sin(phase)) ** 2;
      data[i] = bump((x - 0.25) / 0.28) ** 0.5 * (0.78 + 0.22 * pulse) * muffled * 0.62;
    }
  }
}

const SOUND_SETTINGS = {
  white: { seconds: 12 }, pink: { seconds: 12 }, brown: { seconds: 12 },
  rain: { seconds: 12 }, forest: { seconds: 12 }, umbrella: { seconds: 12 }, car: { seconds: 16 },
  drops: { seconds: 20, peak: 0.8 }, fire: { seconds: 24, peak: 1.4 },
  woods: { seconds: 24, rms: 0.019 }, surf: { seconds: 30 },
  child: { seconds: 29, rms: 0.05 }, dog: { seconds: 30, rms: 0.039 }, purr: { seconds: 36, rms: 0.03 }
};

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
  const set = SOUND_SETTINGS[type] || { seconds: LOOP_SECONDS };
  const data = new Float32Array(Math.floor((set.seconds + FADE_SECONDS) * sr));
  if (type === 'white') genNoise(data, whiteSource());
  else if (type === 'pink') genNoise(data, pinkSource());
  else if (type === 'brown') genNoise(data, brownSource());
  else if (type === 'rain') genRain(data, sr, false);
  else if (type === 'forest') genRain(data, sr, true);
  else if (type === 'fire') genFire(data, sr);
  else if (type === 'umbrella') genUmbrella(data, sr);
  else if (type === 'car') genCar(data, sr);
  else if (type === 'drops') genDrops(data, sr);
  else if (type === 'woods') genWoods(data, sr);
  else if (type === 'surf') genSurf(data, sr);
  else if (type === 'purr') genPurr(data, sr);
  else if (type === 'child') {
    genBreathing(data, sr, { seconds: set.seconds, period: 3.6, inShare: 0.36, outShare: 0.44,
                             inLow: 600, inHigh: 3000, outLow: 400, outHigh: 2200 });
  } else if (type === 'dog') {
    genBreathing(data, sr, { seconds: set.seconds, period: 3.7, inShare: 0.35, outShare: 0.5,
                             inLow: 300, inHigh: 1300, outLow: 120, outHigh: 700, muffle: 450,
                             snore: 24, snoreDepth: 0.3, sighEvery: 5, inGain: 0.28 });
  }
  // Выравниваем громкость: у камина и капель по пикам (главное — щелчки и капли), у остальных по среднему
  if (set.peak) normalizePeak(data, set.peak);
  else normalizeRms(data, set.rms || 0.12);
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

  const src = audioCtx.createBufferSource();
  const samples = getSamples(type, audioCtx.sampleRate);
  const buffer = audioCtx.createBuffer(1, samples.length, audioCtx.sampleRate);
  buffer.getChannelData(0).set(samples);
  src.buffer = buffer;
  src.loop = true;
  src.connect(gainNode);
  // если звук выключился сам (по таймеру сна), снимаем выделение с кнопки
  src.onended = () => {
    if (noiseSource === src) {
      noiseSource = null;
      currentSound = null;
      renderSounds();
    }
  };
  noiseSource = src;

  const now = audioCtx.currentTime;
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(Number($('volume').value), now + 1.5); // плавное начало
  src.start();
  currentSound = type;
  scheduleSleepFade();
  renderSounds();
}

function stopSound(immediate, fadeSeconds = 0.6) {
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
    gainNode.gain.linearRampToValueAtTime(0, now + fadeSeconds); // плавное затухание
    src.stop(now + fadeSeconds + 0.1);
  }
  renderSounds();
}

function renderSounds() {
  const box = $('sounds');
  box.className = 'sound-groups';
  box.innerHTML = '';
  SOUND_GROUPS.forEach(group => {
    const title = document.createElement('p');
    title.className = 'sound-group-title';
    title.textContent = group.title;
    const row = document.createElement('div');
    row.className = 'chips';
    group.items.forEach(([id, label]) => {
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.textContent = label;
      chip.classList.toggle('selected', currentSound === id);
      chip.addEventListener('click', () => {
        if (currentSound === id) stopSound(false); else playSound(id);
      });
      row.appendChild(chip);
    });
    box.append(title, row);
  });
}

// --- Сворачивание приложения ---
// Когда iOS «замораживает» свёрнутое приложение, звук обрывается, а последний кусочек звука может
// застрять и гудеть «нотой». Поэтому при первом же признаке ухода в фон звук очень быстро
// гасится до тишины и останавливается: тогда застревать нечему. При возвращении звук продолжается.
let resumeSound = null;

function pauseForBackground() {
  if (!audioCtx || !noiseSource || resumeSound) return;
  resumeSound = currentSound;
  const now = audioCtx.currentTime;
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(gainNode.gain.value, now);
  gainNode.gain.setTargetAtTime(0, now, 0.004); // примерно 15 мс до тишины, без щелчка
  const src = noiseSource;
  noiseSource = null;
  try { src.stop(now + 0.03); } catch (e) {}
  setTimeout(() => { if (resumeSound && audioCtx.state === 'running') audioCtx.suspend(); }, 60);
}

function resumeFromBackground() {
  if (!resumeSound || document.hidden) return;
  const type = resumeSound;
  resumeSound = null;
  const giveUp = () => { currentSound = null; renderSounds(); };
  // таймер сна закончился, пока приложение было свёрнуто
  if (sleepEnd && Date.now() >= sleepEnd) {
    giveUp();
    setSleepTimer(0);
    return;
  }
  audioCtx.resume().then(() => playSound(type)).catch(giveUp);
  // если iOS не разрешила продолжить без касания, честно показываем, что звук выключен
  setTimeout(() => { if (audioCtx.state !== 'running') giveUp(); }, 600);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseForBackground(); else resumeFromBackground();
});
window.addEventListener('pagehide', pauseForBackground);
window.addEventListener('blur', pauseForBackground);   // на iPhone срабатывает раньше, чем приложение скрывается
window.addEventListener('focus', resumeFromBackground);

// --- Таймер сна: звук плавно затихает и выключается сам ---

const SLEEP_OPTIONS = [[0, 'Выкл'], [15, '15 мин'], [30, '30 мин'], [60, '60 мин']];
const SLEEP_FADE_SECONDS = 20;
let sleepMinutes = 0;
let sleepEnd = 0;
let sleepTimer = null;

// Затухание планируем прямо в звуковом движке: так оно сработает точно, даже если экран погас
function scheduleSleepFade() {
  if (!sleepEnd || !noiseSource || !audioCtx) return;
  const remain = (sleepEnd - Date.now()) / 1000;
  if (remain <= 0) return;
  const now = audioCtx.currentTime;
  const volume = Number($('volume').value);
  const fadeStart = Math.max(0, remain - SLEEP_FADE_SECONDS);
  gainNode.gain.setValueAtTime(volume, now + Math.max(fadeStart, 1.5));
  gainNode.gain.linearRampToValueAtTime(0, now + remain);
  try { noiseSource.stop(now + remain + 0.1); } catch (e) {}
}

function setSleepTimer(minutes) {
  clearTimeout(sleepTimer);
  sleepMinutes = minutes;
  sleepEnd = minutes ? Date.now() + minutes * 60000 : 0;
  if (noiseSource && audioCtx) {
    // перепланируем громкость: сначала обычная, затем затухание к концу таймера
    const now = audioCtx.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(Number($('volume').value), now + 0.3);
    if (!minutes) {
      // таймер выключили: звук должен играть дальше, поэтому перезапускаем его без остановки
      const type = currentSound;
      stopSound(true);
      playSound(type);
    } else {
      scheduleSleepFade();
    }
  }
  if (minutes) sleepTimer = setTimeout(() => setSleepTimer(0), minutes * 60000 + 500);
  renderSleep();
}

function renderSleep() {
  const box = $('sleep-chips');
  box.innerHTML = '';
  SLEEP_OPTIONS.forEach(([min, label]) => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = label;
    chip.classList.toggle('selected', sleepMinutes === min);
    chip.addEventListener('click', () => setSleepTimer(min));
    box.appendChild(chip);
  });
  const status = $('sleep-status');
  if (sleepEnd) {
    const left = Math.max(1, Math.ceil((sleepEnd - Date.now()) / 60000));
    status.textContent = 'Звук плавно выключится через ' + left + ' мин';
    status.hidden = false;
  } else {
    status.hidden = true;
  }
}

setInterval(() => { if (sleepEnd) renderSleep(); }, 30000);

// Закрашенная часть ползунка громкости
function paintVolume() {
  $('volume').style.setProperty('--fill', (Number($('volume').value) * 100) + '%');
}
paintVolume();

$('volume').addEventListener('input', e => {
  paintVolume();
  if (!gainNode || !noiseSource) return;
  const now = audioCtx.currentTime;
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setTargetAtTime(Number(e.target.value), now, 0.1);
  scheduleSleepFade();
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

// --- Режим «Темнее тёмного» ---

function applyDim(on) {
  document.body.classList.toggle('dim', on);
  // цвет системной полосы сверху тоже делаем темнее
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', on ? '#0A0B09' : '#22271F');
}

let savedDim = false;
try { savedDim = localStorage.getItem('hd.dim') === '1'; } catch (e) {}
$('dim-mode').checked = savedDim;
applyDim(savedDim);

$('dim-mode').addEventListener('change', e => {
  applyDim(e.target.checked);
  try { localStorage.setItem('hd.dim', e.target.checked ? '1' : '0'); } catch (err) {}
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
renderSleep();
renderChecklist();
