import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

function SphereParticles({ analyser }) {
   const pointsRef = useRef();
   const count = 2000;

   // Create initial positions on a sphere - these are the ORIGINAL positions we'll reference
   const originalPositions = useMemo(() => {
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
         const phi = Math.acos(-1 + (2 * i) / count);
         const theta = Math.sqrt(count * Math.PI) * phi;

         const radius = 1.0;
         const x = radius * Math.cos(theta) * Math.sin(phi);
         const y = radius * Math.sin(theta) * Math.sin(phi);
         const z = radius * Math.cos(phi);

         pos[i * 3] = x;
         pos[i * 3 + 1] = y;
         pos[i * 3 + 2] = z;
      }
      return pos;
   }, [count]);

   // Create a separate array for the live geometry (mutable)
   const livePositions = useMemo(() => new Float32Array(originalPositions), [originalPositions]);

   const dataArray = useMemo(() => new Uint8Array(analyser ? analyser.frequencyBinCount : 128), [analyser]);

   useFrame((state) => {
      if (!pointsRef.current) return;

      // Get frequency data if analyser exists
      let boost = 0;
      if (analyser) {
         analyser.getByteFrequencyData(dataArray);
         let avg = 0;
         for (let i = 0; i < dataArray.length; i++) avg += dataArray[i];
         avg /= dataArray.length;
         boost = avg / 128.0; // 0 to 2
      }

      const positionsArray = pointsRef.current.geometry.attributes.position.array;

      for (let i = 0; i < count; i++) {
         const i3 = i * 3;
         // Always read from ORIGINAL positions
         const x = originalPositions[i3];
         const y = originalPositions[i3 + 1];
         const z = originalPositions[i3 + 2];

         // Calculate displacement based on frequency
         const freqIndex = analyser ? (i % dataArray.length) : 0;
         const freqValue = analyser ? (dataArray[freqIndex] / 255.0) : 0;

         // Radius is always relative to 1.0 (base) + audio effect
         const currentRadius = 1.0 + freqValue * 0.5 + boost * 0.15;

         positionsArray[i3] = x * currentRadius;
         positionsArray[i3 + 1] = y * currentRadius;
         positionsArray[i3 + 2] = z * currentRadius;
      }

      pointsRef.current.geometry.attributes.position.needsUpdate = true;
      pointsRef.current.rotation.y += 0.002;
      pointsRef.current.rotation.x += 0.001;
   });

   return (
      <Points ref={pointsRef} positions={livePositions} stride={3} position={[0, 0, 0]}>
         <PointMaterial
            transparent
            color="#F9FFEB"
            size={0.03}
            sizeAttenuation={true}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
         />
      </Points>
   );
}

const MemorySphereVisualizer = ({ howlInstance }) => {
   const [analyser, setAnalyser] = React.useState(null);

   useEffect(() => {
      if (!howlInstance) return;

      const ctx = window.Howler ? window.Howler.ctx : null;
      if (!ctx) return;

      const newAnalyser = ctx.createAnalyser();
      newAnalyser.fftSize = 256;

      let source = null;

      // Try to get the internal node (HTML5 Audio or Web Audio)
      const setupConnection = () => {
         try {
            // Find the sound within the howlInstance
            const sound = howlInstance._sounds?.[0];
            if (!sound) return;

            // If it's HTML5 Audio, we need a MediaElementSource
            if (sound._node && (sound._node instanceof HTMLAudioElement || sound._node.tagName === 'AUDIO')) {
               // Check if we've already created a source for this node (store on the node to avoid duplicate errors)
               if (!sound._node.__source) {
                  sound._node.__source = ctx.createMediaElementSource(sound._node);
               }
               source = sound._node.__source;
               source.connect(newAnalyser);
               // newAnalyser.connect(ctx.destination); // Commented out to fix double audio
            } else if (window.Howler.masterGain) {
               // Fallback to global master if it's Web Audio
               window.Howler.masterGain.connect(newAnalyser);
            }
         } catch (e) {
            console.warn("Visualizer connection failed:", e);
         }
      };

      // If howl is already loaded, setup immediately, otherwise wait
      if (howlInstance.state() === 'loaded') {
         setupConnection();
      } else {
         howlInstance.once('load', setupConnection);
      }

      setAnalyser(newAnalyser);

      return () => {
         if (source && source.numberOfOutputs > 0) {
            try { source.disconnect(newAnalyser); } catch (e) { }
         }
         if (window.Howler.masterGain) {
            try { window.Howler.masterGain.disconnect(newAnalyser); } catch (e) { }
         }
         try { newAnalyser.disconnect(); } catch (e) { }
      };
   }, [howlInstance]);

   const [fadedIn, setFadedIn] = React.useState(false);
   const wrapperRef = useRef(null);

   useEffect(() => {
      // Fade in shortly after mount to ensure smooth transition
      const timer = setTimeout(() => {
         setFadedIn(true);
      }, 100);

      return () => {
         clearTimeout(timer);
      };
   }, []);

   return (
      <div
         ref={wrapperRef}
         className="memory-sphere-wrapper"
         style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'none',
            opacity: fadedIn ? 1 : 0,
            transition: 'opacity 1.5s ease'
         }}
      >
         <Canvas camera={{ position: [0, 0, 3.6], fov: 45 }} dpr={[1, 2]} style={{ width: '100%', height: '100%' }}>
            <ambientLight intensity={0.5} />
            <SphereParticles analyser={analyser} />
         </Canvas>
      </div>
   );
};

export default MemorySphereVisualizer;
