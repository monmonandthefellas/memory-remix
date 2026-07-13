class AudioEngine {
    constructor() {
        // 1) Initialize audio context (singleton)
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();

        // 2) Routing nodes
        // Master Out -> user speakers
        this.masterOut = this.ctx.destination;

        // Recording stream -> duplicate everything we want to record
        this.recordingNode = this.ctx.createMediaStreamDestination();

        // Main output gain bus
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.8; // Default volume

        // Connect master gain to both speakers and recording stream
        this.masterGain.connect(this.masterOut);
        this.masterGain.connect(this.recordingNode);

        // 3) Metronome state
        this.isPlaying = false;
        this.bpm = 120;
        this.currentBeat = 0;
        this.nextNoteTime = 0.0;
        this.timerID = null;
        this.lookahead = 25.0; // ms
        this.scheduleAheadTime = 0.1; // sec
    }

    // --- Core API ---
    async init() {
        if (this.ctx.state === 'suspended') {
           await this.ctx.resume();
        }
    }

    // --- Metronome Logic ---
    start() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.currentBeat = 0;
        this.nextNoteTime = this.ctx.currentTime + 0.05; // small future offset
        this.scheduler();
    }

    stop() {
        this.isPlaying = false;
        window.clearTimeout(this.timerID);
    }

    setBpm(bpm) {
        this.bpm = bpm;
    }

    // Lookahead scheduler
    scheduler() {
        // Schedule notes that need to play in the next ~100ms window
        while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.currentBeat, this.nextNoteTime);
            this.nextNote();
        }

        // Recursive timer (inexact), so we still use while above
        if (this.isPlaying) {
            this.timerID = window.setTimeout(() => this.scheduler(), this.lookahead);
        }
    }

    // Move virtual beat pointer forward
    nextNote() {
        const secondsPerBeat = 60.0 / this.bpm;
        this.nextNoteTime += secondsPerBeat; // Advance timeline
        this.currentBeat = (this.currentBeat + 1) % 4; // 4/4 time
    }

    // Generate click sound
    scheduleNote(beatNumber, time) {
        // Oscillator for click tone
        const osc = this.ctx.createOscillator();
        const envelope = this.ctx.createGain();

        // Higher pitch on first beat (accent), lower on others
        osc.frequency.value = (beatNumber === 0) ? 1000 : 800;
        envelope.gain.value = 1;
        envelope.gain.exponentialRampToValueAtTime(1, time + 0.001);
        envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
        osc.connect(envelope);

        // Keep metronome routed through master gain for current behavior
        envelope.connect(this.masterGain);
        osc.start(time);
        osc.stop(time + 0.05);

        // UI metronome tick events can be dispatched here if needed
    }
}

// Export singleton instance
export const audioEngine = new AudioEngine();
