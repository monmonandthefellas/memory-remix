
import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import Particles from './Particles';

// Attractor Visuals (Rings and Arrows)
const AttractorVisual = ({ position, axis, isInteractive = false }) => {
   // Just a simple visual representation
   const groupRef = useRef();

   // Align visual to axis
   useFrame(() => {
      if (groupRef.current) {
         groupRef.current.position.copy(position);
         const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
         groupRef.current.quaternion.copy(quaternion);
      }
   });

   return null;
}

const AttractorController = ({
   analyserRef,
   attractorsRefs,
   loadedAudioPlaybackSourceRef,
   loadedAudioPlayRateRef,
   loadedAudioLoopIsSelectedRef
}) => {
   const dataArray = useMemo(() => new Uint8Array(2048), []);

   useFrame(() => {
      // Audio Playback Sync
      if (loadedAudioPlaybackSourceRef?.current) {
         loadedAudioPlaybackSourceRef.current.playbackRate.value = loadedAudioPlayRateRef.current || 1.0;
         loadedAudioPlaybackSourceRef.current.loop = loadedAudioLoopIsSelectedRef.current;
      }

      // Always update attractor positions
      const n = attractorsRefs.length;

      // If we have audio analyzer, use amplitude to modulate Y
      if (analyserRef?.current) {
         const analyser = analyserRef.current;
         analyser.getByteTimeDomainData(dataArray);
         const bufferLength = analyser.frequencyBinCount;

         for (let i = 0; i < n; i++) {
            if (!attractorsRefs[i]) continue;

            const sliceIndex = Math.floor((i / n) * bufferLength);
            if (sliceIndex < dataArray.length) {
               const amplitude = (dataArray[sliceIndex] - 128) / 128;
               const newY = attractorsRefs[i].basePos.y + amplitude * 5;

               attractorsRefs[i].position.set(
                  attractorsRefs[i].basePos.x,
                  newY,
                  attractorsRefs[i].basePos.z
               );
            }
         }
      } else {
         // No audio - keep attractors at base positions
         for (let i = 0; i < n; i++) {
            if (!attractorsRefs[i]) continue;
            attractorsRefs[i].position.copy(attractorsRefs[i].basePos);
         }
      }
   });
   return null;
}

const GravityVisualizerWebGL = ({
   analyserRef,
   loadedAudioPlaybackSourceRef,
   loadedAudioPlayRateRef,
   loadedAudioLoopIsSelectedRef,
   particleCount,
   dpr
}) => {
   // Shared mutable state for attractors - Original 3 attractors config
   const attractorsRefs = useMemo(() => [
      {
         position: new THREE.Vector3(-1, 0, 0),
         axis: new THREE.Vector3(0, 1, 0),
         basePos: new THREE.Vector3(-1, 0, 0)
      },
      {
         position: new THREE.Vector3(1, 0, -0.5),
         axis: new THREE.Vector3(0, 1, 0),
         basePos: new THREE.Vector3(1, 0, -0.5)
      },
      {
         position: new THREE.Vector3(0, 0.5, 1),
         axis: new THREE.Vector3(1, 0, -0.5).normalize(),
         basePos: new THREE.Vector3(0, 0.5, 1)
      }
   ], []);

   return (
      <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
         <Canvas
            camera={{ position: [3, 5, 8], fov: 25 }}
            gl={{ antialias: true, alpha: true }}
            dpr={dpr || window.devicePixelRatio}
            style={{ width: '100%', height: '100%' }}
         >
            <OrbitControls minDistance={0.1} maxDistance={50} enablePan enableZoom />

            <ambientLight intensity={0.5} />
            <directionalLight position={[4, 2, 0]} intensity={1.5} />

            <AttractorController
               analyserRef={analyserRef}
               attractorsRefs={attractorsRefs}
               loadedAudioPlaybackSourceRef={loadedAudioPlaybackSourceRef}
               loadedAudioPlayRateRef={loadedAudioPlayRateRef}
               loadedAudioLoopIsSelectedRef={loadedAudioLoopIsSelectedRef}
            />

            {/* Visuals */}
            {attractorsRefs.map((attr, i) => (
               <AttractorVisual key={i} position={attr.position} axis={attr.axis} />
            ))}

            <Particles attractorsData={attractorsRefs} count={particleCount || 32768} />
         </Canvas>
      </div>
   )
}

export default GravityVisualizerWebGL;
