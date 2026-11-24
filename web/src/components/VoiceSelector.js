export class VoiceSelector {
    constructor(voiceService) {
        this.voiceService = voiceService;
        this.elements = {
            selectedVoices: document.getElementById('selected-voices')
        };

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Weight adjustment
        this.elements.selectedVoices.addEventListener('input', (e) => {
            if (e.target.type === 'range') {
                const voice = e.target.dataset.voice;
                let weight = parseFloat(e.target.value);

                // Ensure weight is between 0.1 and 2
                weight = Math.max(0.1, Math.min(2, weight));

                // Update the display value
                const valueDisplay = e.target.parentElement.querySelector('.weight-value');
                if (valueDisplay) {
                    valueDisplay.textContent = weight;
                }

                this.voiceService.updateWeight(voice, weight);
            }
        });

        // Remove selected voice and operator toggle
        this.elements.selectedVoices.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-voice')) {
                e.preventDefault();
                e.stopPropagation();
                const voice = e.target.dataset.voice;
                this.voiceService.removeVoice(voice);
                this.updateSelectedVoicesDisplay();
            }

            // Operator toggle
            if (e.target.classList.contains('operator-toggle')) {
                e.preventDefault();
                const voice = e.target.dataset.voice;
                const currentOp = e.target.dataset.operator;
                const newOp = currentOp === '+' ? '-' : '+';
                this.voiceService.updateOperator(voice, newOp);
                this.updateSelectedVoicesDisplay();
            }
        });
    }

    updateSelectedVoicesDisplay() {
        const selectedVoices = this.voiceService.getSelectedVoiceWeights();
        this.elements.selectedVoices.innerHTML = selectedVoices
            .map(({voice, weight, operator}, index) => `
                <div class="selected-voice-tag ${operator === '-' ? 'subtract' : ''}">
                    <div class="voice-tag-header">
                        ${index > 0 ? `
                            <button class="operator-toggle"
                                    data-voice="${voice}"
                                    data-operator="${operator}"
                                    title="Toggle add/subtract">${operator}</button>
                        ` : ''}
                        <span class="voice-name">${voice}</span>
                        <span class="remove-voice" data-voice="${voice}" title="Remove voice">×</span>
                    </div>
                    <div class="voice-weight-slider">
                        <input type="range"
                               value="${weight}"
                               min="0.1"
                               max="2"
                               step="0.1"
                               data-voice="${voice}"
                               class="weight-slider"
                               title="Voice weight">
                        <span class="weight-value">${weight}</span>
                    </div>
                </div>
            `)
            .join('');
    }

    async initialize() {
        try {
            await this.voiceService.loadVoices();
            this.updateSelectedVoicesDisplay();
            return true;
        } catch (error) {
            console.error('Failed to initialize voice selector:', error);
            return false;
        }
    }
}

export default VoiceSelector;
