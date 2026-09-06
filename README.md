# АСУВЦ «Лапка»

Учебное веб-приложение для управления волонтёрским центром помощи животным. Реализованы стартовая страница, health-check и модуль «Учёт животных»: справочники, карточки, поиск, редактирование и архивирование. Стек: FastAPI, PostgreSQL, SQLAlchemy AsyncSession, Alembic, React, TypeScript, Vite, SCSS/БЭМ.

## Требования

- Python 3.11+
- Node.js 20.19+ или 22.12+
- Docker с Docker Compose

## 1. PostgreSQL

При первом запуске скопируйте корневой `.env.example` в `.env`, задайте пароль и те же реквизиты в `backend/.env`. Уже настроенные `.env` не перезаписывайте. Затем запустите базу:

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

Если `backend/.env` отсутствует, скопируйте `backend/.env.example` и согласуйте пароль с корневым `.env`. Примените миграции, заполните справочники и запустите API:

```bash
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload
```

Миграция `0001_animal_registry` создаёт три таблицы модуля. Seed можно запускать повторно: он добавляет отсутствующие типы и породы через `ON CONFLICT DO NOTHING`, не создаёт животных и не перезаписывает существующие справочники. Для птицы и грызуна добавлен вариант «Без породы», чтобы обязательное поле формы можно было заполнить.

Если PowerShell блокирует активацию окружения, запускайте команды напрямую: `.venv\Scripts\python.exe -m pip install -r requirements.txt`, `.venv\Scripts\python.exe -m alembic upgrade head`, `.venv\Scripts\python.exe -m app.seed`, `.venv\Scripts\python.exe -m uvicorn app.main:app --reload`.

## 3. Frontend

Команды выполняются из каталога `frontend`:

```bash
npm install
npm run dev
```

URL backend берётся из `VITE_API_URL`; пример — в `frontend/.env.example`. Если нужен свой адрес, создайте `frontend/.env`. Для Windows при блокировке `npm.ps1` используйте `npm.cmd`. PostgreSQL работает в Docker, backend и frontend запускаются локально.

## Адреса

- приложение: http://localhost:5173
- учёт животных: http://localhost:5173/animals
- health-check API: http://localhost:8000/api/v1/health
- Swagger UI: http://localhost:8000/docs

Health-check возвращает `200`, только если API может выполнить запрос к PostgreSQL. При недоступной базе возвращается `503`.

## Учёт животных

Форма повторяет структуру эскиза технического проекта: карточка и справочники сверху, список животных с фильтрами снизу. «Сохранить» оставляет сохранённую карточку открытой для редактирования; «Сохранить и добавить ещё» сохраняет и открывает пустую форму. Для уже открытой карточки кнопка «Новая карточка» очищает форму и выходит из редактирования. В списке доступны поиск по подстроке клички, тип, статус и страницы по 20 записей.

Архивирование требует подтверждения, сохраняет запись и делает её доступной только для просмотра. Повторное архивирование безопасно. Статус новой карточки задаёт сервер: `in_care` («Под опекой»); архивной — `archived` («В архиве»). Сейчас это внутренний интерфейс без авторизации. Публичный доступ с фильтрацией будет отдельной задачей.

Поля `id`, `status`, `duplicate_key` запрещены в запросах создания/редактирования. `PATCH` принимает только изменяемые поля, пропущенные значения сохраняются; необязательные поля можно очистить через `null`. Обязательные поля не принимают `null`.

Телефон необязателен; принимаются российские номера из 11 цифр с начальной 7/8, допускаются пробелы, скобки и дефисы. Хранение — в виде `+79991234567`. Вес — `Numeric(6, 2)` / Python Decimal, в JSON передаётся строкой: `"4.25"`. Допускается 0 < вес ≤ 9999,99 кг, до двух десятичных знаков. Год рождения — от 1900 до текущего года.

Правило очевидного дубликата: совпадают кличка, тип, порода, год рождения, ФИО и телефон ответственного лица. Регистр и лишние пробелы в кличке/ФИО игнорируются, телефон нормализуется. Вес, примечание и статус не влияют на совпадение. Полное совпадение с архивной карточкой также блокируется. Животные с одинаковой кличкой, но разными данными владельцев допускаются. Без данных владельца это эвристика: для животных-тёзок одного типа/породы и года потребуется уточнить ответственное лицо; это не надёжная идентификация по чипу.

Сервер формирует SHA-256 ключ из этих нормализованных данных и хранит его в уникальном столбце `duplicate_key`. Предварительная проверка даёт понятный конфликт, уникальность в PostgreSQL дополнительно защищает от одновременных запросов. Ошибки ссылок/полей возвращаются как `422`, дубли и изменение архивной карточки — `409`, отсутствующая карточка — `404`.

## Схема и API

```text
animal_types (1) ─── (N) breeds
animal_types (1) ─── (N) animals
breeds       (1) ─── (N) animals
```

- `animal_types`: уникальное название типа.
- `breeds`: тип, название, необязательные границы веса. Название уникально внутри типа; границы пока не задаются seed и не используются как медицинские ограничения.
- `animals`: карточка с весом, годом рождения, контактами, примечанием, enum-статусом и внутренним ключом дубликата. Составной FK `(breed_id, animal_type_id)` гарантирует принадлежность породы выбранному типу даже при прямой записи в БД. CHECK-ограничения защищают вес, год и статус.

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/api/v1/health` | Backend и PostgreSQL |
| GET | `/api/v1/animal-types` | Типы животных |
| GET | `/api/v1/breeds?animal_type_id=1` | Породы; без параметра — все |
| GET | `/api/v1/animals` | Список, параметры `search`, `animal_type_id`, `status`, `limit` (1–100), `offset` |
| GET | `/api/v1/animals/summary` | Количество всех животных, под опекой и в архиве для главной панели |
| GET | `/api/v1/animals/{id}` | Карточка |
| POST | `/api/v1/animals` | Создание, ответ 201 |
| PATCH | `/api/v1/animals/{id}` | Частичное редактирование |
| POST | `/api/v1/animals/{id}/archive` | Архивирование |

API удаления нет. Контракты запросов и ответов доступны в Swagger `/docs`.

## Проверки

Backend, из `backend` при запущенном PostgreSQL:

```powershell
python -m pip install -r requirements-dev.txt
python -m pytest -q
python -m alembic check
```

Тесты используют реальные миграции и PostgreSQL из настроенного `.env`. Каждый тест создаёт отдельную случайно названную схему `lapka_test_*` в транзакции; после теста транзакция откатывается вместе со схемой. Рабочие таблицы не очищаются. Пользователю БД нужно право CREATE SCHEMA (у локального пользователя Docker оно есть). Тестируются API, валидация, FK/UNIQUE/CHECK, архивирование, фильтры, идемпотентность seed, upgrade/downgrade. При недоступной БД тесты завершаются ошибкой, а не пропускаются.

Frontend, из `frontend`:

```powershell
npm.cmd run lint
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Браузерные тесты сами запускают Vite на `127.0.0.1:5174`. Используют тестовые ответы API и не создают записей в рабочей базе; проверяют навигацию, валидацию, зависимую породу, сохранение, редактирование, подтверждение архива, ошибки сервера и мобильную ширину. Реальную серверную логику и БД проверяет pytest. Скриншоты/трассы сохраняются в игнорируемом `frontend/test-results/`.

## Структура модуля и изменения

```text
backend/
  app/
    api/routes/{animals,animal_types,breeds}.py
    core/errors.py
    models/{animal,animal_type,breed}.py
    schemas/{animal,animal_type,breed}.py
    repositories/{animal,animal_type,breed,seed}.py
    services/animal.py
    seed.py
  migrations/versions/0001_animal_registry.py
  tests/{conftest,test_animals}.py
  pytest.ini
  requirements-dev.txt
frontend/
  src/
    api/{animals,dictionaries}.ts
    types/animal.ts
    pages/AnimalsPage/{AnimalsPage.tsx,AnimalsPage.scss}
    components/
      AnimalForm/{AnimalForm.tsx,AnimalForm.scss,validation.ts}
      AnimalsTable/{AnimalsTable.tsx,AnimalsTable.scss}
      FormField/{FormField.tsx,FormField.scss}
  tests/animals.spec.ts
  playwright.config.ts
```

Кроме новых файлов изменены: `backend/app/api/router.py` (подключение маршрутов), `backend/app/main.py` (обработчик доменных ошибок), `backend/app/models/__init__.py` (экспорт моделей), `backend/migrations/env.py` и `backend/alembic.ini` (поддержка тестовой миграции); `frontend/src/main.tsx`, `app/App.tsx`, `components/Header/Header.tsx` и `Header.scss` (клиентская навигация), `api/client.ts` (общие запросы и ошибки), `styles/globals.scss` (фокус и страница 404), `frontend/package.json` и `package-lock.json` (зависимости/команды), `.gitignore` и этот README.

SQL остаётся в repositories, бизнес-проверки и транзакции — в service, HTTP-коды и сериализация — в API. [Документация SQLAlchemy по транзакциям и тестовым сессиям](https://docs.sqlalchemy.org/en/20/orm/session_transaction.html) и [клиентская маршрутизация React Router](https://reactrouter.com/start/declarative/routing).
