import React, { useRef } from 'react';
import GravityVisualizer from './GravityVisualizer';
import { audioEngine } from '../engine/AudioEngine';

const CenterStage = () => {
   // Create a stable ref for the analyser to pass to the visualizer
   const analyserRef = useRef(audioEngine.analyser);

   return (
      <div className="center-stage">
         <GravityVisualizer analyserRef={analyserRef} />
      </div>
   );
};

export default CenterStage;
