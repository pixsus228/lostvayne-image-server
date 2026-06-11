import os
import json
import cgi
import hashlib
from urllib.parse import urlparse, parse_qs
from datetime import datetime
from utils.encoders import AppJSONEncoder
from utils.validators import validate_image
from logger import logger
from database import ImageRepository

# ініціалізував репозиторій для роботи з базою даних
repo = ImageRepository()

def handle_get_stats(server):
    """загальна статистика хостингу за типами файлів"""
    server.send_response(200)
    server.send_header('Content-Type', 'application/json')
    server.end_headers()
    stats = repo.get_stats()
    server.wfile.write(json.dumps(stats, cls=AppJSONEncoder).encode('utf-8'))

def handle_get_trash(server, query_params):
    """список видалених зображень із кошика з пагінацією"""
    page = int(query_params.get('page', [1])[0])
    limit = int(query_params.get('limit', [10])[0])
    server.send_response(200)
    server.send_header('Content-Type', 'application/json')
    server.end_headers()
    deleted_images = repo.get_deleted(page, limit)
    server.wfile.write(json.dumps(deleted_images, cls=AppJSONEncoder).encode('utf-8'))

def handle_get_popular(server, query_params):
    """список найпопулярніших зображень за переглядами"""
    limit = int(query_params.get('limit', [10])[0])
    server.send_response(200)
    server.send_header('Content-Type', 'application/json')
    server.end_headers()
    popular = repo.get_popular(limit)
    server.wfile.write(json.dumps(popular, cls=AppJSONEncoder).encode('utf-8'))

def handle_get_images_count(server, filters):
    """кількість знайдених зображень за фільтрами для пагінації"""
    server.send_response(200)
    server.send_header('Content-Type', 'application/json')
    server.end_headers()
    count = repo.count_images(filters)
    server.wfile.write(json.dumps({"count": count}).encode('utf-8'))

def handle_get_image_stats(server, filename):
    """статистика конкретного зображення за його назвою"""
    stats = repo.get_image_stats(filename)
    if stats:
        server.send_response(200)
        server.send_header('Content-Type', 'application/json')
        server.end_headers()
        server.wfile.write(json.dumps(stats, cls=AppJSONEncoder).encode('utf-8'))
    else:
        server.send_response(404)
        server.end_headers()

def handle_get_single_image(server, filename):
    """отримання зображення з автоматичним інкрементом переглядів"""
    repo.increment_views(filename) # збільшив лічильник переглядів у базі
    stats = repo.get_image_stats(filename)
    if stats:
        server.send_response(200)
        server.send_header('Content-Type', 'application/json')
        server.end_headers()
        server.wfile.write(json.dumps(stats, cls=AppJSONEncoder).encode('utf-8'))
    else:
        server.send_response(404)
        server.end_headers()

def handle_search_images(server, filters, page, limit):
    """динамічний пошук та фільтрація списку зображень"""
    server.send_response(200)
    server.send_header('Content-Type', 'application/json')
    server.end_headers()
    images = repo.search_images(filters, page, limit)
    server.wfile.write(json.dumps(images, cls=AppJSONEncoder).encode('utf-8'))

def handle_upload_image(server):
    """завантаження файлу з гнучким парсингом типу контенту"""
    try:
        content_type = server.headers.get('Content-Type', '')
        
        # розділив обробку форми та прямого бінарного потоку
        if 'multipart/form-data' in content_type:
            form = cgi.FieldStorage(
                fp=server.rfile,
                headers=server.headers,
                environ={'REQUEST_METHOD': 'POST', 'CONTENT_TYPE': content_type}
            )
            file_item = None
            for key in ['file', 'image']:
                if key in form:
                    file_item = form[key]
                    break
            if file_item is not None and file_item.file:
                file_data = file_item.file.read()
                orig_name = file_item.filename
            else:
                server.send_response(400)
                server.end_headers()
                return
        else:
            # зчитав файл напряму з потоку для термінальних запитів
            content_length = int(server.headers.get('content-length', 0))
            file_data = server.rfile.read(content_length)
            orig_name = server.headers.get('X-File-Name', 'image.png')

        if not file_data:
            server.send_response(400)
            server.end_headers()
            server.wfile.write(b"Empty file data")
            return

        # порахував унікальний SHA-256 хеш файлу
        file_hash = hashlib.sha256(file_data).hexdigest()
        
        # перевірив наявність дубліката в базі
        duplicate = repo.find_by_hash(file_hash)
        if duplicate:
            server.send_response(200)
            server.send_header('Content-Type', 'application/json')
            server.end_headers()
            res = {"message": "Файл вже існує (дублікат)", "image": duplicate}
            server.wfile.write(json.dumps(res, cls=AppJSONEncoder).encode('utf-8'))
            return

        file_ext = os.path.splitext(orig_name)[1].lower()
        if not file_ext:
            file_ext = '.png'

        # узгодив виклик із параметрами валідатора (file_size, filename)
        if not validate_image(len(file_data), orig_name):
            server.send_response(400)
            server.end_headers()
            server.wfile.write(b"Invalid file format or size")
            return

        filename = f"{int(datetime.utcnow().timestamp())}{file_ext}"
        os.makedirs('uploads', exist_ok=True)
        with open(os.path.join('uploads', filename), 'wb') as f:
            f.write(file_data)

        img_id = repo.create(filename, orig_name, len(file_data), file_ext, file_hash)
        
        server.send_response(201)
        server.send_header('Content-Type', 'application/json')
        server.end_headers()
        server.wfile.write(json.dumps({"id": img_id, "filename": filename}, cls=AppJSONEncoder).encode('utf-8'))
    except Exception as e:
        logger.error(f"Error uploading image: {e}")
        server.send_response(500)
        server.end_headers()

def handle_restore_image(server, filename):
    """відновлення файлу з кошика (Soft delete)"""
    if repo.restore(filename):
        server.send_response(200)
        server.send_header('Content-Type', 'application/json')
        server.end_headers()
        server.wfile.write(json.dumps({"message": "Зображення відновлено"}).encode('utf-8'))
    else:
        server.send_response(404)
        server.end_headers()

def handle_soft_delete(server, filename):
    """м'яке видалення файлу (перенесення в кошик)"""
    if repo.soft_delete(filename):
        server.send_response(200)
        server.send_header('Content-Type', 'application/json')
        server.end_headers()
        server.wfile.write(json.dumps({"message": "Зображення перенесено в кошик"}).encode('utf-8'))
    else:
        server.send_response(404)
        server.end_headers()

def handle_purge_trash(server):
    """остаточне очищення кошика з видаленням файлів з диска"""
    try:
        filenames = repo.purge_deleted()
        for fname in filenames:
            fpath = os.path.join('uploads', fname)
            if os.path.exists(fpath):
                os.remove(fpath)
        server.send_response(200)
        server.send_header('Content-Type', 'application/json')
        server.end_headers()
        server.wfile.write(json.dumps({"message": "Кошик очищено", "purged": filenames}).encode('utf-8'))
    except Exception as e:
        logger.error(f"Error purging trash: {e}")
        server.send_response(500)
        server.end_headers()