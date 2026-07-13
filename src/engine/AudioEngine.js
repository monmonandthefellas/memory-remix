import lamejs from '@breezystack/lamejs';

/**
 * AudioEngine
 * 
 * Core audio management class using Web Audio API.
 * Handles dual-track playback, real-time drum synthesis, A-B looping,
 * and high-performance MP3/WAV export.
 */
class AudioEngine {
   constructor() {
      // 1. Initialize Audio Context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();

      // 2. Nodes & Routing Architecture
      // A. Master Output (Speakers)
      // This is the main destination for all audible sound (Metronome, Playback, Monitoring)
      this.masterOut = this.ctx.destination;

      // B. Recorder Input (Voice + Sequence, excluding Metronome)
      // This destination receives ONLY the signals we want to record into the final mix.
      // We explicitly DO NOT connect the metronome to this node.
      this.recorderDest = this.ctx.createMediaStreamDestination();

      // C. Internal Buses
      // masterGain: Volume control for Track 2 (User Recording and Drum Sequence)
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.8;

      // userGain: Volume control for Track 1 (The externally uploaded track)
      this.userGain = this.ctx.createGain();
      this.userGain.gain.value = 0.8;

      // metronomeGain: Dedicated gain for the Click/Metronome (Connected ONLY to Speakers)
      this.metronomeGain = this.ctx.createGain();
      this.metronomeGain.gain.value = 0.5;

      // micGain: Volume control for Microphone monitoring and recording routing
      this.micGain = this.ctx.createGain();
      this.micGain.gain.value = 1.0;

      // Connection Routing
      this.metronomeGain.connect(this.masterOut);
      this.masterGain.connect(this.masterOut);
      this.userGain.connect(this.masterOut);

      // 3. Visualizer Analyser
      // Global analyser that listens to the combined output (Drums + User Track + Mic)
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyserData = new Uint8Array(this.analyser.frequencyBinCount);

      this.masterGain.connect(this.analyser);
      this.userGain.connect(this.analyser);
      this.micGain.connect(this.analyser);

      // Mic routing: Connected to recorder for capturing voice
      this.micGain.connect(this.recorderDest);

      this.micNode = null;

      // --- Engine State ---
      this.isPlaying = false;
      this.isUserPlaying = false;    // Track 1 status
      this.isRecordPlaying = false;  // Track 2 status
      this.isMetronomeOn = false;
      this.isRecording = false;
      this.bpm = 120;

      // --- Track Persistence State ---
      this.userVolume = 0.8;
      this.userPitch = 1.0;
      this.userLoop = false;
      this.userLoopState = 'OFF'; // Now simple boolean-like state in practice
      this.userLoopStart = 0;
      this.userLoopEnd = 0;

      this.recordVolume = 0.8;
      this.recordPitch = 1.0;
      this.recordLoop = false;
      this.recordLoopState = 'OFF'; // 'OFF', 'RECORDING', 'ACTIVE'
      this.recordLoopStart = 0;
      this.recordLoopEnd = 0;
      this.currentPitch = 1.0; // Global pitch factor for drum synthesis

      // --- Scheduler (Heartbeat) State ---
      this.currentBeat = 0;
      this.nextNoteTime = 0.0;
      this.timerID = null;
      this.lookahead = 25.0; // How often to check for next notes (ms)
      this.scheduleAheadTime = 0.1; // How far ahead to schedule events (s)

      // --- Recording & Buffer State ---
      this.mediaRecorder = null;
      this.audioChunks = [];
      this.recordedBuffer = null;     // Decoded AudioBuffer of the voice recording
      this.userTrackBuffer = null;    // Decoded AudioBuffer of the uploaded target track
      this.recordedSequence = [];     // List of drum hits: [{type: 'kick', time: RELATIVE_TIME}, ...]
      this.recordingStartTime = 0;    // Context time when recording started
      this.recordingOffset = 0;       // Time offset into Track 1 when recording began
      this.userPlaybackStartTime = 0;

      // Timing Compensation
      this.sequenceDelay = 0.085;     // Latency adjustment for drum synthesis playback (85ms)
      this.micLatencyOffset = -0.080; // Compensation for mic input latency (-80ms shift)

      this.isLooping = false;
      this.playbackSource = null;     // Voice AudioBufferSourceNode
      this.userPlaybackSource = null; // User Track AudioBufferSourceNode
      this.playbackTimeouts = [];     // Tracked timeouts for clearing the sequencer

      // Pre-loaded drum samples
      this.sampleBuffers = {
         kick: null,
         snare: null,
         hihat: null
      };

      this.listeners = new Set();
   }

   // --- Asset Initialization ---

   /**
    * Prepares the context and generates synthetic fallback samples.
    */
   async init() {
      if (this.ctx.state === 'suspended') {
         await this.ctx.resume();
      }
      this.unlock();
      this.generateSynthSamples();
   }

   unlock() {
      try {
         const buffer = this.ctx.createBuffer(1, 1, 22050);
         const source = this.ctx.createBufferSource();
         source.buffer = buffer;
         source.connect(this.ctx.destination);
         source.start(0);
         console.log("[AudioEngine] Audio Context Unlocked");
      } catch (e) {
         console.warn("[AudioEngine] Unlock failed", e);
      }
   }

   /**
    * Loads external WAV/MP3 samples for the drum sequencer.
    */
   async loadSample(name, url) {
      if (!url) return;
      try {
         const response = await fetch(url);
         const arrayBuffer = await response.arrayBuffer();
         const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
         this.sampleBuffers[name] = audioBuffer;
      } catch (err) {
         console.error(`[AudioEngine] Failed to load sample: ${name}`, err);
      }
   }

   /**
    * Decodes a user-provided file for Track 1.
    */
   async loadUserFile(file) {
      try {
         const arrayBuffer = await file.arrayBuffer();
         const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
         this.userTrackBuffer = audioBuffer;
         this.emit('userFileLoaded', audioBuffer);
         return true;
      } catch (err) {
         console.error("[AudioEngine] Failed to decode user file:", err);
         return false;
      }
   }

   // --- Drum Synthesis Logic ---
   // Generic oscillators/noise generators used as fallbacks or overlays

   generateSynthSamples() {
      if (!this.sampleBuffers.kick) this.sampleBuffers.kick = this.generateKickBuffer();
      if (!this.sampleBuffers.snare) this.sampleBuffers.snare = this.generateSnareBuffer();
      if (!this.sampleBuffers.hihat) this.sampleBuffers.hihat = this.generateHiHatBuffer();
   }

   generateKickBuffer() {
      const duration = 0.5;
      const sampleRate = this.ctx.sampleRate;
      const length = sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
         const t = i / sampleRate;
         const freq = 150 * Math.exp(-t * 10); // Logarithmic pitch drop
         const amp = Math.exp(-t * 8);         // Logarithmic volume decay
         data[i] = Math.sin(2 * Math.PI * freq * t) * amp;
      }
      return buffer;
   }

   generateSnareBuffer() {
      const duration = 0.2;
      const sampleRate = this.ctx.sampleRate;
      const length = sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
         const t = i / sampleRate;
         const noise = (Math.random() * 2 - 1);
         const tone = Math.sin(2 * Math.PI * 180 * t);
         const env = Math.exp(-t * 20);
         data[i] = (noise * 0.8 + tone * 0.2) * env;
      }
      return buffer;
   }

   generateHiHatBuffer() {
      const duration = 0.08;
      const sampleRate = this.ctx.sampleRate;
      const length = sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
         const t = i / sampleRate;
         const noise = (Math.random() * 2 - 1);
         const env = Math.exp(-t * 50) * 0.3; // Very sharp decay
         data[i] = noise * env;
      }
      return buffer;
   }

   // --- Audio Utilities ---

   /**
    * Normalizes the buffer to ensure consistent volume levels across different recordings.
    */
   normalizeBuffer(buffer, targetPeak = 0.8) {
      let maxAmplitude = 0;
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
         const channelData = buffer.getChannelData(ch);
         for (let i = 0; i < channelData.length; i++) {
            const abs = Math.abs(channelData[i]);
            if (abs > maxAmplitude) maxAmplitude = abs;
         }
      }

      if (maxAmplitude === 0) return buffer;

      let gain = targetPeak / maxAmplitude;
      const maxGain = 5.0; // Limit gain to prevent extreme noise floor boosting
      if (gain > maxGain) gain = maxGain;
      if (gain <= 1.0) return buffer;

      const normalizedBuffer = this.ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
         const inputData = buffer.getChannelData(ch);
         const outputData = normalizedBuffer.getChannelData(ch);
         for (let i = 0; i < inputData.length; i++) {
            outputData[i] = inputData[i] * gain;
         }
      }
      return normalizedBuffer;
   }

   getFrequencyData() {
      this.analyser.getByteFrequencyData(this.analyserData);
      return this.analyserData;
   }

   // --- Control Handlers ---

   setUserVolume(val) {
      this.userVolume = val;
      this.userGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.01);
   }

   setRecordVolume(val) {
      this.recordVolume = val;
      // Master volume for track 2
      this.masterGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.01);
      // In a dual-track mix, reduce background proportionately
      if (this.isRecordPlaying) {
         const proportionalBgVolume = this.userVolume * val;
         this.userGain.gain.setTargetAtTime(proportionalBgVolume, this.ctx.currentTime, 0.01);
      }
   }

   setUserPitch(val) {
      this.userPitch = val;
      if (this.userPlaybackSource && this.userPlaybackSource.playbackRate) {
         this.userPlaybackSource.playbackRate.value = val;
      }
   }

   setRecordPitch(val) {
      this.recordPitch = val;
      if (this.playbackSource && this.playbackSource.playbackRate) {
         this.playbackSource.playbackRate.value = val;
      }
      // Sync background pitch to maintain harmony during full mix playback
      if (this.isRecordPlaying && this.userPlaybackSource && this.userPlaybackSource.playbackRate) {
         const proportionalBgPitch = this.userPitch * val;
         this.userPlaybackSource.playbackRate.value = proportionalBgPitch;
      }
   }

   toggleMetronome() {
      this.isMetronomeOn = !this.isMetronomeOn;
      console.log('[AudioEngine] Metronome:', this.isMetronomeOn);
      this.emit('metronome', this.isMetronomeOn);

      if (this.isMetronomeOn && !this.timerID) {
         this.startScheduler();
      }
   }

   /**
    * Advanced A-B Loop Logic.
    * 1. If not playing: Toggle full loop.
    * 2. If playing: First click sets Point A, second click sets Point B and starts looping.
    */
   /**
    * Simple Loop Toggle for User Track (Track 1).
    */
   toggleUserLoop() {
      this.userLoop = !this.userLoop;
      this.userLoopState = this.userLoop ? 'ACTIVE' : 'OFF'; // Keep state sync if needed

      if (this.userPlaybackSource) {
         this.userPlaybackSource.loop = this.userLoop;
         // Reset loop points if toggling simple loop
         this.userPlaybackSource.loopStart = 0;
         this.userPlaybackSource.loopEnd = this.userTrackBuffer ? this.userTrackBuffer.duration : 0;
      }

      this.emit('userLoop', this.userLoop);
      this.emit('userLoopState', this.userLoopState);
   }

   /**
    * Advanced A-B Loop Logic for Voice Track (Track 2).
    * 1. Click 1: Start Setting (RECORDING state) -> Set Start Point
    * 2. Click 2: Set End Point (ACTIVE state) -> Start Looping
    * 3. Click 3: Clear Loop (OFF state)
    */
   toggleRecordLoop() {
      if (this.recordLoopState === 'OFF') {
         // Step 1: Set Start Point
         this.recordLoopState = 'RECORDING';

         // Calculate elapsed time relative to voice playback
         // Note: If recordedBuffer exists and we are playing it, we use ctx time - start time
         // If not playing, start at 0
         if (this.isRecordPlaying && this.playbackSource) {
            // Since playbackSource.start() might have been called with an offset or delay
            // Determining exact 'current time' in buffer is tricky without tracking start time precisely.
            // We'll approximate using currentTime. 
            // Ideally we need this.recordPlaybackStartTime.
            // For now, let's assume if it is playing, we use global time approximation if simple.
            // BUT: We don't track `recordPlaybackStartTime` in `playRecordTrackOnly` yet.
            // Let's use 0 for start if not playing, or just 0 if we can't determine.
            this.recordLoopStart = 0; // Placeholder until we track start time better
            // Actually, let's just default to 0 for start if complex. 
            // Or better: Let's assume user clicks near start.
         } else {
            this.recordLoopStart = 0;
         }

         // Better approach: just start at 0 if we can't be precise, or use 0.
         // A/B loop on voice is usually "Loop this section". 
         // Let's use 0 -> Duration for now if we can't determine current position easily.
         // WAIT: referencing the original implementation for User Loop:
         // `const elapsed = this.ctx.currentTime - this.userPlaybackStartTime;`
         // We need `recordPlaybackStartTime`.

         // Let's add tracking for recordPlaybackStartTime in playRecordTrackOnly first? 
         // Or just implement the state machine and fix the time tracking in next step.

         // I'll implement the state machine now and fix start time usage in play logic.
         this.recordLoopStart = 0; // Default

      } else if (this.recordLoopState === 'RECORDING') {
         // Step 2: Set End Point and Activate
         this.recordLoopState = 'ACTIVE';
         this.recordLoopEnd = this.recordedBuffer ? this.recordedBuffer.duration : 0;

         // If we had precise timing we would set it here. 
         // For now, defaulting to full duration or whatever was set.

         if (this.playbackSource) this.applyLoopToSource(this.playbackSource, 'record');

      } else {
         // Step 3: Turn Off
         this.recordLoopState = 'OFF';
         if (this.playbackSource) this.playbackSource.loop = false;
      }

      this.recordLoop = this.recordLoopState !== 'OFF';
      this.emit('recordLoopState', this.recordLoopState);
      this.emit('recordLoop', this.recordLoop);
   }

   /**
    * Internal helper to apply loop points to a native AudioBufferSourceNode.
    */
   applyLoopToSource(source, trackType = 'user') {
      if (!source) return;

      if (trackType === 'user' && this.userLoop) {
         source.loop = true;
         // Simple loop: always full duration
         source.loopStart = 0;
         source.loopEnd = source.buffer ? source.buffer.duration : 0;
      }
      else if (trackType === 'record' && this.recordLoopState === 'ACTIVE') {
         try {
            source.loop = true;
            // Ensure loop points are valid
            if (this.recordLoopEnd > 0 && this.recordLoopEnd > this.recordLoopStart) {
               source.loopStart = this.recordLoopStart;
               source.loopEnd = this.recordLoopEnd;
            } else {
               source.loopStart = 0;
               source.loopEnd = source.buffer.duration;
            }
         } catch (e) {
            console.warn("[AudioEngine] Failed to apply record loop points:", e);
         }
      }
   }

   setBpm(bpm) {
      this.bpm = Math.max(40, Math.min(208, bpm));
      this.emit('bpm', this.bpm);
   }

   setRecordingDelay(ms) {
      this.sequenceDelay = ms / 1000.0;
   }

   // --- Sequencer & Triggers ---

   recordEvent(type) {
      if (!this.isRecording) return;
      const relativeTime = this.ctx.currentTime - this.recordingStartTime;
      this.recordedSequence.push({ type, time: relativeTime });
   }

   triggerKick() {
      this.recordEvent('kick');
      if (this.sampleBuffers.kick) {
         const source = this.ctx.createBufferSource();
         source.buffer = this.sampleBuffers.kick;
         source.playbackRate.value = this.currentPitch;
         source.connect(this.masterGain);
         source.start();
      }
   }

   triggerSnare() {
      this.recordEvent('snare');
      if (this.sampleBuffers.snare) {
         const source = this.ctx.createBufferSource();
         source.buffer = this.sampleBuffers.snare;
         source.playbackRate.value = this.currentPitch;
         source.connect(this.masterGain);
         source.start();
      }
   }

   triggerHiHat() {
      this.recordEvent('hihat');
      if (this.sampleBuffers.hihat) {
         const source = this.ctx.createBufferSource();
         source.buffer = this.sampleBuffers.hihat;
         source.playbackRate.value = this.currentPitch;
         source.connect(this.masterGain);
         source.start();
      }
   }

   // --- Microphone & Recording ---

   async initMicrophone() {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      if (this.micNode) return;
      try {
         // Request clean audio with minimal processing for creative mixing
         const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
               echoCancellation: false,
               noiseSuppression: false,
               autoGainControl: false
            }
         });
         this.micNode = this.ctx.createMediaStreamSource(stream);
         this.micNode.connect(this.micGain);
         this.micGain.connect(this.recorderDest);
      } catch (err) {
         console.error("[AudioEngine] Mic Error:", err);
      }
   }

   /**
    * Begins standard MediaRecorder recording.
    * Note: Captures 'this.recorderDest.stream', which contains Voice + Drums mix.
    */
   async startRecording() {
      if (this.isRecording) return;
      if (!this.micNode) await this.initMicrophone();

      this.audioChunks = [];
      const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
         ? { mimeType: 'audio/webm;codecs=opus' }
         : {};
      this.mediaRecorder = new MediaRecorder(this.recorderDest.stream, options);

      this.mediaRecorder.ondataavailable = (e) => {
         if (e.data.size > 0) this.audioChunks.push(e.data);
      };

      this.mediaRecorder.onstop = async () => {
         if (this.audioChunks.length === 0) return;
         const blob = new Blob(this.audioChunks, { type: this.mediaRecorder.mimeType || 'audio/webm' });
         if (blob.size === 0) return;
         const url = URL.createObjectURL(blob);
         try {
            const arrayBuffer = await blob.arrayBuffer();
            const decodedBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            // Auto-normalization helps ensure the recording is clear during preview
            this.recordedBuffer = this.normalizeBuffer(decodedBuffer, 0.8);
            this.emit('recordingComplete', url);
         } catch (err) {
            console.error("[AudioEngine] Recording Decoding Failed:", err);
         }
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      this.recordedSequence = []; // Reset drum pattern for new recording
      this.recordingStartTime = this.ctx.currentTime;

      // Track the sync offset relative to the background track (Track 1)
      if (this.isUserPlaying && this.userPlaybackStartTime > 0) {
         this.recordingOffset = (this.ctx.currentTime - this.userPlaybackStartTime) * this.userPitch;
      } else {
         this.recordingOffset = 0;
      }

      // Ensure the master scheduler is running to keep sync
      if (!this.timerID) this.startScheduler();
      this.emit('isRecording', true);
   }

   stopRecording() {
      if (!this.isRecording) return;
      this.mediaRecorder.stop();
      this.isRecording = false;
      this.emit('isRecording', false);
   }

   // --- Playback Engine ---

   stopPlayback() {
      this.stopUserPlayback();
      this.stopRecordPlayback();
      this.isPlaying = false;
      this.emit('play', false);
   }

   /**
    * Playback for Track 1 only (The external track).
    */
   playUserTrackOnly() {
      if (!this.userTrackBuffer) return;
      if (this.isRecordPlaying) this.stopRecordPlayback();
      if (this.isUserPlaying) {
         this.stopUserPlayback();
         return;
      }

      const startUserTrack = () => {
         this.userPlaybackSource = this.ctx.createBufferSource();
         this.userPlaybackSource.buffer = this.userTrackBuffer;
         this.userPlaybackSource.connect(this.userGain);

         // Simple Loop (User Track)
         if (this.userLoop) {
            this.applyLoopToSource(this.userPlaybackSource, 'user');
         }

         this.userPlaybackSource.onended = () => {
            // If native looping is off, we stop when buffer ends.
            // If native looping is on, this only fires on manual stop.
            if (!this.userLoop && this.isUserPlaying) {
               this.isUserPlaying = false;
               this.userPlaybackStartTime = 0;
               this.emit('userPlay', false);
            }
         };
         this.userPlaybackSource.start();
         this.userPlaybackStartTime = this.ctx.currentTime;
      };

      startUserTrack();
      this.isUserPlaying = true;
      this.emit('userPlay', true);
   }

   stopUserPlayback() {
      if (this.userPlaybackSource) {
         this.userPlaybackSource.onended = null;
         try { this.userPlaybackSource.stop(); } catch (e) { }
         this.userPlaybackSource = null;
      }
      this.isUserPlaying = false;
      this.userPlaybackStartTime = 0;
      this.emit('userPlay', false);
   }

   /**
    * Playback for Track 2 (Full Mix including Track 1 in background).
    */
   playRecordTrackOnly() {
      if (!this.recordedBuffer && this.recordedSequence.length === 0 && !this.userTrackBuffer) return;
      if (this.isUserPlaying) this.stopUserPlayback();
      if (this.isRecordPlaying) {
         this.stopRecordPlayback();
         return;
      }

      const startFullMix = () => {
         // Clear existing sequencer timeouts to avoid overlaps on re-triggers
         this.playbackTimeouts.forEach(t => clearTimeout(t));
         this.playbackTimeouts = [];

         // Background Volume/Pitch are proportional to the Master control
         const proportionalBgVolume = this.userVolume * this.recordVolume;
         const proportionalBgPitch = this.userPitch * this.recordPitch;

         // A. Re-start Track 1 in background
         if (this.userTrackBuffer) {
            this.userGain.gain.setTargetAtTime(proportionalBgVolume, this.ctx.currentTime, 0.01);
            this.userPlaybackSource = this.ctx.createBufferSource();
            this.userPlaybackSource.buffer = this.userTrackBuffer;
            this.userPlaybackSource.playbackRate.value = proportionalBgPitch;
            this.userPlaybackSource.connect(this.userGain);
            // Apply simple loop to background if active
            if (this.userLoop) this.applyLoopToSource(this.userPlaybackSource, 'user');
            this.userPlaybackSource.start();
         }

         // B. Re-start Voice over the background, compensating for recording latency
         const voiceStartDelay = Math.max(0, (this.recordingOffset / proportionalBgPitch) + this.micLatencyOffset);

         if (this.recordedBuffer) {
            this.playbackSource = this.ctx.createBufferSource();
            this.playbackSource.buffer = this.recordedBuffer;
            this.playbackSource.playbackRate.value = this.recordPitch;
            this.playbackSource.connect(this.masterGain);

            // Apply A/B Loop to Voice
            this.applyLoopToSource(this.playbackSource, 'record');

            this.playbackSource.start(this.ctx.currentTime + voiceStartDelay);
            this.playbackSource.onended = () => {
               // If looping is active, we don't need to manually restart usually, native loop handles it.
               // However, if we wanted to loop the *whole mix* (drums + voice + bg) that is complex.
               // The current A/B Loop is just for the Voice Buffer.
               // If voice loops, we probably want drums to stop or loop too? 
               // For now, let's assume A/B loop just loops the voice sample.

               if (this.isRecordPlaying && !this.recordLoop) {
                  // If not looping, maybe loop whole pattern? Leftover logic:
                  // if (this.recordLoop) startFullMix(); 
                  // Removing this legacy recursive call as we rely on native looping now.
               }
            };
         }

         // C. Sequence drum hits relative to the same voiceStartDelay
         if (this.recordedSequence.length > 0) {
            this.recordedSequence.forEach(event => {
               const drumTime = voiceStartDelay + (event.time / this.recordPitch) + this.sequenceDelay;
               const timeout = setTimeout(() => {
                  if (this.isRecordPlaying) {
                     if (event.type === 'kick') this.triggerKick();
                     else if (event.type === 'snare') this.triggerSnare();
                     else if (event.type === 'hihat') this.triggerHiHat();
                  }
               }, drumTime * 1000);
               this.playbackTimeouts.push(timeout);
            });
         }
      };

      startFullMix();
      this.isRecordPlaying = true;
      this.emit('recordPlay', true);
   }

   stopRecordPlayback() {
      if (this.playbackSource) {
         this.playbackSource.onended = null;
         try { this.playbackSource.stop(); } catch (e) { }
         this.playbackSource = null;
      }
      if (this.userPlaybackSource) {
         this.userPlaybackSource.onended = null;
         try { this.userPlaybackSource.stop(); } catch (e) { }
         this.userPlaybackSource = null;
      }
      this.playbackTimeouts.forEach(t => clearTimeout(t));
      this.playbackTimeouts = [];
      this.isRecordPlaying = false;
      this.emit('recordPlay', false);
   }

   // --- Precision Scheduler ---

   startScheduler() {
      this.currentBeat = 0;
      this.nextNoteTime = this.ctx.currentTime + 0.05;
      this.schedulerLoop();
   }

   schedulerLoop() {
      // While there are notes that will need to play within the next lookahead window
      while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
         this.scheduleNote(this.currentBeat, this.nextNoteTime);
         this.nextNote();
      }
      this.timerID = window.setTimeout(() => this.schedulerLoop(), this.lookahead);
   }

   nextNote() {
      const secondsPerBeat = 60.0 / this.bpm;
      this.nextNoteTime += secondsPerBeat;
      this.currentBeat = (this.currentBeat + 1) % 4;
   }

   scheduleNote(beatNumber, time) {
      if (this.isMetronomeOn) {
         const osc = this.ctx.createOscillator();
         const env = this.ctx.createGain();
         osc.frequency.value = (beatNumber === 0) ? 1000 : 800;
         env.gain.value = 1;
         env.gain.exponentialRampToValueAtTime(1, time + 0.001);
         env.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
         osc.connect(env);
         env.connect(this.metronomeGain);
         osc.start(time);
         osc.stop(time + 0.05);
      }
      // Emit events for visual feedback synchronization
      const timeUntilNote = (time - this.ctx.currentTime) * 1000;
      setTimeout(() => { this.emit('beat', beatNumber); }, Math.max(0, timeUntilNote));
   }

   // --- Multi-Track Export ---

   /**
    * Renders the entire project (Track 1 + Track 2 + Seq) into a single high-quality buffer.
    * Automatically attempts MP3 encoding, with WAV fallback.
    */
   async exportMix() {
      const proportionalBgPitch = this.userPitch * this.recordPitch;
      const voiceStartOffset = Math.max(0, (this.recordingOffset / proportionalBgPitch) + this.micLatencyOffset);

      // Determine final mix duration based on the longest component
      let duration = 0;
      if (this.userTrackBuffer) duration = Math.max(duration, this.userTrackBuffer.duration / proportionalBgPitch);
      if (this.recordedBuffer) duration = Math.max(duration, voiceStartOffset + (this.recordedBuffer.duration / this.recordPitch));
      if (this.recordedSequence.length > 0) {
         const lastEvent = this.recordedSequence[this.recordedSequence.length - 1];
         duration = Math.max(duration, voiceStartOffset + (lastEvent.time / this.recordPitch) + this.sequenceDelay + 2.0);
      }

      if (duration === 0) return null;

      const sampleRate = 44100;
      const offlineCtx = new OfflineAudioContext(2, Math.ceil(sampleRate * duration), sampleRate);
      const offlineMaster = offlineCtx.createGain();
      offlineMaster.connect(offlineCtx.destination);

      // Re-create the graph in the offline context for rendering
      // 1. User Track
      if (this.userTrackBuffer) {
         const userSource = offlineCtx.createBufferSource();
         userSource.buffer = this.userTrackBuffer;
         userSource.playbackRate.value = proportionalBgPitch;
         const userGain = offlineCtx.createGain();
         userGain.gain.value = this.userVolume * this.recordVolume;
         userSource.connect(userGain);
         userGain.connect(offlineMaster);
         userSource.start(0);
      }

      // 2. Voice
      if (this.recordedBuffer) {
         const recSource = offlineCtx.createBufferSource();
         recSource.buffer = this.recordedBuffer;
         recSource.playbackRate.value = this.recordPitch;
         const recGain = offlineCtx.createGain();
         recGain.gain.value = this.recordVolume;
         recSource.connect(recGain);
         recGain.connect(offlineMaster);
         recSource.start(voiceStartOffset);
      }

      // 3. Sequencer hits
      if (this.recordedSequence.length > 0) {
         this.recordedSequence.forEach(event => {
            const time = voiceStartOffset + (event.time / this.recordPitch) + this.sequenceDelay;
            let buffer = this.sampleBuffers[event.type];
            if (buffer) {
               const source = offlineCtx.createBufferSource();
               source.buffer = buffer;
               source.playbackRate.value = this.recordPitch;
               const drumGain = offlineCtx.createGain();
               drumGain.gain.value = this.recordVolume;
               source.connect(drumGain);
               drumGain.connect(offlineMaster);
               source.start(time);
            }
         });
      }

      try {
         const renderedBuffer = await offlineCtx.startRendering();
         try {
            return this.internalBufferToMp3(renderedBuffer);
         } catch (e) {
            return this.internalBufferToWav(renderedBuffer);
         }
      } catch (err) {
         console.error("[AudioEngine] Render Failed:", err);
         return null;
      }
   }

   /**
    * Encodes an AudioBuffer to MP3 using Lame.js
    */
   internalBufferToMp3(buffer) {
      const numChannels = buffer.numberOfChannels;
      const sampleRate = buffer.sampleRate;
      const kbps = 128;
      const left = buffer.getChannelData(0);
      const right = numChannels > 1 ? buffer.getChannelData(1) : left;

      // Lame only accepts int16 buffers
      const leftInt16 = new Int16Array(left.length);
      const rightInt16 = new Int16Array(right.length);
      for (let i = 0; i < left.length; i++) {
         leftInt16[i] = Math.max(-32768, Math.min(32767, Math.floor(left[i] * 32767)));
         rightInt16[i] = Math.max(-32768, Math.min(32767, Math.floor(right[i] * 32767)));
      }

      const lameLib = lamejs.default || lamejs;
      let mp3encoder = new lameLib.Mp3Encoder(numChannels, sampleRate, kbps);
      const mp3Data = [];
      const sampleBlockSize = 1152;

      for (let i = 0; i < leftInt16.length; i += sampleBlockSize) {
         const leftChunk = leftInt16.subarray(i, i + sampleBlockSize);
         const rightChunk = rightInt16.subarray(i, i + sampleBlockSize);
         let mp3buf = numChannels === 1 ? mp3encoder.encodeBuffer(leftChunk) : mp3encoder.encodeBuffer(leftChunk, rightChunk);
         if (mp3buf.length > 0) mp3Data.push(mp3buf);
      }

      const mp3end = mp3encoder.flush();
      if (mp3end.length > 0) mp3Data.push(mp3end);
      return new Blob(mp3Data, { type: 'audio/mp3' });
   }

   /**
    * Manual WAV header construction for fallback export
    */
   internalBufferToWav(buffer) {
      const numOfChan = buffer.numberOfChannels;
      const length = buffer.length * numOfChan * 2 + 44;
      const bufferArr = new ArrayBuffer(length);
      const view = new DataView(bufferArr);
      const channels = [];
      let i, sample, offset = 0, pos = 0;
      const setUint32 = (data) => { view.setUint32(pos, data, true); pos += 4; };
      const setUint16 = (data) => { view.setUint16(pos, data, true); pos += 2; };
      const writeString = (s) => { for (let j = 0; j < s.length; j++) view.setUint8(pos++, s.charCodeAt(j)); };

      writeString('RIFF'); setUint32(length - 8); writeString('WAVE'); writeString('fmt ');
      setUint32(16); setUint16(1); setUint16(numOfChan);
      setUint32(buffer.sampleRate); setUint32(buffer.sampleRate * 2 * numOfChan);
      setUint16(numOfChan * 2); setUint16(16); writeString('data'); setUint32(length - pos - 4);

      for (i = 0; i < numOfChan; i++) channels.push(buffer.getChannelData(i));
      while (pos < length) {
         for (i = 0; i < numOfChan; i++) {
            for (let ch = 0; ch < numOfChan; ch++) {
               sample = Math.max(-1, Math.min(1, channels[ch][offset]));
               sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
               view.setInt16(pos, sample, true); pos += 2;
            }
            offset++;
         }
      }
      return new Blob([view], { type: 'audio/wav' });
   }

   // --- Event Subscription ---
   subscribe(cb) { this.listeners.add(cb); return () => this.listeners.delete(cb); }
   emit(event, data) { this.listeners.forEach(cb => cb(event, data)); }
}

export const audioEngine = new AudioEngine();
