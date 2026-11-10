// «Что нового»: после обновления один раз показываем, что появилось в приложении

const APP_VERSION = 35;
const SEEN_VERSION_KEY = 'hd.seenVersion';

// Новости по версиям. Для следующих обновлений добавляйте сюда запись с новым номером
const NEWS = {
  35: {
    title: 'Что нового в «Тише» 🌿',
    items: [
      'Дневник давления: новая вкладка «Давление» с графиком за 30 дней и средними значениями в дни с болью и без.',
      'Давление можно записать прямо в записи приступа и в конце приступа. Замеры подписываются: в начале, во время или в конце.',
      'Давление теперь есть в статистике и в отчёте для врача.',
      'Прошлый приступ теперь добавляется с пустыми датами: укажите сами, когда он был.'
    ],
    backupHint: 'Резервная копия теперь сохраняет и давление. Сохраните свежую копию, чтобы всё было в безопасности.'
  }
};

function readSeenVersion() {
  try { return Number(localStorage.getItem(SEEN_VERSION_KEY)) || 0; } catch (e) { return 0; }
}

function markNewsSeen() {
  try { localStorage.setItem(SEEN_VERSION_KEY, String(APP_VERSION)); } catch (e) {}
}

function checkNews() {
  const seen = readSeenVersion();
  if (seen >= APP_VERSION) return;
  // Новым пользователям без записей новость не нужна: всё и так новое
  const hasData = Store.load().length > 0 || Store.loadBP().length > 0;
  const news = NEWS[APP_VERSION];
  if (!hasData || !news) {
    markNewsSeen();
    return;
  }
  // Во время приступа не отвлекаем, покажем в следующий раз
  if (Store.active()) return;

  $('news-title').textContent = news.title;
  const list = $('news-list');
  list.innerHTML = '';
  news.items.forEach(text => {
    const li = document.createElement('li');
    li.textContent = text;
    list.appendChild(li);
  });
  $('news-backup').textContent = news.backupHint || '';
  $('news-backup').hidden = !news.backupHint;
  $('news-save').hidden = !news.backupHint;
  $('news-modal').hidden = false;
}

$('news-save').addEventListener('click', async () => {
  const done = await doBackup();
  if (!done) return;
  markNewsSeen();
  $('news-modal').hidden = true;
});

$('news-ok').addEventListener('click', () => {
  markNewsSeen();
  $('news-modal').hidden = true;
});

window.addEventListener('load', () => setTimeout(checkNews, 800));
