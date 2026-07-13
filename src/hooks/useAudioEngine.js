import { useState, useEffect, useCallback } from 'react';
import { audioEngine } from '../engine/AudioEngine';

export function useAudioEngine() {
   const [isPlaying, setIsPlaying] = useState(audioEngine.isPlaying);
   const [bpm, setBpm] = useState(audioEngine.bpm);
   const [currentBeat, setCurrentBeat] = useState(0);
   const [isRecording, setIsRecording] = useState(audioEngine.isRecording);
   const [isMetronomeOn, setIsMetronomeOn] = useState(audioEngine.isMetronomeOn);
   const [recordingUrl, setRecordingUrl] = useState(null);
   const [recordedBuffer, setRecordedBuffer] = useState(audioEngine.recordedBuffer);
   const [userTrackBuffer, setUserTrackBuffer] = useState(audioEngine.userTrackBuffer);

   // Separate Track States
   const [userVolume, setUserVolumeState] = useState(0.8);
   const [recordVolume, setRecordVolumeState] = useState(0.8);
   const [userPitch, setUserPitchState] = useState(1.0);
   const [recordPitch, setRecordPitchState] = useState(1.0);
   const [userLoop, setUserLoopState] = useState(false); // Legacy boolean (keeping for now)
   const [userLoopState, setUserLoopStateValue] = useState('OFF'); // New 3-State
   const [recordLoop, setRecordLoopState] = useState(false);
   const [recordLoopState, setRecordLoopStateValue] = useState('OFF'); // A/B Loop State

   // Separate Track Playback States
   const [isUserPlaying, setIsUserPlaying] = useState(false);
   const [isRecordPlaying, setIsRecordPlaying] = useState(false);

   // Track current audio URL for 3D sync events
   const [currentAudioUrl, setCurrentAudioUrl] = useState(null);

   // Helper to dispatch 3D sync event
   const dispatch3DSync = useCallback((url, playing) => {
      window.dispatchEvent(new CustomEvent('memory-audio-sync', {
         detail: { url, isPlaying: playing }
      }));
   }, []);

   useEffect(() => {
      // Subscribe to engine events
      const unsubscribe = audioEngine.subscribe((event, data) => {
         if (event === 'play') setIsPlaying(data);
         if (event === 'bpm') setBpm(data);
         if (event === 'beat') setCurrentBeat(data);
         if (event === 'isRecording') setIsRecording(data);
         if (event === 'metronome') setIsMetronomeOn(data);
         if (event === 'recordingComplete') {
            setRecordingUrl(data);
            setRecordedBuffer(audioEngine.recordedBuffer);
            setCurrentAudioUrl(data); // Store URL for 3D sync
            // Dispatch: track loaded, not playing yet
            dispatch3DSync(data, false);
         }
         if (event === 'userFileLoaded') {
            setUserTrackBuffer(data);
         }
         // Sync local state with engine events
         if (event === 'userLoop') setUserLoopState(data);
         if (event === 'userLoopState') setUserLoopStateValue(data);
         if (event === 'recordLoop') setRecordLoopState(data);
         if (event === 'recordLoopState') setRecordLoopStateValue(data);
         // Per-track playback state + 3D sync
         if (event === 'userPlay') {
            setIsUserPlaying(data);
            dispatch3DSync(currentAudioUrl, data);
         }
         if (event === 'recordPlay') {
            setIsRecordPlaying(data);
            dispatch3DSync(currentAudioUrl, data);
         }
      });

      return () => unsubscribe();
   }, [dispatch3DSync, currentAudioUrl]);

   const init = useCallback(async () => {
      await audioEngine.init();
   }, []);

   // "PLAY" button now plays the LAST RECORDING  (DEPRECATED - use per-track methods)
   const togglePlay = useCallback(() => {
      init();
      audioEngine.playRecording();
   }, [init]);

   // === PER-TRACK PLAYBACK ===
   const toggleUserPlay = useCallback(async () => {
      await init();
      audioEngine.playUserTrackOnly();
   }, [init]);

   const toggleRecordPlay = useCallback(async () => {
      await init();
      audioEngine.playRecordTrackOnly();
   }, [init]);

   const changeBpm = useCallback((newBpm) => {
      audioEngine.setBpm(newBpm);
   }, []);

   const startRecording = useCallback(async () => {
      await audioEngine.init(); // MUST resume AudioContext first!
      await audioEngine.initMicrophone();
      await audioEngine.startRecording();
   }, []);

   const stopRecording = useCallback(() => {
      audioEngine.stopRecording();
   }, []);

   const toggleMetronome = useCallback(() => {
      init(); // Ensure ctx running
      audioEngine.toggleMetronome();
   }, [init]);

   // Track Controls
   const setUserVolume = useCallback((val) => {
      setUserVolumeState(val);
      audioEngine.setUserVolume(val);
   }, []);

   const setRecordVolume = useCallback((val) => {
      setRecordVolumeState(val);
      audioEngine.setRecordVolume(val);
   }, []);

   const setUserPitch = useCallback((val) => {
      setUserPitchState(val);
      audioEngine.setUserPitch(val);
   }, []);

   const setRecordPitch = useCallback((val) => {
      setRecordPitchState(val);
      audioEngine.setRecordPitch(val);
   }, []);

   const toggleUserLoop = useCallback(() => {
      audioEngine.toggleUserLoop();
   }, []);

   const toggleRecordLoop = useCallback(() => {
      audioEngine.toggleRecordLoop();
   }, []);

   const triggerKick = useCallback(() => {
      audioEngine.triggerKick();
   }, []);

   const triggerSnare = useCallback(() => {
      audioEngine.triggerSnare();
   }, []);

   const triggerHiHat = useCallback(() => {
      audioEngine.triggerHiHat();
   }, []);

   const setRecordingDelay = useCallback((ms) => {
      audioEngine.setRecordingDelay(ms);
   }, []);

   const loadUserFile = useCallback(async (file) => {
      return await audioEngine.loadUserFile(file);
   }, []);

   return {
      isPlaying,
      bpm,
      currentBeat,
      isRecording,
      isMetronomeOn,
      recordingUrl,
      recordedBuffer,
      userTrackBuffer,

      // Separate Track State
      userVolume, recordVolume,
      userPitch, recordPitch,
      userLoop, userLoopState, recordLoop, recordLoopState,

      // Per-track Playback State
      isUserPlaying, isRecordPlaying,

      togglePlay,
      toggleUserPlay,
      toggleRecordPlay,
      setBpm: changeBpm,
      startRecording,
      stopRecording,
      toggleMetronome,

      // Separate Track Setters
      setUserVolume, setRecordVolume,
      setUserPitch, setRecordPitch,
      toggleUserLoop, toggleRecordLoop,

      triggerKick,
      triggerSnare,
      triggerHiHat,
      setRecordingDelay,
      init,
      loadUserFile
   };
}
