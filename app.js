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
// и нижняя панель «подпрыгивает». Переключение вкладки это исправляет, потому что
// экран на миг скрывается и показывается снова. Делаем то же самое автоматически.
function refreshLayout() {
  const active = document.querySelector('.screen.active');
  if (!active) return;
  const top = window.scrollY;
  active.classList.remove('active');
  void active.offsetHeight; // принудительный пересчёт раскладки
  active.classList.add('active');
  window.scrollTo(0, top);
}

// Размеры экрана в iOS «устаканиваются» не сразу, поэтому повторяем несколько раз
window.addEventListener('load', () => {
  [50, 300, 800, 1500, 3000].forEach(ms => setTimeout(refreshLayout, ms));
});
window.addEventListener('pageshow', () => setTimeout(refreshLayout, 50));
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) setTimeout(refreshLayout, 100);
});

// Офлайн-режим: регистрируем помощника, который сохраняет файлы приложения
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
