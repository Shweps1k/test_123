// HTTP-сервер без внешних зависимостей: раздаёт статику из ./public и REST API под /api.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// ---------- помощники ----------

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) req.destroy(); // защита от огромных тел запроса
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Некорректный JSON в теле запроса'));
      }
    });
    req.on('error', reject);
  });
}

// Проверка и нормализация данных книги, приходящих от клиента.
function validateBook(body) {
  const errors = [];
  const value = {};

  value.title = String(body.title ?? '').trim();
  if (!value.title) errors.push('Название обязательно');

  value.author = String(body.author ?? '').trim();
  value.genre = String(body.genre ?? '').trim();
  value.notes = String(body.notes ?? '').trim();

  value.cover_url = String(body.cover_url ?? '').trim();
  if (value.cover_url && !/^https?:\/\//i.test(value.cover_url)) {
    errors.push('Ссылка на обложку должна начинаться с http:// или https://');
  }

  if (body.year === '' || body.year === null || body.year === undefined) {
    value.year = null;
  } else {
    const y = Number(body.year);
    if (!Number.isInteger(y) || y < 0 || y > 3000) errors.push('Год должен быть числом от 0 до 3000');
    else value.year = y;
  }

  const r = Number(body.rating ?? 0);
  if (!Number.isInteger(r) || r < 0 || r > 5) errors.push('Оценка должна быть числом от 0 до 5');
  else value.rating = r;

  value.status = db.STATUSES.includes(body.status) ? body.status : 'planned';

  return { value, errors };
}

// ---------- API ----------

async function handleApi(req, res, url) {
  const { pathname } = url;
  const method = req.method;
  const idMatch = pathname.match(/^\/api\/books\/(\d+)$/);

  // Коллекция: /api/books
  if (pathname === '/api/books' && method === 'GET') {
    return sendJson(res, 200, db.listBooks({
      search: url.searchParams.get('search') || '',
      status: url.searchParams.get('status') || '',
      genre: url.searchParams.get('genre') || '',
      sort: url.searchParams.get('sort') || 'created_desc',
    }));
  }

  if (pathname === '/api/books' && method === 'POST') {
    const { value, errors } = validateBook(await readBody(req));
    if (errors.length) return sendJson(res, 400, { error: errors.join('; ') });
    return sendJson(res, 201, db.createBook(value));
  }

  if (pathname === '/api/books' && method === 'DELETE') {
    return sendJson(res, 200, { deleted: db.clearBooks() });
  }

  // Один элемент: /api/books/:id
  if (idMatch && method === 'GET') {
    const book = db.getBook(Number(idMatch[1]));
    return book ? sendJson(res, 200, book) : sendJson(res, 404, { error: 'Книга не найдена' });
  }

  if (idMatch && method === 'PUT') {
    const { value, errors } = validateBook(await readBody(req));
    if (errors.length) return sendJson(res, 400, { error: errors.join('; ') });
    const book = db.updateBook(Number(idMatch[1]), value);
    return book ? sendJson(res, 200, book) : sendJson(res, 404, { error: 'Книга не найдена' });
  }

  if (idMatch && method === 'DELETE') {
    return db.deleteBook(Number(idMatch[1]))
      ? sendJson(res, 200, { ok: true })
      : sendJson(res, 404, { error: 'Книга не найдена' });
  }

  // Статистика и демо-данные
  if (pathname === '/api/stats' && method === 'GET') return sendJson(res, 200, db.stats());
  if (pathname === '/api/seed' && method === 'POST') return sendJson(res, 200, { inserted: db.seed() });

  return sendJson(res, 404, { error: 'Маршрут API не найден' });
}

// ---------- статика ----------

async function serveStatic(res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/') rel = '/index.html';

  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('403 Forbidden');
  }

  try {
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
}

// ---------- сервер ----------

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    return await serveStatic(res, url.pathname);
  } catch (err) {
    sendJson(res, 500, { error: err.message || 'Внутренняя ошибка сервера' });
  }
});

// Слушаем 0.0.0.0 — это нужно для работы в контейнере (Railway и т.п.).
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  📚 Моя библиотека запущена на порту ${PORT}`);
  console.log(`  ➜  Локально:  http://localhost:${PORT}\n`);
});
