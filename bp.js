// Дневник давления: замеры в любые дни, связь с приступами, график и средние значения

const BP_LIMITS = { sys: [60, 260], dia: [30, 180], pulse: [30, 220] };

function bpId() {
  return 'bp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Проверка введённых чисел. Возвращает замер или текст ошибки
function readBP(sysText, diaText, pulseText) {
  const sys = Number(sysText);
  const dia = Number(diaText);
  const pulse = pulseText === '' ? null : Number(pulseText);
  if (!sysText || !diaText) return { error: 'Введите верхнее и нижнее давление.' };
  if (!Number.isInteger(sys) || sys < BP_LIMITS.sys[0] || sys > BP_LIMITS.sys[1]) {
    return { error: 'Верхнее давление должно быть числом от 60 до 260.' };
  }
  if (!Number.isInteger(dia) || dia < BP_LIMITS.dia[0] || dia > BP_LIMITS.dia[1]) {
    return { error: 'Нижнее давление должно быть числом от 30 до 180.' };
  }
  if (sys <= dia) return { error: 'Верхнее давление должно быть больше нижнего.' };
  if (pulse !== null && (!Number.isInteger(pulse) || pulse < BP_LIMITS.pulse[0] || pulse > BP_LIMITS.pulse[1])) {
    return { error: 'Пульс должен быть числом от 30 до 220.' };
  }
  return { sys, dia, pulse };
}

// Очень высокое давление: только этот случай подсвечиваем, без оценки обычных значений
function isVeryHighBP(m) {
  return m.sys >= 180 || m.dia >= 120;
}

const HIGH_BP_TEXT =
  'Очень высокое давление. Если вместе с ним сильная головная боль, нарушение зрения или речи, ' +
  'слабость в руке или ноге, боль в груди или одышка, срочно вызовите скорую.';

// Приступ, во время которого сделан замер
function episodeAt(time, episodes) {
  const t = new Date(time);
  return episodes.find(ep => new Date(ep.start) <= t && t <= (ep.end ? new Date(ep.end) : new Date())) || null;
}

function bpText(m) {
  return m.sys + '/' + m.dia + (m.pulse ? ', пульс ' + m.pulse : '');
}

function avgBP(list) {
  if (!list.length) return null;
  const avg = key => Math.round(list.reduce((s, m) => s + m[key], 0) / list.length);
  const withPulse = list.filter(m => m.pulse);
  return {
    sys: avg('sys'),
    dia: avg('dia'),
    pulse: withPulse.length ? Math.round(withPulse.reduce((s, m) => s + m.pulse, 0) / withPulse.length) : null,
    count: list.length
  };
}

function avgText(a) {
  if (!a) return '—';
  return a.sys + '/' + a.dia + (a.pulse ? ', пульс ' + a.pulse : '') +
         ' (' + a.count + ' ' + measureWord(a.count) + ')';
}

function measureWord(n) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return 'замер';
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return 'замера';
  return 'замеров';
}

// Дни, в которые были приступы
function painDayKeys(episodes) {
  const keys = new Set();
  episodes.forEach(ep => episodeDays(ep).forEach(k => keys.add(k)));
  return keys;
}

// Сводка давления для статистики и отчёта
function bpSummary(measurements, episodes) {
  const painDays = painDayKeys(episodes);
  return {
    all: avgBP(measurements),
    during: avgBP(measurements.filter(m => episodeAt(m.time, episodes))),
    painFree: avgBP(measurements.filter(m => !painDays.has(dayKey(new Date(m.time)))))
  };
}

// --- Вкладка «Давление» ---

function resetBPForm() {
  $('bp-sys').value = '';
  $('bp-dia').value = '';
  $('bp-pulse').value = '';
  $('bp-time').value = toLocalInput(new Date().toISOString());
}

let bpMsgTimer = null;
function showBPMessage(text, warning) {
  const box = $('bp-msg');
  clearTimeout(bpMsgTimer);
  box.className = warning ? 'bp-warning' : 'bp-ok';
  box.innerHTML = '';
  const p = document.createElement('p');
  p.textContent = text;
  box.appendChild(p);
  if (warning) {
    const call = document.createElement('a');
    call.className = 'call-button';
    call.href = 'tel:103';
    call.textContent = 'Позвонить в скорую: 103';
    box.appendChild(call);
  } else {
    bpMsgTimer = setTimeout(() => { box.hidden = true; }, 4000);
  }
  box.hidden = false;
}

function renderBPChart(list, episodes) {
  const box = $('bp-chart');
  box.innerHTML = '';
  const points = list.slice().sort((a, b) => new Date(a.time) - new Date(b.time));
  if (points.length < 2) {
    box.hidden = true;
    return;
  }
  box.hidden = false;

  const W = 320, H = 150, L = 30, R = 8, T = 10, B = 20;
  const t0 = Date.now() - 30 * DAY_MS, t1 = Date.now();
  const lo = Math.min(60, ...points.map(m => m.dia)) - 5;
  const hi = Math.max(160, ...points.map(m => m.sys)) + 5;
  const x = t => L + (new Date(t).getTime() - t0) / (t1 - t0) * (W - L - R);
  const y = v => T + (hi - v) / (hi - lo) * (H - T - B);

  let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="bp-svg" role="img" aria-label="График давления за 30 дней">';
  [80, 120, 160].forEach(v => {
    if (v < lo || v > hi) return;
    svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="grid"/>' +
           '<text x="' + (L - 6) + '" y="' + (y(v) + 3) + '" class="axis" text-anchor="end">' + v + '</text>';
  });
  svg += '<text x="' + L + '" y="' + (H - 4) + '" class="axis">30 дней назад</text>' +
         '<text x="' + (W - R) + '" y="' + (H - 4) + '" class="axis" text-anchor="end">сегодня</text>';
  ['sys', 'dia'].forEach(key => {
    svg += '<polyline class="line-' + key + '" points="' +
           points.map(m => x(m.time).toFixed(1) + ',' + y(m[key]).toFixed(1)).join(' ') + '"/>';
    points.forEach(m => {
      const pain = episodeAt(m.time, episodes) ? ' pain' : '';
      svg += '<circle class="dot-' + key + pain + '" cx="' + x(m.time).toFixed(1) + '" cy="' + y(m[key]).toFixed(1) + '" r="3"/>';
    });
  });
  svg += '</svg>';
  box.innerHTML = svg +
    '<div class="bp-legend"><span><i class="lg-sys"></i>Верхнее</span><span><i class="lg-dia"></i>Нижнее</span>' +
    '<span><i class="lg-pain"></i>Во время приступа</span></div>';
}

function renderBP() {
  const episodes = Store.load();
  const all = Store.loadBP().sort((a, b) => new Date(b.time) - new Date(a.time));
  const since = Date.now() - 30 * DAY_MS;
  const recent = all.filter(m => new Date(m.time).getTime() >= since);

  renderBPChart(recent, episodes);

  // Средние значения за 30 дней
  const stats = $('bp-stats');
  stats.innerHTML = '';
  if (recent.length) {
    const sum = bpSummary(recent, episodes);
    const lines = ['В среднем: ' + avgText(sum.all)];
    if (sum.during) lines.push('Во время приступов: ' + avgText(sum.during));
    if (sum.painFree && sum.painFree.count !== sum.all.count) lines.push('В дни без боли: ' + avgText(sum.painFree));
    stats.appendChild(statBlock('За последние 30 дней', lines));
  }

  // Список замеров
  const list = $('bp-list');
  list.innerHTML = '';
  if (!all.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Замеров пока нет. Записывайте давление, когда удобно: утром, вечером или во время приступа.';
    list.appendChild(empty);
    return;
  }
  all.slice(0, 60).forEach(m => list.appendChild(bpRow(m, episodes, renderBP)));
}

function bpRow(m, episodes, onDelete) {
  const row = document.createElement('div');
  row.className = 'bp-row';
  const info = document.createElement('div');
  const main = document.createElement('div');
  main.className = 'bp-main';
  main.textContent = bpText(m);
  const meta = document.createElement('div');
  meta.className = 'ep-meta';
  const d = new Date(m.time);
  meta.textContent = dateLabel(d) + ', ' + timeOf(m.time) +
    (episodeAt(m.time, episodes) ? '. Во время приступа' : '') +
    (isVeryHighBP(m) ? '. Очень высокое' : '');
  info.append(main, meta);
  const del = document.createElement('button');
  del.className = 'small-button';
  del.textContent = '✕';
  del.setAttribute('aria-label', 'Удалить замер');
  del.addEventListener('click', () => {
    if (!confirm('Удалить замер ' + bpText(m) + '?')) return;
    Store.removeBP(m.id);
    onDelete();
  });
  row.append(info, del);
  return row;
}

$('bp-save').addEventListener('click', () => {
  const r = readBP($('bp-sys').value.trim(), $('bp-dia').value.trim(), $('bp-pulse').value.trim());
  if (r.error) {
    showBPMessage(r.error, false);
    return;
  }
  const time = parseLocalInput($('bp-time').value) || new Date();
  if (time > new Date()) {
    showBPMessage('Время замера не может быть в будущем.', false);
    return;
  }
  const m = { id: bpId(), time: time.toISOString(), sys: r.sys, dia: r.dia, pulse: r.pulse };
  Store.addBP(m);
  resetBPForm();
  renderBP();
  if (isVeryHighBP(m)) showBPMessage(HIGH_BP_TEXT, true);
  else if (episodeAt(m.time, Store.load())) showBPMessage('Сохранено. Замер добавлен к приступу 🌿', false);
  else showBPMessage('Сохранено 🌿', false);
});

function bpShown() {
  resetBPForm();
  $('bp-msg').hidden = true;
  renderBP();
}

// --- Давление в записи приступа ---

function renderLoggerBP(ep) {
  const list = $('lg-bp-list');
  list.innerHTML = '';
  $('lg-bp-msg').hidden = true;
  const episodes = Store.load();
  Store.loadBP()
    .filter(m => {
      const t = new Date(m.time);
      return new Date(ep.start) <= t && t <= (ep.end ? new Date(ep.end) : new Date());
    })
    .sort((a, b) => new Date(a.time) - new Date(b.time))
    .forEach(m => list.appendChild(bpRow(m, episodes, () => renderLoggerBP(ep))));
}

// Добавить замер из записи приступа.
// Возвращает false, только если поля заполнены с ошибкой (чтобы не закрывать запись и не потерять ввод)
function addPendingLoggerBP() {
  if (!current) return true;
  const sysText = $('lg-bp-sys').value.trim();
  const diaText = $('lg-bp-dia').value.trim();
  const pulseText = $('lg-bp-pulse').value.trim();
  if (!sysText && !diaText && !pulseText) return true; // ничего не вводили
  const msg = $('lg-bp-msg');
  const r = readBP(sysText, diaText, pulseText);
  if (r.error) {
    msg.className = 'bp-ok';
    msg.textContent = r.error;
    msg.hidden = false;
    return false;
  }
  // у идущего приступа замер «сейчас», у прошлого — время начала
  const time = current.end ? current.start : new Date().toISOString();
  const m = { id: bpId(), time, sys: r.sys, dia: r.dia, pulse: r.pulse };
  Store.addBP(m);
  $('lg-bp-sys').value = '';
  $('lg-bp-dia').value = '';
  $('lg-bp-pulse').value = '';
  renderLoggerBP(current);
  if (isVeryHighBP(m)) {
    msg.className = 'bp-warning';
    msg.innerHTML = '';
    const p = document.createElement('p');
    p.textContent = HIGH_BP_TEXT;
    const call = document.createElement('a');
    call.className = 'call-button';
    call.href = 'tel:103';
    call.textContent = 'Позвонить в скорую: 103';
    msg.append(p, call);
    msg.hidden = false;
    return false; // запись не закрываем, чтобы предупреждение точно увидели
  }
  msg.className = 'bp-ok';
  msg.textContent = 'Замер сохранён 🌿';
  msg.hidden = false;
  return true;
}

$('lg-bp-add').addEventListener('click', addPendingLoggerBP);
