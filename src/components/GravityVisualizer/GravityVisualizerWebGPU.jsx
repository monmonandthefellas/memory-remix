/**
 * GravityVisualizerWebGPU.jsx
 * 
 * WebGPU-based high-fidelity particle visualizer.
 * Cleaned from legacy App.jsx, removing all UI components.
 * Accepts analyserRef as a prop for audio reactivity.
 */

import { useRef, useEffect } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  float,
  If,
  PI,
  color,
  cos,
  instanceIndex,
  Loop,
  mix,
  mod,
  sin,
  instancedArray,
  Fn,
  uint,
  uniform,
  uniformArray,
  hash,
  vec3,
  vec4,
} from "three/tsl";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { WebGPURenderer } from "three/webgpu";

function GravityVisualizerWebGPU({ analyserRef, particleCount, dpr }) {
  const mountRef = useRef(null);
  const cameraRef = useRef();
  const rendererRef = useRef();
  const sceneRef = useRef();
  const controlsRef = useRef();
  const dataArrayRef = useRef(null);
  const attractorsRef = useRef(null);
  const attractorsRef2 = useRef([]);
  const updateComputeRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    cameraRef.current = new THREE.PerspectiveCamera(
      25,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100
    );
    cameraRef.current.position.set(3, 5, 8);
    const camera = cameraRef.current;

    // Renderer
    rendererRef.current = new WebGPURenderer({ antialias: true });
    // Use the dpr provided by Auto component
    rendererRef.current.setPixelRatio(dpr || window.devicePixelRatio);
    rendererRef.current.setSize(mount.offsetWidth, mount.offsetHeight);
    rendererRef.current.setClearColor(0x000000, 0);

    mount.appendChild(rendererRef.current.domElement);
    const renderer = rendererRef.current;

    // Controls
    controlsRef.current = new OrbitControls(
      cameraRef.current,
      rendererRef.current.domElement
    );
    controlsRef.current.enablePan = true;
    controlsRef.current.enableZoom = true;
    controlsRef.current.minDistance = 0.1;
    controlsRef.current.maxDistance = 50;

    // ambient light
    const ambientLight = new THREE.AmbientLight("#ffffff", 0.5);
    sceneRef.current.add(ambientLight);

    // directional light
    const directionalLight = new THREE.DirectionalLight("#ffffff", 1.5);
    directionalLight.position.set(4, 2, 0);
    sceneRef.current.add(directionalLight);

    // attractors
    attractorsRef.current = uniformArray([
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(1, 0, -0.5),
      new THREE.Vector3(0, 0.5, 1),
    ]);

    const attractorsRotationAxes = uniformArray([
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(1, 0, -0.5).normalize(),
    ]);

    const attractorsLength = uniform(
      attractorsRef.current.array.length,
      "uint"
    );
    attractorsRef2.current = [];

    for (let i = 0; i < attractorsRef.current.array.length; i++) {
      const attractor = {};

      attractor.position = attractorsRef.current.array[i];
      attractor.orientation = attractorsRotationAxes.array[i];
      attractor.reference = new THREE.Object3D();
      attractor.reference.position.copy(attractor.position);
      attractor.reference.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        attractor.orientation
      );
      sceneRef.current.add(attractor.reference);

      attractorsRef2.current.push(attractor);
    }

    // particles
    const count = particleCount || Math.pow(2, 18);
    const material = new THREE.SpriteMaterial({
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const attractorMass = uniform(Number(`1e${7}`));
    const particleGlobalMass = uniform(Number(`1e${4}`));
    const timeScale = uniform(1);
    const spinningStrength = uniform(2.75);
    const maxSpeed = uniform(8);
    const gravityConstant = 6.67e-11;
    const velocityDamping = uniform(0.1);
    const scale = uniform(0.008);
    const boundHalfExtent = uniform(8);
    const colorA = uniform(color("#fff"));
    const colorB = uniform(color("#fff"));

    const positionBuffer = instancedArray(count, "vec3");
    const velocityBuffer = instancedArray(count, "vec3");

    const sphericalToVec3 = Fn(([phi, theta]) => {
      const sinPhiRadius = sin(phi);

      return vec3(
        sinPhiRadius.mul(sin(theta)),
        cos(phi),
        sinPhiRadius.mul(cos(theta))
      );
    });

    // init compute

    const init = Fn(() => {
      const position = positionBuffer.element(instanceIndex);
      const velocity = velocityBuffer.element(instanceIndex);

      const basePosition = vec3(
        hash(instanceIndex.add(uint(Math.random() * 0xffffff))),
        hash(instanceIndex.add(uint(Math.random() * 0xffffff))),
        hash(instanceIndex.add(uint(Math.random() * 0xffffff)))
      )
        .sub(0.5)
        .mul(vec3(5, 0.2, 5));
      position.assign(basePosition);

      const phi = hash(instanceIndex.add(uint(Math.random() * 0xffffff)))
        .mul(PI)
        .mul(2);
      const theta = hash(instanceIndex.add(uint(Math.random() * 0xffffff))).mul(
        PI
      );
      const baseVelocity = sphericalToVec3(phi, theta).mul(0.05);
      velocity.assign(baseVelocity);
    });

    const initCompute = init().compute(count);
    rendererRef.current.computeAsync(initCompute);

    // update compute

    const particleMassMultiplier = hash(
      instanceIndex.add(uint(Math.random() * 0xffffff))
    )
      .remap(0.25, 1)
      .toVar();
    const particleMass = particleMassMultiplier.mul(particleGlobalMass).toVar();

    const update = Fn(() => {
      const delta = float(1 / 60)
        .mul(timeScale)
        .toVar();
      const position = positionBuffer.element(instanceIndex);
      const velocity = velocityBuffer.element(instanceIndex);

      // force

      const force = vec3(0).toVar();

      Loop(attractorsLength, ({ i }) => {
        const attractorPosition = attractorsRef.current.element(i);
        const attractorRotationAxis = attractorsRotationAxes.element(i);
        const toAttractor = attractorPosition.sub(position);
        const distance = toAttractor.length();
        const direction = toAttractor.normalize();

        // gravity
        const gravityStrength = attractorMass
          .mul(particleMass)
          .mul(gravityConstant)
          .div(distance.pow(2))
          .toVar();
        const gravityForce = direction.mul(gravityStrength);
        force.addAssign(gravityForce);

        // spinning
        const spinningForce = attractorRotationAxis
          .mul(gravityStrength)
          .mul(spinningStrength);
        const spinningVelocity = spinningForce.cross(toAttractor);
        force.addAssign(spinningVelocity);
      });

      // velocity

      velocity.addAssign(force.mul(delta));
      const speed = velocity.length();
      If(speed.greaterThan(maxSpeed), () => {
        velocity.assign(velocity.normalize().mul(maxSpeed));
      });
      velocity.mulAssign(velocityDamping.oneMinus());

      // position

      position.addAssign(velocity.mul(delta));

      // box loop
      const halfHalfExtent = boundHalfExtent.div(2).toVar();
      position.assign(
        mod(position.add(halfHalfExtent), boundHalfExtent).sub(halfHalfExtent)
      );
    });

    // Expanding bounds to prevent accumulation at edges
    boundHalfExtent.value = 20;

    updateComputeRef.current = update().compute(count);

    // nodes

    material.positionNode = positionBuffer.toAttribute();

    material.colorNode = Fn(() => {
      const velocity = velocityBuffer.toAttribute();
      const speed = velocity.length();
      const colorMix = speed.div(maxSpeed).smoothstep(0, 0.5);
      const finalColor = mix(colorA, colorB, colorMix);

      return vec4(finalColor, 1);
    })();

    material.scaleNode = particleMassMultiplier.mul(scale);

    // mesh

    const geometry = new THREE.PlaneGeometry(1, 1);
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    sceneRef.current.add(mesh);

    // Animation loop
    function animateGravityVisualizer() {
      controlsRef.current.update();

      if (
        attractorsRef2.current &&
        attractorsRef2.current.length > 0 &&
        attractorsRef.current &&
        attractorsRef.current.value
      ) {
        const n = attractorsRef2.current.length;

        if (analyserRef?.current) {
          if (!dataArrayRef.current) {
            dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
          }
          analyserRef.current.getByteTimeDomainData(dataArrayRef.current);

          for (let i = 0; i < n; i++) {
            const sliceIndex = Math.floor(
              (i / n) * analyserRef.current.frequencyBinCount
            );
            const amplitude = (dataArrayRef.current[sliceIndex] - 128) / 128;

            // Update uniform array
            attractorsRef.current.value[i * 3 + 1] = amplitude * 5; // Y

            // Update Three.js helper reference
            const x = attractorsRef.current.value[i * 3 + 0];
            const y = attractorsRef.current.value[i * 3 + 1];
            const z = attractorsRef.current.value[i * 3 + 2];

            attractorsRef2.current[i].reference.position.set(x, y, z);
            attractorsRef2.current[i].position.set(x, y, z);
          }
        }
      }

      rendererRef.current.compute(updateComputeRef.current);
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
    renderer.setAnimationLoop(animateGravityVisualizer);

    function resizeRenderer() {
      const { clientWidth, clientHeight } = mount;

      rendererRef.current.setSize(clientWidth, clientHeight);
      cameraRef.current.aspect = clientWidth / clientHeight;
      cameraRef.current.updateProjectionMatrix();
    }

    resizeRenderer();
    window.addEventListener("resize", resizeRenderer);

    return () => {
      window.removeEventListener("resize", resizeRenderer);
      renderer.setAnimationLoop(null);
      mount.removeChild(rendererRef.current.domElement);
      rendererRef.current.dispose();
      controlsRef.current.dispose();
    };
  }, [analyserRef]);

  return (
    <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
  );
}

export default GravityVisualizerWebGPU;
