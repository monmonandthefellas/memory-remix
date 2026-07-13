import React, { useState } from 'react';
import { useAudioEngine } from '../hooks/useAudioEngine';

const DebugLatency = () => {
   const { setRecordingDelay } = useAudioEngine();
   const [latency, setLatency] = useState(85);

   const handleChange = (e) => {
      const val = parseInt(e.target.value);
      setLatency(val);
      setRecordingDelay(val);
   };

   return (
      <div style={{
         position: 'fixed',
         bottom: '20px',
         right: '250px',
         background: 'rgba(0,0,0,0.8)',
         padding: '15px',
         borderRadius: '10px',
         color: 'white',
         zIndex: 1000,
         display: 'flex',
         flexDirection: 'column',
         gap: '10px',
         border: '1px solid var(--color-highlight)',
         fontSize: '12px'
      }}>
         <label style={{ fontWeight: 'bold', color: 'var(--color-highlight)' }}>
            DRUM OFFSET (PLAYBACK): {latency}ms
         </label>
         <input
            type="range"
            min="0"
            max="1000"
            value={latency}
            onChange={handleChange}
            style={{ width: '150px' }}
         />
         <p style={{ margin: 0, opacity: 0.7, fontSize: '10px' }}>
            Adjust this while listening to PLAYBACK.<br />
            Increase if drums sound TOO EARLY compared to voice.
         </p>
      </div>
   );
};

export default DebugLatency;
