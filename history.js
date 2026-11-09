// Экран «История»: календарь, список приступов и статистика

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const DAY_MS = 86400000;

const today0 = new Date();
let viewYear = today0.getFullYear();
let viewMonth = today0.getMonth();
let selectedDay = null; // выбранный день в формате 2026-11-09

function dayKey(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Все дни, которые задевает приступ (если он прошёл через полночь, их два)
function episodeDays(ep) {
  const keys = [];
  const end = ep.end ? new Date(ep.end) : new Date();
  const d = startOfDay(new Date(ep.start));
  while (d <= end) {
    keys.push(dayKey(d));
    d.setDate(d.getDate() + 1);
  }
  return keys;
}

function dateLabel(d) {
  return d.getDate() + ' ' + MONTHS_GEN[d.getMonth()];
}

function intensityOption(value) {
  return OPTIONS.intensity.find(o => o.value === value) || null;
}

// Приступы, которые задевают выбранный месяц
function episodesInMonth(all, year, month) {
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 1);
  return all.filter(ep => {
    const s = new Date(ep.start);
    const e = ep.end ? new Date(ep.end) : new Date();
    return s < to && e >= from;
  });
}

function painDaysInMonth(episodes, year, month) {
  const days = new Set();
  episodes.forEach(ep => episodeDays(ep).forEach(k => {
    const d = keyToDate(k);
    if (d.getFullYear() === year && d.getMonth() === month) days.add(k);
  }));
  return days;
}

// --- Календарь ---

function renderCalendar(all) {
  $('month-title').textContent = MONTHS[viewMonth] + ' ' + viewYear;
  const now = new Date();
  $('month-next').disabled =
    viewYear > now.getFullYear() ||
    (viewYear === now.getFullYear() && viewMonth >= now.getMonth());

  // Самая сильная боль за каждый день: 1–4, или 0, если сила не указана
  const levels = {};
  all.forEach(ep => {
    const level = ep.intensity || 0;
    episodeDays(ep).forEach(k => {
      if (!(k in levels) || level > levels[k]) levels[k] = level;
    });
  });

  const firstUse = startOfDay(Store.firstUse());
  const todayKey = dayKey(now);
  const box = $('calendar');
  box.innerHTML = '';

  WEEKDAYS.forEach(w => {
    const el = document.createElement('div');
    el.className = 'weekday';
    el.textContent = w;
    box.appendChild(el);
  });

  const first = new Date(viewYear, viewMonth, 1);
  const offset = (first.getDay() + 6) % 7; // неделя начинается с понедельника
  for (let i = 0; i < offset; i++) box.appendChild(document.createElement('div'));

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(viewYear, viewMonth, day);
    const key = dayKey(date);
    const btn = document.createElement('button');
    btn.className = 'day';
    btn.textContent = day;

    let state;
    if (date > now) state = 'future';
    else if (key in levels) state = 'level-' + levels[key];
    else if (date < firstUse) state = 'none';
    else state = 'free';
    btn.classList.add(state);
    if (key === todayKey) btn.classList.add('today');
    if (key === selectedDay) btn.classList.add('selected');

    if (state === 'future') {
      btn.disabled = true;
    } else {
      btn.addEventListener('click', () => {
        selectedDay = selectedDay === key ? null : key;
        renderHistory();
      });
    }
    box.appendChild(btn);
  }
}

// --- Список приступов ---

function episodeCard(ep) {
  const card = document.createElement('button');
  card.className = 'ep-card';

  const start = new Date(ep.start);
  const end = ep.end ? new Date(ep.end) : null;
  const sameDay = end && dayKey(start) === dayKey(end);

  const title = document.createElement('div');
  if (!end) {
    title.textContent = dateLabel(start) + ', с ' + timeOf(ep.start) + ', идёт сейчас';
  } else if (sameDay) {
    title.textContent = dateLabel(start) + ', ' + timeOf(ep.start) + '–' + timeOf(ep.end);
  } else {
    title.textContent = dateLabel(start) + ' ' + timeOf(ep.start) + ' – ' +
                        dateLabel(end) + ' ' + timeOf(ep.end);
  }

  const meta = document.createElement('div');
  meta.className = 'ep-meta';
  const parts = [];
  const opt = intensityOption(ep.intensity);
  if (opt) parts.push(opt.emoji + ' ' + opt.label);
  parts.push(formatDuration((end || new Date()) - start));
  if (ep.meds.length) parts.push(ep.meds.map(m => m.name).join(', '));
  if (ep.impact === 'reduced') parts.push('дела через силу');
  if (ep.impact === 'missed') parts.push('дела отменены');
  meta.textContent = parts.join('. ');

  card.append(title, meta);
  card.addEventListener('click', () => openLogger(ep, false));
  return card;
}

function renderList(monthEpisodes) {
  const list = $('episode-list');
  list.innerHTML = '';

  let episodes = monthEpisodes;
  if (selectedDay) {
    episodes = monthEpisodes.filter(ep => episodeDays(ep).includes(selectedDay));
    $('list-title').textContent = dateLabel(keyToDate(selectedDay));
    $('show-month').hidden = false;
  } else {
    $('list-title').textContent = 'Приступы за месяц';
    $('show-month').hidden = true;
  }

  episodes = episodes.slice().sort((a, b) => new Date(b.start) - new Date(a.start));
  if (!episodes.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = selectedDay
      ? 'В этот день головной боли не было 🌿'
      : 'В этом месяце приступов не было 🌿';
    list.appendChild(empty);
    return;
  }
  episodes.forEach(ep => list.appendChild(episodeCard(ep)));
}

// --- Статистика ---

function statTile(value, label, sub) {
  const tile = document.createElement('div');
  tile.className = 'stat';
  const v = document.createElement('div');
  v.className = 'stat-value';
  v.textContent = value;
  const l = document.createElement('div');
  l.className = 'stat-label';
  l.textContent = label;
  tile.append(v, l);
  if (sub) {
    const s = document.createElement('div');
    s.className = 'stat-sub';
    s.textContent = sub;
    tile.appendChild(s);
  }
  return tile;
}

function statBlock(title, lines, note) {
  const block = document.createElement('div');
  block.className = 'stat-block';
  const h = document.createElement('h3');
  h.textContent = title;
  block.appendChild(h);
  lines.forEach(line => {
    const p = document.createElement('p');
    p.textContent = line;
    block.appendChild(p);
  });
  if (note) {
    const n = document.createElement('p');
    n.className = 'note';
    n.textContent = note;
    block.appendChild(n);
  }
  return block;
}

function renderStats(all, monthEpisodes) {
  const box = $('stats');
  box.innerHTML = '';

  // Основные цифры месяца
  const painDays = painDaysInMonth(monthEpisodes, viewYear, viewMonth).size;
  const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
  const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
  const prevPainDays = painDaysInMonth(episodesInMonth(all, prevYear, prevMonth), prevYear, prevMonth).size;

  const ended = monthEpisodes.filter(ep => ep.end);
  const avgDuration = ended.length
    ? formatDuration(ended.reduce((s, ep) => s + (new Date(ep.end) - new Date(ep.start)), 0) / ended.length)
    : '—';

  const rated = monthEpisodes.filter(ep => ep.intensity);
  const avgOpt = rated.length
    ? intensityOption(Math.round(rated.reduce((s, ep) => s + ep.intensity, 0) / rated.length))
    : null;

  const grid = document.createElement('div');
  grid.className = 'stat-grid';
  grid.append(
    statTile(painDays, 'дней с болью', 'в прошлом месяце: ' + prevPainDays),
    statTile(monthEpisodes.length, 'приступов'),
    statTile(avgDuration, 'средняя длительность'),
    statTile(avgOpt ? avgOpt.emoji : '—', 'средняя сила' + (avgOpt ? ': ' + avgOpt.label.toLowerCase() : ''))
  );
  box.appendChild(grid);

  // Влияние на жизнь: дни, когда пришлось отменить дела или делать их через силу
  const impactDays = impactByDay(monthEpisodes, d => d.getFullYear() === viewYear && d.getMonth() === viewMonth);
  if (impactDays.missed + impactDays.reduced > 0) {
    box.appendChild(statBlock('Влияние на жизнь', [
      'Пришлось отменить дела: ' + impactDays.missed + ' ' + daysWord(impactDays.missed),
      'Дела через силу: ' + impactDays.reduced + ' ' + daysWord(impactDays.reduced)
    ]));
  }

  // Дни с обезболивающими за последние 30 дней
  const since = Date.now() - 30 * DAY_MS;
  const medDays = new Set();
  all.forEach(ep => ep.meds.forEach(m => {
    if (new Date(m.time).getTime() >= since) medDays.add(dayKey(new Date(m.time)));
  }));
  const n = medDays.size;
  box.appendChild(statBlock(
    'Обезболивающие за последние 30 дней',
    [n + ' ' + daysWord(n) + ' с приёмом лекарств'],
    n >= 10
      ? 'Приём триптанов или комбинированных обезболивающих 10 и более дней в месяц, ' +
        'а простых (ибупрофен, парацетамол) 15 и более дней может сам поддерживать головную боль. ' +
        'Стоит обсудить это с неврологом.'
      : null
  ));

  // Частые триггеры в этом месяце
  if (monthEpisodes.length) {
    const counts = {};
    monthEpisodes.forEach(ep => ep.triggers.forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    box.appendChild(statBlock(
      'Чаще всего вы отмечали',
      top.length
        ? top.map(([t, c]) => t + ': ' + c + ' из ' + monthEpisodes.length)
        : ['Триггеры в этом месяце не отмечены']
    ));
  }

  // Как помогают лекарства (за всё время, чтобы данных было больше)
  const eff = {};
  all.forEach(ep => ep.meds.forEach(m => {
    if (!m.helped) return;
    eff[m.name] = eff[m.name] || { yes: 0, partly: 0, no: 0 };
    eff[m.name][m.helped]++;
  }));
  const effLines = Object.entries(eff).map(([name, c]) =>
    name + ': помогло ' + c.yes + ', частично ' + c.partly + ', не помогло ' + c.no);
  if (effLines.length) box.appendChild(statBlock('Как помогают лекарства', effLines));
}

// Для каждого дня берём самое сильное влияние: отменённые дела важнее «через силу»
function impactByDay(episodes, dayFilter) {
  const rank = { none: 0, reduced: 1, missed: 2 };
  const days = {};
  episodes.forEach(ep => {
    if (!ep.impact) return;
    episodeDays(ep).forEach(k => {
      if (!dayFilter(keyToDate(k))) return;
      if (!(k in days) || rank[ep.impact] > rank[days[k]]) days[k] = ep.impact;
    });
  });
  const values = Object.values(days);
  return {
    missed: values.filter(v => v === 'missed').length,
    reduced: values.filter(v => v === 'reduced').length
  };
}

// --- Сборка экрана ---

function renderHistory() {
  const all = Store.load();
  const monthEpisodes = episodesInMonth(all, viewYear, viewMonth);
  renderCalendar(all);
  renderList(monthEpisodes);
  renderStats(all, monthEpisodes);
}

function changeMonth(delta) {
  viewMonth += delta;
  if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  selectedDay = null;
  renderHistory();
}

$('month-prev').addEventListener('click', () => changeMonth(-1));
$('month-next').addEventListener('click', () => changeMonth(1));

$('show-month').addEventListener('click', () => {
  selectedDay = null;
  renderHistory();
});

// Добавить прошлый приступ: на выбранный день или на последний час
$('btn-add-past').addEventListener('click', () => {
  const now = new Date();
  let start, end;
  if (selectedDay) {
    start = keyToDate(selectedDay);
    start.setHours(12, 0, 0, 0);
    end = new Date(start.getTime() + 2 * 3600000);
  } else {
    end = new Date(now);
    start = new Date(now.getTime() - 3600000);
  }
  if (end > now) {
    end = new Date(now);
    start = new Date(now.getTime() - 3600000);
  }
  openLogger(Store.createPast(start, end), false);
});
