# LOSTVAYNE-LOQ: Image Server v2.0

Це самостійна комерційна розробка сервісу для завантаження, зберігання та керування зображеннями. Проект базується на архітектурі Python (бекенд) + Nginx (проксі/статика) + PostgreSQL (БД).

## Основний функціонал
- Завантаження зображень з валідацією типів та розміру.
- Зберігання метаданих у PostgreSQL.
- Пагінація списку зображень (API).
- Функціонал видалення зображень через POST-запити.
- Автоматизоване резервне копіювання бази даних.

## Як запустити
Для запуску проекту переконайтеся, що встановлено Docker та Docker Compose:

1. Склонуйте репозиторій.
2. Запустіть сервіси:
   docker compose up -d --build

3. Доступ до API:
   http://localhost/api/images

## Резервне копіювання
Створення бекапу бази даних:
docker compose exec -T postgres pg_dump -U postgres images_db > backups/backup_test.sql

Відновлення бази даних:
docker exec -i postgres psql -U postgres images_db < backups/backup_test.sql