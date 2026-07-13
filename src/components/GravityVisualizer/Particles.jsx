
import { useFrame, useThree, createPortal } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { simulationVertexShader, simulationFragmentShader, velocityFragmentShader } from './simulationShaders';

// Initial positions with MASS stored in W component
// We use a DataTexture to pass initial state to the GPGPU shader.
const getDataTexture = (size) => {
   const number = size * size;
   const data = new Float32Array(4 * number);
   for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
         const index = i * size + j;
         // Setup initial particle cloud (matching the original TSL spread)
         data[4 * index] = (Math.random() - 0.5) * 5.0;      // X spread
         data[4 * index + 1] = (Math.random() - 0.5) * 0.2;  // Y thin disk
         data[4 * index + 2] = (Math.random() - 0.5) * 5.0;  // Z spread
         // MASS MULTIPLIER stored in W (0.25 to 1.0) for individual gravity influence
         data[4 * index + 3] = Math.random() * 0.75 + 0.25;
      }
   }
   const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
   texture.needsUpdate = true;
   return texture;
};

// Initial velocities
const getVelocityTexture = (size) => {
   const number = size * size;
   const data = new Float32Array(4 * number);
   for (let i = 0; i < number; i++) {
      const phi = Math.random() * Math.PI * 2;
      const theta = Math.random() * Math.PI;
      // Convert spherical coordinates to cartesian for initial outward velocity
      data[4 * i] = Math.sin(phi) * Math.sin(theta) * 0.05;
      data[4 * i + 1] = Math.cos(phi) * 0.05;
      data[4 * i + 2] = Math.sin(phi) * Math.cos(theta) * 0.05;
      data[4 * i + 3] = 1.0;
   }
   const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
   texture.needsUpdate = true;
   return texture;
};

const Particles = ({ attractorsData, count = 262144 }) => {
   const size = Math.round(Math.sqrt(count)); // size x size = count particles (e.g. 512x512 = 262144)
   const { gl } = useThree();

   const getTarget = () => new THREE.WebGLRenderTarget(size, size, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      stencilBuffer: false,
      depthBuffer: false,
   });

   const positionsRef = useRef([getTarget(), getTarget()]);
   const velocitiesRef = useRef([getTarget(), getTarget()]);
   const simMeshRef = useRef();
   const scene = useMemo(() => new THREE.Scene(), []);
   const cameraOrtho = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), []);

   // Initialization flag
   const needsInit = useRef(true);
   // Store initial textures
   const initialData = useRef({ pos: null, vel: null });

   // Create initial data textures once
   if (!initialData.current.pos) {
      initialData.current.pos = getDataTexture(size);
      initialData.current.vel = getVelocityTexture(size);
   }

   // Axis values from Legacy code
   const axis1 = new THREE.Vector3(0, 1, 0);
   const axis2 = new THREE.Vector3(0, 1, 0);
   const axis3 = new THREE.Vector3(1, 0, -0.5).normalize();

   const velocityMaterial = useMemo(() => new THREE.ShaderMaterial({
      uniforms: {
         positions: { value: null },
         velocities: { value: null },
         // Renamed to match Gemini shader
         uAttractorsPos: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
         uAttractorsAxis: { value: [axis1.clone(), axis2.clone(), axis3.clone()] },
         uAttractorMass: { value: 1e7 },  // STRICT LEGACY VALUE
         uG: { value: 6.67e-11 },
         uSpinningStrength: { value: 2.75 },  // STRICT LEGACY VALUE
         uMaxSpeed: { value: 8.0 },
         uVelocityDamping: { value: 0.1 },  // STRICT LEGACY VALUE
         uTimeScale: { value: 1.0 },
         uParticleGlobalMass: { value: 1e4 },
      },
      vertexShader: simulationVertexShader,
      fragmentShader: velocityFragmentShader
   }), []);

   const positionMaterial = useMemo(() => new THREE.ShaderMaterial({
      uniforms: {
         positions: { value: null },
         velocities: { value: null },
         uTimeScale: { value: 1.0 },
         uBoundHalfExtent: { value: new THREE.Vector3(8, 8, 8) }, // TSL value = 8
      },
      vertexShader: simulationVertexShader,
      fragmentShader: simulationFragmentShader
   }), []);

   const renderMaterial = useMemo(() => new THREE.ShaderMaterial({
      uniforms: {
         positions: { value: null },
         velocities: { value: null },
         uPointSize: { value: 3.5 },
         uColorA: { value: new THREE.Color("#ffffff") },
         uColorB: { value: new THREE.Color("#ffffff") },
         uMaxSpeed: { value: 8.0 }
      },
      vertexShader: `
            uniform sampler2D positions;
            uniform sampler2D velocities;
            uniform float uPointSize;
            uniform float uMaxSpeed;
            uniform vec3 uColorA;
            uniform vec3 uColorB;
            varying vec3 vColor;
            
            void main() {
                vec4 posData = texture2D(positions, position.xy);
                vec3 pos = posData.xyz;
                float massMultiplier = posData.w; // Read mass from W
                
                vec3 vel = texture2D(velocities, position.xy).rgb;

                vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                gl_Position = projectionMatrix * mvPosition;

                float speed = length(vel);
                float colorMix = smoothstep(0.0, uMaxSpeed * 0.5, speed);
                vColor = mix(uColorA, uColorB, colorMix);
                
                // TSL: scale = 0.008, massMultiplier from W component
                // Heavier particles are LARGER (like original)
                gl_PointSize = uPointSize * massMultiplier * (10.0 / -mvPosition.z);
            }
        `,
      fragmentShader: `
            varying vec3 vColor;
            void main() {
                vec2 coord = gl_PointCoord - vec2(0.5);
                float dist = length(coord);
                if(dist > 0.5) discard;
                
                float alpha = 1.0 - smoothstep(0.2, 0.5, dist);
                
                gl_FragColor = vec4(vColor, alpha * 0.6); 
            }
        `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
   }), []);

   const geometry = useMemo(() => {
      const geo = new THREE.BufferGeometry();
      const coords = new Float32Array(size * size * 3);
      for (let i = 0; i < size * size; i++) {
         const x = (i % size) / size;
         const y = Math.floor(i / size) / size;
         coords[i * 3] = x;
         coords[i * 3 + 1] = y;
         coords[i * 3 + 2] = 0;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(coords, 3));
      return geo;
   }, [size]);


   useFrame((state, delta) => {
      // Initialize FBOs on first frame
      if (needsInit.current) {
         // Initialize all render targets
         gl.initRenderTarget(positionsRef.current[0]);
         gl.initRenderTarget(positionsRef.current[1]);
         gl.initRenderTarget(velocitiesRef.current[0]);
         gl.initRenderTarget(velocitiesRef.current[1]);

         // Copy initial data to both buffers
         const posTex = initialData.current.pos;
         const velTex = initialData.current.vel;

         gl.copyTextureToTexture(posTex, positionsRef.current[0].texture);
         gl.copyTextureToTexture(posTex, positionsRef.current[1].texture);
         gl.copyTextureToTexture(velTex, velocitiesRef.current[0].texture);
         gl.copyTextureToTexture(velTex, velocitiesRef.current[1].texture);

         needsInit.current = false;
      }

      // Update attractor positions from props
      if (attractorsData) {
         const uAttractors = velocityMaterial.uniforms.uAttractorsPos.value;
         const uAxes = velocityMaterial.uniforms.uAttractorsAxis.value;
         for (let i = 0; i < 3; i++) {
            if (attractorsData[i]) {
               uAttractors[i].copy(attractorsData[i].position);
               uAxes[i].copy(attractorsData[i].axis);
            }
         }
         // Force uniforms to sync to GPU
         velocityMaterial.uniformsNeedUpdate = true;
      }

      // 1. Velocity Pass
      velocityMaterial.uniforms.positions.value = positionsRef.current[0].texture;
      velocityMaterial.uniforms.velocities.value = velocitiesRef.current[0].texture;
      simMeshRef.current.material = velocityMaterial;
      gl.setRenderTarget(velocitiesRef.current[1]);
      gl.render(scene, cameraOrtho);

      // 2. Position Pass
      positionMaterial.uniforms.positions.value = positionsRef.current[0].texture;
      positionMaterial.uniforms.velocities.value = velocitiesRef.current[1].texture;
      simMeshRef.current.material = positionMaterial;
      gl.setRenderTarget(positionsRef.current[1]);
      gl.render(scene, cameraOrtho);

      gl.setRenderTarget(null);

      // Ping Pong Swap
      let temp = velocitiesRef.current[0];
      velocitiesRef.current[0] = velocitiesRef.current[1];
      velocitiesRef.current[1] = temp;

      temp = positionsRef.current[0];
      positionsRef.current[0] = positionsRef.current[1];
      positionsRef.current[1] = temp;

      // Render with new positions
      renderMaterial.uniforms.positions.value = positionsRef.current[0].texture;
      renderMaterial.uniforms.velocities.value = velocitiesRef.current[0].texture;
   });

   return (
      <>
         {createPortal(
            <mesh ref={simMeshRef}>
               <planeGeometry args={[2, 2]} />
            </mesh>,
            scene
         )}
         <points geometry={geometry} material={renderMaterial} />
      </>
   );
};

export default Particles;
