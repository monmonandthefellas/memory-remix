/**
 * GravityVisualizerAuto.jsx
 * 
 * Automatically selects WebGPU or WebGL implementation
 * based on browser support.
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';

// Lazy load implementations
const GravityVisualizerWebGPU = lazy(() => import('./GravityVisualizerWebGPU'));
const GravityVisualizerWebGL = lazy(() => import('./GravityVisualizerWebGL'));

// Check WebGPU support
const checkWebGPUSupport = async () => {
   if (!navigator.gpu) return false;
   try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) return false;
      const device = await adapter.requestDevice();
      return !!device;
   } catch (e) {
      // WebGPU check failed
      return false;
   }
};

const LoadingFallback = () => (
   <div style={{
      width: '100%',
      height: '100%',
      // Match the app background color or transparent
      background: 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontFamily: 'monospace'
   }}>
      <div>🌀 Initializing Renderer...</div>
   </div>
);

const GravityVisualizerAuto = (props) => {
   const [backend, setBackend] = useState(null); // 'webgpu' | 'webgl' | null
   const [config, setConfig] = useState(null);

   useEffect(() => {
      const detectAndConfigure = async () => {
         const params = new URLSearchParams(window.location.search);
         const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

         // 1. Determine Backend
         let selectedBackend = null;
         if (params.get('renderer') === 'webgl') {
            selectedBackend = 'webgl';
         } else if (params.get('renderer') === 'webgpu') {
            selectedBackend = 'webgpu';
         } else {
            const hasWebGPU = await checkWebGPUSupport();
            selectedBackend = hasWebGPU ? 'webgpu' : 'webgl';
         }

         // 2. Determine Particle Count
         // Conservative limits for production safety
         // Adjusted for Heat Reduction (-20% from previous maxes)
         let defaultCount = 0;
         if (selectedBackend === 'webgpu') {
            // Desktop: ~210k (was 262k), Mobile: ~26k (was 32k)
            defaultCount = isMobile ? 26000 : 210000;
         } else {
            // WebGL is heavier. Desktop: ~100k, Mobile: ~14k
            defaultCount = isMobile ? 14000 : 100000;
         }

         const countOverride = params.get('particles');
         const finalCount = countOverride ? parseInt(countOverride) : defaultCount;

         // 3. Determine DPR (Device Pixel Ratio)
         // Extreme density is the main performance killer on mobile
         const dprOverride = params.get('dpr');

         // HARD CAP DPR TO 1.5 GLOBALLY TO PREVENT OVERHEATING ON RETINA SCREENS
         // This is the most effective way to reduce GPU load without visible degradation.
         let defaultDpr = Math.min(window.devicePixelRatio, 1.5);

         if (isMobile && !dprOverride) {
            // Further reduce for WebGL mobile to ensure smoothness
            defaultDpr = selectedBackend === 'webgpu' ? 1.5 : 1.25;
         }
         const finalDpr = dprOverride ? parseFloat(dprOverride) : defaultDpr;

         /*
          Renderer Auto-Configuration Log:
          -------------------------------
          - Selected Backend: ${selectedBackend.toUpperCase()}${isMobile ? ' (Mobile)' : ''}
          - Particle Count: ${finalCount.toLocaleString()}
          - Device Pixel Ratio (DPR): ${finalDpr}
          
          Optimization Note: 
          On mobile devices, we strictly limit DPR to 1.5 (WebGPU) or 1.25 (WebGL) 
          to maintain smooth frame rates, as high pixel density is the primary 
          bottleneck for mobile GPU shaders.
         */

         setBackend(selectedBackend);
         setConfig({ particleCount: finalCount, dpr: finalDpr, isMobile });
      };

      detectAndConfigure();
   }, []);

   if (!backend || !config) {
      return <LoadingFallback />;
   }

   return (
      <Suspense fallback={<LoadingFallback />}>
         {backend === 'webgpu' ? (
            <GravityVisualizerWebGPU {...props} particleCount={config.particleCount} dpr={config.dpr} />
         ) : (
            <GravityVisualizerWebGL {...props} particleCount={config.particleCount} dpr={config.dpr} />
         )}
      </Suspense>
   );
};

export default GravityVisualizerAuto;
