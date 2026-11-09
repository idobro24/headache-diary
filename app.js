// Навигация между экранами
const tabs = document.querySelectorAll('.tab');
const screens = document.querySelectorAll('.screen');

function showScreen(name) {
  screens.forEach(s => s.classList.toggle('active', s.id === 'screen-' + name));
  tabs.forEach(t => t.classList.toggle('active', t.dataset.screen === name));
  window.scrollTo(0, 0);
}

tabs.forEach(tab => {
  tab.addEventListener('click', () => showScreen(tab.dataset.screen));
});

// Кнопка «Началось» — пока заглушка
document.getElementById('btn-start').addEventListener('click', () => {
  alert('Скоро здесь будет логгер приступа');
});
