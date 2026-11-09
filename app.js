// Навигация между экранами
const tabs = document.querySelectorAll('.tab');
const screens = document.querySelectorAll('.screen');

function showScreen(name) {
  screens.forEach(s => s.classList.toggle('active', s.id === 'screen-' + name));
  tabs.forEach(t => t.classList.toggle('active', t.dataset.screen === name));
  window.scrollTo(0, 0);
  if (name === 'help') helpShown(); else helpHidden();
  if (name === 'history') renderHistory();
}

tabs.forEach(tab => {
  tab.addEventListener('click', () => showScreen(tab.dataset.screen));
});

// Запоминаем день начала дневника
Store.firstUse();

// Обновляем главный экран при запуске, каждые 30 секунд и при возврате в приложение
renderHome();
setInterval(renderHome, 30000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) renderHome();
});

// iOS 26 в приложении с экрана «Домой»: если страница не прокручивается (как «Главная»),
// Safari считает экран ниже, чем он есть, и всё, что прижато к низу, поднимается.
// Отсчёт от верха экрана при этом верный, поэтому ставим панель от верха,
// а высоту берём из реального размера экрана.
if (window.navigator.standalone === true) {
  document.documentElement.classList.add('ios-standalone');
  const setScreenHeight = () => {
    const landscape = window.matchMedia('(orientation: landscape)').matches;
    const h = landscape
      ? Math.min(screen.width, screen.height)
      : Math.max(screen.width, screen.height);
    document.documentElement.style.setProperty('--screen-h', h + 'px');
  };
  setScreenHeight();
  window.addEventListener('resize', setScreenHeight);
  window.addEventListener('orientationchange', () => setTimeout(setScreenHeight, 300));
}

// Офлайн-режим: регистрируем помощника, который сохраняет файлы приложения
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
