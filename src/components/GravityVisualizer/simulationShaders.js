export const simulationVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// POSITION SHADER: Updates position based on velocity
export const simulationFragmentShader = `
  uniform sampler2D positions;
  uniform sampler2D velocities;
  uniform float uTimeScale;
  uniform vec3 uBoundHalfExtent; 

  varying vec2 vUv;

  void main() {
    vec4 posData = texture2D(positions, vUv);
    vec3 pos = posData.xyz;
    vec3 vel = texture2D(velocities, vUv).xyz;
    float mass = posData.w; // Preserve mass in W component

    // TSL uses fixed step 1/60
    float delta = (1.0 / 60.0) * uTimeScale;
    
    pos += vel * delta;

    // Boundary Wrapping (Teleport at edges)
    // TSL Logic: mod(pos + half, bound) - half
    // uBoundHalfExtent = 8.0 -> half = 4.0
    vec3 boundary = uBoundHalfExtent; 
    vec3 halfBoundary = boundary / 2.0;
    
    pos = mod(pos + halfBoundary, boundary) - halfBoundary;

    gl_FragColor = vec4(pos, mass);
  }
`;

// VELOCITY SHADER: Physics Calculation
export const velocityFragmentShader = `
  uniform sampler2D positions;
  uniform sampler2D velocities;
  
  uniform vec3 uAttractorsPos[3];
  uniform vec3 uAttractorsAxis[3];
  
  uniform float uAttractorMass;
  uniform float uG;
  uniform float uSpinningStrength;
  uniform float uMaxSpeed;
  uniform float uVelocityDamping;
  uniform float uTimeScale;
  uniform float uParticleGlobalMass;

  varying vec2 vUv;

  void main() {
    vec4 posData = texture2D(positions, vUv);
    vec3 pos = posData.xyz;
    vec3 vel = texture2D(velocities, vUv).xyz;
    
    // Particle mass stored in W component (range 0.25 - 1.0 multiplier)
    float pMassMultiplier = posData.w; 
    float pMass = pMassMultiplier * uParticleGlobalMass;

    vec3 force = vec3(0.0);

    // Loop over 3 attractors
    for(int i = 0; i < 3; i++) {
        vec3 attrPos = uAttractorsPos[i];
        vec3 attrAxis = uAttractorsAxis[i];

        vec3 toAttractor = attrPos - pos;
        float dist = length(toAttractor);
        
        // Add small epsilon to avoid division by zero
        float distSq = max(0.00001, dist * dist);
        
        // 1. Gravity
        // TSL: float(ATTRACTOR_MASS).mul(particleMass).mul(float(GRAVITY_CONSTANT)).div(distance.pow(2))
        float gravStrength = (uAttractorMass * pMass * uG) / distSq;
        vec3 dir = normalize(toAttractor);

        // OUTER LAYER: Weak repulsion (-10%) to make them drift away slowly
        bool isOuterLayer = pMassMultiplier < 0.5;
        float gravMod = isOuterLayer ? -0.1 : 1.0;
        
        vec3 gravForce = dir * gravStrength * gravMod;
        
        force += gravForce;

        // 2. Spin (Rotation)
        // TSL: attractorRotationAxis.mul(gravityStrength).mul(float(SPINNING_STRENGTH))
        vec3 spinForceVec = attrAxis * gravStrength * uSpinningStrength;
        
        // OUTER LAYER: Spin in REVERSE direction
        if (isOuterLayer) {
            spinForceVec *= -1.0;
        }
        
        // TSL: spinningForce.cross(toAttractor) <-- UNNORMALIZED VECTOR !!!
        vec3 spinVel = cross(spinForceVec, toAttractor);
        
        force += spinVel;
    }

    float delta = (1.0 / 60.0) * uTimeScale;
    
    // Velocity integration
    vel += force * delta;

    // Speed limit
    float speed = length(vel);
    if(speed > uMaxSpeed) {
        vel = normalize(vel) * uMaxSpeed;
    }

    // Damping
    vel *= (1.0 - uVelocityDamping);

    gl_FragColor = vec4(vel, 1.0);
  }
`;
