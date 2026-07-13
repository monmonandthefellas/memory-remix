import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAudioEngine } from '../hooks/useAudioEngine';

const ControlsRight = ({ onSubmit, activeHintTarget, isProcessing }) => {
   const {
      bpm, setBpm, currentBeat, toggleMetronome, isMetronomeOn,
      triggerKick, triggerSnare, triggerHiHat, init,
      recordedBuffer, userTrackBuffer
   } = useAudioEngine();

   // Local state for pad visual feedback
   const [activePads, setActivePads] = useState({
      kick: false,
      snare: false,
      hihat: false
   });

   // Toast notification state
   const [showToast, setShowToast] = useState(false);
   const toastTimeoutRef = useRef(null);

   const flashPad = useCallback((pad) => {
      setActivePads(prev => ({ ...prev, [pad]: true }));
      setTimeout(() => {
         setActivePads(prev => ({ ...prev, [pad]: false }));
      }, 100);
   }, []);

   const handleKick = useCallback(async () => {
      await init();
      triggerKick();
      flashPad('kick');
   }, [init, triggerKick, flashPad]);

   const handleSnare = useCallback(async () => {
      await init();
      triggerSnare();
      flashPad('snare');
   }, [init, triggerSnare, flashPad]);

   const handleHiHat = useCallback(async () => {
      await init();
      triggerHiHat();
      flashPad('hihat');
   }, [init, triggerHiHat, flashPad]);

   // Keyboard Shortcuts (A=Snare, S=Kick, D=Hi-Hat - matches visual order)
   useEffect(() => {
      const handleKeyDown = (e) => {
         const key = e.key.toLowerCase();
         if (key === 'a') handleSnare();  // Top
         if (key === 's') handleKick();   // Middle
         if (key === 'd') handleHiHat();  // Bottom
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
   }, [handleKick, handleSnare, handleHiHat]);


   // BPM range for circular slider
   const MIN_BPM = 40;
   const MAX_BPM = 208;

   // --- Arc Slider Logic (Speedometer Style, 270 degrees, gap at bottom) ---
   const dialRef = useRef(null);
   const [isDragging, setIsDragging] = useState(false);

   // Arc spans 270 degrees with 90-degree gap at the bottom
   // Start at bottom-left (225°) → end at bottom-right (495° = 135° wrapped)
   const ARC_START_ANGLE = 225; // degrees (bottom-left)
   const ARC_END_ANGLE = 495;   // degrees (bottom-right, wraps around)
   const ARC_SPAN = 270;         // total degrees
   const RADIUS = 56;            // Arc radius (hugging button edge)
   const CENTER = 72;            // center of 144x144 viewBox

   // Convert BPM to angle on the arc
   const bpmToAngle = (value) => {
      const ratio = (value - MIN_BPM) / (MAX_BPM - MIN_BPM);
      return ARC_START_ANGLE + ratio * ARC_SPAN;
   };

   // Convert angle to BPM (clamped to arc range)
   const angleToBpm = (angle) => {
      let normalizedAngle = angle;
      if (normalizedAngle < 0) normalizedAngle += 360;
      if (normalizedAngle >= 360) normalizedAngle %= 360;

      // Handle the wrap-around
      let arcAngle = normalizedAngle;
      if (normalizedAngle < ARC_START_ANGLE && normalizedAngle < 135) {
         arcAngle = normalizedAngle + 360;
      }

      // Clamp to arc bounds
      if (arcAngle < ARC_START_ANGLE) return MIN_BPM;
      if (arcAngle > ARC_END_ANGLE) return MAX_BPM;

      const ratio = (arcAngle - ARC_START_ANGLE) / ARC_SPAN;
      return Math.round(MIN_BPM + ratio * (MAX_BPM - MIN_BPM));
   };

   // Polar to cartesian for handle position
   const polarToCartesian = (cx, cy, r, angleDeg) => {
      const rad = (angleDeg - 90) * (Math.PI / 180);
      return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
   };

   // Generate SVG arc path
   const describeArc = (cx, cy, r, startAngle, endAngle) => {
      const start = polarToCartesian(cx, cy, r, endAngle);
      const end = polarToCartesian(cx, cy, r, startAngle);
      const largeArcFlag = (endAngle - startAngle) <= 180 ? 0 : 1;
      return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
   };

   const arcPath = describeArc(CENTER, CENTER, RADIUS, ARC_START_ANGLE, ARC_END_ANGLE);
   const currentAngle = bpmToAngle(bpm);
   const handlePos = polarToCartesian(CENTER, CENTER, RADIUS, currentAngle);

   // Pointer interaction handlers
   const handleRadialInteraction = (e) => {
      if (!dialRef.current) return;
      const rect = dialRef.current.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const deltaX = clientX - centerX;
      const deltaY = clientY - centerY;

      let angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI) + 90;
      if (angle < 0) angle += 360;

      const newBpm = angleToBpm(angle);
      setBpm(Math.max(MIN_BPM, Math.min(MAX_BPM, newBpm)));
   };

   const handleMouseDown = (e) => {
      if (e.target.closest('.metronome-btn')) return; // Don't drag if clicking button
      setIsDragging(true);
      handleRadialInteraction(e);
   };

   useEffect(() => {
      const handleGlobalMove = (e) => {
         if (isDragging) {
            e.preventDefault();
            handleRadialInteraction(e);
         }
      };
      const handleGlobalUp = () => setIsDragging(false);

      if (isDragging) {
         window.addEventListener('mousemove', handleGlobalMove);
         window.addEventListener('mouseup', handleGlobalUp);
         window.addEventListener('touchmove', handleGlobalMove, { passive: false });
         window.addEventListener('touchend', handleGlobalUp);
      }

      return () => {
         window.removeEventListener('mousemove', handleGlobalMove);
         window.removeEventListener('mouseup', handleGlobalUp);
         window.removeEventListener('touchmove', handleGlobalMove);
         window.removeEventListener('touchend', handleGlobalUp);
      };
   }, [isDragging]);

   // Check if we can submit
   const canSubmit = !!(recordedBuffer || userTrackBuffer);

   return (
      <div className="rightSide">
         <div className="controls-right">
            {/* 1. Drum Pads */}
            <div className="pads-group">
               <button className={`circle-btn pad-btn ${activePads.snare ? 'active' : ''} ${activeHintTarget === 'pads-group' ? 'hint-highlight' : ''}`} onClick={handleSnare}>
                  <div className="pad-icon-svg">
                     <svg width="32" height="30" viewBox="0 0 32 30" fill="none" className="pad-svg-icon">
                        <path d="M1.12988 13.0825C1.14792 13.0626 1.17742 13.035 1.22363 12.9995C1.37321 12.8847 1.62661 12.7507 2.00293 12.6108C2.74982 12.3334 3.86036 12.0743 5.26855 11.853C8.07727 11.4117 11.9763 11.1363 16.2959 11.1362C20.6157 11.1362 24.5154 11.4116 27.3242 11.853C28.7324 12.0743 29.843 12.3334 30.5898 12.6108C30.9662 12.7507 31.2196 12.8847 31.3691 12.9995C31.415 13.0347 31.4438 13.0626 31.4619 13.0825C31.4438 13.1024 31.415 13.1303 31.3691 13.1655C31.2196 13.2804 30.9661 13.4144 30.5898 13.5542C29.843 13.8316 28.7324 14.0907 27.3242 14.312C24.5154 14.7534 20.6157 15.0288 16.2959 15.0288C11.9763 15.0288 8.07727 14.7534 5.26855 14.312C3.86038 14.0907 2.74982 13.8316 2.00293 13.5542C1.62664 13.4144 1.37321 13.2804 1.22363 13.1655C1.17745 13.1301 1.14792 13.1025 1.12988 13.0825Z" stroke="#063A5C" strokeWidth="1.04464" />
                        <path d="M1.12988 26.9976C1.14792 26.9776 1.17742 26.95 1.22363 26.9146C1.37321 26.7997 1.62661 26.6657 2.00293 26.5259C2.74982 26.2485 3.86036 25.9894 5.26855 25.7681C8.07727 25.3267 11.9763 25.0513 16.2959 25.0513C20.6157 25.0513 24.5154 25.3267 27.3242 25.7681C28.7324 25.9894 29.843 26.2485 30.5898 26.5259C30.9662 26.6657 31.2196 26.7997 31.3691 26.9145C31.415 26.9498 31.4438 26.9776 31.4619 26.9976C31.4438 27.0175 31.415 27.0454 31.3691 27.0806C31.2196 27.1954 30.9661 27.3294 30.5898 27.4692C29.843 27.7467 28.7324 28.0058 27.3242 28.227C24.5154 28.6684 20.6157 28.9438 16.2959 28.9438C11.9763 28.9438 8.07727 28.6684 5.26855 28.2271C3.86038 28.0058 2.74982 27.7467 2.00293 27.4692C1.62664 27.3294 1.37321 27.1954 1.22363 27.0806C1.17745 27.0451 1.14792 27.0175 1.12988 26.9976Z" stroke="#063A5C" strokeWidth="1.04464" />
                        <line x1="15.9432" y1="12.4891" x2="28.0626" y2="0.369577" stroke="#063A5C" strokeWidth="1.04464" />
                        <line x1="31.4835" y1="26.7729" x2="31.4835" y2="13.3069" stroke="#063A5C" strokeWidth="1.04464" />
                        <line x1="0.5226" y1="26.7729" x2="0.5226" y2="13.3069" stroke="#063A5C" strokeWidth="1.04464" />
                     </svg>
                  </div>
                  <span className="pad-label">SNARE</span>
               </button>

               <button className={`circle-btn pad-btn ${activePads.kick ? 'active' : ''} ${activeHintTarget === 'pads-group' ? 'hint-highlight' : ''}`} onClick={handleKick}>
                  <div className="pad-icon-svg">
                     <svg width="33" height="37" viewBox="0 0 33 37" fill="none" className="pad-svg-icon">
                        <circle cx="28.6873" cy="15.534" r="3.949" fill="#063A5C" />
                        <path d="M2.89551 0.527344C2.91943 0.539676 2.97719 0.577479 3.06543 0.692383C3.20806 0.878109 3.36785 1.18489 3.5332 1.62988C3.86179 2.5143 4.16775 3.82413 4.42773 5.47852C4.94642 8.77924 5.26953 13.3582 5.26953 18.4287C5.26953 23.4992 4.94642 28.0782 4.42773 31.3789C4.16776 33.0333 3.86178 34.3431 3.5332 35.2275C3.36786 35.6725 3.20805 35.9793 3.06543 36.165C2.97766 36.2793 2.91964 36.3166 2.89551 36.3291C2.871 36.3162 2.8135 36.2782 2.72656 36.165C2.58395 35.9793 2.42413 35.6725 2.25879 35.2275C1.93021 34.3431 1.62424 33.0332 1.36426 31.3789C0.845574 28.0782 0.522463 23.4992 0.522461 18.4287C0.522461 13.3582 0.845573 8.77924 1.36426 5.47852C1.62424 3.82414 1.93021 2.51429 2.25879 1.62988C2.42413 1.18491 2.58394 0.878103 2.72656 0.692383C2.81396 0.578593 2.8712 0.540049 2.89551 0.527344Z" stroke="#063A5C" strokeWidth="1.04464" />
                        <line x1="2.81227" y1="36.4533" x2="28.6124" y2="15.3919" stroke="#063A5C" strokeWidth="1.04464" />
                     </svg>
                  </div>
                  <span className="pad-label">KICK</span>
               </button>

               <button className={`circle-btn pad-btn ${activePads.hihat ? 'active' : ''} ${activeHintTarget === 'pads-group' ? 'hint-highlight' : ''}`} onClick={handleHiHat}>
                  <div className="pad-icon-svg">
                     <svg width="34" height="35" viewBox="0 0 34 35" fill="none" className="pad-svg-icon">
                        <path d="M0.538086 14.9321C0.556117 14.909 0.589595 14.8703 0.655273 14.8198C0.816574 14.696 1.08698 14.5538 1.48535 14.4058C2.2768 14.1117 3.45226 13.8379 4.94043 13.604C7.90856 13.1376 12.0279 12.8462 16.5908 12.8462C21.1538 12.8462 25.2731 13.1376 28.2412 13.604C29.7294 13.8379 30.9048 14.1117 31.6963 14.4058C32.0947 14.5538 32.3651 14.696 32.5264 14.8198C32.592 14.8702 32.6255 14.909 32.6436 14.9321C32.6253 14.9553 32.5912 14.9927 32.5264 15.0425C32.3651 15.1663 32.0948 15.3085 31.6963 15.4565C30.9048 15.7506 29.7294 16.0254 28.2412 16.2593C25.2731 16.7257 21.1537 17.0161 16.5908 17.0161C12.0279 17.0161 7.90856 16.7257 4.94043 16.2593C3.45225 16.0254 2.2768 15.7506 1.48535 15.4565C1.08686 15.3085 0.816518 15.1663 0.655273 15.0425C0.59041 14.9927 0.556305 14.9553 0.538086 14.9321Z" stroke="#063A5C" strokeWidth="1.04464" />
                        <line x1="16.0656" y1="14.2207" x2="16.0656" y2="-3.52631e-05" stroke="#063A5C" strokeWidth="1.04464" />
                        <line x1="16.0656" y1="34.6025" x2="16.0656" y2="20.3818" stroke="#063A5C" strokeWidth="1.04464" />
                        <path d="M0.538086 17.7759C0.556117 17.7527 0.589595 17.714 0.655273 17.6636C0.816574 17.5398 1.08698 17.3975 1.48535 17.2495C2.2768 16.9555 3.45226 16.6816 4.94043 16.4478C7.90856 15.9813 12.0279 15.6899 16.5908 15.6899C21.1538 15.6899 25.2731 15.9813 28.2412 16.4478C29.7294 16.6816 30.9048 16.9555 31.6963 17.2495C32.0947 17.3975 32.3651 17.5398 32.5264 17.6636C32.592 17.714 32.6255 17.7527 32.6436 17.7759C32.6253 17.7991 32.5912 17.8364 32.5264 17.8862C32.3651 18.0101 32.0948 18.1522 31.6963 18.3003C30.9048 18.5943 29.7294 18.8692 28.2412 19.103C25.2731 19.5694 21.1537 19.8599 16.5908 19.8599C12.0279 19.8599 7.90856 19.5694 4.94043 19.103C3.45225 18.8692 2.2768 18.5943 1.48535 18.3003C1.08686 18.1522 0.816518 18.0101 0.655273 17.8862C0.59041 17.8364 0.556305 17.7991 0.538086 17.7759Z" stroke="#063A5C" strokeWidth="1.04464" />
                     </svg>
                  </div>
                  <span className="pad-label">HI-HAT</span>
               </button>
            </div>

            {/* 2. Metronome Group with custom SVG arc slider (Speedometer style) */}
            <div className="metronome-group">
               <div
                  ref={dialRef}
                  className="metronome-dial-container"
                  onMouseDown={handleMouseDown}
                  onTouchStart={handleMouseDown}
               >
                  {/* Center button */}
                  <button
                     className={`circle-btn metronome-btn ${isMetronomeOn && currentBeat === 0 ? 'pulse' : ''} ${isMetronomeOn ? 'active' : ''} ${activeHintTarget === 'metronome-btn' ? 'hint-highlight' : ''}`}
                     onClick={toggleMetronome}
                  >
                     <div className="bpm-icon">
                        <svg width="24" height="22" viewBox="0 0 38 34" fill="none" className="metronome-svg-icon">
                           <circle cx="33.7181" cy="7.58301" r="2.97852" transform="rotate(-45 33.7181 7.58301)" fill="#063A5C" />
                           <line x1="16.4885" y1="24.9365" x2="37.5499" y2="3.00846" stroke="#063A5C" strokeWidth="1.04464" />
                           <path d="M0 28.2222V33.6982H27.801V28.2222L18.9552 0H9.68822L0 28.2222Z" fill="#063A5C" />
                        </svg>
                     </div>
                     <div className="bpm-text-group">
                        <span className="bpm-label">METRONOME</span>
                        <span className="bpm-value"><strong>{bpm} BPM</strong></span>
                     </div>
                  </button>

                  {/* Custom SVG arc slider */}
                  <svg className="radial-ring" viewBox="0 0 144 144" style={{ overflow: 'visible' }}>
                     {/* Arc track (270 degrees, gap at bottom) */}
                     <path
                        d={arcPath}
                        fill="none"
                        stroke="rgba(255,255,255,0.2)"
                        strokeWidth="1"
                        strokeLinecap="round"
                     />
                     {/* Handle/thumb */}
                     <circle
                        cx={handlePos.x}
                        cy={handlePos.y}
                        r="8"
                        fill="var(--color-dark-blue)"
                        stroke="var(--color-cream)"
                        strokeWidth="1"
                        style={{ cursor: 'grab' }}
                     />
                  </svg>
               </div>
            </div>

            {/* 3. Submit Button */}
            <div className="submit-group">
               <button
                  className={`circle-btn submit-btn ${!canSubmit ? 'disabled' : ''} ${isProcessing ? 'processing' : ''}`}
                  onClick={() => {
                     if (isProcessing) return; // Prevent double-click
                     if (!canSubmit) {
                        // Show toast warning
                        setShowToast(true);
                        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
                        toastTimeoutRef.current = setTimeout(() => setShowToast(false), 3000);
                     } else {
                        onSubmit();
                     }
                  }}
                  disabled={isProcessing}
               >
                  {isProcessing ? (
                     <>
                        <svg className="submit-spinner" viewBox="0 0 50 50">
                           <circle
                              className="spinner-track"
                              cx="25" cy="25" r="20"
                              fill="none"
                              strokeWidth="4"
                           />
                           <circle
                              className="spinner-progress"
                              cx="25" cy="25" r="20"
                              fill="none"
                              strokeWidth="4"
                              strokeDasharray="80 126"
                           />
                        </svg>
                        <span className="submit-text">PROCESSING</span>
                        <span className="submit-hint">may take ~1 min</span>
                     </>
                  ) : (
                     'SUBMIT'
                  )}
               </button>

               {/* Toast Notification */}
               <div className={`submit-toast ${showToast ? 'visible' : ''}`}>
                  <span>⚠️</span>
                  <p>Please record or upload audio first!</p>
               </div>
            </div>
         </div>
      </div>
   );
};

export default ControlsRight;
