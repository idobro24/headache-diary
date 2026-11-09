// Экран «Как пользоваться» и связь с автором

// Ник в Telegram без @
const TELEGRAM_USERNAME = 'irish_dobr';

function openInfo() {
  $('info-telegram').href = 'https://t.me/' + TELEGRAM_USERNAME;
  const version = document.querySelector('.version');
  $('info-version').textContent = version ? version.textContent : '';
  $('info-sheet').hidden = false;
  $('info-sheet').scrollTop = 0;
}

$('btn-info').addEventListener('click', openInfo);
$('info-close').addEventListener('click', () => {
  $('info-sheet').hidden = true;
});
