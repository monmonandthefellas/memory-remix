import React from 'react';

const hints = [
   {
      id: 'upload',
      target: 'upload-btn',
      text: 'UPLOAD A TRACK OF YOUR MEMORY IN A .WAV OR .MP3 FILE'
   },
   {
      id: 'play',
      target: 'play-btn',
      text: 'NOW PLAY THE FILE.\nYOU CAN ALSO STOP AT ANY TIME.'
   },
   {
      id: 'sliders',
      target: 'sliders-group',
      text: 'ADJUST THE VOLUME AND PITCH'
   },
   {
      id: 'loop',
      target: 'loop-btn',
      text: 'LOOP THE TRACK HERE. CLICK ONCE TO START RECORDING THE LOOP. CLICK AGAIN TO DEFINE THE LOOP AND KEEP IT PLAYING. DISABLE THE LOOP BY CLICKING ONE MORE TIME.'
   },
   {
      id: 'track',
      target: 'track-switcher',
      text: 'SWITCH TO THE NEXT TRACK'
   },
   // New Hints
   {
      id: 'mic-setup',
      target: null, // Removed highlight area for mic permission
      text: 'TURN ON YOUR MICROPHONE, IF IT ISN\'T ON ALREADY'
   },
   {
      id: 'start-recording',
      target: 'rec-btn', // Highlight the REC button for Track 2
      text: 'PRESS START REC TO BEGIN RECORDING YOUR SOUNDS'
   },
   {
      id: 'make-sound',
      target: null, // Detailed: 2nd new prompt -> No highlight
      text: 'MAKE ONE SOUND FOR A LONG TIME.'
   },
   {
      id: 'turn-looper',
      target: 'loop-btn', // Detailed: 3rd new prompt -> Highlight Loop (implied)
      text: 'TURN ON THE LOOPER'
   },
   {
      id: 'make-other',
      target: null, // Detailed: 4th new prompt -> No highlight
      text: 'MAKE OTHER SOUNDS THAT GO WITH THE LONG SOUND.'
   },
   {
      id: 'metronome',
      target: 'metronome-btn', // Detailed: 5th new prompt -> Highlight Metronome
      text: 'TURN ON THE METRONOME. MAKE SOUNDS YOU LIKE IN TIME WITH THE METRONOME.'
   },
   {
      id: 'looper-pattern',
      target: 'loop-btn',
      text: 'TURN ON THE LOOPER. MAKE OTHER SOUNDS THAT GO WITH THE PATTERN.'
   },
   {
      id: 'metronome-drums',
      target: 'pads-group',
      text: 'TURN ON THE METRONOME. PLAY THE DRUMS WITH THE METRONOME.'
   },
   {
      id: 'voicemail-echo',
      target: null,
      text: 'As you listen to the voice, notice any sounds you might mirror or echo.'
   },
   {
      id: 'lyrics-connection',
      target: null,
      text: 'Do any lyrics or songs evoke a sense of connection or remembrance of your loved one?'
   },
   {
      id: 'images-dreamlike',
      target: null,
      text: 'Do images, memories, or dreamlike impressions arise that could support your music-making?'
   }
];

const HintPanel = ({ activeIndex, onNext, onPrev, onHide, onShow, visible }) => {
   const isFirstPage = activeIndex === 0;
   const isLastPage = activeIndex === hints.length - 1;

   if (!visible) {
      return (
         <button className="hint-panel-minimized" onClick={onShow}>
            SHOW PROMPTS
         </button>
      );
   }

   const currentHint = hints[activeIndex];

   return (
      <div className="hint-panel">
         <div className="hint-content">
            <p className="hint-text">
               {currentHint.text}
            </p>
         </div>

         <div className="hint-controls">
            <button
               className={`hint-nav-btn prev ${isFirstPage ? 'disabled' : ''}`}
               onClick={onPrev}
               disabled={isFirstPage}
            >
               <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.41 7.41L17 6l-6 6 6 6 1.41-1.41L13.83 12z" />
                  <path d="M12.41 7.41L11 6l-6 6 6 6 1.41-1.41L7.83 12z" />
               </svg>
            </button>
            <button
               className={`hint-nav-btn next ${isLastPage ? 'disabled' : ''}`}
               onClick={onNext}
               disabled={isLastPage}
            >
               <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5.59 7.41L7 6l6 6-6 6-1.41-1.41L10.17 12z" />
                  <path d="M11.59 7.41L13 6l6 6-6 6-1.41-1.41L16.17 12z" />
               </svg>
            </button>
         </div>

         <button className="hint-hide-btn" onClick={onHide}>
            HIDE PROMPTS
         </button>
      </div>
   );
};


export { HintPanel, hints };
