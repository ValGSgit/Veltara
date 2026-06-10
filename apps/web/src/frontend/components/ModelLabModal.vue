<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import * as THREE from 'three';

const props = defineProps({
  open: { type: Boolean, required: true },
});

const emit = defineEmits(['close']);

const viewportRef = ref(null);
const errorMessage = ref('');
const fileName = ref('');

const scale = ref(1);
const rotationX = ref(0);
const rotationY = ref(0);
const rotationZ = ref(0);
const positionX = ref(0);
const positionY = ref(0);
const positionZ = ref(0);

const transformSummary = computed(() => {
  return {
    scale: Number(scale.value).toFixed(2),
    rotation: `${Number(rotationX.value).toFixed(1)}, ${Number(rotationY.value).toFixed(1)}, ${Number(rotationZ.value).toFixed(1)}`,
    position: `${Number(positionX.value).toFixed(2)}, ${Number(positionY.value).toFixed(2)}, ${Number(positionZ.value).toFixed(2)}`,
  };
});

let renderer = null;
let scene = null;
let camera = null;
let animationId = null;
let loadedObject = null;
let objectRoot = null;
let objectBoxHelper = null;
let objectUrl = null;
let orbitAngle = 0;

function disposeObject() {
  if (objectBoxHelper) {
    scene?.remove(objectBoxHelper);
    objectBoxHelper.geometry?.dispose?.();
    objectBoxHelper.material?.dispose?.();
    objectBoxHelper = null;
  }
  if (!loadedObject) return;
  loadedObject.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => {
          material?.map?.dispose?.();
          material?.normalMap?.dispose?.();
          material?.emissiveMap?.dispose?.();
          material?.metalnessMap?.dispose?.();
          material?.roughnessMap?.dispose?.();
          material?.dispose?.();
        });
      } else {
        child.material?.map?.dispose?.();
        child.material?.normalMap?.dispose?.();
        child.material?.emissiveMap?.dispose?.();
        child.material?.metalnessMap?.dispose?.();
        child.material?.roughnessMap?.dispose?.();
        child.material?.dispose?.();
      }
    }
  });
  objectRoot?.remove(loadedObject);
  loadedObject = null;
}

function cleanupScene() {
  cancelAnimationFrame(animationId);
  animationId = null;
  disposeObject();
  if (renderer) {
    renderer.dispose();
    renderer.forceContextLoss?.();
    renderer.domElement.remove();
    renderer = null;
  }
  scene = null;
  camera = null;
  objectRoot = null;
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
}

function fitCameraToObject(target) {
  const box = new THREE.Box3().setFromObject(target);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z, 0.0001);
  const fov = (camera.fov * Math.PI) / 180;
  const dist = (maxSize / (2 * Math.tan(fov / 2))) * 1.75;
  camera.position.set(center.x + dist * 0.2, center.y + dist * 0.12, center.z + dist);
  camera.lookAt(center);
}

function resetTransformControls() {
  scale.value = 1;
  rotationX.value = 0;
  rotationY.value = 0;
  rotationZ.value = 0;
  positionX.value = 0;
  positionY.value = 0;
  positionZ.value = 0;
}

function applyTransform() {
  if (!loadedObject) return;
  loadedObject.scale.setScalar(Number(scale.value));
  loadedObject.rotation.set(
    THREE.MathUtils.degToRad(Number(rotationX.value)),
    THREE.MathUtils.degToRad(Number(rotationY.value)),
    THREE.MathUtils.degToRad(Number(rotationZ.value)),
  );
  loadedObject.position.set(
    Number(positionX.value),
    Number(positionY.value),
    Number(positionZ.value),
  );
  if (objectBoxHelper) {
    objectBoxHelper.update();
  }
}

watch([scale, rotationX, rotationY, rotationZ, positionX, positionY, positionZ], applyTransform);

async function loadModelFile(file) {
  errorMessage.value = '';
  if (!file) return;

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext || !['glb', 'gltf', 'fbx'].includes(ext)) {
    errorMessage.value = 'Supported formats: .glb, .gltf, .fbx';
    return;
  }

  disposeObject();
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
  }
  objectUrl = URL.createObjectURL(file);
  fileName.value = file.name;

  try {
    let object = null;
    if (ext === 'fbx') {
      const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
      const loader = new FBXLoader();
      object = await new Promise((resolve, reject) => {
        loader.load(objectUrl, resolve, undefined, reject);
      });
    } else {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const loader = new GLTFLoader();
      const gltf = await new Promise((resolve, reject) => {
        loader.load(objectUrl, resolve, undefined, reject);
      });
      object = gltf.scene;
    }

    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = false;
      child.receiveShadow = false;
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => {
          if (!material) return;
          if ('map' in material && material.map) {
            material.map.encoding = THREE.sRGBEncoding;
          }
          material.needsUpdate = true;
        });
      } else if (child.material) {
        if ('map' in child.material && child.material.map) {
          child.material.map.encoding = THREE.sRGBEncoding;
        }
        child.material.needsUpdate = true;
      }
    });

    loadedObject = object;
    objectRoot.add(loadedObject);
    resetTransformControls();
    applyTransform();
    fitCameraToObject(loadedObject);

    objectBoxHelper = new THREE.BoxHelper(loadedObject, 0x64d2ff);
    objectBoxHelper.material.transparent = true;
    objectBoxHelper.material.opacity = 0.7;
    scene.add(objectBoxHelper);
  } catch (err) {
    errorMessage.value = `Failed to load model: ${err?.message ?? 'Unknown error'}`;
  }
}

function onFileInput(event) {
  const file = event?.target?.files?.[0];
  void loadModelFile(file);
}

function initScene() {
  if (!viewportRef.value || renderer) return;

  const width = viewportRef.value.clientWidth || 740;
  const height = viewportRef.value.clientHeight || 420;

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.outputEncoding = THREE.sRGBEncoding; // three r128 API (SRGBColorSpace is r152+)
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  viewportRef.value.innerHTML = '';
  viewportRef.value.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030710);

  camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 1000);
  camera.position.set(0, 1.2, 5.2);

  objectRoot = new THREE.Group();
  scene.add(objectRoot);

  const key = new THREE.DirectionalLight(0xffffff, 1.65);
  key.position.set(6, 5, 5);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x8ab8ff, 0.75);
  fill.position.set(-5, 2, -4);
  scene.add(fill);

  const hemi = new THREE.HemisphereLight(0x9fc8ff, 0x0b1324, 0.75);
  scene.add(hemi);

  const grid = new THREE.GridHelper(8, 16, 0x274a7a, 0x16233f);
  grid.position.y = -1.15;
  scene.add(grid);

  const pivot = new THREE.AxesHelper(1.2);
  scene.add(pivot);

  const animate = () => {
    animationId = requestAnimationFrame(animate);
    orbitAngle += 0.0032;
    if (loadedObject) {
      const radius = 0.12;
      const baseY = Number(positionY.value);
      objectRoot.position.x = Math.cos(orbitAngle) * radius * 0.25;
      objectRoot.position.z = Math.sin(orbitAngle) * radius * 0.25;
      objectRoot.position.y = baseY;
    }
    renderer.render(scene, camera);
  };
  animate();
}

function close() {
  emit('close');
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    setTimeout(() => initScene(), 0);
    return;
  }
  cleanupScene();
});

onBeforeUnmount(() => {
  cleanupScene();
});
</script>

<template>
  <div v-if="open" class="model-lab-backdrop" @click.self="close">
    <section class="model-lab glass-panel">
      <header class="model-lab__header">
        <div>
          <p class="model-lab__eyebrow">Sandbox Tooling</p>
          <h3>Model Test Lab</h3>
          <p class="model-lab__hint">Upload .glb/.gltf/.fbx and tune transforms before adding to game assets.</p>
        </div>
        <button type="button" class="model-lab__close" @click="close">Close</button>
      </header>

      <div class="model-lab__toolbar">
        <label class="model-lab__upload">
          <input type="file" accept=".glb,.gltf,.fbx,model/gltf-binary,model/gltf+json" @change="onFileInput" />
          Upload Model
        </label>
        <div class="model-lab__filename">{{ fileName || 'No model loaded' }}</div>
      </div>

      <div class="model-lab__viewport" ref="viewportRef"></div>

      <div v-if="errorMessage" class="model-lab__error">{{ errorMessage }}</div>

      <div class="model-lab__controls">
        <label>Scale
          <input v-model.number="scale" type="range" min="0.1" max="5" step="0.01" />
        </label>
        <label>Rot X
          <input v-model.number="rotationX" type="range" min="-180" max="180" step="1" />
        </label>
        <label>Rot Y
          <input v-model.number="rotationY" type="range" min="-180" max="180" step="1" />
        </label>
        <label>Rot Z
          <input v-model.number="rotationZ" type="range" min="-180" max="180" step="1" />
        </label>
        <label>Pos X
          <input v-model.number="positionX" type="range" min="-4" max="4" step="0.01" />
        </label>
        <label>Pos Y
          <input v-model.number="positionY" type="range" min="-4" max="4" step="0.01" />
        </label>
        <label>Pos Z
          <input v-model.number="positionZ" type="range" min="-4" max="4" step="0.01" />
        </label>
      </div>

      <div class="model-lab__summary">
        <span>Scale: {{ transformSummary.scale }}</span>
        <span>Rotation: {{ transformSummary.rotation }}</span>
        <span>Position: {{ transformSummary.position }}</span>
      </div>
    </section>
  </div>
</template>
