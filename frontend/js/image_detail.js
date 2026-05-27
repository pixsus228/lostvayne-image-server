/**
 * Image detail page logic
 * - Load image details from API
 * - Display image information
 * - Handle actions (copy, download, delete)
 * - Fullscreen modal functionality
 */
(() => {
    /* --------------------------------------------------------------------
     *  CONSTANTS
     * ------------------------------------------------------------------ */
    const API_DELETE_URL = (fn) => `${location.origin}/api/images/${encodeURIComponent(fn)}`;
    const API_DETAIL_URL = (fn) => `${location.origin}/api/images/${encodeURIComponent(fn)}`;

    const SEL = {
        loadingContainer: '#loadingContainer',
        errorContainer: '#errorContainer',
        mainContent: '#mainContent',
        imagePreview: '#imagePreview',
        fullscreenBtn: '#fullscreenBtn',
        fullscreenModal: '#fullscreenModal',
        fullscreenImage: '#fullscreenImage',
        fullscreenClose: '#fullscreenClose',

        // Info elements
        infoFilename: '#infoFilename',
        infoOriginalName: '#infoOriginalName',
        infoFileSize: '#infoFileSize',
        infoFileType: '#infoFileType',
        infoUploadDate: '#infoUploadDate',
        infoId: '#infoId',

        // Action buttons
        copyUrlBtn: '#copyUrlBtn',
        downloadBtn: '#downloadBtn',
        deleteBtn: '#deleteBtn',
        directUrl: '#directUrl',
        urlCopyBtn: '#urlCopyBtn'
    };

    const $ = (s) => document.querySelector(s);
    const $$ = (s) => document.querySelectorAll(s);

    let currentImageData = null;
    let currentFilename = null;

    console.log('[INIT] Image detail script started, location:', location.href);

    /**
     * Get URL search parameter value
     * @param {string} paramName - Parameter name to get
     * @returns {string|null} Parameter value or null if not found
     */
    const getUrlParam = (paramName) => {
        const urlParams = new URLSearchParams(window.location.search);
        const value = urlParams.get(paramName);
        console.log(`[getUrlParam] ${paramName} = ${value}`);
        return value;
    };

    /**
     * Perform API request with Axios
     * @param {'get'|'post'|'delete'} method - HTTP method
     * @param {string} url - API endpoint URL
     * @param {*} [data] - Request body data
     * @param {object} [cfg={}] - Axios config
     * @returns {Promise<any>}
     */
    const api = async (method, url, data, cfg = {}) => {
        console.log(`[API] ${method.toUpperCase()} request to:`, url);
        try {
            const response = await axios({method, url, data, ...cfg});
            console.log(`[API] ${method.toUpperCase()} response:`, response.data);
            return response;
        } catch (e) {
            console.error(`[API] ${method.toUpperCase()} error:`, e);
            const error = {
                status: e.response?.status ?? null,
                message: e.response?.data?.detail || e.message || 'Unknown error',
            };
            throw error;
        }
    };

    /**
     * Copy text to clipboard and show feedback
     * @param {string} text - Text to copy
     * @param {HTMLElement} button - Button to show feedback on
     * @param {string} originalText - Button's original text to restore
     */
    const copyToClipboard = async (text, button, originalText) => {
        console.log('[copyToClipboard] Copying text to clipboard:', text.substring(0, 50) + '...');
        try {
            await navigator.clipboard.writeText(text);

            if (button.querySelector('span')) {
                button.querySelector('span').textContent = 'Copied!';
                setTimeout(() => {
                    button.querySelector('span').textContent = originalText;
                }, 1500);
            } else {
                button.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => {
                    button.innerHTML = '<i class="fas fa-copy"></i>';
                }, 1500);
            }

            console.log('[copyToClipboard] Successfully copied to clipboard');
        } catch (e) {
            console.error('[copyToClipboard] Failed to copy to clipboard:', e);
        }
    };

    /**
     * Format file size in human-readable format
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted file size
     */
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    /**
     * Format upload date in human-readable format
     * @param {string} dateString - ISO date string
     * @returns {string} Formatted date
     */
    const formatUploadDate = (dateString) => {
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffTime = Math.abs(now - date);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            const dateOptions = {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            };

            const formattedDate = date.toLocaleDateString('en-US', dateOptions);

            if (diffDays === 1) {
                return `${formattedDate} (Today)`;
            } else if (diffDays === 2) {
                return `${formattedDate} (Yesterday)`;
            } else if (diffDays <= 7) {
                return `${formattedDate} (${diffDays - 1} days ago)`;
            } else {
                return formattedDate;
            }
        } catch (e) {
            console.error('[formatUploadDate] Error formatting date:', e);
            return dateString;
        }
    };

    /**
     * Show error state
     * @param {string} message - Error message to display
     */
    const showError = (message = 'The requested image could not be found or has been deleted.') => {
        console.log('[showError] Showing error:', message);

        $(SEL.loadingContainer).classList.add('hidden');
        $(SEL.mainContent).classList.add('hidden');
        $(SEL.errorContainer).classList.remove('hidden');

        const errorMessageEl = $(SEL.errorContainer).querySelector('.error-message');
        if (errorMessageEl) {
            errorMessageEl.textContent = message;
        }
    };

    /**
     * Show main content with image data
     */
    const showMainContent = () => {
        console.log('[showMainContent] Showing main content');

        $(SEL.loadingContainer).classList.add('hidden');
        $(SEL.errorContainer).classList.add('hidden');
        $(SEL.mainContent).classList.remove('hidden');
    };

    /**
     * Update image information in the UI
     * @param {object} imageData - Image data from API
     */
    const updateImageInfo = (imageData) => {
        console.log('[updateImageInfo] Updating UI with image data:', imageData);

        const imageUrl = `${location.origin}${imageData.url || '/images/' + imageData.filename}`;

        $(SEL.imagePreview).src = imageUrl;
        $(SEL.imagePreview).alt = imageData.original_name || imageData.filename;

        $(SEL.fullscreenImage).src = imageUrl;
        $(SEL.fullscreenImage).alt = imageData.original_name || imageData.filename;

        $(SEL.infoFilename).textContent = imageData.filename || '-';
        $(SEL.infoOriginalName).textContent = imageData.original_name || '-';
        $(SEL.infoFileSize).textContent = imageData.size ? formatFileSize(imageData.size) : '-';
        $(SEL.infoFileType).textContent = imageData.file_type || '-';
        $(SEL.infoUploadDate).textContent = imageData.upload_time ? formatUploadDate(imageData.upload_time) : '-';
        $(SEL.infoId).textContent = imageData.id ? `#${imageData.id}` : '-';

        $(SEL.directUrl).value = imageUrl;

        document.title = `${imageData.original_name || imageData.filename} - Image Details`;
    };

    /**
     * Load image details from API
     * @param {string} filename - Filename to load details for
     */
    const loadImageDetails = async (filename) => {
        console.log('[loadImageDetails] Loading details for filename:', filename);

        try {
            const response = await api('get', API_DETAIL_URL(filename));
            const imageData = response.data;

            console.log('[loadImageDetails] Loaded image data:', imageData);

            currentImageData = imageData;
            updateImageInfo(imageData);
            showMainContent();

        } catch (e) {
            console.error('[loadImageDetails] Error loading image details:', e);

            if (e.status === 404) {
                showError('The requested image could not be found or has been deleted.');
            } else {
                showError(`Error loading image details: ${e.message}`);
            }
        }
    };

    /**
     * Handle image deletion
     */
    const handleDelete = async () => {
        if (!currentImageData || !currentFilename) {
            console.error('[handleDelete] No current image data or filename');
            return;
        }

        const confirmMessage = `Are you sure you want to delete "${currentImageData.original_name || currentFilename}"?\n\nThis action cannot be undone.`;

        if (!confirm(confirmMessage)) {
            console.log('[handleDelete] Delete cancelled by user');
            return;
        }

        console.log('[handleDelete] Attempting to delete:', currentFilename);

        try {
            const deleteBtn = $(SEL.deleteBtn);
            const originalText = deleteBtn.querySelector('span').textContent;
            deleteBtn.disabled = true;
            deleteBtn.querySelector('span').textContent = 'Deleting...';

            await api('delete', API_DELETE_URL(currentFilename));

            console.log('[handleDelete] Delete successful, redirecting to gallery');

            window.location.href = 'upload.html?tab=images&deleted=1';

        } catch (e) {
            console.error('[handleDelete] Delete failed:', e);

            const deleteBtn = $(SEL.deleteBtn);
            deleteBtn.disabled = false;
            deleteBtn.querySelector('span').textContent = 'Delete';

            alert(`Delete failed: ${e.message}`);
        }
    };

    /**
     * Handle image download
     */
    const handleDownload = () => {
        if (!currentImageData) {
            console.error('[handleDownload] No current image data');
            return;
        }

        console.log('[handleDownload] Starting download for:', currentImageData.filename);

        const imageUrl = `${location.origin}${currentImageData.url || '/images/' + currentImageData.filename}`;
        const filename = currentImageData.original_name || currentImageData.filename;

        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = filename;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log('[handleDownload] Download triggered');
    };

    /**
     * Initialize fullscreen modal functionality
     */
    const initFullscreenModal = () => {
        console.log('[initFullscreenModal] Initializing fullscreen modal');

        const fullscreenBtn = $(SEL.fullscreenBtn);
        const fullscreenModal = $(SEL.fullscreenModal);
        const fullscreenClose = $(SEL.fullscreenClose);

        if (!fullscreenBtn || !fullscreenModal || !fullscreenClose) {
            console.error('[initFullscreenModal] Missing required elements');
            return;
        }

        fullscreenBtn.addEventListener('click', () => {
            console.log('[initFullscreenModal] Opening fullscreen modal');
            fullscreenModal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        });

        const closeModal = () => {
            console.log('[initFullscreenModal] Closing fullscreen modal');
            fullscreenModal.classList.add('hidden');
            document.body.style.overflow = '';
        };

        fullscreenClose.addEventListener('click', closeModal);

        fullscreenModal.addEventListener('click', (e) => {
            if (e.target === fullscreenModal) {
                closeModal();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !fullscreenModal.classList.contains('hidden')) {
                closeModal();
            }
        });

        console.log('[initFullscreenModal] Fullscreen modal initialized');
    };

    /**
     * Initialize action buttons
     */
    const initActionButtons = () => {
        console.log('[initActionButtons] Initializing action buttons');

        const copyUrlBtn = $(SEL.copyUrlBtn);
        const downloadBtn = $(SEL.downloadBtn);
        const deleteBtn = $(SEL.deleteBtn);
        const directUrl = $(SEL.directUrl);
        const urlCopyBtn = $(SEL.urlCopyBtn);

        if (copyUrlBtn) {
            copyUrlBtn.addEventListener('click', () => {
                if (!currentImageData) return;
                const imageUrl = `${location.origin}${currentImageData.url || '/images/' + currentImageData.filename}`;
                copyToClipboard(imageUrl, copyUrlBtn, 'Copy URL');
            });
        }

        if (downloadBtn) {
            downloadBtn.addEventListener('click', handleDownload);
        }

        if (deleteBtn) {
            deleteBtn.addEventListener('click', handleDelete);
        }

        if (urlCopyBtn && directUrl) {
            urlCopyBtn.addEventListener('click', () => {
                copyToClipboard(directUrl.value, urlCopyBtn, '');
            });
        }

        console.log('[initActionButtons] Action buttons initialized');
    };

    /**
     * Initialize the image detail page
     */
    const initImageDetailPage = () => {
        console.log('[initImageDetailPage] Starting initialization');

        currentFilename = getUrlParam('filename');

        if (!currentFilename) {
            console.error('[initImageDetailPage] No filename parameter found in URL');
            showError('No image specified. Please provide a valid filename parameter.');
            return;
        }

        console.log('[initImageDetailPage] Loading details for filename:', currentFilename);

        initFullscreenModal();
        initActionButtons();

        loadImageDetails(currentFilename);

        console.log('[initImageDetailPage] Initialization complete');
    };

    document.addEventListener('DOMContentLoaded', () => {
        console.log('[DOMContentLoaded] Starting image detail page initialization');
        initImageDetailPage();
    });
})();
