// Логгер приступа
const OPTIONS = {
  intensity: [
    { value: 1, label: 'Лёгкая', emoji: '🙂' },
    { value: 2, label: 'Умеренная', emoji: '😐' },
    { value: 3, label: 'Сильная', emoji: '😣' },
    { value: 4, label: 'Невыносимая', emoji: '😖' }
  ],
  tags: ['Пульсирующая', 'Давящая', 'Колющая', 'Односторонняя', 'Глаза / переносица'],
  symptoms: ['Тошнота', 'Светобоязнь', 'Звукобоязнь', 'Аура'],
  triggers: ['Недосып', 'Стресс', 'Кофеин', 'Работа за ПК', 'Экраны', 'Яркое солнце',
             'Смена погоды', 'Алкоголь', 'Пропуск еды', 'Мало воды', 'Цикл'],
  meds: ['Ибупрофен', 'Парацетамол', 'Нурофен', 'Цитрамон', 'Пенталгин', 'Кеторол',
         'Суматриптан', 'Золмитриптан', 'Элетриптан', 'Ризатриптан']
};

let current = null;          // запись, которую сейчас редактируем
let openedFromStart = false; // открыт ли логгер кнопкой «Началось»

const $ = id => document.getElementById(id);

function pad(n) { return String(n).padStart(2, '0'); }

function timeOf(iso) {
  const d = new Date(iso);
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function formatDuration(ms) {
  const total = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h === 0 ? m + ' мин' : h + ' ч ' + m + ' мин';
}

function daysWord(n) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return 'день';
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return 'дня';
  return 'дней';
}

// --- Отрисовка элементов логгера ---

function renderIntensity() {
  const box = $('lg-intensity');
  box.innerHTML = '';
  OPTIONS.intensity.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'intensity-button';
    btn.classList.toggle('selected', current.intensity === opt.value);
    const emoji = document.createElement('span');
    emoji.className = 'emoji';
    emoji.textContent = opt.emoji;
    const label = document.createElement('span');
    label.textContent = opt.label;
    btn.append(emoji, label);
    btn.addEventListener('click', () => {
      current.intensity = opt.value;
      Store.upsert(current);
      renderIntensity();
    });
    box.appendChild(btn);
  });
}

function renderChips(containerId, items, field) {
  const box = $(containerId);
  box.innerHTML = '';
  items.forEach(item => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = item;
    chip.classList.toggle('selected', current[field].includes(item));
    chip.addEventListener('click', () => {
      const list = current[field];
      const i = list.indexOf(item);
      if (i >= 0) list.splice(i, 1); else list.push(item);
      chip.classList.toggle('selected');
      Store.upsert(current);
    });
    box.appendChild(chip);
  });
}

function renderMeds() {
  const list = $('lg-meds');
  list.innerHTML = '';
  current.meds.forEach((med, i) => {
    const li = document.createElement('li');
    const text = document.createElement('span');
    text.textContent = timeOf(med.time) + ' · ' + med.name + (med.dose ? ', ' + med.dose : '');
    const del = document.createElement('button');
    del.className = 'small-button';
    del.textContent = '✕';
    del.addEventListener('click', () => {
      current.meds.splice(i, 1);
      Store.upsert(current);
      renderMeds();
    });
    li.append(text, del);
    list.appendChild(li);
  });
}

function fillMedList() {
  const names = [...Store.recentMeds(), ...OPTIONS.meds]
    .filter((n, i, arr) => arr.indexOf(n) === i);
  const dl = $('med-list');
  dl.innerHTML = '';
  names.forEach(n => {
    const o = document.createElement('option');
    o.value = n;
    dl.appendChild(o);
  });
}

function addPendingMed() {
  const name = $('lg-med-name').value.trim();
  if (!name) return;
  current.meds.push({
    name,
    dose: $('lg-med-dose').value.trim(),
    time: new Date().toISOString(),
    helped: null
  });
  Store.upsert(current);
  $('lg-med-name').value = '';
  $('lg-med-dose').value = '';
  renderMeds();
  fillMedList();
}

// --- Открытие и закрытие логгера ---

function openLogger(ep, fromStart) {
  current = ep;
  openedFromStart = fromStart;
  $('lg-time').value = timeOf(ep.start);
  $('lg-note').value = ep.note;
  renderIntensity();
  renderChips('lg-tags', OPTIONS.tags, 'tags');
  renderChips('lg-symptoms', OPTIONS.symptoms, 'symptoms');
  renderChips('lg-triggers', OPTIONS.triggers, 'triggers');
  renderMeds();
  fillMedList();
  $('logger').hidden = false;
  $('logger').scrollTop = 0;
}

function closeLogger() {
  addPendingMed(); // если лекарство вписано, но «+» не нажат
  $('logger').hidden = true;
  const goHelp = openedFromStart;
  current = null;
  renderHome();
  if (goHelp) showScreen('help');
}

// --- Завершение приступа ---

function openEndSheet() {
  const ep = Store.active();
  if (!ep) return;
  current = ep;
  $('end-duration').textContent =
    'Длительность: ' + formatDuration(Date.now() - new Date(ep.start));

  const box = $('end-meds');
  box.innerHTML = '';
  ep.meds.forEach(med => {
    const block = document.createElement('div');
    block.className = 'end-med';
    const q = document.createElement('p');
    q.textContent = med.name + ' — помогло?';
    const row = document.createElement('div');
    row.className = 'chips';
    [['yes', 'Да'], ['partly', 'Частично'], ['no', 'Нет']].forEach(([val, label]) => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = label;
      b.classList.toggle('selected', med.helped === val);
      b.addEventListener('click', () => {
        med.helped = val;
        Store.upsert(ep);
        row.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
        b.classList.add('selected');
      });
      row.appendChild(b);
    });
    block.append(q, row);
    box.appendChild(block);
  });
  $('end-sheet').hidden = false;
}

// --- Главный экран ---

function renderHome() {
  const ep = Store.active();
  if (ep) {
    $('home-title').textContent = 'Приступ идёт';
    $('home-status').textContent =
      'Уже ' + formatDuration(Date.now() - new Date(ep.start)) + '. Это пройдёт 🌿';
    $('btn-start').textContent = 'Прошло';
    $('home-hint').textContent = 'Нажмите, когда станет легче';
    $('btn-edit').hidden = false;
    return;
  }
  $('home-title').textContent = 'Как вы сегодня?';
  $('btn-start').textContent = 'Началось';
  $('home-hint').textContent = 'Нажмите, когда начнётся боль';
  $('btn-edit').hidden = true;

  const last = Store.lastEnded();
  if (!last) {
    $('home-status').textContent = 'Хорошего дня 🌿';
  } else {
    const days = Math.floor((Date.now() - new Date(last.end)) / 86400000);
    $('home-status').textContent = days === 0
      ? 'Приступ позади. Отдыхайте 🌿'
      : 'Без боли: ' + days + ' ' + daysWord(days) + ' 🌿';
  }
}

// --- Обработчики кнопок ---

$('btn-start').addEventListener('click', () => {
  if (Store.active()) openEndSheet();
  else openLogger(Store.create(), true);
});

$('btn-edit').addEventListener('click', () => {
  const ep = Store.active();
  if (ep) openLogger(ep, false);
});

$('lg-time').addEventListener('change', e => {
  const [h, m] = e.target.value.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (d > new Date()) d.setDate(d.getDate() - 1); // началось вчера вечером
  current.start = d.toISOString();
  Store.upsert(current);
});

$('lg-note').addEventListener('input', e => {
  if (!current) return;
  current.note = e.target.value;
  Store.upsert(current);
});

$('lg-med-add').addEventListener('click', addPendingMed);
$('lg-done').addEventListener('click', closeLogger);

$('end-yes').addEventListener('click', () => {
  current.end = new Date().toISOString();
  Store.upsert(current);
  current = null;
  $('end-sheet').hidden = true;
  renderHome();
});

$('end-no').addEventListener('click', () => {
  current = null;
  $('end-sheet').hidden = true;
});
