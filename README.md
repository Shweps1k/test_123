# 📚 Моя библиотека

Полноценный веб-сайт с базой данных и полным CRUD. Каталог книг: можно добавлять,
искать, фильтровать, редактировать и удалять записи. Всё работает **без единой внешней
зависимости** — только Node.js (встроенный HTTP-сервер + встроенная база `node:sqlite`).

## 🚀 Запуск

```bash
node server.js
# или
npm start
```

Затем откройте в браузере: **http://localhost:3000**

> Нужен Node.js версии 22.5 или новее (для встроенного модуля `node:sqlite`).
> Порт можно поменять: `PORT=4000 node server.js`

## 🧩 Что внутри

| Файл | Назначение |
|------|------------|
| `server.js` | HTTP-сервер: раздаёт сайт и REST API |
| `db.js` | Работа с базой SQLite (создание таблицы, запросы) |
| `public/index.html` | Разметка страницы |
| `public/styles.css` | Стили |
| `public/app.js` | Логика интерфейса (запросы к API, отрисовка) |
| `data.db` | Файл базы данных (создаётся автоматически) |

## 🖱 Как тестировать через интерфейс

- **＋ Добавить книгу** — открывает форму создания.
- **✏️ Изменить** на карточке — редактирование книги.
- **🗑 Удалить** на карточке — удаление (с подтверждением).
- **✨ Заполнить примерами** — добавляет 10 демо-книг.
- **Очистить всё** — удаляет все записи.
- Поле поиска, фильтры по статусу/жанру и сортировка — фильтрация на стороне сервера.

## 🔌 REST API

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/api/books` | Список книг. Параметры: `search`, `status`, `genre`, `sort` |
| `POST` | `/api/books` | Создать книгу |
| `GET` | `/api/books/:id` | Получить одну книгу |
| `PUT` | `/api/books/:id` | Обновить книгу |
| `DELETE` | `/api/books/:id` | Удалить книгу |
| `DELETE` | `/api/books` | Удалить все книги |
| `GET` | `/api/stats` | Статистика и список жанров |
| `POST` | `/api/seed` | Добавить демо-данные |

### Пример запроса через curl

```bash
# создать книгу
curl -X POST http://localhost:3000/api/books \
  -H "Content-Type: application/json" \
  -d '{"title":"Дюна","author":"Фрэнк Герберт","genre":"Фантастика","year":1965,"rating":5,"status":"reading"}'

# получить список
curl http://localhost:3000/api/books

# обновить (id = 1)
curl -X PUT http://localhost:3000/api/books/1 \
  -H "Content-Type: application/json" \
  -d '{"title":"Дюна","rating":4,"status":"read"}'

# удалить (id = 1)
curl -X DELETE http://localhost:3000/api/books/1
```

## 🗂 Модель данных (таблица `books`)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | INTEGER | Первичный ключ |
| `title` | TEXT | Название (обязательно) |
| `author` | TEXT | Автор |
| `genre` | TEXT | Жанр |
| `year` | INTEGER | Год издания |
| `rating` | INTEGER | Оценка 0–5 |
| `status` | TEXT | `planned` / `reading` / `read` |
| `notes` | TEXT | Заметки |
| `created_at`, `updated_at` | TEXT | Метки времени |

## 🚂 Деплой на Railway

Приложение готово к деплою на [Railway](https://railway.app). Важно: база данных —
это файл SQLite, поэтому нужен **постоянный диск (Volume)**, иначе данные будут
теряться при каждом редеплое.

В проекте уже есть `Dockerfile` (Node 24, где `node:sqlite` работает без флагов) —
Railway подхватит его автоматически. Путь к базе берётся из переменной `DATA_DIR`
(в `Dockerfile` уже задано `/data`).

### Шаги (через GitHub — проще всего)

1. Залей проект на GitHub:
   ```bash
   git init
   git add .
   git commit -m "Моя библиотека: CRUD на Node.js + SQLite"
   git branch -M main
   git remote add origin https://github.com/<логин>/<репозиторий>.git
   git push -u origin main
   ```
2. На [railway.app](https://railway.app): **New Project → Deploy from GitHub repo** → выбери репозиторий. Railway соберёт образ по `Dockerfile`.
3. **Добавь Volume** (это главное для сохранения данных): сервис → **+ Create → Volume** → **Mount path = `/data`**.
4. **Сгенерируй домен**: сервис → **Settings → Networking → Generate Domain**.
5. Открой адрес — сайт работает, данные сохраняются между перезапусками. 🎉

### Через CLI (альтернатива)

```bash
npm i -g @railway/cli
railway login
railway init
railway up
# затем в дашборде: добавь Volume на /data и сгенерируй домен
```

> ⚠️ SQLite + Volume работает на одном экземпляре сервиса (без горизонтального
> масштабирования) — для хобби-проекта это идеально. Если позже понадобится рост,
> Railway в один клик добавляет PostgreSQL.
