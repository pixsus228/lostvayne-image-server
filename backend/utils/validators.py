import os
from config import settings
from logger import logger

def validate_image(file_size, filename):
    size = len(file_size) if isinstance(file_size, (bytes, bytearray)) else file_size
    ext = os.path.splitext(filename)[1].lower()
    
    logger.info(f"DEBUG: filename={filename}, ext={ext}, allowed={settings.allowed_file_types}")
    
    if size < 4: return False
    if size > settings.max_file_size_mb * 1024 * 1024: return False

    # перевіряємо, чи збігається розширення з будь-яким елементом списку (якщо він містить частину імені або MIME)
    # наприклад, якщо в списку "png" або "image/png", ми знайдемо збіг для ".png"
    is_valid = any(t.lower() in ext or ext.lstrip('.') in t.lower() for t in settings.allowed_file_types)
    
    if not is_valid:
        logger.error(f"Валідація провалена: {ext} не підходить до {settings.allowed_file_types}")
        return False
        
    return True