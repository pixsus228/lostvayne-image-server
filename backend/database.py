from __future__ import annotations
from contextlib import contextmanager
import psycopg
from psycopg.rows import dict_row
from config import settings

class ImageRepository:
    
    @contextmanager
    def _cursor(self, dict_rows: bool = False):
        with psycopg.connect(
            host=settings.db_host,
            port=settings.db_port,
            dbname=settings.db_name,
            user=settings.db_user,
            password=settings.db_password, 
        ) as conn:
            kwargs = {"row_factory": dict_row} if dict_rows else {}
            with conn.cursor(**kwargs) as cur:
                yield cur
    
    def create(self, filename: str, original_name: str, size: int, file_type: str, file_hash: str = None) -> int:
        """додав збереження file_hash для уникнення дублікатів"""
        with self._cursor() as cur:
            cur.execute(
                """
                INSERT INTO images (filename, original_name, size, file_type, file_hash)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
                """,
                (filename, original_name, size, file_type, file_hash),
            )
            image_id = cur.fetchone()[0]
            return image_id
        
    def list(self, page: int = 1, limit: int = 10, direction: str = 'desc') -> list[dict]:
        """оновив фільтрацію, щоб не виводити м'яко видалені файли"""
        with self._cursor(dict_rows=True) as cur:
            offset = (page - 1) * limit
            order = 'DESC' if direction.lower() == 'desc' else 'ASC'
            query = f'SELECT id, filename, original_name, size, file_type, upload_time, views FROM images WHERE deleted_at IS NULL ORDER BY upload_time ' + order + ' LIMIT %s OFFSET %s'
            cur.execute(query, (limit, offset))
            return cur.fetchall()

    def get_by_id(self, image_id: int):
        with self._cursor(dict_rows=True) as cur:
            cur.execute("SELECT * FROM images WHERE id = %s AND deleted_at IS NULL", (image_id,))
            return cur.fetchone()

    def delete_by_id(self, image_id: int):
        """метод залишив для повної сумісності, але тепер використовуємо soft delete за назвою файлу"""
        with self._cursor() as cur:
            cur.execute("SELECT filename FROM images WHERE id = %s", (image_id,))
            row = cur.fetchone()
            if row:
                cur.execute("DELETE FROM images WHERE id = %s", (image_id,))
                return row[0]
            return None

    # --- СТАТИСТИКА ---
    
    def get_stats(self) -> list[dict]:
        """отримання загальної статистики хостингу за типами файлів"""
        with self._cursor(dict_rows=True) as cur:
            cur.execute(
                """
                SELECT COUNT(*) as total_files, SUM(size) as total_size, file_type 
                FROM images 
                WHERE deleted_at IS NULL 
                GROUP BY file_type
                """
            )
            return cur.fetchall()

    def get_image_stats(self, filename: str):
        """отримання статистики конкретного зображення за назвою файлу"""
        with self._cursor(dict_rows=True) as cur:
            cur.execute(
                "SELECT views, upload_time, size, original_name FROM images WHERE filename = %s", 
                (filename,)
            )
            return cur.fetchone()

    # --- ПЕРЕГЛЯДИ / ЛІЧИЛЬНИКИ ---

    def increment_views(self, filename: str):
        """інкрементування лічильника переглядів зображення"""
        with self._cursor() as cur:
            cur.execute(
                "UPDATE images SET views = views + 1 WHERE filename = %s",
                (filename,)
            )

    def get_popular(self, limit: int = 10) -> list[dict]:
        """отримання списку найпопулярніших зображень за кількістю переглядів"""
        with self._cursor(dict_rows=True) as cur:
            cur.execute(
                "SELECT * FROM images WHERE deleted_at IS NULL ORDER BY views DESC LIMIT %s",
                (limit,)
            )
            return cur.fetchall()

    # --- ПОШУК І ФІЛЬТРАЦІЯ ---

    def search_images(self, filters: dict, page: int = 1, limit: int = 10, direction: str = 'desc') -> list[dict]:
        """динамічний пошук зображень за фільтрами"""
        with self._cursor(dict_rows=True) as cur:
            conditions = ["deleted_at IS NULL"]
            params = []
            
            if filters.get('search'):
                conditions.append("original_name ILIKE %s")
                params.append(f"%{filters['search']}%")
                
            if filters.get('file_type'):
                conditions.append("file_type = %s")
                params.append(filters['file_type'])
                
            if filters.get('date_from'):
                conditions.append("upload_time >= %s")
                params.append(filters['date_from'])
                
            if filters.get('date_to'):
                conditions.append("upload_time <= %s")
                params.append(filters['date_to'])
                
            where_clause = " AND ".join(conditions)
            order = 'DESC' if direction.lower() == 'desc' else 'ASC'
            offset = (page - 1) * limit
            
            query = f"SELECT * FROM images WHERE {where_clause} ORDER BY upload_time {order} LIMIT %s OFFSET %s"
            params.extend([limit, offset])
            
            cur.execute(query, params)
            return cur.fetchall()

    def count_images(self, filters: dict) -> int:
        """підрахунок кількості знайдених зображень за фільтрами для пагінації"""
        with self._cursor() as cur:
            conditions = ["deleted_at IS NULL"]
            params = []
            
            if filters.get('search'):
                conditions.append("original_name ILIKE %s")
                params.append(f"%{filters['search']}%")
                
            if filters.get('file_type'):
                conditions.append("file_type = %s")
                params.append(filters['file_type'])
                
            if filters.get('date_from'):
                conditions.append("upload_time >= %s")
                params.append(filters['date_from'])
                
            if filters.get('date_to'):
                conditions.append("upload_time <= %s")
                params.append(filters['date_to'])
                
            where_clause = " AND ".join(conditions)
            query = f"SELECT COUNT(*) FROM images WHERE {where_clause}"
            
            cur.execute(query, params)
            return cur.fetchone()[0]

    # --- SOFT DELETE + КОШИК ---

    def soft_delete(self, filename: str) -> bool:
        """м'яке видалення зображення (перенесення в кошик)"""
        with self._cursor() as cur:
            cur.execute(
                "UPDATE images SET deleted_at = NOW() WHERE filename = %s AND deleted_at IS NULL RETURNING id",
                (filename,)
            )
            return cur.fetchone() is not None

    def get_deleted(self, page: int = 1, limit: int = 10) -> list[dict]:
        """отримання списку видалених зображень з кошика"""
        with self._cursor(dict_rows=True) as cur:
            offset = (page - 1) * limit
            cur.execute(
                "SELECT * FROM images WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT %s OFFSET %s",
                (limit, offset)
            )
            return cur.fetchall()

    def restore(self, filename: str) -> bool:
        """відновлення зображення з кошика"""
        with self._cursor() as cur:
            cur.execute(
                "UPDATE images SET deleted_at = NULL WHERE filename = %s AND deleted_at IS NOT NULL RETURNING id",
                (filename,)
            )
            return cur.fetchone() is not None

    def purge_deleted(self) -> list[str]:
        """остаточне очищення кошика, повертає список імен файлів для видалення з диска"""
        with self._cursor() as cur:
            cur.execute(
                "DELETE FROM images WHERE deleted_at IS NOT NULL RETURNING filename"
            )
            return [row[0] for row in cur.fetchall()]

    # --- ДУБЛІКАТИ ПО ХЕШУ ---

    def find_by_hash(self, file_hash: str):
        """пошук зображення за його SHA-256 хешем для запобігання дублікатів"""
        with self._cursor(dict_rows=True) as cur:
            cur.execute("SELECT * FROM images WHERE file_hash = %s AND deleted_at IS NULL", (file_hash,))
            return cur.fetchone()
