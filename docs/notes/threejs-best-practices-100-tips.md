# 100 Three.js Tips That Actually Improve Performance (2026)

Jocelyn Lecamus

Co-Founder, CEO of Utsubo

Building performant 3D experiences on the web requires more than knowing the API. It requires understanding how browsers, GPUs, and JavaScript interact—and where the bottlenecks hide.

This guide compiles 100 actionable best practices for Three.js development, with a heavy focus on the new WebGPU renderer. Whether you're optimizing an existing project or starting fresh, these tips will help you ship faster, smoother experiences.

> **Who this is for:** Web developers working with Three.js who want to level up their performance and code quality. If you're just starting, we recommend [Three.js Journey](https://threejs-journey.com/)

## Key Takeaways

- **WebGPU is production-ready** since r171—zero-config imports with automatic WebGL 2 fallback
- **Draw calls are the silent killer**—aim for under 100 per frame
- **Instancing and batching** can reduce draw calls by 90%+
- **Dispose everything** you no longer need—geometries, materials, textures, render targets
- **TSL (Three Shader Language)** is the future—write once, run on WebGPU or WebGL
- **Bake what you can**—lightmaps, shadows, ambient occlusion
- **Profile before optimizing**—use stats-gl, renderer.info, and Spector.js

## WebGPU Renderer

The WebGPU renderer represents a fundamental shift in how Three.js handles graphics. Since Safari 26 shipped support in September 2025, you can now target WebGPU for all major browsers. For context on what changed, see our [Three.js 2026 overview](https://www.utsubo.com/blog/threejs-2026-what-changed).

### 1. Use the zero-config WebGPU import with async init

Since r171, adopting WebGPU is straightforward—but requires async initialization:

```javascript
import { WebGPURenderer } from 'three/webgpu';

const renderer = new WebGPURenderer();
await renderer.init(); // Required before first render

function animate() {
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
```

The `init()` call is mandatory—it requests the GPU adapter and device. Without it, rendering fails silently. No bundler configuration or polyfills needed.

### 2. Trust the automatic WebGL 2 fallback

When a browser doesn't support WebGPU, the WebGPURenderer automatically falls back to WebGL 2. You don't need separate code paths—ship one renderer and let Three.js handle compatibility.

### 3. Learn TSL (Three Shader Language)

TSL is Three.js's node-based material system that compiles to either WGSL (WebGPU) or GLSL (WebGL). Instead of writing shader code twice, write it once in TSL:

```javascript
import { color, positionLocal, sin, time } from 'three/tsl';

const material = new MeshStandardNodeMaterial();
material.colorNode = color(1, 0, 0).mul(sin(time).mul(0.5).add(0.5));
```

TSL is the recommended approach for custom shaders moving forward.

### 4. Move particle systems to compute shaders

CPU-based particle updates hit bottlenecks around 50,000 particles on typical hardware. WebGPU compute shaders push this to millions—see [Three.js WebGPU particle examples](https://threejs.org/examples/?q=webgpu#webgpu_compute_particles):

```javascript
import { instancedArray, storage, uniform } from 'three/tsl';

const positions = instancedArray(particleCount, 'vec3');
const velocities = instancedArray(particleCount, 'vec3');
```

### 5. Use instancedArray for GPU-persistent buffers

`instancedArray` creates persistent GPU buffers that survive across frames. This eliminates the CPU-GPU data transfer that kills performance in traditional particle systems.

### 6. Migrate to WebGPU when you hit performance walls

If your WebGL project runs smoothly, there's no urgent need to migrate. Migrate when:

- Draw-call-heavy scenes drop frames
- You need compute shaders for physics or simulations
- Complex post-processing chains cause stuttering

### 7. Know the browser support matrix

| Browser     | WebGPU Support                         |
| :---------- | :------------------------------------- |
| Chrome/Edge | Since v113 (2023)                      |
| Firefox     | Since v141 (Windows), v145 (macOS ARM) |
| Safari      | Since v26 (September 2025)             |

All major browsers now support WebGPU—the waiting game is over. (Source: [caniuse.com/webgpu](https://caniuse.com/webgpu))

### 8. Use forceWebGL strategically

The `forceWebGL: true` option forces WebGL mode on the WebGPURenderer. This is useful for:

- Testing WebGL fallback behavior on WebGPU-capable machines
- Debugging shader compilation differences between backends
- Supporting specific WebGL extensions not yet available in WebGPU

For production WebGL-only builds, consider using WebGLRenderer directly for a smaller bundle size.

### 9. Expect 2-10x performance gains in specific scenarios

WebGPU shines in:

- Draw-call-heavy scenes (hundreds of objects)
- Compute-intensive effects (particles, physics)
- Complex shader pipelines

These improvements are documented in [Chrome's WebGPU benchmarks](https://developer.chrome.com/blog/webgpu-cross-platform/) and our own production experience at [Expo 2025](https://www.utsubo.com/blog/hokusai-interactive-installation). It's not universally faster—profile your specific use case.

### 10. Use node materials for dynamic customization

Node materials accept properties like `positionNode`, `colorNode`, and `normalNode` for programmatic control:

```javascript
const material = new MeshStandardNodeMaterial();
material.positionNode = positionLocal.add(displacement);
material.colorNode = vertexColor;
```

This enables effects that would require custom shaders in WebGL.

### 11. Use renderAsync for compute-heavy scenes

When your scene includes compute shaders, use async rendering to properly synchronize GPU work:

```javascript
async function animate() {
  await renderer.renderAsync(scene, camera);
  requestAnimationFrame(animate);
}
```

This ensures compute passes complete before dependent render passes begin. For simple scenes without compute, regular `render()` is fine.

### 12. Understand WebGPU's binding model

WebGPU batches resources into bind groups, unlike WebGL's individual bindings. This architecture favors:

- Grouping frequently-updated uniforms (like time, camera) in one bind group
- Placing static data (textures, materials) in separate groups
- Minimizing bind group switches between draw calls

Three.js handles this automatically, but understanding it helps when debugging performance.

### 13. Use storage textures for read-write compute

Unlike regular textures, storage textures allow both reading and writing in compute shaders:

```javascript
import { storageTexture, textureStore, uvec2 } from 'three/tsl';

const outputTexture = new StorageTexture(width, height);
const store = textureStore(outputTexture, uvec2(x, y), computedColor);
```

Essential for effects like fluid simulation, image processing, and GPU-driven rendering.

### 14. Handle WebGPU feature detection gracefully

Not all WebGPU features are universally available. Check before using:

```javascript
const adapter = await navigator.gpu?.requestAdapter();
if (!adapter) {
  // Fall back to WebGL or show error
  return;
}

// Check specific features
const hasFloat32Filtering = adapter.features.has('float32-filterable');
const hasTimestamps = adapter.features.has('timestamp-query');
```

### 15. Debug with Chrome WebGPU DevTools

Chrome's GPU debugging (chrome://gpu) shows WebGPU status and errors. For deeper debugging:

1. Enable "WebGPU Developer Features" in chrome://flags
2. Use the Performance panel to trace GPU work
3. Check console for shader compilation errors—they're more verbose than WebGL

Validation errors appear in the console with stack traces pointing to the problematic call.

### 16. Minimize buffer updates per frame

WebGPU buffer writes are expensive. Instead of updating many small buffers:

```javascript
// Bad: multiple small updates
particles.forEach(p => p.buffer.update());

// Good: single batched update
const data = new Float32Array(particles.length * 4);
particles.forEach((p, i) => data.set(p.data, i * 4));
batchBuffer.update(data);
```

Use `instancedArray` for particle data that updates every frame.

### 17. Use compute shaders for physics

Beyond particles, compute shaders excel at physics simulations:

```javascript
import { compute, instancedArray } from 'three/tsl';

const positions = instancedArray(count, 'vec3');
const velocities = instancedArray(count, 'vec3');

const physicsCompute = compute(() => {
  const pos = positions.element(instanceIndex);
  const vel = velocities.element(instanceIndex);
  // Apply forces, collision detection, constraints
  positions.element(instanceIndex).assign(pos.add(vel.mul(deltaTime)));
});

renderer.compute(physicsCompute);
```

### 18. Generate terrain with compute shaders

Procedural terrain generation on the GPU enables real-time editing and massive scale:

```javascript
const heightmap = storageTexture(resolution, resolution);

const terrainCompute = compute(() => {
  const uv = uvec2(instanceIndex.mod(resolution), instanceIndex.div(resolution));
  const height = mx_noise_float(uv.mul(scale)).mul(amplitude);
  textureStore(heightmap, uv, vec4(height, 0, 0, 1));
});
```

### 19. Leverage workgroup shared memory

For compute shaders that need data sharing between threads, use workgroup variables:

```javascript
import { workgroupArray, workgroupBarrier } from 'three/tsl';

const sharedData = workgroupArray('float', 256);
// Load data into shared memory
sharedData.element(localIndex).assign(inputData);
workgroupBarrier(); // Sync all threads
// Now all threads can read from sharedData
```

Shared memory is 10-100x faster than global memory for repeated access patterns.

### 20. Use indirect draws for GPU-driven rendering

Let the GPU decide what to render based on compute shader output:

```javascript
const drawIndirectBuffer = new IndirectStorageBufferAttribute(4, 'uint');

// Compute shader populates: [vertexCount, instanceCount, firstVertex, firstInstance]
const cullCompute = compute(() => {
  // Frustum culling, LOD selection on GPU
  if (visible) drawIndirectBuffer.element(1).atomicAdd(1);
});

mesh.drawIndirect = drawIndirectBuffer;
```

Essential for rendering millions of instances with per-frame GPU culling.

## Asset Optimization

Your 3D assets are often the biggest performance bottleneck. A 50MB GLTF file will destroy load times regardless of how optimized your rendering code is.

### 21. Compress geometry with Draco

Draco compression reduces geometry file sizes by 90-95% (Source: [gltf-transform docs](https://gltf-transform.dev/modules/functions/functions/draco)):

```bash
gltf-transform draco model.glb compressed.glb --method edgebreaker
```

The decompression happens in a Web Worker, so it doesn't block the main thread.

### 22. Use KTX2 for texture compression

PNG and JPEG textures decompress fully in GPU memory. A 200KB PNG can occupy 20MB+ of VRAM. KTX2 with Basis Universal stays compressed on the GPU, reducing memory by ~10x:

```bash
gltf-transform uastc model.glb optimized.glb
```

### 23. Choose UASTC for quality, ETC1S for size

- **UASTC**: Higher quality, larger files. Best for normal maps and hero textures.
- **ETC1S**: Smaller files, acceptable quality. Best for environment textures and secondary assets.

Use UASTC for normals and ETC1S for diffuse as a starting rule.

### 24. Master gltf-transform CLI

[gltf-transform](https://gltf-transform.dev/) is the Swiss Army knife for GLTF optimization:

```bash
# Full optimization pipeline
gltf-transform optimize model.glb output.glb \
  --texture-compress ktx2 \
  --compress draco
```

### 25. Use Shopify's gltf-compressor for visual comparison

[gltf-compressor](https://github.com/shopify/gltf-compressor) lets you interactively compress textures while previewing changes. Hold "C" to see the original, release to see compressed. This answers: "How much can I compress before it looks bad?"

### 26. Implement LOD (Level of Detail)

Swap high-poly models for low-poly versions at distance. In React Three Fiber, Drei's `<Detailed />` handles this:

```jsx
<Detailed distances={[0, 50, 100]}>
  <HighPolyModel />
  <MediumPolyModel />
  <LowPolyModel />
</Detailed>
```

LOD can improve frame rates by 30-40% in large scenes.

### 27. Atlas textures to reduce binds

Multiple textures = multiple texture binds = slower rendering. Combine textures into atlases and update UV coordinates accordingly. This reduces overhead significantly on mobile GPUs.

### 28. Configure decoder paths correctly

Draco and KTX2 require decoders. Set them up once:

```javascript
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');

const ktx2Loader = new KTX2Loader();
ktx2Loader.setTranscoderPath('/basis/');
```

Host the decoder files on your CDN for fast access.

### 29. Consider Meshopt as a Draco alternative

Meshopt provides similar compression to Draco with faster decompression. Combined with gzip, it can match Draco's ratios while being lighter on the client. Test both for your use case.

## Draw Call Optimization

Every mesh in your scene typically generates one draw call. Each draw call has CPU overhead. The key insight: **triangle count matters less than draw call count**.

### 30. Target under 100 draw calls per frame

This is the golden rule. Below 100 draw calls, most devices maintain smooth 60fps. Above 500, even powerful GPUs struggle. Check with `renderer.info.render.calls`.

### 31. Use InstancedMesh for repeated objects

Rendering 1,000 trees as individual meshes = 1,000 draw calls. Using InstancedMesh = 1 draw call:

```javascript
const mesh = new InstancedMesh(geometry, material, 1000);
for (let i = 0; i < 1000; i++) {
  matrix.setPosition(positions[i]);
  mesh.setMatrixAt(i, matrix);
}
```

A real estate demo reduced draw calls from 9,000 to 300 by switching chairs to instanced rendering.

### 32. Use BatchedMesh for varied geometries

BatchedMesh (since r156) combines multiple geometries sharing a material into a single draw call. Unlike InstancedMesh, each instance can have different geometry.

### 33. Share materials between meshes

Three.js batches meshes with identical materials. Creating a new material for every object defeats this optimization:

```javascript
// Bad: new material per mesh
meshes.forEach(m => m.material = new MeshStandardMaterial({ color: 'red' }));

// Good: shared material
const sharedMaterial = new MeshStandardMaterial({ color: 'red' });
meshes.forEach(m => m.material = sharedMaterial);
```

### 34. Merge static geometry with BufferGeometryUtils

For static scenes, merge meshes at load time:

```javascript
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const merged = mergeGeometries([geo1, geo2, geo3]);
const mesh = new Mesh(merged, sharedMaterial);
```

One draw call instead of many.

### 35. Use array textures for modern browsers

Array textures combine multiple textures into layers, accessed by index in shaders. Combined with BatchedMesh, this enables diverse appearances with minimal draw calls.

### 36. Understand frustum culling

Three.js automatically culls objects outside the camera's view—they don't generate draw calls. You can control this behavior:

```javascript
// Default: objects outside view are culled
mesh.frustumCulled = true;

// Disable for objects that should always render (skyboxes, particle systems)
skybox.frustumCulled = false;

// For manual culling with complex logic:
const frustum = new Frustum();
const matrix = new Matrix4().multiplyMatrices(
  camera.projectionMatrix,
  camera.matrixWorldInverse
);
frustum.setFromProjectionMatrix(matrix);

if (frustum.intersectsObject(mesh)) {
  // Object is visible
}
```

Frustum culling is free optimization—ensure your bounding boxes are accurate for it to work correctly.

## Memory Management

Three.js doesn't garbage collect GPU resources automatically. You must explicitly dispose of geometries, materials, and textures when done with them.

### 37. Dispose all GPU resources when done

Three.js doesn't garbage collect GPU resources. Always dispose geometries, materials, and textures:

```javascript
function cleanupMesh(mesh) {
  mesh.geometry.dispose();

  if (Array.isArray(mesh.material)) {
    mesh.material.forEach(mat => {
      Object.values(mat).forEach(prop => {
        if (prop?.isTexture) prop.dispose();
      });
      mat.dispose();
    });
  } else {
    Object.values(mesh.material).forEach(prop => {
      if (prop?.isTexture) prop.dispose();
    });
    mesh.material.dispose();
  }

  scene.remove(mesh);
}
```

A single 4K texture uses 64MB+ of VRAM. Geometries and shader programs also persist. Monitor `renderer.info.memory`—if counts keep growing, you have leaks.

### 38. Handle ImageBitmap textures from GLTF specially

GLTF textures load as ImageBitmap, which requires explicit closing:

```javascript
texture.source.data.close?.();
texture.dispose();
```

Without `close()`, ImageBitmap objects leak.

### 39. Use object pooling for spawned entities

For frequently created/destroyed objects (bullets, particles, enemies), pool instead of creating new. This avoids allocation overhead and GC pauses:

```javascript
class ObjectPool {
  constructor(factory, reset, initialSize = 20) {
    this.factory = factory;
    this.reset = reset;
    this.pool = [];

    // Pre-warm the pool
    for (let i = 0; i < initialSize; i++) {
      const obj = factory();
      obj.visible = false;
      this.pool.push(obj);
    }
  }

  acquire() {
    const obj = this.pool.pop() || this.factory();
    obj.visible = true;
    return obj;
  }

  release(obj) {
    this.reset(obj);
    obj.visible = false;
    this.pool.push(obj);
  }
}

// Usage
const bulletPool = new ObjectPool(
  () => new Mesh(bulletGeometry, bulletMaterial),
  (bullet) => bullet.position.set(0, 0, 0),
  50
);

// Spawn
const bullet = bulletPool.acquire();
scene.add(bullet);

// Despawn
bulletPool.release(bullet);
```

Pre-warm pools during loading to avoid runtime allocation spikes.

### 40. Cache and reuse textures

Load each texture once, reference it everywhere:

```javascript
const textureCache = new Map();

function getTexture(url) {
  if (!textureCache.has(url)) {
    textureCache.set(url, textureLoader.load(url));
  }
  return textureCache.get(url);
}
```

### 41. Dispose render targets

Post-processing render targets need disposal too:

```javascript
renderTarget.dispose();
```

Each render target allocates framebuffer memory.

### 42. Clean up on component unmount (React)

In React Three Fiber, use cleanup functions:

```javascript
useEffect(() => {
  return () => {
    geometry.dispose();
    material.dispose();
    texture.dispose();
  };
}, []);
```

## Shaders & Materials

Shader optimization is where experts separate from beginners. Small changes can yield 2x performance improvements, especially on mobile.

### 43. Use mediump precision on mobile

Mobile GPUs process mediump at roughly 2x the speed of highp:

```glsl
precision mediump float;
```

Only use highp when you need it (depth calculations, positions).

### 44. Minimize varying variables

Varyings transfer data between vertex and fragment shaders. Keep them under 3 for mobile GPUs:

```glsl
// Bad: many varyings
varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec4 vColor;

// Better: pack data
varying vec4 vData1; // xy = uv, zw = packed normal
varying vec4 vData2; // xyz = position, w = unused
```

### 45. Replace conditionals with mix() and step()

Branching kills GPU parallelism:

```glsl
// Bad: branching
if (value > 0.5) {
  color = colorA;
} else {
  color = colorB;
}

// Good: branchless
color = mix(colorB, colorA, step(0.5, value));
```

### 46. Pack data into RGBA channels

Store 4 values per texel instead of 1:

```glsl
vec4 data = texture2D(dataTex, uv);
float value1 = data.r;
float value2 = data.g;
float value3 = data.b;
float value4 = data.a;
```

This reduces texture fetches by 75%.

### 47. Avoid dynamic loops

Loops with dynamic bounds prevent optimization:

```glsl
// Bad: dynamic
for (int i = 0; i < count; i++) { ... }

// Better: fixed
for (int i = 0; i < 16; i++) { ... }
```

Or unroll short loops entirely.

### 48. Prefer TSL over raw GLSL/WGSL

TSL handles cross-compilation, uniforms, and attributes automatically. Raw shaders require maintaining two codebases (GLSL + WGSL).

### 49. Build custom effects with node materials

Node materials are composable:

```javascript
const noise = mx_noise_float(positionLocal);
const displaced = positionLocal.add(normalLocal.mul(noise));
material.positionNode = displaced;
```

### 50. Write reusable TSL functions with Fn

Create reusable shader logic with the `Fn` pattern:

```javascript
import { Fn, float, vec3 } from 'three/tsl';

const fresnel = Fn(([normal, viewDir, power]) => {
  const dotNV = normal.dot(viewDir).saturate();
  return float(1).sub(dotNV).pow(power);
});

// Use it
material.emissiveNode = fresnel(normalWorld, viewDirection, 3.0).mul(color);
```

Functions compile once and can be reused across materials.

### 51. Use TSL's built-in noise functions

TSL includes MaterialX noise functions—no need for external libraries:

```javascript
import { mx_noise_float, mx_noise_vec3, mx_fractal_noise_float } from 'three/tsl';

// Simple noise
const n = mx_noise_float(positionLocal.mul(scale));

// Fractal noise with octaves
const fbm = mx_fractal_noise_float(positionLocal, octaves, lacunarity, gain);

// 3D noise for color variation
const colorNoise = mx_noise_vec3(uv.mul(10));
```

### 52. Reuse shader programs

Three.js reuses programs for identical shaders. If you define uniforms the same way, programs are shared. Unnecessary variations create program proliferation.

## Lighting & Shadows

Lighting is expensive. Shadows are more expensive. Real-time lighting with shadows can consume more GPU time than everything else combined.

### 53. Limit active lights to 3 or fewer

Each additional light adds computational complexity. Beyond 3 lights, consider baking or using environment maps.

### 54. Understand PointLight shadow cost

PointLight shadows require 6 shadow map renders (one per cube face):

Two PointLights with shadows on 10 objects = 120 extra draw calls.

### 55. Bake lightmaps for static scenes

If lighting doesn't change, bake it into textures:

- Use Blender's bake functionality
- Or [@react-three/lightmap](https://github.com/pmndrs/react-three-lightmap) for runtime baking

Baked lighting is essentially free at render time.

### 56. Use Cascaded Shadow Maps for large scenes

CSM provides high-quality shadows near the camera and lower quality at distance:

```javascript
import { CSM } from 'three/addons/csm/CSM.js';

const csm = new CSM({
  maxFar: camera.far,
  cascades: 4, // desktop: 4, mobile: 2
  shadowMapSize: 2048
});
```

### 57. Size shadow maps appropriately

- Mobile: 512-1024
- Desktop: 1024-2048
- Quality-critical: 4096

Larger shadow maps consume quadratically more memory.

### 58. Use @react-three/lightmap for runtime baking

Generate lightmaps at load time, allowing some light customization:

```jsx
import { Lightmap } from '@react-three/lightmap';

<Lightmap>
  <Scene />
</Lightmap>
```

### 59. Use environment maps for ambient light

Environment maps (HDRIs) provide realistic lighting without per-light calculation:

```javascript
const envMap = pmremGenerator.fromScene(scene).texture;
scene.environment = envMap;
```

### 60. Tune shadow camera frustum

A tight frustum improves shadow quality:

```javascript
directionalLight.shadow.camera.left = -10;
directionalLight.shadow.camera.right = 10;
directionalLight.shadow.camera.top = 10;
directionalLight.shadow.camera.bottom = -10;
```

Don't use defaults—fit to your scene.

### 61. Disable shadow auto-update for static scenes

If your lights and shadow-casting objects don't move, disable automatic shadow map updates:

```javascript
renderer.shadowMap.autoUpdate = false;

// When lights or objects do move, manually trigger update:
renderer.shadowMap.needsUpdate = true;
```

This saves a full shadow pass every frame. For scenes with occasional movement, update shadows only when needed.

### 62. Use fake shadows for simple cases

A semi-transparent plane with a radial gradient can fake contact shadows cheaply. Good enough for many use cases without the cost of real shadows.

## React Three Fiber

React Three Fiber (R3F) adds React's mental model to Three.js. It also adds performance pitfalls specific to React's rendering paradigm.

### 63. Mutate in useFrame, don't setState

The core rule: Three.js mutations happen in useFrame, not React state:

```javascript
// Bad: triggers React re-render
const [rotation, setRotation] = useState(0);
useFrame(() => setRotation(r => r + 0.01));

// Good: direct mutation
const meshRef = useRef();
useFrame(() => {
  meshRef.current.rotation.x += 0.01;
});
```

### 64. Use frameloop="demand" for static scenes

If nothing animates, don't render every frame:

```jsx
<Canvas frameloop="demand">
  <Scene />
</Canvas>
```

This saves battery on mobile devices.

### 65. Call invalidate() for manual updates

With on-demand rendering, trigger re-render when needed:

```javascript
const invalidate = useThree(state => state.invalidate);

// After a change
invalidate();
```

### 66. Never create objects inside useFrame

Object creation triggers garbage collection:

```javascript
// Bad: creates new Vector3 every frame
useFrame(() => {
  mesh.position.copy(new Vector3(1, 2, 3));
});

// Good: reuse
const targetPos = useMemo(() => new Vector3(1, 2, 3), []);
useFrame(() => {
  mesh.position.copy(targetPos);
});
```

### 67. Use delta for frame-rate independence

Different devices have different refresh rates:

```javascript
useFrame((state, delta) => {
  // Bad: speed varies with frame rate
  mesh.rotation.x += 0.1;

  // Good: consistent speed
  mesh.rotation.x += delta * speed;
});
```

### 68. Use Drei's for LOD

No boilerplate LOD:

```jsx
import { Detailed } from '@react-three/drei';

<Detailed distances={[0, 20, 50]}>
  <HighDetail />
  <MediumDetail />
  <LowDetail />
</Detailed>
```

### 69. Preload models with useGLTF.preload

Load models before they're needed:

```javascript
useGLTF.preload('/model.glb');

// Later, in component
const { scene } = useGLTF('/model.glb');
```

### 70. Wrap expensive components in React.memo

Prevent unnecessary re-renders:

```javascript
const ExpensiveModel = React.memo(({ url }) => {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
});
```

### 71. Toggle visibility instead of remounting

Remounting recreates buffers and recompiles shaders:

```javascript
// Bad: unmount/mount
{showModel && <Model />}

// Good: visibility toggle
<Model visible={showModel} />
```

### 72. Use r3f-perf for monitoring

Drop-in performance monitoring for R3F:

```jsx
import { Perf } from 'r3f-perf';

<Canvas>
  <Perf position="top-left" />
  <Scene />
</Canvas>
```

## Post-Processing & Effects

Post-processing runs additional GPU passes over your rendered scene. Each effect adds cost, but smart configuration minimizes impact.

### 73. Use pmndrs/postprocessing over Three.js default

The [pmndrs postprocessing library](https://github.com/pmndrs/postprocessing) automatically merges effects into fewer passes:

```javascript
import { EffectComposer, Bloom, Vignette } from 'postprocessing';

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new EffectPass(camera, new Bloom(), new Vignette()));
```

### 74. Configure renderer for post-processing

Optimal settings when using EffectComposer:

```javascript
// WebGL
const renderer = new WebGLRenderer({
  powerPreference: 'high-performance',
  antialias: false,      // AA handled by post-processing
  stencil: false,
  depth: false
});

// WebGPU
const renderer = new WebGPURenderer({
  antialias: false,
  powerPreference: 'high-performance'
});
await renderer.init();
```

WebGPU handles depth/stencil buffers automatically. Both renderers benefit from disabling native AA when post-processing adds SMAA/FXAA.

### 75. Disable multisampling for performance

When you don't need it:

```jsx
<EffectComposer multisampling={0}>
  <Bloom />
</EffectComposer>
```

### 76. Apply tone mapping at pipeline end

With post-processing, disable renderer tone mapping:

```javascript
renderer.toneMapping = NoToneMapping;
```

Add ToneMappingEffect as the last effect instead.

### 77. Implement selective bloom

Not everything should bloom. Use layers or threshold:

```javascript
const bloom = new SelectiveBloomEffect(scene, camera, {
  luminanceThreshold: 0.9,
  luminanceSmoothing: 0.3
});
```

### 78. Add antialiasing at the end

Post-processing bypasses WebGL's built-in AA. Add SMAA or FXAA as the final pass:

```javascript
composer.addPass(new EffectPass(camera, new SMAAEffect()));
```

### 79. Tune bloom parameters carefully

- **intensity**: Overall strength (0.5-2.0 typical)
- **luminanceThreshold**: Minimum brightness to bloom (0.8-1.0)
- **radius**: Spread size (0.5-1.0)

Lower resolution bloom is cheaper and often looks good.

### 80. Consider resolution vs. quality tradeoffs

Rendering at half resolution, then upscaling, can double frame rate:

```javascript
composer.setSize(window.innerWidth / 2, window.innerHeight / 2);
```

### 81. Merge compatible effects

Some effects can combine their shader passes:

```javascript
// Single pass for multiple effects
const effects = new EffectPass(camera, bloom, vignette, chromaticAberration);
```

### 82. Use Three.js native post-processing for WebGPU

For WebGPU projects, use Three.js's built-in post-processing with TSL nodes instead of pmndrs/postprocessing:

```javascript
import { pass, bloom, fxaa } from 'three/tsl';

const postProcessing = new PostProcessing(renderer);
const scenePass = pass(scene, camera);
postProcessing.outputNode = scenePass.pipe(bloom()).pipe(fxaa());
```

The pmndrs library remains excellent for WebGL projects, but TSL-based post-processing is the native solution for WebGPU with full compute shader support.

## Loading & Core Web Vitals

Heavy 3D experiences can destroy Core Web Vitals if you're not careful. Here's how to maintain good LCP, FID/INP, and CLS while delivering rich experiences.

### 83. Lazy load 3D content below the fold

If 3D isn't immediately visible, defer its loading:

```javascript
const observer = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting) {
    loadThreeJsScene();
    observer.disconnect();
  }
});

observer.observe(canvasContainer);
```

### 84. Code-split Three.js modules

Don't bundle everything upfront:

```javascript
const Three = await import('three');
const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
```

### 85. Preload critical assets

For above-the-fold 3D, preload aggressively:

```html
<link rel="preload" href="/model.glb" as="fetch" crossorigin>
<link rel="preload" href="/texture.ktx2" as="fetch" crossorigin>
```

### 86. Implement progressive loading

Show low-resolution first, load high-res in background:

```javascript
// Load low-res immediately
const lowRes = await loadModel('low.glb');
scene.add(lowRes);

// Load high-res async
loadModel('high.glb').then(highRes => {
  scene.remove(lowRes);
  scene.add(highRes);
});
```

### 87. Offload heavy work to Web Workers

Physics, procedural generation, and asset processing can run off the main thread:

```javascript
const worker = new Worker('/physics-worker.js');
worker.postMessage({ positions, velocities });
```

### 88. Stream large scenes

For massive environments, load sections dynamically:

```javascript
function updateVisibleChunks(cameraPosition) {
  const visibleChunks = getChunksNear(cameraPosition);
  visibleChunks.forEach(chunk => {
    if (!chunk.loaded) loadChunk(chunk);
  });
}
```

### 89. Use placeholder geometry during load

Show something immediately:

```javascript
// Simple box while loading
const placeholder = new Mesh(
  new BoxGeometry(1, 1, 1),
  new MeshBasicMaterial({ color: 0x808080, wireframe: true })
);
scene.add(placeholder);

// Replace when loaded
loadModel().then(model => {
  scene.remove(placeholder);
  scene.add(model);
});
```

### 90. Use Suspense with R3F

R3F integrates with React Suspense:

```jsx
<Suspense fallback={<Loader />}>
  <Model />
</Suspense>
```

## Development & Debugging

The best optimization is the one you don't need because you caught the problem early. These tools and techniques help identify issues before they become production problems.

### 91. Use stats-gl for WebGL/WebGPU monitoring

[stats-gl](https://github.com/RenaudRohlinger/stats-gl) provides real-time FPS, CPU, and GPU metrics. It works with both WebGL and WebGPU:

```javascript
import Stats from 'stats-gl';

const stats = new Stats();
document.body.appendChild(stats.dom);

function animate() {
  stats.begin();
  // ... render
  stats.end();
  requestAnimationFrame(animate);
}
```

### 92. Set up lil-gui for live tweaking

[lil-gui](https://lil-gui.georgealways.com/) creates debug panels for any JavaScript object:

```javascript
import GUI from 'lil-gui';

const gui = new GUI();
gui.add(camera.position, 'x', -10, 10);
gui.add(camera.position, 'y', -10, 10);
gui.add(light, 'intensity', 0, 2);
```

Essential for finding the right values during development.

### 93. Profile with Spector.js

Spector.js is a browser extension that captures WebGL frames. See every draw call, texture bind, and shader program. Invaluable for understanding what's actually happening.

### 94. Check renderer.info regularly

```javascript
setInterval(() => {
  console.log('Calls:', renderer.info.render.calls);
  console.log('Triangles:', renderer.info.render.triangles);
  console.log('Geometries:', renderer.info.memory.geometries);
  console.log('Textures:', renderer.info.memory.textures);
}, 1000);
```

Watch these numbers. They should stay stable, not climb.

### 95. Use three-mesh-bvh for fast raycasting

[three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) enables raycasting against 80,000+ polygons at 60fps:

```javascript
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';

mesh.geometry.boundsTree = new MeshBVH(mesh.geometry);
mesh.raycast = acceleratedRaycast;
```

Essential for interactive scenes with complex geometry.

### 96. Use browser DevTools Performance tab

Chrome/Edge DevTools shows where time is spent:

- Long frames
- Garbage collection pauses
- Blocking JavaScript

Profile real sessions, not just synthetic tests.

### 97. Use GPU timing queries with feature detection

WebGPU timestamp queries require the `timestamp-query` feature, which isn't enabled by default:

```javascript
// Check feature support
const adapter = await navigator.gpu.requestAdapter();
const hasTimestamps = adapter.features.has('timestamp-query');

if (hasTimestamps) {
  const device = await adapter.requestDevice({
    requiredFeatures: ['timestamp-query']
  });
  // Now you can create timestamp query sets
}
```

For Three.js projects, stats-gl handles this complexity—use it instead of raw timestamp queries for most profiling needs.

### 98. Handle context lost gracefully

WebGL context can be lost on mobile. Listen and recover:

```javascript
renderer.domElement.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  // Stop animation loop
});

renderer.domElement.addEventListener('webglcontextrestored', () => {
  // Reinitialize
});
```

### 99. Profile the animation loop

Measure what happens each frame:

```javascript
function animate() {
  const t0 = performance.now();

  physics.update();
  const t1 = performance.now();

  controls.update();
  const t2 = performance.now();

  renderer.render(scene, camera);
  const t3 = performance.now();

  console.log(`Physics: ${t1-t0}ms, Controls: ${t2-t1}ms, Render: ${t3-t2}ms`);

  requestAnimationFrame(animate);
}
```

### 100. Use setAnimationLoop for cleaner render loops

Instead of manual `requestAnimationFrame`, use Three.js's built-in animation loop:

```javascript
// Instead of:
function animate() {
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

// Use:
renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
});

// Stop when needed
renderer.setAnimationLoop(null);
```

This handles XR sessions automatically and provides cleaner start/stop control. Essential for WebXR applications.

## About Utsubo

Utsubo is an interactive creative studio specializing in Three.js development, from brand websites to physical installations.

We shipped one of the first production WebGPU Three.js experiences at [2024.utsubo.com](https://2024.utsubo.com/) in early 2024. We actively contribute to the Three.js ecosystem, including tools like [stats-gl](https://github.com/RenaudRohlinger/stats-gl) for WebGPU performance monitoring.

Our work includes:

- **[utsubo.com](https://utsubo.com/)**: Award-winning 3D heavy experience
- **[Hokusai installation](https://www.utsubo.com/blog/hokusai-interactive-installation)**: 1M particle fluid simulation at Expo 2025 Osaka
- **[Segments.ai](https://segments.ai/)**: 100x performance improvement via WebGPU migration

We work with brands, museums, and tech companies building the next generation of web experiences.

## Let's Build Something Together

Looking for a team to create your next 3D web experience? Book a free discovery call.

[Book a free discovery call](https://cal.com/utsubo/30min?source_url=%2Fblog%2Fthreejs-best-practices-100-tips)

## Related Reading

- **[Three.js 2026: What Changed](https://www.utsubo.com/blog/threejs-2026-what-changed)** — Overview of WebGPU adoption, vibe coding, and the expanded Three.js ecosystem
- **[WebGPU Three.js Migration Guide](https://www.utsubo.com/blog/webgpu-threejs-migration-guide)** — Step-by-step migration checklist for existing WebGL projects

## Summary

The 100 tips above cover the essential practices for production Three.js development in 2026: WebGPU renderer adoption, asset optimization with Draco and KTX2, draw call reduction through instancing and batching, proper memory management, and effective debugging workflows. Below, we answer the most common questions developers ask when optimizing their projects.

## FAQs

### How do I optimize Three.js performance?

Start by measuring: use stats-gl and renderer.info to identify bottlenecks. The most common issues are too many draw calls (solved by instancing and batching), unoptimized assets (use Draco and KTX2 compression), and memory leaks (always dispose unused resources). Target under 100 draw calls for smooth 60fps performance.

### What are the best practices for WebGPU in Three.js?

Since r171, use `import { WebGPURenderer } from 'three/webgpu'` for zero-config setup with automatic WebGL 2 fallback. Learn TSL (Three Shader Language) for cross-platform shaders. Use compute shaders for particle systems and physics. WebGPU shines in draw-call-heavy scenes and compute-intensive effects, delivering 2-10x improvements in those scenarios.

### How do I reduce draw calls in Three.js?

Use InstancedMesh for repeated objects (trees, particles, props). Use BatchedMesh for objects sharing materials but with different geometries. Share materials between meshes. Merge static geometry with BufferGeometryUtils. Use texture atlases to reduce material variations. Check your progress with renderer.info.render.calls.

### What tools help debug Three.js applications?

Essential tools include: stats-gl for FPS/CPU/GPU monitoring, lil-gui for live parameter tweaking, Spector.js for WebGL frame capture, three-mesh-bvh for fast raycasting, renderer.info for memory and draw call stats, and browser DevTools Performance tab for frame timing analysis.

### Should I migrate from WebGL to WebGPU?

Migrate if you're hitting performance walls—especially with draw-call-heavy scenes, complex particle systems, or compute-intensive effects. For new projects, start with WebGPU. If your current WebGL project runs smoothly and you're not limited by performance, there's no urgent need to migrate. Three.js provides automatic fallback, so you can adopt WebGPU without breaking compatibility.

### How do I handle memory leaks in Three.js?

Always dispose resources when done: call geometry.dispose(), material.dispose(), and texture.dispose(). For GLTF textures loaded as ImageBitmap, also call texture.source.data.close?.(). Monitor renderer.info.memory—if geometries and textures keep growing, you have a leak. Implement resource pooling for frequently created/destroyed objects.

## Have a project in mind?

Tell us what you’re building — we reply within 1–2 business days.



Or alternatively [get a concept call here](https://cal.com/utsubo/30min?source_url=%2Fblog%2Fthreejs-best-practices-100-tips%2F)

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

- [Book a Call](https://cal.com/utsubo/30min?source_url=%2Fblog%2Fthreejs-best-practices-100-tips%2F)
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