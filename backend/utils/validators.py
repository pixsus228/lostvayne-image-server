import os
from config import settings

def validate_image(file_size, filename):
    # Ліміт 5 МБ
    if file_size > settings.max_file_size_mb * 1024 * 1024:
        raise ValueError("Файл перевищує ліміт 5 МБ")
    
    # Дозволені формати
    ext = os.path.splitext(filename)[1].lower()
    if ext not in settings.allowed_file_types:
        raise ValueError(f"Формат {ext} не підтримується")
    return True
