// Логгер приступа: запись, дополнение, редактирование и удаление
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

const HELPED = [['yes', 'Помогло'], ['partly', 'Частично'], ['no', 'Не помогло']];

// Как приступ повлиял на день (для врача это так же важно, как частота)
const IMPACT = [['none', 'Почти не мешал'], ['reduced', 'Дела через силу'], ['missed', 'Пришлось отменить дела']];
const IMPACT_AREAS = ['Работа или учёба', 'Домашние дела', 'Встречи и отдых'];

let current = null;          // запись, которую сейчас редактируем
let openedFromStart = false; // открыт ли логгер кнопкой «Началось»

const $ = id => document.getElementById(id);

function pad(n) { return String(n).padStart(2, '0'); }

function timeOf(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function formatDuration(ms) {
  const total = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return m + ' мин';
  return m === 0 ? h + ' ч' : h + ' ч ' + m + ' мин';
}

function daysWord(n) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return 'день';
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return 'дня';
  return 'дней';
}

// Дата и время для поля datetime-local и обратно
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
         'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function parseLocalInput(value) {
  if (!value || !value.includes('T')) return null;
  const [date, time] = value.split('T');
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const result = new Date(y, mo - 1, d, h, mi);
  return isNaN(result) ? null : result;
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
      saveCurrent();
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
      saveCurrent();
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
    text.textContent = timeOf(med.time) + ', ' + med.name + (med.dose ? ', ' + med.dose : '');
    const del = document.createElement('button');
    del.className = 'small-button';
    del.textContent = '✕';
    del.setAttribute('aria-label', 'Удалить лекарство');
    del.addEventListener('click', () => {
      current.meds.splice(i, 1);
      saveCurrent();
      renderMeds();
    });
    li.append(text, del);

    // У завершённого приступа можно сразу отметить, помогло ли лекарство
    if (current.end) {
      const row = document.createElement('div');
      row.className = 'chips';
      HELPED.forEach(([val, label]) => {
        const b = document.createElement('button');
        b.className = 'chip';
        b.textContent = label;
        b.classList.toggle('selected', med.helped === val);
        b.addEventListener('click', () => {
          med.helped = med.helped === val ? null : val;
          saveCurrent();
          renderMeds();
        });
        row.appendChild(b);
      });
      li.appendChild(row);
    }
    list.appendChild(li);
  });
}

// Вопрос о влиянии на день: в логгере (prefix 'lg') и при завершении приступа (prefix 'end')
function renderImpact(ep, prefix) {
  if (!Array.isArray(ep.impactAreas)) ep.impactAreas = [];
  const box = $(prefix + '-impact');
  box.innerHTML = '';
  IMPACT.forEach(([val, label]) => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = label;
    chip.classList.toggle('selected', ep.impact === val);
    chip.addEventListener('click', () => {
      ep.impact = ep.impact === val ? null : val;
      if (ep.impact !== 'reduced' && ep.impact !== 'missed') ep.impactAreas = [];
      saveEp(ep);
      renderImpact(ep, prefix);
    });
    box.appendChild(chip);
  });

  const showAreas = ep.impact === 'reduced' || ep.impact === 'missed';
  $(prefix + '-areas-wrap').hidden = !showAreas;
  const areas = $(prefix + '-areas');
  areas.innerHTML = '';
  if (!showAreas) return;
  IMPACT_AREAS.forEach(area => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = area;
    chip.classList.toggle('selected', ep.impactAreas.includes(area));
    chip.addEventListener('click', () => {
      const i = ep.impactAreas.indexOf(area);
      if (i >= 0) ep.impactAreas.splice(i, 1); else ep.impactAreas.push(area);
      chip.classList.toggle('selected');
      saveEp(ep);
    });
    areas.appendChild(chip);
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
  if (!current) return;
  const name = $('lg-med-name').value.trim();
  if (!name) return;
  current.meds.push({
    name,
    dose: $('lg-med-dose').value.trim(),
    // для прошлого приступа время приёма неизвестно, берём начало приступа
    time: current.draft ? current.start : (current.end ? current.start : new Date().toISOString()),
    helped: null
  });
  saveCurrent();
  $('lg-med-name').value = '';
  $('lg-med-dose').value = '';
  renderMeds();
  fillMedList();
}

// Черновик — новая запись о прошлом приступе, пока не указаны начало и конец.
// Он хранится только в памяти и попадает в дневник, когда обе даты заполнены.
function saveEp(ep) {
  if (!ep || ep.draft) return;
  Store.upsert(ep);
}

function saveCurrent() {
  saveEp(current);
}

// Когда у черновика есть начало и конец, превращаем его в настоящую запись
function finalizeDraft() {
  if (!current || !current.draft || !current.start || !current.end) return;
  delete current.draft;
  current.meds.forEach(m => { if (!m.time) m.time = current.start; });
  Store.upsert(current);
  $('lg-title').textContent = 'Запись о приступе';
  renderMeds();
}

// --- Открытие и закрытие логгера ---

function openLogger(ep, fromStart) {
  current = ep;
  openedFromStart = fromStart;
  const isActive = !ep.end && !ep.draft;

  $('lg-title').textContent = fromStart ? 'Приступ записан 🌿'
    : ep.draft ? 'Новая запись о приступе' : 'Запись о приступе';
  $('lg-time-row').hidden = !isActive;
  $('lg-range-row').hidden = isActive;
  if (isActive) {
    $('lg-time').value = timeOf(ep.start);
  } else {
    $('lg-start-dt').value = toLocalInput(ep.start);
    $('lg-end-dt').value = toLocalInput(ep.end);
  }

  $('lg-impact-section').hidden = isActive;
  if (!isActive) renderImpact(ep, 'lg');

  $('lg-note').value = ep.note;
  renderIntensity();
  renderChips('lg-tags', OPTIONS.tags, 'tags');
  renderChips('lg-symptoms', OPTIONS.symptoms, 'symptoms');
  renderChips('lg-triggers', OPTIONS.triggers, 'triggers');
  renderMeds();
  fillMedList();
  renderLoggerBP(ep);
  $('logger').hidden = false;
  $('logger').scrollTop = 0;
}

function discardDraft() {
  current = null;
  $('logger').hidden = true;
  refreshScreens();
}

function refreshScreens() {
  renderHome();
  renderHistory();
}

function closeLogger() {
  if (current && current.draft) {
    if (!confirm('Укажите начало и конец приступа, чтобы сохранить запись. Закрыть без сохранения?')) return;
    discardDraft();
    return;
  }
  // Давление, вписанное без нажатия «+», тоже сохраняем.
  // Если в нём ошибка или оно очень высокое, запись не закрываем, чтобы сообщение увидели
  if (!addPendingLoggerBP()) {
    $('lg-bp-msg').scrollIntoView({ block: 'center' });
    return;
  }
  addPendingMed(); // если лекарство вписано, но «+» не нажат
  $('logger').hidden = true;
  const goHelp = openedFromStart;
  current = null;
  refreshScreens();
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
    q.textContent = med.name + ': помогло?';
    const row = document.createElement('div');
    row.className = 'chips';
    [['yes', 'Да'], ['partly', 'Частично'], ['no', 'Нет']].forEach(([val, label]) => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = label;
      b.classList.toggle('selected', med.helped === val);
      b.addEventListener('click', () => {
        med.helped = val;
        saveEp(ep);
        row.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
        b.classList.add('selected');
      });
      row.appendChild(b);
    });
    block.append(q, row);
    box.appendChild(block);
  });
  renderImpact(ep, 'end');
  resetEndBP();
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
    $('btn-message-home').hidden = false;
    return;
  }
  $('home-title').textContent = 'Как вы сегодня?';
  $('btn-start').textContent = 'Началось';
  $('home-hint').textContent = 'Нажмите, когда начнётся боль';
  $('btn-edit').hidden = true;
  $('btn-message-home').hidden = true;

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

// Время начала идущего приступа
$('lg-time').addEventListener('change', e => {
  const [h, m] = e.target.value.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (d > new Date()) d.setDate(d.getDate() - 1); // началось вчера вечером
  current.start = d.toISOString();
  saveCurrent();
});

// Начало и конец завершённого приступа
$('lg-start-dt').addEventListener('change', e => {
  const d = parseLocalInput(e.target.value);
  if (!d || d > new Date() || (current.end && d >= new Date(current.end))) {
    alert('Начало должно быть раньше конца приступа и не в будущем.');
    e.target.value = toLocalInput(current.start);
    return;
  }
  current.start = d.toISOString();
  saveCurrent();
  finalizeDraft();
});

$('lg-end-dt').addEventListener('change', e => {
  const d = parseLocalInput(e.target.value);
  if (current.draft && !current.start) {
    alert('Сначала укажите начало приступа.');
    e.target.value = '';
    return;
  }
  if (!d || d > new Date() || d <= new Date(current.start)) {
    alert('Конец должен быть позже начала приступа и не в будущем.');
    e.target.value = toLocalInput(current.end);
    return;
  }
  current.end = d.toISOString();
  saveCurrent();
  finalizeDraft();
});

$('lg-note').addEventListener('input', e => {
  if (!current) return;
  current.note = e.target.value;
  saveCurrent();
});

$('lg-med-add').addEventListener('click', addPendingMed);
$('lg-done').addEventListener('click', closeLogger);

$('lg-delete').addEventListener('click', () => {
  if (!current) return;
  if (current.draft) {
    discardDraft();
    return;
  }
  if (!confirm('Удалить эту запись? Это действие нельзя отменить.')) return;
  Store.remove(current.id);
  current = null;
  $('logger').hidden = true;
  refreshScreens();
});

$('end-yes').addEventListener('click', () => {
  // Давление в конце приступа: при ошибке или очень высоком значении окно не закрываем
  if (!addPendingEndBP()) return;
  current.end = new Date().toISOString();
  saveCurrent();
  current = null;
  $('end-sheet').hidden = true;
  refreshScreens();
});

$('end-no').addEventListener('click', () => {
  current = null;
  $('end-sheet').hidden = true;
});
