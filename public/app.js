// Логика фронтенда: общается с REST API и рисует интерфейс.

const STATUS_LABELS = { planned: 'В планах', reading: 'Читаю', read: 'Прочитано' };

// --- ссылки на элементы ---
const grid = document.getElementById('grid');
const emptyEl = document.getElementById('empty');
const statsEl = document.getElementById('stats');
const searchEl = document.getElementById('search');
const statusEl = document.getElementById('filterStatus');
const genreEl = document.getElementById('filterGenre');
const sortEl = document.getElementById('sort');
const toasts = document.getElementById('toasts');

const dialog = document.getElementById('dialog');
const form = document.getElementById('bookForm');
const dialogTitle = document.getElementById('dialogTitle');
const ratingInput = document.getElementById('ratingInput');
const genreList = document.getElementById('genreList');

const fTitle = document.getElementById('f_title');
const fAuthor = document.getElementById('f_author');
const fGenre = document.getElementById('f_genre');
const fYear = document.getElementById('f_year');
const fStatus = document.getElementById('f_status');
const fNotes = document.getElementById('f_notes');

let editingId = null; // id редактируемой книги или null для новой

// --- помощники ---

// Универсальный запрос к API с обработкой ошибок.
async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { /* не JSON */ }
  }
  if (!res.ok) throw new Error((data && data.error) || `Ошибка ${res.status}`);
  return data;
}

// Экранирование текста, чтобы безопасно вставлять в HTML.
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );
}

function starsHtml(rating) {
  let s = '';
  for (let i = 1; i <= 5; i++) s += `<span class="${i <= rating ? 'on' : ''}">★</span>`;
  return `<span class="stars">${s}</span>`;
}

function toast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = msg;
  toasts.appendChild(el);
  setTimeout(() => {
    el.classList.add('hide');
    setTimeout(() => el.remove(), 300);
  }, 2600);
}

// --- загрузка и отрисовка ---

async function loadStats() {
  const s = await api('/api/stats');
  statsEl.innerHTML = `
    <div class="stat"><span class="num">${s.total}</span><span class="lbl">всего</span></div>
    <div class="stat"><span class="num">${s.read}</span><span class="lbl">прочитано</span></div>
    <div class="stat"><span class="num">${s.reading}</span><span class="lbl">читаю</span></div>
    <div class="stat"><span class="num">${s.planned}</span><span class="lbl">в планах</span></div>
    <div class="stat"><span class="num">${s.avgRating || '—'}</span><span class="lbl">ср. оценка</span></div>`;

  // обновляем выпадающий список жанров (сохраняя выбранный)
  const cur = genreEl.value;
  genreEl.innerHTML =
    '<option value="">Все жанры</option>' +
    s.genres.map((g) => `<option value="${esc(g)}" ${g === cur ? 'selected' : ''}>${esc(g)}</option>`).join('');

  // и подсказки жанров в форме
  genreList.innerHTML = s.genres.map((g) => `<option value="${esc(g)}"></option>`).join('');
}

async function loadBooks() {
  const params = new URLSearchParams();
  if (searchEl.value.trim()) params.set('search', searchEl.value.trim());
  if (statusEl.value) params.set('status', statusEl.value);
  if (genreEl.value) params.set('genre', genreEl.value);
  if (sortEl.value) params.set('sort', sortEl.value);

  const books = await api('/api/books?' + params.toString());
  render(books);
}

function render(books) {
  emptyEl.classList.toggle('hidden', books.length > 0);
  grid.innerHTML = books
    .map(
      (b) => `
    <article class="card" data-id="${b.id}">
      <div class="card-top">
        <span class="badge badge-${b.status}">${STATUS_LABELS[b.status] || b.status}</span>
        ${b.year ? `<span class="year">${b.year}</span>` : ''}
      </div>
      <h3 class="card-title">${esc(b.title)}</h3>
      <p class="card-author">${esc(b.author) || '—'}</p>
      ${b.genre ? `<span class="genre-chip">${esc(b.genre)}</span>` : ''}
      ${starsHtml(b.rating)}
      ${b.notes ? `<p class="card-notes">${esc(b.notes)}</p>` : ''}
      <div class="card-actions">
        <button class="btn btn-sm btn-edit" data-act="edit">✏️ Изменить</button>
        <button class="btn btn-sm btn-del" data-act="delete">🗑 Удалить</button>
      </div>
    </article>`,
    )
    .join('');
}

async function refresh() {
  await Promise.all([loadStats(), loadBooks()]);
}

// --- форма (создание / редактирование) ---

function setFormRating(v) {
  ratingInput.dataset.value = String(v);
  ratingInput.querySelectorAll('button[data-val]').forEach((btn) => {
    btn.classList.toggle('on', Number(btn.dataset.val) <= v);
  });
}

function openDialog(book) {
  editingId = book ? book.id : null;
  dialogTitle.textContent = book ? 'Изменить книгу' : 'Новая книга';
  fTitle.value = book?.title ?? '';
  fAuthor.value = book?.author ?? '';
  fGenre.value = book?.genre ?? '';
  fYear.value = book?.year ?? '';
  fStatus.value = book?.status ?? 'planned';
  fNotes.value = book?.notes ?? '';
  setFormRating(book?.rating ?? 0);
  dialog.showModal();
  fTitle.focus();
}

// --- обработчики событий ---

document.getElementById('addBtn').addEventListener('click', () => openDialog(null));
document.getElementById('cancelBtn').addEventListener('click', () => dialog.close());
document.getElementById('ratingReset').addEventListener('click', () => setFormRating(0));

// клик по звезде в форме
ratingInput.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-val]');
  if (btn) setFormRating(Number(btn.dataset.val));
});

// закрытие диалога кликом по затемнению
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) dialog.close();
});

// отправка формы
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    title: fTitle.value.trim(),
    author: fAuthor.value.trim(),
    genre: fGenre.value.trim(),
    year: fYear.value,
    status: fStatus.value,
    notes: fNotes.value.trim(),
    rating: Number(ratingInput.dataset.value || 0),
  };
  if (!payload.title) {
    toast('Введите название', 'err');
    fTitle.focus();
    return;
  }
  try {
    if (editingId) {
      await api('/api/books/' + editingId, { method: 'PUT', body: JSON.stringify(payload) });
      toast('Изменения сохранены');
    } else {
      await api('/api/books', { method: 'POST', body: JSON.stringify(payload) });
      toast('Книга добавлена');
    }
    dialog.close();
    await refresh();
  } catch (err) {
    toast(err.message, 'err');
  }
});

// делегирование кликов на карточках (Изменить / Удалить)
grid.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = Number(btn.closest('.card').dataset.id);

  if (btn.dataset.act === 'edit') {
    try {
      openDialog(await api('/api/books/' + id));
    } catch (err) {
      toast(err.message, 'err');
    }
  } else if (btn.dataset.act === 'delete') {
    if (!confirm('Удалить эту книгу?')) return;
    try {
      await api('/api/books/' + id, { method: 'DELETE' });
      toast('Книга удалена');
      await refresh();
    } catch (err) {
      toast(err.message, 'err');
    }
  }
});

// демо-данные
document.getElementById('seedBtn').addEventListener('click', async () => {
  try {
    const r = await api('/api/seed', { method: 'POST' });
    toast(r.inserted ? `Добавлено книг: ${r.inserted}` : 'Примеры уже добавлены');
    await refresh();
  } catch (err) {
    toast(err.message, 'err');
  }
});

// очистить всё
document.getElementById('clearBtn').addEventListener('click', async () => {
  if (!confirm('Удалить ВСЕ книги? Это действие необратимо.')) return;
  try {
    const r = await api('/api/books', { method: 'DELETE' });
    toast(`Удалено книг: ${r.deleted}`);
    await refresh();
  } catch (err) {
    toast(err.message, 'err');
  }
});

// фильтры и поиск
let searchTimer;
searchEl.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadBooks, 250);
});
statusEl.addEventListener('change', loadBooks);
genreEl.addEventListener('change', loadBooks);
sortEl.addEventListener('change', loadBooks);

// старт
refresh().catch((err) => toast('Не удалось загрузить данные: ' + err.message, 'err'));
