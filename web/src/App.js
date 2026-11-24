import AudioService from './services/AudioService.js';
import VoiceService from './services/VoiceService.js';
import PlayerState from './state/PlayerState.js';
import PlayerControls from './components/PlayerControls.js';
import VoiceSelector from './components/VoiceSelector.js';
import VoiceDemos from './components/VoiceDemos.js';
import WaveVisualizer from './components/WaveVisualizer.js';
import TextEditor from './components/TextEditor.js';

export class App {
    constructor() {
        this.elements = {
            generateBtn: document.getElementById('generate-btn'),
            generateBtnText: document.querySelector('#generate-btn .btn-text'),
            generateBtnLoader: document.querySelector('#generate-btn .loader'),
            downloadBtn: document.getElementById('download-btn'),
            autoplayToggle: document.getElementById('autoplay-toggle'),
            formatSelect: document.getElementById('format-select'),
            status: document.getElementById('status'),
            cancelBtn: document.getElementById('cancel-btn'),
            // New controls
            gainSlider: document.getElementById('gain-slider'),
            gainValue: document.getElementById('gain-value'),
            // Normalization checkboxes
            normUnits: document.getElementById('norm-units'),
            normUrls: document.getElementById('norm-urls'),
            normEmails: document.getElementById('norm-emails'),
            normPhones: document.getElementById('norm-phones'),
            normPlurals: document.getElementById('norm-plurals'),
            normSymbols: document.getElementById('norm-symbols'),
            // Model status
            modelStatus: document.getElementById('model-status'),
            vramDisplay: document.getElementById('vram-display'),
            modelToggleBtn: document.getElementById('model-toggle-btn')
        };

        this.initialize();
    }

    async initialize() {
        // Initialize services and state
        this.playerState = new PlayerState();
        this.audioService = new AudioService();
        this.voiceService = new VoiceService();

        // Initialize components
        this.playerControls = new PlayerControls(this.audioService, this.playerState);
        this.voiceSelector = new VoiceSelector(this.voiceService);
        this.waveVisualizer = new WaveVisualizer(this.playerState);
        
        // Initialize text editor
        const editorContainer = document.getElementById('text-editor');
        this.textEditor = new TextEditor(editorContainer, {
            linesPerPage: 20,
            onTextChange: (text) => {
                // Optional: Handle text changes here if needed
                console.log('Text changed:', text);
            }
        });

        // Set default sample text
        const sampleText = "The quick brown fox jumps over the lazy dog. This classic pangram contains every letter of the English alphabet at least once. It has been used for decades to test typewriters, fonts, and text-to-speech systems. Feel free to replace this text with your own content to generate natural-sounding speech.";
        this.textEditor.setText(sampleText);

        // Initialize voice selector
        const voicesLoaded = await this.voiceSelector.initialize();
        if (!voicesLoaded) {
            this.showStatus('Failed to load voices', 'error');
            this.elements.generateBtn.disabled = true;
            return;
        }

        // Initialize voice demos with callback to update selected voices display
        this.voiceDemos = new VoiceDemos(this.voiceService, () => {
            this.voiceSelector.updateSelectedVoicesDisplay();
        });
        await this.voiceDemos.initialize();

        this.setupEventListeners();
        this.setupAudioEvents();
    }

    setupEventListeners() {
        // Generate button
        this.elements.generateBtn.addEventListener('click', () => this.generateSpeech());

        // Download button
        this.elements.downloadBtn.addEventListener('click', () => this.downloadAudio());

        // Cancel button
        this.elements.cancelBtn.addEventListener('click', () => {
            this.audioService.cancel();
            this.setGenerating(false);
            this.elements.downloadBtn.classList.remove('ready');
            this.showStatus('Generation cancelled', 'info');
        });

        // Gain slider
        if (this.elements.gainSlider) {
            this.elements.gainSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value).toFixed(1);
                if (this.elements.gainValue) {
                    this.elements.gainValue.textContent = value;
                }
            });
        }

        // Model toggle button
        if (this.elements.modelToggleBtn) {
            this.elements.modelToggleBtn.addEventListener('click', () => this.toggleModel());
        }

        // Handle page unload
        window.addEventListener('beforeunload', () => {
            this.audioService.cleanup();
            this.playerControls.cleanup();
            this.waveVisualizer.cleanup();
            this.voiceDemos.cleanup();
        });

        // Start model status polling
        this.pollModelStatus();
    }

    async pollModelStatus() {
        try {
            const response = await fetch('/debug/model/status');
            if (response.ok) {
                const status = await response.json();
                this.updateModelStatusDisplay(status);
            }
        } catch (error) {
            console.warn('Failed to fetch model status:', error);
        }
        // Poll every 10 seconds
        setTimeout(() => this.pollModelStatus(), 10000);
    }

    updateModelStatusDisplay(status) {
        if (!this.elements.modelStatus) return;

        const statusEl = this.elements.modelStatus;
        const textEl = statusEl.querySelector('.status-text');
        const vramEl = this.elements.vramDisplay;
        const toggleBtn = this.elements.modelToggleBtn;

        statusEl.classList.remove('loaded', 'unloaded', 'error');

        if (status.loaded) {
            statusEl.classList.add('loaded');
            textEl.textContent = `Model: ${status.device || 'Loaded'}`;
            if (toggleBtn) {
                toggleBtn.textContent = 'Unload';
                toggleBtn.style.display = 'block';
            }
        } else {
            statusEl.classList.add('unloaded');
            textEl.textContent = 'Model: Unloaded';
            if (toggleBtn) {
                toggleBtn.textContent = 'Load';
                toggleBtn.style.display = 'block';
            }
        }

        // Display VRAM if available
        if (vramEl && status.vram) {
            const used = (status.vram.allocated_mb / 1024).toFixed(1);
            const total = (status.vram.total_mb / 1024).toFixed(1);
            vramEl.textContent = `VRAM: ${used}/${total}GB`;
        } else if (vramEl) {
            vramEl.textContent = '';
        }
    }

    async toggleModel() {
        const btn = this.elements.modelToggleBtn;
        if (!btn) return;

        const isLoaded = this.elements.modelStatus?.classList.contains('loaded');
        const endpoint = isLoaded ? '/debug/model/unload' : '/debug/model/load';

        btn.disabled = true;
        btn.textContent = isLoaded ? 'Unloading...' : 'Loading...';

        try {
            const response = await fetch(endpoint, { method: 'POST' });
            const result = await response.json();
            this.showStatus(result.message, result.status === 'success' ? 'success' : 'info');
            // Refresh status immediately
            this.pollModelStatus();
        } catch (error) {
            this.showStatus('Failed to toggle model', 'error');
        } finally {
            btn.disabled = false;
        }
    }

    setupAudioEvents() {
        // Handle download button visibility
        this.audioService.addEventListener('downloadReady', () => {
            this.elements.downloadBtn.classList.add('ready');
        });

        // Handle buffer errors
        this.audioService.addEventListener('bufferError', () => {
            this.showStatus('Processing... (Download will be available when complete)', 'info');
        });

        // Handle completion
        this.audioService.addEventListener('complete', () => {
            this.setGenerating(false);
            
            // Show preparing status
            this.showStatus('Preparing file...', 'info');
            
            // Trigger coffee steam animation
            const steamElement = document.querySelector('.cup .steam');
            if (steamElement) {
                // Remove and re-add the element to restart animation
                const parent = steamElement.parentNode;
                const clone = steamElement.cloneNode(true);
                parent.removeChild(steamElement);
                parent.appendChild(clone);
            }
        });

        // Handle download ready
        this.audioService.addEventListener('downloadReady', () => {
            setTimeout(() => {
                this.showStatus('Generation complete', 'success');
            }, 500); // Small delay to ensure "Preparing file..." is visible
        });

        // Handle audio end
        this.audioService.addEventListener('ended', () => {
            this.playerState.setPlaying(false);
        });

        // Handle errors
        this.audioService.addEventListener('error', (error) => {
            this.showStatus('Error: ' + error.message, 'error');
            this.setGenerating(false);
            this.elements.downloadBtn.style.display = 'none';
        });
    }

    showStatus(message, type = 'info') {
        this.elements.status.textContent = message;
        this.elements.status.className = 'status ' + type;
        setTimeout(() => {
            this.elements.status.className = 'status';
        }, 5000);
    }

    setGenerating(isGenerating) {
        this.playerState.setGenerating(isGenerating);
        this.elements.generateBtn.disabled = isGenerating;
        this.elements.generateBtn.classList.toggle('loading', isGenerating);
        this.elements.generateBtnLoader.style.display = isGenerating ? 'block' : 'none';
        this.elements.generateBtnText.style.visibility = isGenerating ? 'hidden' : 'visible';
        this.elements.cancelBtn.style.display = isGenerating ? 'block' : 'none';
    }

    validateInput() {
        const text = this.textEditor.getText().trim();
        if (!text) {
            this.showStatus('Please enter some text', 'error');
            return false;
        }
        
        if (!this.voiceService.hasSelectedVoices()) {
            this.showStatus('Please select a voice', 'error');
            return false;
        }
        
        return true;
    }

    async generateSpeech() {
        // Don't check isGenerating state since we want to allow generation after cancel
        if (!this.validateInput()) {
            return;
        }

        const text = this.textEditor.getText().trim();
        const voice = this.voiceService.getSelectedVoiceString();
        const speed = this.playerState.getState().speed;
        const inputMode = this.textEditor.getInputMode();

        // Collect advanced options
        const options = this.getGenerationOptions();

        this.setGenerating(true);
        this.elements.downloadBtn.classList.remove('ready');

        // Just reset progress bar, don't do full cleanup
        this.waveVisualizer.updateProgress(0, 1);

        try {
            console.log('Starting audio generation...', { text, voice, speed, inputMode, options });

            // Ensure we have valid input
            if (!text || !voice) {
                console.error('Invalid input:', { text, voice, speed });
                throw new Error('Invalid input parameters');
            }

            if (inputMode === 'phonemes') {
                // Generate directly from phonemes
                await this.audioService.generateFromPhonemes(
                    text,
                    voice,
                    (loaded, total) => {
                        console.log('Progress update:', { loaded, total });
                        this.waveVisualizer.updateProgress(loaded, total);
                    }
                );
            } else {
                // Normal text-to-speech
                await this.audioService.streamAudio(
                    text,
                    voice,
                    speed,
                    (loaded, total) => {
                        console.log('Progress update:', { loaded, total });
                        this.waveVisualizer.updateProgress(loaded, total);
                    },
                    options
                );
            }
        } catch (error) {
            console.error('Generation error:', error);
            if (error.name !== 'AbortError') {
                this.showStatus('Error generating speech: ' + error.message, 'error');
                this.setGenerating(false);
            }
        }
    }

    getGenerationOptions() {
        const options = {};

        // Volume multiplier
        if (this.elements.gainSlider) {
            const gain = parseFloat(this.elements.gainSlider.value);
            if (gain !== 1.0) {
                options.volumeMultiplier = gain;
            }
        }

        // Normalization options - only include if user has changed defaults
        const normOptions = {};
        let hasNormChanges = false;

        if (this.elements.normUnits?.checked) {
            normOptions.unit_normalization = true;
            hasNormChanges = true;
        }
        if (this.elements.normUrls && !this.elements.normUrls.checked) {
            normOptions.url_normalization = false;
            hasNormChanges = true;
        }
        if (this.elements.normEmails && !this.elements.normEmails.checked) {
            normOptions.email_normalization = false;
            hasNormChanges = true;
        }
        if (this.elements.normPhones && !this.elements.normPhones.checked) {
            normOptions.phone_normalization = false;
            hasNormChanges = true;
        }
        if (this.elements.normPlurals && !this.elements.normPlurals.checked) {
            normOptions.optional_pluralization_normalization = false;
            hasNormChanges = true;
        }
        if (this.elements.normSymbols && !this.elements.normSymbols.checked) {
            normOptions.replace_remaining_symbols = false;
            hasNormChanges = true;
        }

        if (hasNormChanges) {
            options.normalizationOptions = normOptions;
        }

        return options;
    }

    downloadAudio() {
        const downloadUrl = this.audioService.getDownloadUrl();
        if (!downloadUrl) {
            console.warn('No download URL available');
            return;
        }

        console.log('Starting download from:', downloadUrl);
        
        const format = this.elements.formatSelect.value;
        const voice = this.voiceService.getSelectedVoiceString();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${voice}_${timestamp}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new App();
});
