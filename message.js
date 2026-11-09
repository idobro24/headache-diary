// Сообщение близким: готовый текст, который можно отправить в одно касание

const MESSAGE_KEY = 'hd.message';
const DEFAULT_MESSAGE =
  'У меня сейчас приступ головной боли. Мне нужно полежать в тишине и темноте, ' +
  'поэтому какое-то время я могу не отвечать. Напишу, когда станет легче 🌿';

function loadMessage() {
  try {
    return localStorage.getItem(MESSAGE_KEY) || DEFAULT_MESSAGE;
  } catch (e) {
    return DEFAULT_MESSAGE;
  }
}

function saveMessage(text) {
  try { localStorage.setItem(MESSAGE_KEY, text); } catch (e) {}
}

function openMessage() {
  $('msg-text').value = loadMessage();
  $('message-sheet').hidden = false;
  $('message-sheet').scrollTop = 0;
}

// Изменённый текст сразу запоминается на будущее
$('msg-text').addEventListener('input', e => saveMessage(e.target.value));

$('msg-reset').addEventListener('click', () => {
  $('msg-text').value = DEFAULT_MESSAGE;
  saveMessage(DEFAULT_MESSAGE);
});

$('msg-send').addEventListener('click', async () => {
  const text = $('msg-text').value.trim();
  if (!text) return;
  if (navigator.share) {
    try {
      await navigator.share({ text });
      $('message-sheet').hidden = true;
      return;
    } catch (e) {
      if (e.name === 'AbortError') return; // меню закрыли, ничего не делаем
    }
  }
  // Если меню «Поделиться» недоступно, копируем текст
  try {
    await navigator.clipboard.writeText(text);
    alert('Текст скопирован. Вставьте его в сообщение близкому человеку.');
  } catch (e) {
    alert('Не получилось открыть меню «Поделиться». Выделите текст и скопируйте его вручную.');
  }
});

$('msg-close').addEventListener('click', () => {
  $('message-sheet').hidden = true;
});

$('btn-message-home').addEventListener('click', openMessage);
$('btn-message-help').addEventListener('click', openMessage);
