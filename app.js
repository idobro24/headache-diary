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

// iOS: при запуске с экрана «Домой» Safari иногда сначала неверно считает высоту экрана,
// и нижняя панель «подпрыгивает». Заставляем браузер пересчитать её положение,
// когда размеры экрана окончательно известны.
function refreshTabbar() {
  const bar = document.querySelector('.tabbar');
  bar.style.display = 'none';
  void bar.offsetHeight; // принудительный пересчёт раскладки
  bar.style.display = '';
}

window.addEventListener('load', () => {
  [0, 100, 400, 1000].forEach(ms => setTimeout(refreshTabbar, ms));
});
window.addEventListener('pageshow', refreshTabbar);
window.addEventListener('resize', refreshTabbar);
window.addEventListener('orientationchange', () => setTimeout(refreshTabbar, 300));
if (window.visualViewport) window.visualViewport.addEventListener('resize', refreshTabbar);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) setTimeout(refreshTabbar, 100);
});

// Офлайн-режим: регистрируем помощника, который сохраняет файлы приложения
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
