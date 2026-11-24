export default class TextEditor {
    constructor(container, options = {}) {
        this.options = {
            charsPerPage: 500,  // Default to 500 chars per page
            onTextChange: null,
            onModeChange: null,
            ...options
        };

        this.container = container;
        this.currentPage = 1;
        this.pages = [''];
        this.charCount = 0;
        this.fullText = '';
        this.isTyping = false;
        this.inputMode = 'text'; // 'text' or 'phonemes'

        this.setupDOM();
        this.bindEvents();
    }

    setupDOM() {
        this.container.innerHTML = `
            <div class="text-editor">
                <div class="editor-view">
                    <div class="input-mode-toggle">
                        <button class="mode-btn active" data-mode="text">Text</button>
                        <button class="mode-btn" data-mode="phonemes">Phonemes</button>
                    </div>
                    <div class="editor-toolbar">
                        <div class="toolbar-group text-mode-only">
                            <span class="toolbar-label">Insert Pause:</span>
                            <button class="pause-btn" data-pause="0.5s">0.5s</button>
                            <button class="pause-btn" data-pause="1s">1s</button>
                            <button class="pause-btn" data-pause="2s">2s</button>
                        </div>
                        <div class="toolbar-group text-mode-only">
                            <button class="phoneme-preview-btn" title="Preview how text will be pronounced">Preview</button>
                        </div>
                        <div class="toolbar-group phoneme-mode-only" style="display: none;">
                            <span class="toolbar-label phoneme-hint">Enter IPA phonemes directly (e.g., həˈloʊ wɝːld)</span>
                        </div>
                    </div>
                    <div class="page-navigation">
                        <div class="pagination">
                            <button class="prev-btn">← Previous</button>
                            <span class="page-info">Page 1 of 1</span>
                            <button class="next-btn">Next →</button>
                        </div>
                    </div>
                    <textarea
                        class="page-content"
                        placeholder="Enter text to convert to speech. Use [pause:1s] for pauses."
                    ></textarea>
                    <div class="editor-footer">
                        <div class="file-controls">
                            <input type="file" class="file-input" accept=".txt" style="display: none;">
                            <button class="upload-btn">Upload Text</button>
                            <button class="clear-btn">Clear Text</button>
                        </div>
                        <div class="chars-per-page">
                            <input
                                type="number"
                                class="chars-input"
                                value="500"
                                min="100"
                                max="2000"
                                title="Characters per page"
                            >
                            <span class="chars-label">chars/page</span>
                            <button class="format-btn">Format Pages</button>
                        </div>
                        <div class="char-count">0 characters</div>
                    </div>
                </div>
            </div>
        `;

        // Cache DOM elements
        this.elements = {
            pageContent: this.container.querySelector('.page-content'),
            prevBtn: this.container.querySelector('.prev-btn'),
            nextBtn: this.container.querySelector('.next-btn'),
            pageInfo: this.container.querySelector('.page-info'),
            fileInput: this.container.querySelector('.file-input'),
            uploadBtn: this.container.querySelector('.upload-btn'),
            clearBtn: this.container.querySelector('.clear-btn'),
            charCount: this.container.querySelector('.char-count'),
            charsPerPage: this.container.querySelector('.chars-input'),
            formatBtn: this.container.querySelector('.format-btn'),
            pauseBtns: this.container.querySelectorAll('.pause-btn'),
            phonemePreviewBtn: this.container.querySelector('.phoneme-preview-btn'),
            modeBtns: this.container.querySelectorAll('.mode-btn'),
            textModeElements: this.container.querySelectorAll('.text-mode-only'),
            phonemeModeElements: this.container.querySelectorAll('.phoneme-mode-only')
        };

        // Set initial chars per page value
        this.elements.charsPerPage.value = this.options.charsPerPage;
    }

    bindEvents() {
        // Handle page content changes
        this.elements.pageContent.addEventListener('input', (e) => {
            const newContent = e.target.value;
            this.pages[this.currentPage - 1] = newContent;
            
            // Only handle empty pages, otherwise just update the text
            if (!newContent.trim() && this.pages.length > 1) {
                // Remove the empty page and adjust
                this.pages.splice(this.currentPage - 1, 1);
                this.currentPage = Math.min(this.currentPage, this.pages.length);
                this.updatePageDisplay();
            }
            
            // Update full text and char count - join with space since pages are just for UI
            this.fullText = this.pages.join(' ');
            this.updateCharCount();
            
            if (this.options.onTextChange) {
                this.options.onTextChange(this.fullText);
            }
        });

        // Navigation
        this.elements.prevBtn.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.updatePageDisplay();
            }
        });

        this.elements.nextBtn.addEventListener('click', () => {
            if (this.currentPage < this.pages.length) {
                this.currentPage++;
                this.updatePageDisplay();
            }
        });

        // File upload
        this.elements.uploadBtn.addEventListener('click', () => {
            this.elements.fileInput.click();
        });
        
        this.elements.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.setText(e.target.result);
                    if (this.options.onTextChange) {
                        this.options.onTextChange(this.getText());
                    }
                };
                reader.readAsText(file);
            }
        });

        // Clear text
        this.elements.clearBtn.addEventListener('click', () => {
            this.clear();
            if (this.options.onTextChange) {
                this.options.onTextChange('');
            }
        });

        // Cache format button
        this.elements.formatBtn = this.container.querySelector('.format-btn');

        // Characters per page control - just update the value
        this.elements.charsPerPage.addEventListener('change', (e) => {
            const value = parseInt(e.target.value);
            if (value >= 100 && value <= 2000) {
                this.options.charsPerPage = value;
            }
        });

        // Format pages button - trigger the split
        this.elements.formatBtn.addEventListener('click', () => {
            const value = parseInt(this.elements.charsPerPage.value);
            if (value >= 100 && value <= 2000) {
                this.options.charsPerPage = value;
                this.splitIntoPages(this.fullText);
            }
        });

        // Pause insertion buttons
        this.elements.pauseBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const pauseDuration = btn.dataset.pause;
                this.insertAtCursor(`[pause:${pauseDuration}]`);
            });
        });

        // Phoneme preview button
        if (this.elements.phonemePreviewBtn) {
            this.elements.phonemePreviewBtn.addEventListener('click', () => {
                this.showPhonemePreview();
            });
        }

        // Mode toggle buttons
        this.elements.modeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                this.setInputMode(mode);
            });
        });
    }

    setInputMode(mode) {
        this.inputMode = mode;

        // Update button states
        this.elements.modeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        // Show/hide mode-specific elements
        this.elements.textModeElements.forEach(el => {
            el.style.display = mode === 'text' ? '' : 'none';
        });
        this.elements.phonemeModeElements.forEach(el => {
            el.style.display = mode === 'phonemes' ? '' : 'none';
        });

        // Update placeholder
        if (mode === 'phonemes') {
            this.elements.pageContent.placeholder = 'Enter IPA phonemes directly (e.g., həˈloʊ wɝːld)';
        } else {
            this.elements.pageContent.placeholder = 'Enter text to convert to speech. Use [pause:1s] for pauses.';
        }

        // Notify callback
        if (this.options.onModeChange) {
            this.options.onModeChange(mode);
        }
    }

    getInputMode() {
        return this.inputMode;
    }

    insertAtCursor(text) {
        const textarea = this.elements.pageContent;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;

        textarea.value = value.substring(0, start) + text + value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + text.length;

        // Update the page content
        this.pages[this.currentPage - 1] = textarea.value;
        this.fullText = this.pages.join(' ');
        this.updateCharCount();

        if (this.options.onTextChange) {
            this.options.onTextChange(this.fullText);
        }

        textarea.focus();
    }

    async showPhonemePreview() {
        const text = this.getText().trim();
        if (!text) {
            alert('Please enter some text first');
            return;
        }

        // Get selected text or use first 200 chars
        const textarea = this.elements.pageContent;
        let previewText = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
        if (!previewText) {
            previewText = text.substring(0, 200);
        }

        try {
            this.elements.phonemePreviewBtn.textContent = 'Loading...';
            this.elements.phonemePreviewBtn.disabled = true;

            const response = await fetch('/dev/phonemize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: previewText,
                    language: document.getElementById('lang-select')?.value || 'a'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to get phonemes');
            }

            const data = await response.json();
            this.showPhonemeModal(previewText, data.phonemes);
        } catch (error) {
            console.error('Phoneme preview error:', error);
            alert('Failed to preview phonemes: ' + error.message);
        } finally {
            this.elements.phonemePreviewBtn.textContent = 'Preview';
            this.elements.phonemePreviewBtn.disabled = false;
        }
    }

    showPhonemeModal(originalText, phonemes) {
        // Remove existing modal if any
        const existing = document.querySelector('.phoneme-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.className = 'phoneme-modal';
        modal.innerHTML = `
            <div class="phoneme-modal-content">
                <div class="phoneme-modal-header">
                    <h3>Pronunciation Preview</h3>
                    <button class="phoneme-modal-close">&times;</button>
                </div>
                <div class="phoneme-modal-body">
                    <div class="phoneme-section">
                        <label>Original Text:</label>
                        <div class="phoneme-text">${originalText}</div>
                    </div>
                    <div class="phoneme-section">
                        <label>Phonemes (how it sounds):</label>
                        <div class="phoneme-output">${phonemes}</div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close handlers
        modal.querySelector('.phoneme-modal-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    splitIntoPages(text) {
        if (!text || !text.trim()) {
            this.pages = [''];
            this.fullText = '';
            this.currentPage = 1;
            this.updatePageDisplay();
            this.updateCharCount();
            return;
        }

        // Store original text to preserve natural line breaks
        this.fullText = text.trim();
        const words = text.trim().split(/\s+/);
        this.pages = [];
        let currentPage = '';
        
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const potentialPage = currentPage + (currentPage ? ' ' : '') + word;
            
            if (potentialPage.length >= this.options.charsPerPage && currentPage) {
                this.pages.push(currentPage);
                currentPage = word;
            } else {
                currentPage = potentialPage;
            }
        }
        
        if (currentPage) {
            this.pages.push(currentPage);
        }
        
        if (this.pages.length === 0) {
            this.pages = [''];
            this.currentPage = 1;
        } else {
            // Keep current page in bounds
            this.currentPage = Math.min(this.currentPage, this.pages.length);
        }
        
        this.updatePageDisplay();
        this.updateCharCount();
    }

    setText(text) {
        // Just set the text without splitting into pages
        this.fullText = text;
        this.pages = [text];
        this.currentPage = 1;
        this.updatePageDisplay();
        this.updateCharCount();
    }

    updatePageDisplay() {
        this.elements.pageContent.value = this.pages[this.currentPage - 1] || '';
        this.elements.pageInfo.textContent = `Page ${this.currentPage} of ${this.pages.length}`;
        
        // Update button states
        this.elements.prevBtn.disabled = this.currentPage === 1;
        this.elements.nextBtn.disabled = this.currentPage === this.pages.length;
    }

    updateCharCount() {
        const totalChars = this.fullText.length;
        this.elements.charCount.textContent = `${totalChars} characters`;
    }

    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.updatePageDisplay();
        }
    }

    nextPage() {
        if (this.currentPage < this.pages.length) {
            this.currentPage++;
            this.updatePageDisplay();
        }
    }

    getText() {
        return this.fullText;
    }

    clear() {
        this.setText('');
    }
}