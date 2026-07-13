import React, { useState, useEffect } from 'react';
import ControlsLeft from './components/ControlsLeft';
import ControlsRight from './components/ControlsRight';
import CenterStage from './components/CenterStage';
import DebugLatency from './components/DebugLatency';
import SubmissionSidebar from './components/SubmissionSidebar';
import { hints } from './components/HintPanel';
import { audioEngine } from './engine/AudioEngine';

function App({ debugMode, samples }) {
   const [isSubmissionOpen, setIsSubmissionOpen] = useState(false);
   const [submissionBlob, setSubmissionBlob] = useState(null);
   const [isProcessing, setIsProcessing] = useState(false);

   // Hint State
   const [activeHintIndex, setActiveHintIndex] = useState(0);
   const [isHintVisible, setIsHintVisible] = useState(true);
   const [currentTrack, setCurrentTrack] = useState(1);
   const [pendingTrackSwitch, setPendingTrackSwitch] = useState(null);

   useEffect(() => {
      if (samples) {
         if (samples.kick) audioEngine.loadSample('kick', samples.kick);
         if (samples.snare) audioEngine.loadSample('snare', samples.snare);
         if (samples.hihat) audioEngine.loadSample('hihat', samples.hihat);
      }
   }, [samples]);

   // Auto-switch track based on hint (with animation)
   useEffect(() => {
      // Hints 0-4: Track 1 (Upload/Play/etc)
      // Hints 5+: Track 2 (Mic/Loop/etc)
      const targetTrack = activeHintIndex >= 5 ? 2 : 1;
      if (targetTrack !== currentTrack) {
         setPendingTrackSwitch(targetTrack);
      }
   }, [activeHintIndex]);

   // Callback when switch animation completes
   const handleSwitchComplete = () => {
      setPendingTrackSwitch(null);
   };

   // Trigger microphone modal when user reaches mic-setup hint
   useEffect(() => {
      const initMicWithModal = async () => {
         // Show modal when mic-setup hint (index 5) becomes active
         if (activeHintIndex === 5) {
            // Check permission status first
            let permissionState = 'prompt';
            if (window.checkMicPermission) {
               permissionState = await window.checkMicPermission();
            }

            if (permissionState === 'granted') {
               // Permission already granted, just init
               audioEngine.initMicrophone();
               if (window.setMicPermissionGranted) window.setMicPermissionGranted(true);
            } else {
               // Show modal for 'prompt' or 'denied'
               if (window.showMicPermissionModal) {
                  window.showMicPermissionModal();
               }

               // If it's explicitly denied, show error immediately
               if (permissionState === 'denied') {
                  if (window.showMicPermissionModalError) window.showMicPermissionModalError();
                  return;
               }

               // For 'prompt': trigger init (browser prompt appears)
               try {
                  await audioEngine.initMicrophone();
                  // SUCCESS: hide modal
                  if (window.setMicPermissionGranted) window.setMicPermissionGranted(true);
                  if (window.hideMicPermissionModal) window.hideMicPermissionModal();
               } catch (error) {
                  console.error('[App] Microphone init failed:', error);
                  // ERROR: show error in modal
                  if (window.showMicPermissionModalError) window.showMicPermissionModalError();
               }
            }
         }
      };
      initMicWithModal();
   }, [activeHintIndex]);


   const handleOpenSubmission = async () => {

      // Stop all playback and recording before exporting
      audioEngine.stopPlayback();
      audioEngine.stopRecording();

      setIsProcessing(true);

      // Use setTimeout to let UI update before heavy processing
      setTimeout(async () => {
         try {
            const blob = await audioEngine.exportMix();
            if (blob) {
               setSubmissionBlob(blob);
               setIsSubmissionOpen(true);
            } else {
               console.warn("[App] Mix failed or duration was 0");
               alert("Please record or upload something first!");
            }
         } finally {
            setIsProcessing(false);
         }
      }, 100);
   };

   // Hint Navigation
   const handleNextHint = () => {
      setActiveHintIndex(prev => (prev + 1) % hints.length);
   };

   const handlePrevHint = () => {
      setActiveHintIndex(prev => (prev - 1 + hints.length) % hints.length);
   };

   const activeTarget = isHintVisible ? hints[activeHintIndex].target : null;

   return (
      <div id="memory-remix-app">
         <div className="app-layout">
            <ControlsLeft
               activeHintTarget={activeTarget}
               currentTrack={currentTrack}
               onTrackChange={setCurrentTrack}
               pendingTrackSwitch={pendingTrackSwitch}
               onSwitchComplete={handleSwitchComplete}
               hintProps={{
                  activeIndex: activeHintIndex,
                  visible: isHintVisible,
                  onNext: handleNextHint,
                  onPrev: handlePrevHint,
                  onHide: () => setIsHintVisible(false),
                  onShow: () => setIsHintVisible(true)
               }}
            />
            <CenterStage />
            <ControlsRight
               onSubmit={handleOpenSubmission}
               activeHintTarget={activeTarget}
               isProcessing={isProcessing}
            />
         </div>


         {debugMode && <DebugLatency />}

         <SubmissionSidebar
            isOpen={isSubmissionOpen}
            onClose={() => setIsSubmissionOpen(false)}
            audioBlob={submissionBlob}
         />
      </div>
   )
}

export default App