# АСУВЦ «Лапка»

Учебное веб-приложение для управления волонтёрским центром помощи животным. Репозиторий содержит фундамент проекта: FastAPI API, асинхронное подключение к PostgreSQL, Alembic и React-клиент.

## Требования

- Python 3.11+
- Node.js 20.19+ или 22.12+
- Docker с Docker Compose

## 1. PostgreSQL

При необходимости скопируйте корневой `.env.example` в `.env` и поменяйте локальные значения. Затем запустите базу:

```bash
docker compose up -d postgres
```

По умолчанию PostgreSQL публикуется на порту `55432`, чтобы не конфликтовать с уже установленным локальным PostgreSQL. Порт можно изменить через `POSTGRES_PORT` одновременно в корневом и backend-файлах `.env`.

## 2. Backend и миграции

Команды выполняются из каталога `backend`:

```bash
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

Скопируйте `backend/.env.example` в `backend/.env`. Примените миграции и запустите API:

```bash
alembic upgrade head
uvicorn app.main:app --reload
```

На этом этапе предметных таблиц ещё нет, поэтому Alembic настроен и готов к созданию первой миграции:

```bash
alembic revision --autogenerate -m "create initial tables"
```

## 3. Frontend

Команды выполняются из каталога `frontend`:

```bash
npm install
copy .env.example .env
npm run dev
```

В macOS/Linux вместо `copy` используйте `cp`.

## Адреса

- приложение: http://localhost:5173
- health-check API: http://localhost:8000/api/v1/health
- Swagger UI: http://localhost:8000/docs

Health-check возвращает `200`, только если API может выполнить запрос к PostgreSQL. При недоступной базе возвращается `503`.
