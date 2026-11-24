const DEMO_TEXT = "Hello! This is a sample of my voice. How do I sound?";

export class VoiceDemos {
    constructor(voiceService, onVoiceAdded = null) {
        this.voiceService = voiceService;
        this.onVoiceAdded = onVoiceAdded;
        this.container = document.getElementById('voice-demo-list');
        this.searchInput = document.getElementById('voice-demo-search');
        this.currentAudio = null;
        this.currentVoice = null;
        this.audioCache = new Map();
        this.audioContext = null;
        this.unlocked = false;
        this.voices = [];
    }

    unlockAudio() {
        if (this.unlocked) return;

        // Create AudioContext on first user interaction
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Resume if suspended
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        this.unlocked = true;
    }

    async initialize() {
        const voices = this.voiceService.getAvailableVoices();
        // Filter to English voices only (American and British prefixes)
        this.voices = voices.filter(voice =>
            voice.startsWith('af_') ||
            voice.startsWith('am_') ||
            voice.startsWith('bf_') ||
            voice.startsWith('bm_')
        );
        this.render(this.voices);
        this.setupSearch();
    }

    setupSearch() {
        if (!this.searchInput) return;

        this.searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            this.filterVoices(query);
        });
    }

    filterVoices(query) {
        if (!query) {
            this.render(this.voices);
            return;
        }

        const filtered = this.voices.filter(voice =>
            voice.toLowerCase().includes(query)
        );
        this.render(filtered);
    }

    addVoiceToSelected(voice) {
        const added = this.voiceService.addVoice(voice);
        if (added && this.onVoiceAdded) {
            this.onVoiceAdded(voice);
        }
    }

    render(voices) {
        if (!this.container) return;

        this.container.innerHTML = voices.map(voice => `
            <div class="voice-demo-item" data-voice="${voice}">
                <span class="voice-demo-name" title="${voice}">${voice}</span>
                <button class="voice-demo-add" aria-label="Add ${voice} to selection" title="Add to selection">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                </button>
                <button class="voice-demo-play" aria-label="Play ${voice}">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                </button>
            </div>
        `).join('');

        this.container.querySelectorAll('.voice-demo-item').forEach(item => {
            const playBtn = item.querySelector('.voice-demo-play');
            const addBtn = item.querySelector('.voice-demo-add');
            const voice = item.dataset.voice;

            playBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.togglePlay(voice, item, playBtn);
            });

            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.addVoiceToSelected(voice);
            });

            item.addEventListener('click', () => {
                this.togglePlay(voice, item, playBtn);
            });
        });
    }

    async togglePlay(voice, item, playBtn) {
        // Unlock audio on first interaction
        this.unlockAudio();

        if (this.currentVoice === voice && this.currentSource) {
            this.stopCurrent();
            return;
        }

        this.stopCurrent();
        this.currentVoice = voice;

        item.classList.add('loading');
        playBtn.innerHTML = '<div class="spinner"></div>';
        playBtn.disabled = true;

        try {
            let audioBuffer = this.audioCache.get(voice);

            if (!audioBuffer) {
                // Build URL with query params for GET request
                const params = new URLSearchParams({
                    text: DEMO_TEXT,
                    voice: voice,
                    speed: '1.0'
                });

                const response = await fetch(`/v1/audio/speech?${params}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch audio');
                }

                const arrayBuffer = await response.arrayBuffer();
                audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                this.audioCache.set(voice, audioBuffer);
            }

            // Create source and play
            this.currentSource = this.audioContext.createBufferSource();
            this.currentSource.buffer = audioBuffer;
            this.currentSource.connect(this.audioContext.destination);

            this.currentSource.onended = () => {
                this.resetItem(item, playBtn);
                this.currentVoice = null;
                this.currentSource = null;
            };

            item.classList.remove('loading');
            item.classList.add('playing');
            playBtn.disabled = false;
            playBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 6h4v12H6zm8 0h4v12h-4z"/>
                </svg>
            `;

            this.currentSource.start(0);
        } catch (error) {
            console.error('Error playing voice demo:', error);
            this.resetItem(item, playBtn);
            this.currentVoice = null;
        }
    }

    stopCurrent() {
        if (this.currentSource) {
            try {
                this.currentSource.stop();
            } catch (e) {
                // Ignore - source may already be stopped
            }
            this.currentSource = null;
        }

        if (!this.container) return;

        const prevPlaying = this.container.querySelector('.voice-demo-item.playing');
        if (prevPlaying) {
            const prevBtn = prevPlaying.querySelector('.voice-demo-play');
            this.resetItem(prevPlaying, prevBtn);
        }
    }

    resetItem(item, playBtn) {
        item.classList.remove('loading', 'playing');
        playBtn.disabled = false;
        playBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
            </svg>
        `;
    }

    cleanup() {
        this.stopCurrent();
        this.audioCache.clear();
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}

export default VoiceDemos;
