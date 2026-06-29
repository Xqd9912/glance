# WebGPU + Three.js Migration Guide (2026): From WebGL to WebGPU

Jocelyn Lecamus

Co-Founder, CEO of Utsubo

WebGPU is production-ready. All major browsers support it. Three.js makes the switch trivial.

Yet most Three.js projects are still running WebGL.

This guide is the technical roadmap for teams ready to migrate. We'll cover the decision framework, step-by-step migration process, React Three Fiber integration, and the edge cases that trip people up.

> **Who this is for:** Three.js developers planning WebGPU migration, technical leads evaluating the effort, and React Three Fiber teams considering WebGPU support.

## Key Takeaways

- **Migration is often a one-line change**—swap `WebGLRenderer` for `WebGPURenderer` and Three.js handles the rest
- **Automatic fallback to WebGL 2** means you can ship WebGPU today without breaking older browsers
- **React Three Fiber supports WebGPU** via the `gl` prop factory pattern
- **TSL (Three Shader Language)** lets you write shaders that compile to both WGSL and GLSL
- **Compute shaders unlock 10-100x performance gains** for particle systems and physics

## 1. Is Your Project Ready for WebGPU?

Not every project needs WebGPU. Here's how to decide.

### 1-1. Decision Matrix: Migrate vs Stay on WebGL

| Scenario                                                    | Recommendation                  |
| :---------------------------------------------------------- | :------------------------------ |
| New project, no legacy constraints                          | **Start with WebGPU**           |
| Hitting performance walls (50k+ particles, high draw calls) | **Migrate**                     |
| Current app runs smoothly, no new features planned          | **Stay on WebGL**               |
| Heavy custom GLSL shaders                                   | **Evaluate TSL first**          |
| Kiosk/installation with controlled hardware                 | **Migrate** (fixed environment) |
| Must support very old browsers (Chrome < 113)               | **Stay on WebGL**               |

### 1-2. Browser Support Status (January 2026)

WebGPU is now supported everywhere that matters:

| Browser       | WebGPU Support             | Notes                        |
| :------------ | :------------------------- | :--------------------------- |
| Chrome / Edge | v113+ (May 2023)           | Full support                 |
| Firefox       | v141+ Windows, v145+ macOS | Enabled by default           |
| Safari        | v26+ (September 2025)      | macOS, iOS, iPadOS, visionOS |

**Global coverage**: ~95% of users have WebGPU-capable browsers. The remaining 5% get WebGL 2 fallback automatically.

For the full context on what changed in Three.js, see [What's New in Three.js (2026)](https://www.utsubo.com/blog/threejs-2026-what-changed).

### 1-3. When WebGPU Delivers Real Gains

WebGPU isn't universally faster. It excels in specific scenarios:

- **High draw call counts**: WebGPU's binding model reduces CPU overhead
- **Compute-heavy workloads**: Particle systems, physics simulations, ML inference
- **Complex post-processing**: Native TSL effects outperform WebGL equivalents
- **Large instanced meshes**: More efficient buffer management

If your bottleneck is texture upload speed or shader compilation time, WebGPU may not help much.

## 2. Migration Checklist: WebGL to WebGPU

Here's the step-by-step process. Most projects can complete this in a few hours.

### 2-1. Step 1: Audit Your Current Setup

Before touching code, understand what you have:

```bash
# Check Three.js version
npm list three

# Check for WebGL-specific dependencies
grep -r "WebGLRenderer" src/
grep -r "ShaderMaterial" src/
grep -r "RawShaderMaterial" src/
```

**What to look for:**

- Three.js version (must be r171+ for zero-config WebGPU)
- Custom GLSL shaders (will need TSL conversion)
- Post-processing (may need updates)
- Third-party libraries (check WebGPU compatibility)

### 2-2. Step 2: Update Three.js to r171+

If you're on an older version:

```bash
npm install three@latest
```

**Breaking changes to watch for:**

- `BufferGeometry` is now the only geometry type
- Some deprecated methods removed
- Import paths changed for some modules

Check the [Three.js release notes](https://github.com/mrdoob/three.js/releases) for your version jump.

### 2-3. Step 3: Swap the Renderer Import

This is the core change:

```javascript
// Before (WebGL)
import * as THREE from 'three';
const renderer = new THREE.WebGLRenderer({ antialias: true });

// After (WebGPU)
import * as THREE from 'three/webgpu';
const renderer = new THREE.WebGPURenderer({ antialias: true });
```

That's it. The `three/webgpu` entry point includes everything—renderer, materials, lights. It automatically falls back to WebGL 2 if WebGPU isn't available.

### 2-4. Step 4: Handle Async Initialization

**Critical difference**: WebGPU initialization is asynchronous.

```javascript
// WebGL (synchronous)
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
animate(); // Can call immediately

// WebGPU (asynchronous)
const renderer = new THREE.WebGPURenderer();
await renderer.init(); // MUST await before using
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
animate();
```

**Common mistake**: Forgetting `await renderer.init()`. Your scene will render nothing with no error message.

**Pattern for existing codebases:**

```javascript
async function initRenderer() {
  const renderer = new THREE.WebGPURenderer({ antialias: true });
  await renderer.init();
  return renderer;
}

// In your main function
const renderer = await initRenderer();
```

### 2-5. Step 5: Update Post-Processing

If you're using `pmndrs/postprocessing` or `three/examples/jsm/postprocessing`:

**Option A: Use TSL-native effects (recommended)**

```javascript
import { bloom, pass } from 'three/tsl';

const postProcessing = new THREE.PostProcessing(renderer);
const scenePass = pass(scene, camera);
const bloomPass = bloom(scenePass, { threshold: 0.8, intensity: 1.5 });
postProcessing.outputNode = bloomPass;
```

**Option B: Keep existing post-processing (if compatible)**

Some `EffectComposer` passes work with WebGPU. Test each one individually.

### 2-6. Step 6: Convert Custom Shaders to TSL

If you have custom GLSL shaders, you have two options:

**Option A: Use TSL (Three Shader Language)**

TSL is a node-based system that compiles to both WGSL (WebGPU) and GLSL (WebGL):

```javascript
// GLSL version
const material = new THREE.ShaderMaterial({
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    void main() {
      gl_FragColor = vec4(vUv, 0.5, 1.0);
    }
  `
});

// TSL version
import { Fn, uv, vec4 } from 'three/tsl';

const colorNode = Fn(() => {
  return vec4(uv(), 0.5, 1.0);
});

const material = new THREE.MeshBasicNodeMaterial();
material.colorNode = colorNode();
```

**Option B: Keep GLSL for WebGL fallback**

If TSL conversion is too complex, you can maintain separate code paths:

```javascript
const isWebGPU = renderer.isWebGPURenderer;

const material = isWebGPU
  ? createTSLMaterial()
  : createGLSLMaterial();
```

### 2-7. Step 7: Implement Fallback Detection

For graceful degradation:

```javascript
async function createRenderer() {
  // Try WebGPU first
  if (navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        const renderer = new THREE.WebGPURenderer({ antialias: true });
        await renderer.init();
        console.log('Using WebGPU');
        return renderer;
      }
    } catch (e) {
      console.warn('WebGPU init failed:', e);
    }
  }

  // Fallback to WebGL 2
  console.log('Falling back to WebGL');
  return new THREE.WebGLRenderer({ antialias: true });
}
```

**Simpler approach** (Three.js handles it):

```javascript
import * as THREE from 'three/webgpu';

const renderer = new THREE.WebGPURenderer({
  antialias: true,
  forceWebGL: false // Set to true to test WebGL fallback
});
await renderer.init();
// Automatically uses WebGL 2 if WebGPU unavailable
```

### 2-8. Step 8: Cross-Browser Testing

Test on all target platforms:

| Browser | Test Focus                       |
| :------ | :------------------------------- |
| Chrome  | Baseline—should work first       |
| Firefox | Check compute shader support     |
| Safari  | Test on macOS AND iOS separately |
| Edge    | Usually identical to Chrome      |

**Safari-specific gotchas:**

- Some timestamp queries not supported
- Slightly different texture format behavior
- Test touch interactions on iOS

## 3. React Three Fiber + WebGPU Integration

React Three Fiber (R3F) supports WebGPU, but setup requires understanding the `gl` prop.

### 3-1. Current R3F WebGPU Support Status

As of R3F v9.x (January 2026):

- WebGPU works via the `gl` factory prop
- Most Drei helpers work unchanged
- Some edge cases with post-processing

### 3-2. Setting Up R3F with WebGPURenderer

The key is the async `gl` factory:

```jsx
import { Canvas } from '@react-three/fiber';
import { WebGPURenderer } from 'three/webgpu';

function App() {
  return (
    <Canvas
      gl={async (canvas) => {
        const renderer = new WebGPURenderer({
          canvas,
          antialias: true
        });
        await renderer.init();
        return renderer;
      }}
    >
      <mesh>
        <boxGeometry />
        <meshStandardMaterial color="orange" />
      </mesh>
    </Canvas>
  );
}
```

**Important**: The `gl` prop must return a Promise that resolves to the renderer.

### 3-3. Drei Compatibility Notes

Most Drei components work unchanged:

| Component                    | WebGPU Status    |
| :--------------------------- | :--------------- |
| `OrbitControls`              | Works            |
| `Environment`                | Works            |
| `useGLTF`                    | Works            |
| `Text`                       | Works            |
| `Html`                       | Works            |
| `EffectComposer` (from Drei) | May need updates |

**Post-processing**: The Drei `EffectComposer` wraps pmndrs/postprocessing. Some effects need WebGPU-specific versions or TSL rewrites.

### 3-4. Common R3F + WebGPU Pitfalls

**Pitfall 1: Forgetting async init**

```jsx
// WRONG - renderer not initialized
gl={(canvas) => new WebGPURenderer({ canvas })}

// CORRECT - await init
gl={async (canvas) => {
  const r = new WebGPURenderer({ canvas });
  await r.init();
  return r;
}}
```

**Pitfall 2: Using WebGL-specific hooks**

```jsx
// May not work with WebGPU
const { gl } = useThree();
gl.capabilities.isWebGL2; // undefined on WebGPU

// Better approach
const { gl } = useThree();
const isWebGPU = gl.isWebGPURenderer;
```

**Pitfall 3: Mixing import paths**

```jsx
// Don't mix these
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three'; // WebGL version
import { WebGPURenderer } from 'three/webgpu'; // WebGPU version

// Consistent imports
import * as THREE from 'three/webgpu'; // Use this for all Three.js
```

## 4. Graceful Degradation Patterns

Ship WebGPU now while supporting older browsers.

### 4-1. Feature Detection Code

Copy-paste ready:

```javascript
async function checkWebGPUSupport() {
  if (!navigator.gpu) {
    return { supported: false, reason: 'WebGPU API not available' };
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return { supported: false, reason: 'No GPU adapter found' };
    }

    const device = await adapter.requestDevice();
    return { supported: true, adapter, device };
  } catch (e) {
    return { supported: false, reason: e.message };
  }
}

// Usage
const gpuStatus = await checkWebGPUSupport();
if (!gpuStatus.supported) {
  console.log(`WebGPU not available: ${gpuStatus.reason}`);
  // Use WebGL fallback
}
```

### 4-2. Progressive Enhancement Strategy

Structure your code for graceful fallback:

```javascript
// renderer-factory.js
import * as THREE_WEBGPU from 'three/webgpu';
import * as THREE_WEBGL from 'three';

export async function createRenderer(canvas, options = {}) {
  const { preferWebGPU = true, ...rendererOptions } = options;

  if (preferWebGPU && navigator.gpu) {
    try {
      const renderer = new THREE_WEBGPU.WebGPURenderer({
        canvas,
        ...rendererOptions
      });
      await renderer.init();
      return { renderer, isWebGPU: true, THREE: THREE_WEBGPU };
    } catch (e) {
      console.warn('WebGPU failed, falling back:', e);
    }
  }

  return {
    renderer: new THREE_WEBGL.WebGLRenderer({ canvas, ...rendererOptions }),
    isWebGPU: false,
    THREE: THREE_WEBGL
  };
}
```

### 4-3. User Messaging Best Practices

Don't show errors. Show graceful fallbacks:

```javascript
// Bad
alert('Your browser doesn\'t support WebGPU!');

// Good
const banner = document.getElementById('tech-banner');
if (!gpuStatus.supported) {
  banner.textContent = 'Running in compatibility mode';
  banner.style.display = 'block';
}
```

## 5. TSL (Three Shader Language) Fundamentals

TSL is the future of shaders in Three.js. Learn it now.

### 5-1. Why TSL Over Raw WGSL

| Approach | Pros                           | Cons                 |
| :------- | :----------------------------- | :------------------- |
| Raw WGSL | Maximum control                | WebGPU only, verbose |
| Raw GLSL | Familiar syntax                | WebGL only           |
| **TSL**  | **Cross-platform, composable** | **Learning curve**   |

TSL compiles to both WGSL (WebGPU) and GLSL (WebGL fallback). Write once, run everywhere.

### 5-2. TSL Syntax Basics

TSL uses JavaScript-like syntax with math operations:

```javascript
import {
  Fn, uv, sin, cos, time, vec3, vec4,
  positionLocal, normalLocal
} from 'three/tsl';

// Simple color based on UV
const uvColor = Fn(() => {
  const coords = uv();
  return vec4(coords.x, coords.y, 0.5, 1.0);
});

// Animated displacement
const wobble = Fn(() => {
  const t = time.mul(2.0);
  const displacement = sin(positionLocal.x.mul(10.0).add(t)).mul(0.1);
  return positionLocal.add(normalLocal.mul(displacement));
});
```

### 5-3. Converting GLSL to TSL: Common Patterns

**Fresnel effect:**

```glsl
// GLSL
float fresnel = pow(1.0 - dot(viewDirection, normal), 3.0);
// TSL
import { Fn, viewDirection, normalLocal, pow, dot, sub } from 'three/tsl';

const fresnel = Fn(() => {
  const vDotN = dot(viewDirection, normalLocal);
  return pow(sub(1.0, vDotN), 3.0);
});
```

**Noise-based displacement:**

```javascript
import { Fn, positionLocal, normalLocal, noise3D, time } from 'three/tsl';

const noiseDisplacement = Fn(() => {
  const noiseInput = positionLocal.add(time.mul(0.5));
  const n = noise3D(noiseInput);
  return positionLocal.add(normalLocal.mul(n.mul(0.2)));
});
```

For 100 more Three.js optimization patterns, see our [Three.js Best Practices guide](https://www.utsubo.com/blog/threejs-best-practices-100-tips).

## 6. Compute Shader Patterns

Compute shaders are WebGPU's killer feature. They unlock performance impossible with WebGL.

### 6-1. When to Use Compute Shaders

| Use Case        | WebGL Limit | WebGPU + Compute |
| :-------------- | :---------- | :--------------- |
| Particle count  | ~50,000     | **1,000,000+**   |
| Physics bodies  | ~1,000      | **100,000+**     |
| Data processing | CPU-bound   | **GPU-parallel** |

### 6-2. Particle Systems on the GPU

```javascript
import {
  Fn, storage, instancedArray,
  instanceIndex, vec3, time
} from 'three/tsl';

// Store 1 million particle positions
const particleCount = 1000000;
const positionBuffer = instancedArray(particleCount, 'vec3');
const velocityBuffer = instancedArray(particleCount, 'vec3');

// Compute shader: update positions
const updateParticles = Fn(() => {
  const i = instanceIndex;
  const pos = positionBuffer.element(i);
  const vel = velocityBuffer.element(i);

  // Simple physics
  const gravity = vec3(0, -9.8, 0);
  vel.addAssign(gravity.mul(0.016)); // deltaTime
  pos.addAssign(vel.mul(0.016));

  // Ground collision
  pos.y.assign(pos.y.max(0));
});

// Run compute shader each frame
renderer.computeAsync(updateParticles);
```

### 6-3. Physics Simulations

For complex physics, structure your compute passes:

1. **Broad phase**: Spatial hashing to find potential collisions
2. **Narrow phase**: Precise collision detection
3. **Resolution**: Apply collision responses
4. **Integration**: Update positions from velocities

Each phase can be a separate compute shader, running entirely on the GPU.

## 7. Performance Profiling for WebGPU

Measure before optimizing.

### 7-1. stats-gl Setup

[stats-gl](https://github.com/RenaudRohlinger/stats-gl) works with both WebGL and WebGPU:

```javascript
import Stats from 'stats-gl';

const stats = new Stats({
  trackGPU: true,
  trackCPU: true,
  trackHz: true
});
document.body.appendChild(stats.dom);

function animate() {
  stats.begin();
  renderer.render(scene, camera);
  stats.end();
  requestAnimationFrame(animate);
}
```

### 7-2. Chrome DevTools GPU Debugging

1. Open DevTools → Performance tab
2. Check "GPU" in the capture settings
3. Record a session
4. Look for:
   - GPU task duration
   - Frame timing
   - Memory allocation patterns

### 7-3. Common Performance Bottlenecks

| Symptom                      | Likely Cause            | Solution                            |
| :--------------------------- | :---------------------- | :---------------------------------- |
| Stuttering on first frame    | Shader compilation      | Pre-warm shaders                    |
| Memory climbing              | Buffer not disposed     | Call `dispose()` on removed objects |
| Low FPS despite simple scene | Texture format mismatch | Check texture compression           |
| Compute shaders slow         | Too many dispatches     | Batch into fewer calls              |

## 8. Installation/Kiosk Considerations

Running Three.js on dedicated hardware? WebGPU excels here.

### 8-1. Electron Configuration

For kiosk apps:

```javascript
// main.js
const { app, BrowserWindow } = require('electron');

app.commandLine.appendSwitch('enable-features', 'Vulkan');
app.commandLine.appendSwitch('use-vulkan');
app.commandLine.appendSwitch('enable-unsafe-webgpu');

const win = new BrowserWindow({
  fullscreen: true,
  frame: false,
  kiosk: true,
  webPreferences: {
    webgl: true,
    webgpu: true
  }
});
```

### 8-2. Chromium Flags for WebGPU

When running Chromium directly:

```bash
chromium --enable-unsafe-webgpu \
         --enable-features=Vulkan \
         --disable-gpu-sandbox \
         --ignore-gpu-blocklist
```

### 8-3. Hardware Selection for WebGPU

For installations, hardware matters:

| GPU              | WebGPU Performance            | Recommendation          |
| :--------------- | :---------------------------- | :---------------------- |
| Intel integrated | Adequate for < 100k particles | Budget option           |
| NVIDIA RTX 3060+ | Excellent                     | Best for complex scenes |
| AMD RX 6600+     | Excellent                     | Alternative to NVIDIA   |
| Apple M1/M2/M3   | Very good                     | macOS installations     |

**Tip**: For 24/7 installations, NVIDIA Quadro/RTX series offer better stability and driver support than consumer cards.

See our [Hokusai installation case study](https://www.utsubo.com/blog/hokusai-interactive-installation) for a real-world WebGPU installation running 1 million particles.

## 9. Troubleshooting Common Migration Issues

### 9-1. Shader Compilation Errors

**Error**: `Shader compilation failed`

**Causes and fixes:**

- **GLSL in WebGPU context**: Use TSL or ensure you're importing from correct path
- **Unsupported GLSL features**: Some GLSL extensions don't have WebGPU equivalents
- **Syntax errors in TSL**: Check your node connections

### 9-2. Safari-Specific Quirks

**Issue**: Works in Chrome, fails in Safari

**Common causes:**

- Timestamp queries not supported (don't rely on them)
- Different texture format defaults
- Stricter validation in some cases

**Fix**: Test early and often on Safari. Use feature detection.

### 9-3. Memory Management Changes

WebGPU is more explicit about memory:

```javascript
// Always dispose when removing objects
mesh.geometry.dispose();
mesh.material.dispose();
texture.dispose();

// For compute buffers
storageBuffer.destroy();
```

## 10. About Utsubo

We're a creative technology studio specializing in Three.js and interactive installations.

Our team has deep expertise in the Three.js WebGPU renderer and has been building with it since its early development.

We've shipped WebGPU in production—including a million-particle installation at Expo 2025 Osaka—and helped enterprises like Segments.ai achieve 100x performance improvements through WebGPU migration.

## 11. Let's Talk

Planning a WebGPU migration? Need help with performance optimization or a complex installation?

[Book a 30-minute consultation](https://cal.com/utsubo/30min?source_url=%2Fblog%2Fwebgpu-threejs-migration-guide) to discuss your project.

## Migration Checklist

- Audit current Three.js version and dependencies
- Update to Three.js r171+
- Swap renderer import to `three/webgpu`
- Add `await renderer.init()` before using renderer
- Update post-processing to TSL (if applicable)
- Convert custom GLSL shaders to TSL (if applicable)
- Implement fallback detection
- Test on Chrome, Firefox, Safari (macOS + iOS)
- Profile with stats-gl
- Dispose resources properly

## FAQs

### Does Three.js support WebGPU?

Yes. Since Three.js r171 (September 2025), WebGPU is production-ready with zero-config imports. Just use `import * as THREE from 'three/webgpu'` and you get WebGPU rendering with automatic WebGL 2 fallback.

### Does React Three Fiber support WebGPU?

Yes. R3F supports WebGPU through the async `gl` prop factory. Pass an async function that creates and initializes a `WebGPURenderer`. Most Drei components work unchanged.

### How do I check if a browser supports WebGPU?

Check for `navigator.gpu`, then try requesting an adapter:

```javascript
if (navigator.gpu) {
  const adapter = await navigator.gpu.requestAdapter();
  if (adapter) {
    // WebGPU supported
  }
}
```

Three.js handles this automatically when using the `three/webgpu` import.

### What's the difference between WebGL and WebGPU?

WebGPU is a modern graphics API with three key advantages: (1) compute shaders for general-purpose GPU computation, (2) explicit resource management for better performance, (3) modern architecture matching how GPUs actually work. Performance gains of 2-10x are common for draw-call-heavy scenes.

### Does Safari on iOS support WebGPU?

Yes, since Safari 26 (September 2025). WebGPU is supported on macOS, iOS, iPadOS, and visionOS. This was the last major browser to add support—WebGPU now works everywhere.

### How do I convert GLSL shaders to WebGPU?

Use TSL (Three Shader Language) instead of raw WGSL. TSL provides a JavaScript-based shader authoring system that compiles to both WGSL (WebGPU) and GLSL (WebGL). This lets you maintain a single codebase that works on both renderers.

### What is TSL (Three Shader Language)?

TSL is Three.js's node-based material system. You write shaders as compositions of JavaScript functions that compile to GPU shader code. It's cross-platform (WGSL + GLSL), composable, and integrates with Three.js's material system.

### How long does WebGPU migration take?

For simple projects (standard materials, no custom shaders): 1-2 hours. For projects with custom GLSL shaders: 1-2 days for TSL conversion. For large applications with complex post-processing: 1-2 weeks including testing.

## Have a project in mind?

Tell us what you’re building — we reply within 1–2 business days.



Or alternatively [get a concept call here](https://cal.com/utsubo/30min?source_url=%2Fblog%2Fwebgpu-threejs-migration-guide%2F)

Discover our comprehensive web production services, tailored to elevate your online presence and drive business growth.

## YOU MIGHT ALSO LIKE

- [Digital Twin Experiences for Brands & Showrooms (2026 Guide)Jun 24th, 2026](https://www.utsubo.com/blog/digital-twin-brand-showroom-guide)
- [The "Built with AI" Tell: 12 Signals That Drop Trust in 2026Jun 23rd, 2026](https://www.utsubo.com/blog/built-with-ai-trust-signals-2026)
- [How to Hire a Branding & Design Agency in Asia (2026)Jun 22nd, 2026](https://www.utsubo.com/blog/branding-design-agency-asia-guide)
- [Which 3D Capture Method to Commission: Gaussian Splatting vs Photogrammetry vs NeRF vs LiDAR (2026)Jun 19th, 2026](https://www.utsubo.com/blog/gaussian-splatting-vs-photogrammetry-nerf-lidar)

## Follow us

- [X / Twitter](https://x.com/utsuboco)
- [Instagram](https://www.instagram.com/utsuboco/)
- [LinkedIn](https://www.linkedin.com/company/utsuboco/)
- [GitHub](https://github.com/utsuboco)
- [YouTube](https://www.youtube.com/@utsuboco)
- [TikTok](https://www.tiktok.com/@utsuboco)

## EXPLORE

- [Book a Call](https://cal.com/utsubo/30min?source_url=%2Fblog%2Fwebgpu-threejs-migration-guide%2F)
- [Portfolio](https://works.utsubo.com/)
- [WEBGPU EXPERTS](https://www.webgpuexperts.com/)
- [KOKOPON](https://kokopon.jp/)
- [Blog](https://www.utsubo.com/blog)
- [Experience Economy](https://www.utsubo.com/experience-economy-interactive-installations)

## SERVICES

- [WEBSITE PRODUCTION](https://www.utsubo.com/osaka-web-agency)
- [OSAKA INTERACTIVE INSTALLATION STUDIO](https://www.utsubo.com/osaka-interactive-installation-studio)
- [INTERACTIVE INSTALLATIONS FOR MUSEUMS](https://www.utsubo.com/interactive-installations-for-museums)
- [INTERACTIVE INSTALLATIONS FOR HOTELS](https://www.utsubo.com/interactive-installations-for-hotels)

TECHNOLOGY-FIRST CREATIVE STUDIO