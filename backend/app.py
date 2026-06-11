from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from logger import logger
from handlers import (
    handle_get_stats, handle_get_trash, handle_get_popular,
    handle_get_images_count, handle_get_image_stats, handle_get_single_image,
    handle_search_images, handle_upload_image, handle_restore_image,
    handle_soft_delete, handle_purge_trash
)

class ImageAPIServer(BaseHTTPRequestHandler):

    def do_GET(self):
        logger.info(f'Received GET request for {self.path}')
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        query_params = parse_qs(parsed_url.query)

        filters = {
            'search': query_params.get('search', [None])[0],
            'file_type': query_params.get('file_type', [None])[0],
            'date_from': query_params.get('date_from', [None])[0],
            'date_to': query_params.get('date_to', [None])[0]
        }
        page = int(query_params.get('page', [1])[0])
        limit = int(query_params.get('limit', [10])[0])

        if path == '/api/stats':
            handle_get_stats(self)
        elif path == '/api/trash':
            handle_get_trash(self, query_params)
        elif path == '/api/images/popular':
            handle_get_popular(self, query_params)
        elif path == '/api/images/count':
            handle_get_images_count(self, filters)
        elif path.startswith('/api/images/'):
            parts = path.strip('/').split('/')
            # захистив індекси від виходу за межі масиву
            if len(parts) == 4 and parts[3] == 'stats':
                handle_get_image_stats(self, parts[2])
            elif len(parts) == 3 and parts[2]:
                handle_get_single_image(self, parts[2])
            else:
                self.send_response(404)
                self.end_headers()
        elif path == '/api/images' or path == '/images':
            handle_search_images(self, filters, page, limit)
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        logger.info(f'Received POST request for {self.path}')
        parsed_url = urlparse(self.path)
        path = parsed_url.path

        if path.startswith('/api/upload'):
            handle_upload_image(self)
        elif path.startswith('/api/images/') and path.endswith('/restore'):
            parts = path.strip('/').split('/')
            if len(parts) >= 3 and parts[2]:
                handle_restore_image(self, parts[2])
            else:
                self.send_response(400)
                self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def do_DELETE(self):
        logger.info(f'Received DELETE request for {self.path}')
        parsed_url = urlparse(self.path)
        path = parsed_url.path

        if path == '/api/trash':
            handle_purge_trash(self)
        elif path.startswith('/api/images/'):
            parts = path.strip('/').split('/')
            if len(parts) >= 3 and parts[2]:
                handle_soft_delete(self, parts[2])
            else:
                self.send_response(400)
                self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8000), ImageAPIServer)
    logger.info('Server started on port 8000')
    server.serve_forever()