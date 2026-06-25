// Слой работы с базой данных.
// Используем встроенный в Node модуль node:sqlite — никаких внешних зависимостей.
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Папку с базой можно переопределить переменной окружения DATA_DIR.
// На Railway укажи путь к примонтированному диску (Volume) — например, /data —
// иначе файл базы будет стираться при каждом редеплое.
const DATA_DIR = process.env.DATA_DIR || __dirname;
fs.mkdirSync(DATA_DIR, { recursive: true });

// Файл базы данных создаётся автоматически.
export const db = new DatabaseSync(path.join(DATA_DIR, 'data.db'));

// Регистрируем Unicode-версию LOWER(): встроенная в SQLite понимает регистр
// только для латиницы, поэтому поиск по кириллице без этого был бы регистрозависимым.
db.function('lower_u', { deterministic: true }, (s) => (s == null ? null : String(s).toLowerCase()));

// Создаём таблицу, если её ещё нет.
db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL,
    author     TEXT    NOT NULL DEFAULT '',
    genre      TEXT    NOT NULL DEFAULT '',
    year       INTEGER,
    rating     INTEGER NOT NULL DEFAULT 0,
    status     TEXT    NOT NULL DEFAULT 'planned',
    notes      TEXT    NOT NULL DEFAULT '',
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

// Допустимые статусы прочтения.
export const STATUSES = ['planned', 'reading', 'read'];

// ---------- READ ----------

// Получить список книг с фильтрами, поиском и сортировкой.
export function listBooks({ search = '', status = '', genre = '', sort = 'created_desc' } = {}) {
  const where = [];
  const params = [];

  if (search) {
    where.push('(lower_u(title) LIKE ? OR lower_u(author) LIKE ? OR lower_u(notes) LIKE ?)');
    const q = `%${search.toLowerCase()}%`;
    params.push(q, q, q);
  }
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  if (genre) {
    where.push('genre = ?');
    params.push(genre);
  }

  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const sortMap = {
    created_desc: 'created_at DESC, id DESC',
    created_asc: 'created_at ASC, id ASC',
    title_asc: 'title COLLATE NOCASE ASC',
    title_desc: 'title COLLATE NOCASE DESC',
    rating_desc: 'rating DESC, title COLLATE NOCASE ASC',
    rating_asc: 'rating ASC, title COLLATE NOCASE ASC',
    year_desc: 'year DESC',
    year_asc: 'year ASC',
  };
  const orderSql = 'ORDER BY ' + (sortMap[sort] || sortMap.created_desc);

  return db.prepare(`SELECT * FROM books ${whereSql} ${orderSql}`).all(...params);
}

// Получить одну книгу по id.
export function getBook(id) {
  return db.prepare('SELECT * FROM books WHERE id = ?').get(id) ?? null;
}

// ---------- CREATE ----------

export function createBook(b) {
  const info = db
    .prepare(
      `INSERT INTO books (title, author, genre, year, rating, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(b.title, b.author, b.genre, b.year ?? null, b.rating, b.status, b.notes);
  return getBook(Number(info.lastInsertRowid));
}

// ---------- UPDATE ----------

export function updateBook(id, b) {
  if (!getBook(id)) return null;
  db.prepare(
    `UPDATE books
       SET title = ?, author = ?, genre = ?, year = ?, rating = ?, status = ?, notes = ?,
           updated_at = datetime('now')
     WHERE id = ?`,
  ).run(b.title, b.author, b.genre, b.year ?? null, b.rating, b.status, b.notes, id);
  return getBook(id);
}

// ---------- DELETE ----------

export function deleteBook(id) {
  return db.prepare('DELETE FROM books WHERE id = ?').run(id).changes > 0;
}

export function clearBooks() {
  return db.prepare('DELETE FROM books').run().changes;
}

// ---------- STATS ----------

export function stats() {
  const total = db.prepare('SELECT COUNT(*) AS c FROM books').get().c;

  const counts = { planned: 0, reading: 0, read: 0 };
  for (const row of db.prepare('SELECT status, COUNT(*) AS c FROM books GROUP BY status').all()) {
    counts[row.status] = row.c;
  }

  const avg = db.prepare('SELECT AVG(rating) AS a FROM books WHERE rating > 0').get().a;
  const genres = db
    .prepare("SELECT DISTINCT genre FROM books WHERE genre <> '' ORDER BY genre COLLATE NOCASE")
    .all()
    .map((r) => r.genre);

  return {
    total,
    planned: counts.planned,
    reading: counts.reading,
    read: counts.read,
    avgRating: avg ? Math.round(avg * 10) / 10 : 0,
    genres,
  };
}

// ---------- SEED (демо-данные) ----------

const SEED = [
  { title: 'Мастер и Маргарита', author: 'Михаил Булгаков', genre: 'Роман', year: 1967, rating: 5, status: 'read', notes: 'Любимая книга.' },
  { title: '1984', author: 'Джордж Оруэлл', genre: 'Антиутопия', year: 1949, rating: 5, status: 'read', notes: 'Big Brother is watching you.' },
  { title: 'Преступление и наказание', author: 'Фёдор Достоевский', genre: 'Классика', year: 1866, rating: 4, status: 'read', notes: '' },
  { title: 'Дюна', author: 'Фрэнк Герберт', genre: 'Фантастика', year: 1965, rating: 5, status: 'reading', notes: 'Перечитываю перед фильмом.' },
  { title: 'Хоббит', author: 'Дж. Р. Р. Толкин', genre: 'Фэнтези', year: 1937, rating: 5, status: 'read', notes: '' },
  { title: 'Гарри Поттер и философский камень', author: 'Дж. К. Роулинг', genre: 'Фэнтези', year: 1997, rating: 4, status: 'read', notes: '' },
  { title: 'Три товарища', author: 'Эрих Мария Ремарк', genre: 'Роман', year: 1936, rating: 5, status: 'planned', notes: 'Советовали друзья.' },
  { title: 'Сто лет одиночества', author: 'Габриэль Гарсиа Маркес', genre: 'Магический реализм', year: 1967, rating: 4, status: 'planned', notes: '' },
  { title: 'Краткая история времени', author: 'Стивен Хокинг', genre: 'Научпоп', year: 1988, rating: 4, status: 'reading', notes: 'О чёрных дырах и времени.' },
  { title: 'Цветы для Элджернона', author: 'Дэниел Киз', genre: 'Фантастика', year: 1966, rating: 5, status: 'planned', notes: '' },
];

// Добавляет демо-книги (пропускает те, что уже есть по названию) — можно нажимать несколько раз.
export function seed() {
  const exists = db.prepare('SELECT 1 FROM books WHERE title = ? LIMIT 1');
  const insert = db.prepare(
    `INSERT INTO books (title, author, genre, year, rating, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  let inserted = 0;
  for (const b of SEED) {
    if (!exists.get(b.title)) {
      insert.run(b.title, b.author, b.genre, b.year, b.rating, b.status, b.notes);
      inserted++;
    }
  }
  return inserted;
}
