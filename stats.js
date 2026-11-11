// Анонимная статистика через GoatCounter: считается только факт открытия приложения.
// Никакие записи о здоровье, давлении, лекарствах и заметки никуда не отправляются.

const GC_URL = 'https://tishe.goatcounter.com';
const IS_PRODUCTION = location.hostname.endsWith('github.io');   // тестовый стенд не считаем
const IS_INSTALLED = window.navigator.standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches;
const COMMUNITY_KEY = 'hd.community';
const COMMUNITY_SHOW_MS = 8000; // сколько строка видна перед тем, как раствориться
let communityFadeTimer = null;
const COMMUNITY_MIN = 10; // маленькие числа не показываем: «3 раза» звучит скорее одиноко

// Счётчик открытий. Отдельно видно, открыли приложение с иконки или просто в браузере
if (IS_PRODUCTION) {
  window.goatcounter = { path: () => (IS_INSTALLED ? '/app' : '/browser') };
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://gc.zgo.at/count.js';
  script.dataset.goatcounter = GC_URL + '/count';
  document.head.appendChild(script);
}

function timesWord(n) {
  const a = n % 10, b = n % 100;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return 'раза';
  return 'раз';
}

function showCommunity(count) {
  const el = $('community');
  if (!count || count < COMMUNITY_MIN) {
    el.hidden = true;
    return;
  }
  el.textContent = 'Каждый день «Тише» открывают люди, которым тоже бывает непросто: за месяц уже ' +
    count.toLocaleString('ru-RU') + ' ' + timesWord(count) + '. Вы не одни';
  el.hidden = false;
  // Строка тихо показывается при открытии и через несколько секунд плавно растворяется.
  // Место под ней остаётся, чтобы ничего на экране не «прыгало»
  el.classList.remove('faded');
  clearTimeout(communityFadeTimer);
  communityFadeTimer = setTimeout(() => el.classList.add('faded'), COMMUNITY_SHOW_MS);
}

// Число открытий за последние 30 дней. Обновляем раз в день, без интернета показываем последнее известное
function loadCommunity() {
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(COMMUNITY_KEY)); } catch (e) {}
  if (cached) showCommunity(cached.count);
  if (cached && Date.now() - cached.time < DAY_MS) return;

  const start = new Date(Date.now() - 30 * DAY_MS).toISOString().slice(0, 10);
  fetch(GC_URL + '/counter/TOTAL.json?start=' + start)
    .then(r => (r.ok ? r.json() : null))
    .then(data => {
      if (!data || data.count == null) return;
      const count = parseInt(String(data.count).replace(/\D/g, ''), 10);
      if (isNaN(count)) return;
      try { localStorage.setItem(COMMUNITY_KEY, JSON.stringify({ count, time: Date.now() })); } catch (e) {}
      showCommunity(count);
    })
    .catch(() => {});
}

// Для проверки на тестовом стенде: адрес с #community-demo показывает строку с примером числа.
// Срабатывает и при загрузке, и когда приписку добавили к уже открытой странице
function checkCommunityDemo() {
  if (!IS_PRODUCTION && location.hash === '#community-demo') {
    showCommunity(1243);
    return true;
  }
  return false;
}

if (!checkCommunityDemo()) loadCommunity();
window.addEventListener('hashchange', checkCommunityDemo);
