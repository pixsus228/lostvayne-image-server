from utils.validators import validate_image
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
from utils.encoders import AppJSONEncoder
from logger import logger
from database import ImageRepository

class ImageAPIServer(BaseHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self.repo = ImageRepository()
        super().__init__(*args, **kwargs)

    def do_GET(self):
        logger.info(f'Received GET request for {self.path}')
        if '/images' in self.path:
            self.handle_images()
        else:
            self.send_response(404)
            self.end_headers()

    def handle_images(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        images = self.repo.list()
        self.wfile.write(json.dumps(images, cls=AppJSONEncoder).encode('utf-8'))

    def do_POST(self):
        if self.path.startswith('/api/upload/'):
            self.handle_upload()
        elif self.path.startswith('/api/delete/'):
            try:
                image_id = int(self.path.split('/')[-1])
                filename = self.repo.delete_by_id(image_id)
                if filename:
                    import os
                    file_path = os.path.join('uploads', filename)
                    if os.path.exists(file_path):
                        os.remove(file_path)
                    self.send_response(204)
                else:
                    self.send_response(404)
            except Exception as e:
                logger.error(f"Error deleting image: {e}")
                self.send_response(500)
            self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()


if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8000), ImageAPIServer)
    logger.info('Server started on port 8000')
    server.serve_forever()

