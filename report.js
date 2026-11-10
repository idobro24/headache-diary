// Данные: отчёт для врача, резервная копия и восстановление

const BACKUP_KEY = 'hd.lastBackup';
const REPORT_PERIODS = [
  { days: 30, label: '30 дней' },
  { days: 90, label: '3 месяца' },
  { days: 180, label: '6 месяцев' }
];
let reportDays = 90;

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fullDate(d) {
  return d.getDate() + ' ' + MONTHS_GEN[d.getMonth()] + ' ' + d.getFullYear();
}

function fileDate() {
  return dayKey(new Date());
}

// Поделиться файлом (на телефоне откроется меню «Поделиться»), иначе скачать
async function shareOrDownload(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const file = new File([blob], filename, { type: mime });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return true;
    } catch (e) {
      if (e.name === 'AbortError') return false; // пользователь закрыл меню
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

// --- Отчёт для врача ---

function countItems(episodes, field) {
  const counts = {};
  episodes.forEach(ep => (ep[field] || []).forEach(x => { counts[x] = (counts[x] || 0) + 1; }));
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function listSection(title, entries, total) {
  if (!entries.length) return '';
  return '<h2>' + title + '</h2><p>' +
    entries.map(([name, c]) => escapeHtml(name) + ': ' + c + ' из ' + total).join('<br>') +
    '</p>';
}

function buildReport(days) {
  const now = new Date();
  const periodStart = startOfDay(new Date(now.getTime() - (days - 1) * DAY_MS));
  const from = new Date(Math.max(periodStart, startOfDay(Store.firstUse())));
  const coveredDays = Math.max(1, Math.round((startOfDay(now) - from) / DAY_MS) + 1);
  const perMonth = n => (n * 30 / coveredDays).toFixed(1).replace('.', ',');

  const episodes = Store.load()
    .filter(ep => new Date(ep.start) <= now && (ep.end ? new Date(ep.end) : now) >= from)
    .sort((a, b) => new Date(a.start) - new Date(b.start));

  const painDays = new Set();
  episodes.forEach(ep => episodeDays(ep).forEach(k => {
    if (keyToDate(k) >= from) painDays.add(k);
  }));

  const medDays = new Set();
  episodes.forEach(ep => ep.meds.forEach(m => {
    if (new Date(m.time) >= from) medDays.add(dayKey(new Date(m.time)));
  }));

  const ended = episodes.filter(ep => ep.end);
  const avgDuration = ended.length
    ? formatDuration(ended.reduce((s, ep) => s + (new Date(ep.end) - new Date(ep.start)), 0) / ended.length)
    : 'нет данных';

  const levelCounts = OPTIONS.intensity.map(o =>
    o.label.toLowerCase() + ': ' + episodes.filter(ep => ep.intensity === o.value).length);
  const unknown = episodes.filter(ep => !ep.intensity).length;
  if (unknown) levelCounts.push('не указана: ' + unknown);

  let html = '<h1>Дневник головной боли</h1>';
  html += '<p class="r-period">Период: ' + fullDate(from) + ' – ' + fullDate(now) +
          ' (' + coveredDays + ' ' + daysWord(coveredDays) + '). Отчёт сформирован ' + fullDate(now) + '.</p>';

  html += '<h2>Сводка</h2><div class="table-wrap"><table>';
  html += '<tr><th>Дней с головной болью</th><td>' + painDays.size + ' из ' + coveredDays +
          ' (в среднем ' + perMonth(painDays.size) + ' в месяц)</td></tr>';
  html += '<tr><th>Приступов</th><td>' + episodes.length + '</td></tr>';
  html += '<tr><th>Средняя длительность</th><td>' + avgDuration + '</td></tr>';
  html += '<tr><th>Сила приступов</th><td>' + levelCounts.join(', ') + '</td></tr>';
  html += '<tr><th>Дней с обезболивающими</th><td>' + medDays.size +
          ' (в среднем ' + perMonth(medDays.size) + ' в месяц)</td></tr>';
  const impactDays = impactByDay(episodes, d => d >= from);
  html += '<tr><th>Дней, когда пришлось отменить дела</th><td>' + impactDays.missed + '</td></tr>';
  html += '<tr><th>Дней, когда дела давались через силу</th><td>' + impactDays.reduced + '</td></tr>';
  html += '</table></div>';

  if (!episodes.length) {
    html += '<p>За этот период приступов не записано.</p>';
    html += bpReportSection(from, now, episodes);
    return html;
  }

  html += listSection('Сопутствующие симптомы', countItems(episodes, 'symptoms'), episodes.length);
  html += listSection('Характер и место боли', countItems(episodes, 'tags'), episodes.length);
  html += listSection('Возможные триггеры (отмечены пациентом)', countItems(episodes, 'triggers'), episodes.length);
  html += listSection('Что страдало из-за приступов', countItems(episodes, 'impactAreas'), episodes.length);

  // Лекарства: сколько раз принимались и помогали ли
  const meds = {};
  episodes.forEach(ep => ep.meds.forEach(m => {
    meds[m.name] = meds[m.name] || { uses: 0, yes: 0, partly: 0, no: 0, doses: new Set() };
    meds[m.name].uses++;
    if (m.dose) meds[m.name].doses.add(m.dose);
    if (m.helped) meds[m.name][m.helped]++;
  }));
  const medNames = Object.keys(meds);
  if (medNames.length) {
    html += '<h2>Лекарства</h2><div class="table-wrap"><table>';
    html += '<tr><th>Препарат</th><th>Дозы</th><th>Приёмов</th><th>Помогло</th><th>Частично</th><th>Не помогло</th></tr>';
    medNames.sort((a, b) => meds[b].uses - meds[a].uses).forEach(name => {
      const m = meds[name];
      html += '<tr><td>' + escapeHtml(name) + '</td><td>' + escapeHtml([...m.doses].join(', ') || '—') +
              '</td><td>' + m.uses + '</td><td>' + m.yes + '</td><td>' + m.partly + '</td><td>' + m.no + '</td></tr>';
    });
    html += '</table></div>';
  }

  html += bpReportSection(from, now, episodes);

  // Все приступы по порядку
  html += '<h2>Все приступы</h2><div class="table-wrap"><table class="r-episodes">';
  html += '<tr><th>Дата</th><th>Время</th><th>Длительность</th><th>Сила</th>' +
          '<th>Характер и симптомы</th><th>Триггеры</th><th>Лекарства</th><th>Влияние на день</th><th>Заметка</th></tr>';
  episodes.forEach(ep => {
    const start = new Date(ep.start);
    const end = ep.end ? new Date(ep.end) : null;
    const opt = intensityOption(ep.intensity);
    const time = timeOf(ep.start) + '–' + (end
      ? (dayKey(start) === dayKey(end) ? '' : dateLabel(end) + ' ') + timeOf(ep.end)
      : 'идёт');
    const medsText = ep.meds.map(m => {
      const helped = { yes: 'помогло', partly: 'частично', no: 'не помогло' }[m.helped];
      return m.name + (m.dose ? ' ' + m.dose : '') + (helped ? ' (' + helped + ')' : '');
    }).join(', ');
    const impactLabel = { none: 'почти не мешал', reduced: 'дела через силу', missed: 'пришлось отменить дела' }[ep.impact];
    const impactText = impactLabel
      ? impactLabel + ((ep.impactAreas || []).length ? ' (' + ep.impactAreas.join(', ').toLowerCase() + ')' : '')
      : '—';
    html += '<tr>' +
      '<td>' + fullDate(start) + '</td>' +
      '<td>' + escapeHtml(time) + '</td>' +
      '<td>' + formatDuration((end || now) - start) + '</td>' +
      '<td>' + (opt ? opt.label : '—') + '</td>' +
      '<td>' + escapeHtml([...ep.tags, ...ep.symptoms].join(', ') || '—') + '</td>' +
      '<td>' + escapeHtml(ep.triggers.join(', ') || '—') + '</td>' +
      '<td>' + escapeHtml(medsText || '—') + '</td>' +
      '<td>' + escapeHtml(impactText) + '</td>' +
      '<td>' + escapeHtml(ep.note || '—') + '</td>' +
      '</tr>';
  });
  html += '</table></div>';
  return html;
}

// Давление в отчёте: средние значения и все замеры за период
function bpReportSection(from, now, episodes) {
  const list = Store.loadBP()
    .filter(m => new Date(m.time) >= from && new Date(m.time) <= now)
    .sort((a, b) => new Date(a.time) - new Date(b.time));
  if (!list.length) return '';
  const allEpisodes = Store.load();
  const sum = bpSummary(list, allEpisodes);
  let html = '<h2>Артериальное давление</h2><div class="table-wrap"><table>';
  html += '<tr><th>Среднее за период</th><td>' + avgText(sum.all) + '</td></tr>';
  html += '<tr><th>Во время приступов</th><td>' + avgText(sum.during) + '</td></tr>';
  html += '<tr><th>В дни без головной боли</th><td>' + avgText(sum.painFree) + '</td></tr>';
  html += '</table></div>';
  html += '<div class="table-wrap"><table class="r-episodes">' +
          '<tr><th>Дата</th><th>Время</th><th>Давление</th><th>Пульс</th><th>Во время приступа</th></tr>';
  list.forEach(m => {
    html += '<tr><td>' + fullDate(new Date(m.time)) + '</td><td>' + timeOf(m.time) + '</td>' +
            '<td>' + m.sys + '/' + m.dia + '</td><td>' + (m.pulse || '—') + '</td>' +
            '<td>' + (episodeAt(m.time, allEpisodes) ? 'да' : '—') + '</td></tr>';
  });
  html += '</table></div>';
  return html;
}

const REPORT_FILE_CSS = `
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #222; max-width: 960px;
         margin: 0 auto; padding: 24px; font-size: 14px; line-height: 1.5; }
  h1 { font-size: 22px; font-weight: 500; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 24px 0 8px; }
  .r-period { color: #555; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; vertical-align: top; padding: 6px 8px; border-bottom: 1px solid #ccc; }
  th { color: #555; font-weight: 500; }
`;

function renderReport() {
  const box = $('report-period');
  box.innerHTML = '';
  REPORT_PERIODS.forEach(p => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = p.label;
    chip.classList.toggle('selected', reportDays === p.days);
    chip.addEventListener('click', () => {
      reportDays = p.days;
      renderReport();
    });
    box.appendChild(chip);
  });
  $('report-body').innerHTML = buildReport(reportDays);
}

$('btn-report').addEventListener('click', () => {
  renderReport();
  $('report-sheet').hidden = false;
  $('report-sheet').scrollTop = 0;
});

$('report-close').addEventListener('click', () => {
  $('report-sheet').hidden = true;
});

$('report-print').addEventListener('click', () => window.print());

$('report-share').addEventListener('click', () => {
  const doc = '<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Дневник головной боли: отчёт</title><style>' + REPORT_FILE_CSS + '</style></head><body>' +
    buildReport(reportDays) + '</body></html>';
  shareOrDownload('headache-report-' + fileDate() + '.html', doc, 'text/html');
});

// --- Резервная копия ---

function renderBackupStatus() {
  let last = null;
  try { last = localStorage.getItem(BACKUP_KEY); } catch (e) {}
  const el = $('backup-status');
  if (!last) {
    el.textContent = Store.load().length
      ? 'Резервных копий ещё не было. Сохраните первую, чтобы записи не потерялись.'
      : 'Резервных копий ещё не было.';
    return;
  }
  const d = new Date(last);
  const old = Date.now() - d.getTime() > 30 * DAY_MS;
  el.textContent = 'Последняя копия: ' + fullDate(d) + (old ? '. Пора сделать свежую.' : '.');
}

// Сохранить копию: возвращает true, если файл сохранён или отправлен
async function doBackup() {
  const data = {
    app: 'headache-diary',
    format: 1,
    exportedAt: new Date().toISOString(),
    firstUse: Store.firstUse().toISOString(),
    episodes: Store.load(),
    bp: Store.loadBP()
  };
  const done = await shareOrDownload('headache-backup-' + fileDate() + '.json',
                                     JSON.stringify(data, null, 2), 'application/json');
  if (done) {
    try { localStorage.setItem(BACKUP_KEY, new Date().toISOString()); } catch (e) {}
    renderBackupStatus();
  }
  return done;
}

$('btn-backup').addEventListener('click', doBackup);

// --- Еженедельное напоминание о копии ---

const SNOOZE_KEY = 'hd.backupSnooze';
const WEEK_MS = 7 * DAY_MS;

function readTime(key) {
  try {
    const v = localStorage.getItem(key);
    return v ? new Date(v).getTime() : 0;
  } catch (e) {
    return 0;
  }
}

function shouldRemindBackup() {
  const episodes = Store.load();
  if (!episodes.length && !Store.loadBP().length) return false; // сохранять пока нечего
  if (episodes.some(ep => !ep.end)) return false;   // во время приступа не беспокоим
  if (document.querySelector('.sheet:not([hidden])')) return false; // открыто другое окно
  const now = Date.now();
  if (now < readTime(SNOOZE_KEY)) return false;
  const last = readTime(BACKUP_KEY) || Store.firstUse().getTime();
  return now - last >= WEEK_MS;
}

function checkBackupReminder() {
  if (document.hidden || !$('backup-modal').hidden) return;
  if (!shouldRemindBackup()) return;
  $('bm-ask').hidden = false;
  $('bm-done').hidden = true;
  $('backup-modal').hidden = false;
}

$('bm-save').addEventListener('click', async () => {
  const done = await doBackup();
  if (!done) return; // меню «Поделиться» закрыли: окно остаётся
  $('bm-ask').hidden = true;
  $('bm-done').hidden = false;
  setTimeout(() => { $('backup-modal').hidden = true; }, 2500);
});

$('bm-later').addEventListener('click', () => {
  try { localStorage.setItem(SNOOZE_KEY, new Date(Date.now() + DAY_MS).toISOString()); } catch (e) {}
  $('backup-modal').hidden = true;
});

window.addEventListener('load', () => setTimeout(checkBackupReminder, 1500));
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) setTimeout(checkBackupReminder, 1000);
});

// Приводим запись из файла к правильному виду, чтобы испорченные поля не сломали приложение
function normalizeEpisode(ep) {
  const list = v => Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
  return {
    id: ep.id,
    start: new Date(ep.start).toISOString(),
    end: ep.end && !isNaN(new Date(ep.end)) ? new Date(ep.end).toISOString() : null,
    intensity: [1, 2, 3, 4].includes(ep.intensity) ? ep.intensity : null,
    tags: list(ep.tags),
    symptoms: list(ep.symptoms),
    triggers: list(ep.triggers),
    meds: Array.isArray(ep.meds) ? ep.meds.filter(m => m && typeof m.name === 'string').map(m => ({
      name: m.name,
      dose: typeof m.dose === 'string' ? m.dose : '',
      time: !isNaN(new Date(m.time)) ? new Date(m.time).toISOString() : new Date(ep.start).toISOString(),
      helped: ['yes', 'partly', 'no'].includes(m.helped) ? m.helped : null
    })) : [],
    impact: ['none', 'reduced', 'missed'].includes(ep.impact) ? ep.impact : null,
    impactAreas: list(ep.impactAreas),
    note: typeof ep.note === 'string' ? ep.note : ''
  };
}

// Восстановление: записи из копии добавляются к текущим, ничего не удаляется
$('restore-file').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;

  let data;
  try {
    data = JSON.parse(await file.text());
  } catch (err) {
    alert('Не удалось прочитать файл. Выберите файл резервной копии дневника (.json).');
    return;
  }
  if (!data || data.app !== 'headache-diary' || !Array.isArray(data.episodes)) {
    alert('Этот файл не похож на резервную копию дневника головной боли.');
    return;
  }

  const valid = data.episodes.filter(ep =>
    ep && typeof ep.id === 'string' && ep.start && !isNaN(new Date(ep.start)));
  const existing = Store.load();
  const ids = new Set(existing.map(ep => ep.id));
  let hasActive = existing.some(ep => !ep.end);

  const added = valid.filter(ep => !ids.has(ep.id)).map(normalizeEpisode).map(ep => {
    // идущим может быть только один приступ
    if (!ep.end) {
      if (hasActive) ep.end = new Date(Math.min(Date.now(), new Date(ep.start).getTime() + 3600000)).toISOString();
      hasActive = true;
    }
    return ep;
  });

  Store.save([...existing, ...added]);

  // Замеры давления (в копиях старых версий их нет)
  let bpAdded = 0;
  if (Array.isArray(data.bp)) {
    const bpExisting = Store.loadBP();
    const bpIds = new Set(bpExisting.map(m => m.id));
    const bpNew = data.bp.filter(m =>
      m && typeof m.id === 'string' && !bpIds.has(m.id) && !isNaN(new Date(m.time)) &&
      Number.isInteger(m.sys) && Number.isInteger(m.dia) &&
      m.sys >= BP_LIMITS.sys[0] && m.sys <= BP_LIMITS.sys[1] &&
      m.dia >= BP_LIMITS.dia[0] && m.dia <= BP_LIMITS.dia[1]
    ).map(m => ({
      id: m.id,
      time: new Date(m.time).toISOString(),
      sys: m.sys,
      dia: m.dia,
      pulse: Number.isInteger(m.pulse) ? m.pulse : null
    }));
    Store.saveBP([...bpExisting, ...bpNew]);
    bpAdded = bpNew.length;
  }

  alert('Готово. Добавлено записей: ' + added.length +
        '. Уже были в дневнике: ' + (valid.length - added.length) + '.' +
        (Array.isArray(data.bp) ? ' Добавлено замеров давления: ' + bpAdded + '.' : ''));
  refreshScreens();
  renderBackupStatus();
});

renderBackupStatus();
