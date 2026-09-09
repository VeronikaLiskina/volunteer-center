# АСУВЦ «Лапка»

Учебное веб-приложение для управления волонтёрским центром помощи животным. Реализованы главная панель, health-check, учёт животных, волонтёров, планирование и выполнение процедур ухода. Стек: FastAPI, PostgreSQL, SQLAlchemy AsyncSession, Alembic, React, TypeScript, Vite, SCSS/БЭМ.

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

Миграция `0001_animal_registry` создаёт таблицы животных и справочников, `0002_volunteers` — таблицу волонтёров, `0003_volunteer_duplicate_key` добавляет защиту контактов от конкурентных дублей, `0004_care_procedures` — типы и плановые процедуры ухода, а `0005_procedure_executions` — фактические результаты выполнения. Seed можно запускать повторно: он добавляет отсутствующие типы животных, породы и типы процедур через `ON CONFLICT DO NOTHING`, не создаёт рабочие записи и не перезаписывает справочники.

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
- учёт волонтёров: http://localhost:5173/volunteers
- планирование процедур: http://localhost:5173/procedures
- health-check API: http://localhost:8000/api/v1/health
- Swagger UI: http://localhost:8000/docs

Health-check возвращает `200`, только если API может выполнить запрос к PostgreSQL. При недоступной базе возвращается `503`.

## Учёт животных

Список, форма и справочники разделены по маршрутам: `/animals`, `/animals/new`, `/animals/{id}/edit` и `/animals/dictionaries`. На дочерних страницах есть закрытие с возвратом к списку. В списке доступны поиск по подстроке клички, тип, статус и страницы по 20 записей.

Архивирование требует подтверждения, сохраняет запись и делает её доступной только для просмотра. Повторное архивирование безопасно. Статус новой карточки задаёт сервер: `in_care` («Под опекой»); архивной — `archived` («В архиве»). Сейчас это внутренний интерфейс без авторизации. Публичный доступ с фильтрацией будет отдельной задачей.

Поля `id`, `status`, `duplicate_key` запрещены в запросах создания/редактирования. `PATCH` принимает только изменяемые поля, пропущенные значения сохраняются; необязательные поля можно очистить через `null`. Обязательные поля не принимают `null`.

Телефон необязателен; принимаются российские номера из 11 цифр с начальной 7/8, допускаются пробелы, скобки и дефисы. Хранение — в виде `+79991234567`. Вес — `Numeric(6, 2)` / Python Decimal, в JSON передаётся строкой: `"4.25"`. Допускается 0 < вес ≤ 9999,99 кг, до двух десятичных знаков. Год рождения — от 1900 до текущего года.

Правило очевидного дубликата: совпадают кличка, тип, порода, год рождения, ФИО и телефон ответственного лица. Регистр и лишние пробелы в кличке/ФИО игнорируются, телефон нормализуется. Вес, примечание и статус не влияют на совпадение. Полное совпадение с архивной карточкой также блокируется. Животные с одинаковой кличкой, но разными данными владельцев допускаются. Без данных владельца это эвристика: для животных-тёзок одного типа/породы и года потребуется уточнить ответственное лицо; это не надёжная идентификация по чипу.

Сервер формирует SHA-256 ключ из этих нормализованных данных и хранит его в уникальном столбце `duplicate_key`. Предварительная проверка даёт понятный конфликт, уникальность в PostgreSQL дополнительно защищает от одновременных запросов. Ошибки ссылок/полей возвращаются как `422`, дубли и изменение архивной карточки — `409`, отсутствующая карточка — `404`.

## Учёт волонтёров

Карточка содержит только ФИО, обязательный российский телефон, необязательное примечание и серверный статус. Создание и редактирование открываются на отдельных страницах `/volunteers/new` и `/volunteers/{id}/edit`, закрытие возвращает к списку. В списке доступны поиск по ФИО, фильтр статуса и пагинация.

Новый волонтёр всегда создаётся со статусом `active` («Активен»). Статус нельзя передать в `POST` или обычный `PATCH`: он изменяется только действиями активации и деактивации. Деактивация требует подтверждения, не удаляет запись и идемпотентна; неактивные волонтёры не возвращаются endpoint-ом `/volunteers/active`. Физического удаления нет.

Телефон принимается в форматах `+7 (999) 123-45-67`, `89991234567` и аналогичных, а хранится как `+79991234567`. ФИО очищается от лишних пробелов. Совпадение нормализованного телефона и ФИО без учёта регистра считается очевидным дубликатом и возвращает `409`; SHA-256 `duplicate_key` дополнительно защищён UNIQUE-ограничением PostgreSQL и не попадает в API. Невалидные данные возвращают `422`, отсутствующая карточка — `404`.

## Планирование процедур ухода

Список и отдельные страницы формы доступны по маршрутам `/procedures`, `/procedures/new` и `/procedures/{id}/edit`. Процедура связывает животное, тип процедуры и ответственного волонтёра, а также содержит плановую дату/время, целую положительную продолжительность, статус и комментарий до 255 символов. Статусы: `assigned` («Назначена»), `completed` («Выполнена»), `cancelled` («Отменена») и `overdue` («Просрочена»). При создании статус не принимается от клиента и всегда устанавливается сервером в `assigned`; PATCH не позволяет установить `completed`. Форма отображает статус без возможности редактирования. Переходы статусов появятся вместе с отдельным учётом фактического выполнения.

Новые назначения запрещены для архивных животных и неактивных волонтёров; эти же правила повторно проверяются при `PATCH` ссылочных полей. Форма предлагает только доступные карточки. Seed создаёт четыре типа: «Кормление», «Выгул», «Уборка» и «Обработка». Главная панель получает реальные количества и расписание на текущую дату.

## Учёт выполнения процедур

Для процедур в статусе `assigned` или `overdue` в списке доступно действие «Выполнить» и страница `/procedures/{id}/execute`. Сохранение создаёт фактический результат и в той же транзакции переводит процедуру в `completed`. Выполненные и отменённые процедуры выполнить нельзя. Одна процедура имеет не более одного выполнения — это защищено проверкой сервиса и UNIQUE-ограничением PostgreSQL.

Запись выполнения содержит фактические дату и время, обязательный результат, необязательный комментарий до 255 символов и серверное время создания. Результат отображается в карточке процедуры и может быть уточнён через PATCH. Удаления выполнения нет. Показатель «Выполнено сегодня» считается по `procedure_executions.execution_date`, а не по текущему статусу плана.

## Схема и API

```text
animal_types (1) ─── (N) breeds
animal_types (1) ─── (N) animals
breeds       (1) ─── (N) animals

volunteers — самостоятельный реестр команды
animals              (1) ─── (N) care_procedures
volunteers           (1) ─── (N) care_procedures
care_procedure_types (1) ─── (N) care_procedures
care_procedures      (1) ─── (0..1) procedure_executions
```

- `animal_types`: уникальное название типа.
- `breeds`: тип, название, необязательные границы веса. Название уникально внутри типа; границы пока не задаются seed и не используются как медицинские ограничения.
- `animals`: карточка с весом, годом рождения, контактами, примечанием, enum-статусом и внутренним ключом дубликата. Составной FK `(breed_id, animal_type_id)` гарантирует принадлежность породы выбранному типу даже при прямой записи в БД. CHECK-ограничения защищают вес, год и статус.
- `volunteers`: ФИО, нормализованный телефон, примечание и enum-статус `active`/`inactive`. CHECK-ограничения защищают непустое ФИО, формат телефона и статус; по статусу создан индекс.
- `care_procedure_types`: уникальные названия типов процедур.
- `care_procedures`: плановое назначение с FK на три реестра, enum-статусом и CHECK `duration_minutes > 0`; индексы созданы по дате, статусу, животному и волонтёру.
- `procedure_executions`: единственный фактический результат процедуры с датой, временем и `created_at`; UNIQUE по `care_procedure_id` исключает повторное выполнение.

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
| GET | `/api/v1/volunteers` | Список, параметры `search`, `status`, `limit` (1–100), `offset` |
| GET | `/api/v1/volunteers/active` | Только активные волонтёры для будущего планирования |
| GET | `/api/v1/volunteers/summary` | Количество всех, активных и неактивных для главной панели |
| GET | `/api/v1/volunteers/{id}` | Карточка волонтёра |
| POST | `/api/v1/volunteers` | Создание активного волонтёра, ответ 201 |
| PATCH | `/api/v1/volunteers/{id}` | Частичное редактирование контактов и примечания |
| POST | `/api/v1/volunteers/{id}/deactivate` | Деактивация без удаления |
| POST | `/api/v1/volunteers/{id}/activate` | Повторная активация |
| GET | `/api/v1/care-procedure-types` | Seed-справочник типов процедур |
| GET | `/api/v1/care-procedures` | Список; фильтры `status`, три FK, `date_from`, `date_to`, `limit`, `offset` |
| GET | `/api/v1/care-procedures/summary` | Планы на сегодня и выполнения с сегодняшней фактической датой |
| GET | `/api/v1/care-procedures/{id}` | Карточка процедуры со вложенными данными для интерфейса |
| POST | `/api/v1/care-procedures` | Создание назначения, ответ 201 |
| PATCH | `/api/v1/care-procedures/{id}` | Частичное редактирование с повторной проверкой связей |
| GET | `/api/v1/care-procedures/{id}/execution` | Фактический результат; 404, если выполнения нет |
| POST | `/api/v1/care-procedures/{id}/execute` | Транзакционно создать выполнение и установить `completed` |
| PATCH | `/api/v1/care-procedures/{id}/execution` | Уточнить фактические дату, время, результат или комментарий |

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

Браузерные тесты сами запускают Vite на `127.0.0.1:5174`. Используют тестовые ответы API и не создают записей в рабочей базе; проверяют основные модули, формы, фильтры, выполнение процедур, ошибки сервера и мобильную ширину. Реальную серверную логику и БД проверяет pytest. Скриншоты/трассы сохраняются в игнорируемом `frontend/test-results/`.

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
    models/volunteer.py
    schemas/volunteer.py
    repositories/volunteer.py
    services/volunteer.py
    api/routes/volunteers.py
    seed.py
  migrations/versions/0001_animal_registry.py
  migrations/versions/0002_volunteers.py
  migrations/versions/0003_volunteer_duplicate_key.py
  migrations/versions/0004_care_procedures.py
  migrations/versions/0005_procedure_executions.py
  tests/{conftest,test_animals,test_volunteers,test_care_procedures,test_procedure_executions}.py
  pytest.ini
  requirements-dev.txt
frontend/
  src/
    api/{animals,dictionaries}.ts
    api/volunteers.ts
    api/{careProcedures,careProcedureTypes}.ts
    api/procedureExecutions.ts
    types/animal.ts
    types/volunteer.ts
    types/careProcedure.ts
    types/procedureExecution.ts
    pages/AnimalsPage/{AnimalsPage.tsx,AnimalsPage.scss}
    components/
      AnimalForm/{AnimalForm.tsx,AnimalForm.scss,validation.ts}
      AnimalsTable/{AnimalsTable.tsx,AnimalsTable.scss}
      VolunteerForm/{VolunteerForm.tsx,VolunteerForm.scss,validation.ts}
      VolunteersTable/{VolunteersTable.tsx,VolunteersTable.scss}
      FormField/{FormField.tsx,FormField.scss}
      CareProcedureForm/{CareProcedureForm.tsx,CareProcedureForm.scss}
      CareProceduresTable/{CareProceduresTable.tsx,CareProceduresTable.scss}
      ProcedureExecutionForm/{ProcedureExecutionForm.tsx,ProcedureExecutionForm.scss}
      ProcedureExecutionResult/{ProcedureExecutionResult.tsx,ProcedureExecutionResult.scss}
  tests/{animals,volunteers,procedures}.spec.ts
  playwright.config.ts
```

Кроме новых файлов изменены: `backend/app/api/router.py` (подключение маршрутов), `backend/app/main.py` (обработчик доменных ошибок), `backend/app/models/__init__.py` (экспорт моделей), `backend/migrations/env.py` и `backend/alembic.ini` (поддержка тестовой миграции); `frontend/src/main.tsx`, `app/App.tsx`, `components/Header/Header.tsx` и `Header.scss` (клиентская навигация), `api/client.ts` (общие запросы и ошибки), `styles/globals.scss` (фокус и страница 404), `frontend/package.json` и `package-lock.json` (зависимости/команды), `.gitignore` и этот README.

SQL остаётся в repositories, бизнес-проверки и транзакции — в service, HTTP-коды и сериализация — в API. [Документация SQLAlchemy по транзакциям и тестовым сессиям](https://docs.sqlalchemy.org/en/20/orm/session_transaction.html) и [клиентская маршрутизация React Router](https://reactrouter.com/start/declarative/routing).
