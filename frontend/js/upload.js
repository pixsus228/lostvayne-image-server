/**
 * Image-host front-end logic
 * - Upload via button or drag-&-drop
 * - List uploaded images as cards with pagination
 * - Delete images
 */
(() => {
    /* --------------------------------------------------------------------
     *  CONSTANTS
     * ------------------------------------------------------------------ */
    const API_UPLOAD_URL = `http://localhost:8000/api/upload/`;
    const API_IMAGES_URL = `http://localhost:8000/api/images`;
    const API_DELETE_URL = (fn) => `${location.origin}/api/images/${encodeURIComponent(fn)}`;

    const LS_KEYS = {
        LIMIT: 'image_host_limit',
        ACTIVE_TAB: 'image_host_active_tab',
        SORT_ORDER: 'image_host_sort_order'
    };

    const DEFAULT_PAGE = 1;
    const DEFAULT_LIMIT = 10;
    const AVAILABLE_LIMITS = [10];
    const DEFAULT_TAB = 'upload';
    const DEFAULT_SORT_ORDER = 'desc';
    const VALID_TABS = ['upload', 'images'];
    const VALID_SORT_ORDERS = ['desc', 'asc'];

    const SEL = {
        uploadBtn: '#uploadBtn',
        fileInput: '#fileInput',
        resultInput: '#resultLink',
        copyBtn: '#copyBtn',
        uploadText: '.upload-main-text, .upload-error',
        dropArea: '#dropArea',
        imgSection: '#images-tab',
        uploadSection: '#upload-tab',
        imgTabBtn: '.tab[data-tab="images"]',
        uploadTabBtn: '.tab[data-tab="upload"]',
        allTabs: '.tab',
        allTabContent: '.tab-content',
        imageGallery: '.image-gallery',
        prevPageBtn: '#prevPage',
        nextPageBtn: '#nextPage',
        currentPageSpan: '#currentPage',
        totalPagesSpan: '#totalPages',
        limitSelect: '#limitSelect',
        sortSelect: '#sortSelect'
    };

    const $ = (s) => document.querySelector(s);
    const $$ = (s) => document.querySelectorAll(s);

    let loadImagesFunction = null;

    console.log('[INIT] Script started, location:', location.href);

    const getSavedLimit = () => {
        const saved = localStorage.getItem(LS_KEYS.LIMIT);
        if (saved && AVAILABLE_LIMITS.includes(parseInt(saved))) {
            return parseInt(saved);
        }
        return DEFAULT_LIMIT;
    };

    const saveLimit = (limit) => {
        console.log('[saveLimit] Saving limit to localStorage:', limit);
        localStorage.setItem(LS_KEYS.LIMIT, limit.toString());
    };

    const getSavedActiveTab = () => {
        const savedTab = localStorage.getItem(LS_KEYS.ACTIVE_TAB);
        console.log('[getSavedActiveTab] Retrieved from localStorage:', savedTab);
        return savedTab || DEFAULT_TAB;
    };

    const saveActiveTab = (tab) => {
        console.log('[saveActiveTab] Saving to localStorage:', tab);
        localStorage.setItem(LS_KEYS.ACTIVE_TAB, tab);
    };

    const getSavedSortOrder = () => {
        const saved = localStorage.getItem(LS_KEYS.SORT_ORDER);
        if (saved && VALID_SORT_ORDERS.includes(saved)) {
            return saved;
        }
        return DEFAULT_SORT_ORDER;
    };

    const saveSortOrder = (sortOrder) => {
        console.log('[saveSortOrder] Saving sortOrder to localStorage:', sortOrder);
        localStorage.setItem(LS_KEYS.SORT_ORDER, sortOrder);
    };

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
     * Update URL parameter without page reload
     * @param {string} paramName - Parameter name
     * @param {string} value - Parameter value
     */
    const updateUrlParam = (paramName, value) => {
        console.log(`[updateUrlParam] Setting ${paramName} = ${value}`);
        const url = new URL(window.location);
        url.searchParams.set(paramName, value);
        window.history.replaceState({}, '', url);
    };

    /**
     * Remove URL parameter without page reload
     * @param {string} paramName - Parameter name to remove
     */
    const removeUrlParam = (paramName) => {
        console.log(`[removeUrlParam] Removing ${paramName}`);
        const url = new URL(window.location);
        url.searchParams.delete(paramName);
        window.history.replaceState({}, '', url);
    };

    /**
     * Update pagination-related URL parameters
     * @param {number} page - Current page
     * @param {number} limit - Items per page
     * @param {string} order - Sort order
     */
    const updatePaginationUrlParams = (page, limit, order) => {
        console.log(`[updatePaginationUrlParams] page=${page}, limit=${limit}, order=${order}`);
        const url = new URL(window.location);
        url.searchParams.set('page', page.toString());
        url.searchParams.set('limit', limit.toString());
        url.searchParams.set('order', order);
        window.history.replaceState({}, '', url);
    };

    /**
     * Remove pagination-related URL parameters
     */
    const removePaginationUrlParams = () => {
        console.log('[removePaginationUrlParams] Removing pagination params');
        const url = new URL(window.location);
        url.searchParams.delete('page');
        url.searchParams.delete('limit');
        url.searchParams.delete('order');
        window.history.replaceState({}, '', url);
    };

    /**
     * Initialize pagination state from URL parameters
     */
    const initPaginationFromUrl = () => {
        console.log('[initPaginationFromUrl] Starting, current state:', paginationState);

        const urlPage = getUrlParam('page');
        const urlLimit = getUrlParam('limit');
        const urlOrder = getUrlParam('order');

        if (urlPage) {
            const pageNum = parseInt(urlPage);
            if (pageNum > 0) {
                paginationState.currentPage = pageNum;
                console.log('[initPaginationFromUrl] Set page from URL:', pageNum);
            }
        }

        if (urlLimit) {
            const limitNum = parseInt(urlLimit);
            if (AVAILABLE_LIMITS.includes(limitNum)) {
                paginationState.limit = limitNum;
                console.log('[initPaginationFromUrl] Set limit from URL:', limitNum);
            }
        }

        if (urlOrder && VALID_SORT_ORDERS.includes(urlOrder)) {
            paginationState.sortOrder = urlOrder;
            console.log('[initPaginationFromUrl] Set sortOrder from URL:', urlOrder);
        }

        console.log('[initPaginationFromUrl] Final state:', paginationState);
    };

    /**
     * Determine which tab should be active based on URL param, localStorage, or default
     * @returns {string} Tab ID to activate
     */
    const getTabToActivate = () => {
        const urlTab = getUrlParam('tab');
        if (urlTab && VALID_TABS.includes(urlTab)) {
            console.log('[getTabToActivate] Using tab from URL:', urlTab);
            return urlTab;
        }

        const savedTab = getSavedActiveTab();
        if (VALID_TABS.includes(savedTab)) {
            console.log('[getTabToActivate] Using tab from localStorage:', savedTab);
            return savedTab;
        }

        console.log('[getTabToActivate] Using default tab:', DEFAULT_TAB);
        return DEFAULT_TAB;
    };

    const paginationState = {
        currentPage: DEFAULT_PAGE,
        limit: getSavedLimit(),
        totalPages: 1,
        totalItems: 0,
        sortOrder: getSavedSortOrder()
    };

    console.log('[INIT] Initial pagination state:', paginationState);

    /**
     * Display status message in upload text area.
     * @param {HTMLElement} el - Element to display message in.
     * @param {string} msg - Message to show.
     * @param {boolean} [isErr=false] - Whether it's an error message.
     */
    const showStatus = (el, msg, isErr = false) => {
        console.log(`[showStatus] ${isErr ? 'ERROR' : 'INFO'}: ${msg}`);
        el.classList.toggle('upload-error', isErr);
        el.classList.toggle('upload-main-text', !isErr);
        el.textContent = msg;
    };

    /**
     * Perform API request with Axios.
     * @param {'get'|'post'|'delete'} method - HTTP method.
     * @param {string} url - API endpoint URL.
     * @param {*} [data] - Request body data.
     * @param {object} [cfg={}] - Axios config.
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

            if (method.toLowerCase() === 'get' && url.startsWith(API_IMAGES_URL) && error.status === 404) {
                console.log('[API] GET 404 - returning empty data');
                return {data: {items: [], pagination: {total: 0, pages: 0}}};
            }

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
            button.textContent = 'Copied!';
            setTimeout(() => (button.textContent = originalText), 1500);
            console.log('[copyToClipboard] Successfully copied to clipboard');
        } catch (e) {
            console.error('[copyToClipboard] Failed to copy to clipboard:', e);
        }
    };

    /**
     * Initialize tabs functionality with localStorage and URL parameter support
     */
    function initTabs() {
        console.log('[initTabs] Starting initialization');

        const tabs = $$(SEL.allTabs);
        const tabContents = $$(SEL.allTabContent);

        console.log('[initTabs] Found elements:', {
            tabs: tabs.length,
            tabContents: tabContents.length
        });

        if (!tabs.length || !tabContents.length) {
            console.error('[initTabs] No tabs or tab contents found!');
            return;
        }

        const activateTab = (tabId, updateUrl = true) => {
            console.log(`[activateTab] Activating tab: ${tabId}, updateUrl: ${updateUrl}`);

            tabContents.forEach(content => content.classList.add('hidden'));
            tabs.forEach(tab => {
                tab.classList.remove('active');
                tab.classList.add('inactive');
            });

            const targetContent = $(`#${tabId}-tab`);
            const targetTab = $(`.tab[data-tab="${tabId}"]`);

            console.log('[activateTab] Target elements:', {
                targetContent: !!targetContent,
                targetTab: !!targetTab
            });

            if (targetContent) targetContent.classList.remove('hidden');
            if (targetTab) {
                targetTab.classList.add('active');
                targetTab.classList.remove('inactive');
            }

            if (updateUrl) {
                updateUrlParam('tab', tabId);

                if (tabId === 'images') {
                    updatePaginationUrlParams(
                        paginationState.currentPage,
                        paginationState.limit,
                        paginationState.sortOrder
                    );
                } else {
                    removePaginationUrlParams();
                }
            }

            saveActiveTab(tabId);

            console.log(`[activateTab] Checking loadImages: tabId=${tabId}, loadImagesFunction=${!!loadImagesFunction}`);

            if (tabId === 'images' && loadImagesFunction) {
                console.log('[activateTab] Calling loadImagesFunction');
                loadImagesFunction();
            } else if (tabId === 'images') {
                console.warn('[activateTab] loadImagesFunction not available yet!');
            }
        };

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.getAttribute('data-tab');
                console.log('[initTabs] Tab clicked:', tabId);
                if (tabId && VALID_TABS.includes(tabId)) {
                    activateTab(tabId, true);
                }
            });
        });

        window.activateTabOnLoad = () => {
            console.log('[activateTabOnLoad] Starting tab activation on load');

            const tabToActivate = getTabToActivate();
            console.log('[activateTabOnLoad] Tab to activate:', tabToActivate);

            if (tabToActivate === 'images') {
                console.log('[activateTabOnLoad] Initializing pagination from URL');
                initPaginationFromUrl();
            }

            const hasTabInUrl = !!getUrlParam('tab');
            const shouldUpdateUrl = !hasTabInUrl;

            console.log('[activateTabOnLoad] URL update decision:', {
                hasTabInUrl,
                shouldUpdateUrl
            });

            activateTab(tabToActivate, shouldUpdateUrl);
        };

        console.log('[initTabs] Initialization complete');
    }

    /**
     * Initialize upload functionality.
     */
    function initUploader() {
        console.log('[initUploader] Starting initialization');

        const uploadBtn = $(SEL.uploadBtn);
        const fileInput = $(SEL.fileInput);
        const resultInput = $(SEL.resultInput);
        const copyBtn = $(SEL.copyBtn);
        const uploadText = $(SEL.uploadText);
        const dropArea = $(SEL.dropArea);

        console.log('[initUploader] Found elements:', {
            uploadBtn: !!uploadBtn,
            fileInput: !!fileInput,
            resultInput: !!resultInput,
            copyBtn: !!copyBtn,
            uploadText: !!uploadText,
            dropArea: !!dropArea
        });

        if (!uploadBtn || !fileInput || !resultInput || !copyBtn || !uploadText || !dropArea) {
            console.error('[initUploader] Missing required elements!');
            return;
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        const maxSize = 5 * 1024 * 1024;

        /**
         * Upload a single file to the server.
         * @param {File} file - File to upload.
         */
        const uploadFile = async (file) => {
            console.log('[uploadFile] Starting upload:', {
                name: file.name,
                type: file.type,
                size: file.size
            });

            if (!allowedTypes.includes(file.type)) {
                console.error('[uploadFile] Invalid file type:', file.type);
                showStatus(uploadText, `Upload failed: invalid file type. Allowed: ${allowedTypes.join(', ')}`, true);
                return;
            }

            if (file.size > maxSize) {
                console.error('[uploadFile] File too large:', file.size, 'max:', maxSize);
                showStatus(uploadText, `Upload failed: file too large (max ${maxSize / 1024 / 1024}MB)`, true);
                return;
            }

            try {
                showStatus(uploadText, 'Uploading...');
                const form = new FormData();
                form.append('file', file);
                const {data} = await api('post', API_UPLOAD_URL, form, {
                    headers: {'Content-Type': 'multipart/form-data'},
                });
                console.log('[uploadFile] Upload successful:', data);
                showStatus(uploadText, `File uploaded: ${data.filename}`);
                resultInput.value = `${location.origin}${data.url}`;
            } catch (e) {
                console.error('[uploadFile] Upload failed:', e);
                showStatus(uploadText, `Upload failed: ${e.message}`, true);
            }
        };

        uploadBtn.addEventListener('click', () => {
            console.log('[uploadBtn] Upload button clicked');
            fileInput.click();
        });

        fileInput.addEventListener('change', () => {
            const file = fileInput.files[0];
            console.log('[fileInput] File selected:', file?.name);
            if (file) uploadFile(file);
            fileInput.value = '';
        });

        copyBtn.addEventListener('click', () => {
            if (!resultInput.value) {
                console.log('[copyBtn] No URL to copy');
                return;
            }
            console.log('[copyBtn] Copy button clicked');
            copyToClipboard(resultInput.value, copyBtn, 'COPY');
        });

        const prevent = (e) => e.preventDefault();
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev =>
            dropArea.addEventListener(ev, prevent, false));

        dropArea.addEventListener('dragenter', () => {
            console.log('[dropArea] Drag enter');
            dropArea.classList.add('dragover');
        });
        dropArea.addEventListener('dragover', () => {
            dropArea.classList.add('dragover');
        });
        dropArea.addEventListener('dragleave', () => {
            console.log('[dropArea] Drag leave');
            dropArea.classList.remove('dragover');
        });
        dropArea.addEventListener('drop', (e) => {
            console.log('[dropArea] File dropped');
            dropArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) uploadFile(file);
        });

        console.log('[initUploader] Initialization complete');
    }

    /**
     * Initialize "Images" tab: fetch list and handle deletion.
     */
    function initImagesTab() {
        console.log('[initImagesTab] Starting initialization');

        const imgSection = $(SEL.imgSection);
        const imgTabBtn = $(SEL.imgTabBtn);
        const imgGallery = imgSection?.querySelector(SEL.imageGallery);
        const prevPageBtn = $(SEL.prevPageBtn);
        const nextPageBtn = $(SEL.nextPageBtn);
        const currentPageSpan = $(SEL.currentPageSpan);
        const totalPagesSpan = $(SEL.totalPagesSpan);
        const limitSelect = $(SEL.limitSelect);
        const sortSelect = $(SEL.sortSelect);

        console.log('[initImagesTab] Found elements:', {
            imgSection: !!imgSection,
            imgTabBtn: !!imgTabBtn,
            imgGallery: !!imgGallery,
            prevPageBtn: !!prevPageBtn,
            nextPageBtn: !!nextPageBtn,
            currentPageSpan: !!currentPageSpan,
            totalPagesSpan: !!totalPagesSpan,
            limitSelect: !!limitSelect,
            sortSelect: !!sortSelect
        });

        if (!imgSection || !imgGallery || !imgTabBtn) {
            console.error('[initImagesTab] Missing required elements!');
            return;
        }

        /**
         * Update UI selects with current pagination state
         */
        const updateSelectsFromState = () => {
            console.log('[updateSelectsFromState] Updating selects with state:', paginationState);
            if (limitSelect) limitSelect.value = paginationState.limit.toString();
            if (sortSelect) sortSelect.value = paginationState.sortOrder;
        };

        /**
         * Update pagination UI elements
         */
        const updatePaginationUI = () => {
            console.log('[updatePaginationUI] Updating UI with state:', paginationState);

            if (currentPageSpan) currentPageSpan.textContent = paginationState.currentPage;
            if (totalPagesSpan) totalPagesSpan.textContent = paginationState.totalPages || 1;

            if (prevPageBtn) prevPageBtn.disabled = paginationState.currentPage <= 1;
            if (nextPageBtn) nextPageBtn.disabled = paginationState.currentPage >= paginationState.totalPages;

            updatePaginationUrlParams(
                paginationState.currentPage,
                paginationState.limit,
                paginationState.sortOrder
            );
        };

        /**
         * Delete a specific image by filename.
         * @param {string} filename - Name of file to delete.
         * @param {HTMLElement} card - DOM card to remove.
         */
        const deleteImage = async (filename, card) => {
            console.log('[deleteImage] Attempting to delete:', filename);

            if (!confirm(`Delete "${filename}"?`)) {
                console.log('[deleteImage] Delete cancelled by user');
                return;
            }

            try {
                await api('delete', API_DELETE_URL(filename));
                console.log('[deleteImage] Delete successful, removing card');
                card.remove();

                paginationState.totalItems--;
                paginationState.totalPages = Math.max(
                    1,
                    Math.ceil(paginationState.totalItems / paginationState.limit)
                );

                console.log('[deleteImage] Updated pagination after delete:', paginationState);

                if (!imgGallery.querySelector('.image-card') && paginationState.currentPage > 1) {
                    console.log('[deleteImage] Page is empty, going to previous page');
                    paginationState.currentPage--;
                    loadImages();
                } else if (!imgGallery.querySelector('.image-card')) {
                    console.log('[deleteImage] No more images, showing empty message');
                    imgGallery.innerHTML = '<p class="no-images-msg">No images uploaded yet.</p>';
                    updatePaginationUI();
                } else {
                    updatePaginationUI();
                }
            } catch (e) {
                console.error('[deleteImage] Delete failed:', e);
                alert(`Delete failed: ${e.message}`);
            }
        };

        /**
         * Create image card element for gallery
         * @param {object} image - Image object with filename and other properties
         * @returns {HTMLDivElement} Card element
         */
        const createImageCard = (image) => {
            const filename = image.filename;
            const imageUrl = `${location.origin}${image.url || '/images/' + filename}`;
            const detailUrl = `image_detail.html?filename=${encodeURIComponent(filename)}`;

            console.log('[createImageCard] Creating card for:', filename);

            const card = document.createElement('div');
            card.className = 'image-card';
            card.innerHTML = `
                <div class="image-card-preview">
                    <a href="${detailUrl}">
                        <img src="${imageUrl}" alt="${filename}" loading="lazy" />
                    </a>
                </div>
                <div class="image-card-info">
                    <h3 class="image-card-title" title="${filename}">${filename}</h3>
                    <p class="image-card-url" title="${imageUrl}">${imageUrl}</p>
                    <div class="image-card-actions">
                        <button class="copy-url-btn">Copy URL</button>
                        <button class="card-delete-btn" aria-label="Delete image">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            `;

            card.querySelector('.copy-url-btn').addEventListener('click', () => {
                console.log('[createImageCard] Copy URL clicked for:', filename);
                copyToClipboard(imageUrl, card.querySelector('.copy-url-btn'), 'Copy URL');
            });

            card.querySelector('.card-delete-btn').addEventListener('click', () => {
                console.log('[createImageCard] Delete clicked for:', filename);
                deleteImage(filename, card);
            });

            return card;
        };

        /**
         * Load and display the list of uploaded images as cards with pagination.
         */
        const loadImages = async () => {
            console.log('[loadImages] Starting to load images with state:', paginationState);

            imgGallery.innerHTML = '<div class="loading-spinner-container"><div class="loading-spinner"><i class="fas fa-spinner fa-pulse fa-4x"></i></div></div>';

            const paginationControls = $('.pagination-controls');
            if (paginationControls) {
                paginationControls.classList.add('hidden');
            }

            updateSelectsFromState();

            try {
                const url = `${API_IMAGES_URL}?page=${paginationState.currentPage}&limit=${paginationState.limit}&order=${paginationState.sortOrder}`;
                console.log('[loadImages] Making API request to:', url);

                const response = await api('get', url);
                const data = response.data;

                console.log('[loadImages] Raw API response data:', data);

                const files = data.items || data;
                const pagination = data.pagination || {};

                console.log('[loadImages] Processed data:', {
                    files: files,
                    filesLength: files?.length,
                    pagination: pagination
                });

                imgGallery.innerHTML = '';

                paginationState.totalItems = pagination.total || files.length;
                paginationState.totalPages = pagination.pages || Math.ceil(files.length / paginationState.limit) || 1;

                console.log('[loadImages] Updated pagination state:', paginationState);

                if (!files || !files.length) {
                    console.log('[loadImages] No files found, showing empty message');
                    imgGallery.innerHTML = '<p class="no-images-msg">No images uploaded yet.</p>';
                    updatePaginationUI();

                    if (paginationControls) {
                        paginationControls.classList.remove('hidden');
                    }
                    return;
                }

                console.log('[loadImages] Creating cards for', files.length, 'files');
                const fragment = document.createDocumentFragment();
                files.forEach((file, index) => {
                    console.log(`[loadImages] Processing file ${index + 1}:`, file);
                    const fileObj = typeof file === 'string' ? {filename: file} : file;
                    const card = createImageCard(fileObj);
                    fragment.appendChild(card);
                });

                imgGallery.appendChild(fragment);
                updatePaginationUI();

                if (paginationControls) {
                    paginationControls.classList.remove('hidden');
                }

                console.log('[loadImages] Successfully loaded', files.length, 'images');

            } catch (e) {
                console.error('[loadImages] Error loading images:', e);
                imgGallery.innerHTML = `<p class="no-images-msg" style="color: #FF0000">Error loading images: ${e.message}</p>`;
            }
        };

        if (limitSelect) {
            limitSelect.addEventListener('change', () => {
                const newLimit = parseInt(limitSelect.value);
                console.log('[limitSelect] Change event:', newLimit);
                if (AVAILABLE_LIMITS.includes(newLimit) && newLimit !== paginationState.limit) {
                    paginationState.limit = newLimit;
                    paginationState.currentPage = 1;
                    saveLimit(newLimit);
                    loadImages();
                }
            });
        } else {
            console.log('[initImagesTab] limitSelect not found, skipping event listener');
        }

        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                const newSortOrder = sortSelect.value;
                console.log('[sortSelect] Change event:', newSortOrder);
                if (VALID_SORT_ORDERS.includes(newSortOrder) && newSortOrder !== paginationState.sortOrder) {
                    paginationState.sortOrder = newSortOrder;
                    paginationState.currentPage = 1;
                    saveSortOrder(newSortOrder);
                    loadImages();
                }
            });
        } else {
            console.log('[initImagesTab] sortSelect not found, skipping event listener');
        }

        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => {
                console.log('[prevPageBtn] Click event');
                if (paginationState.currentPage > 1) {
                    paginationState.currentPage--;
                    loadImages();
                }
            });
        } else {
            console.log('[initImagesTab] prevPageBtn not found, skipping event listener');
        }

        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => {
                console.log('[nextPageBtn] Click event');
                if (paginationState.currentPage < paginationState.totalPages) {
                    paginationState.currentPage++;
                    loadImages();
                }
            });
        } else {
            console.log('[initImagesTab] nextPageBtn not found, skipping event listener');
        }

        console.log('[initImagesTab] Setting loadImagesFunction');
        loadImagesFunction = loadImages;
        console.log('[initImagesTab] loadImagesFunction is now set:', !!loadImagesFunction);
        console.log('[initImagesTab] Initialization complete');
    }

    // Initialize modules
    document.addEventListener('DOMContentLoaded', () => {
        console.log('[DOMContentLoaded] Starting module initialization');

        initTabs();
        initUploader();
        initImagesTab();

        console.log('[DOMContentLoaded] All modules initialized');
        console.log('[DOMContentLoaded] loadImagesFunction available:', !!loadImagesFunction);
        console.log('[DOMContentLoaded] window.activateTabOnLoad available:', !!window.activateTabOnLoad);

        if (window.activateTabOnLoad) {
            console.log('[DOMContentLoaded] Calling activateTabOnLoad');
            window.activateTabOnLoad();
        } else {
            console.error('[DOMContentLoaded] activateTabOnLoad function not found!');
        }

        console.log('[DOMContentLoaded] Initialization complete');
    });
})();
