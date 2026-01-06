<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import * as THREE from 'three'
  import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
  import type { Group } from 'three'
  import { createKeycapMaterial, KEYCAP_BODY_COLOR } from '../generate/materials'

  export let stlUrl: string | null = null
  export let stlBuffer: ArrayBuffer | null = null
  export let modelGroup: Group | null = null
  export let rotationX: number = 0
  export let rotationY: number = 0
  export let rotationZ: number = 0

  let container: HTMLDivElement | null = null
  let scene: THREE.Scene | null = null
  let camera: THREE.PerspectiveCamera | null = null
  let renderer: THREE.WebGLRenderer | null = null
  let controls: OrbitControls | null = null
  let mesh: THREE.Mesh | null = null
  let currentModelGroup: Group | null = null

  function initScene() {
    if (!container) return

    scene = new THREE.Scene()
    scene.background = null

    camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000)
    camera.position.set(0, 0, 80)
    camera.lookAt(0, 0, 0)

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setClearColor(0x000000, 0)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2

    container.appendChild(renderer.domElement)

    controls = new OrbitControls(camera, renderer.domElement)
    controls.minDistance = 20
    controls.maxDistance = 200
    controls.target.set(0, 0, 0)

    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4)
    hemisphereLight.position.set(0, 50, 0)
    scene.add(hemisphereLight)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2)
    scene.add(ambientLight)

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.0)
    keyLight.position.set(50, 80, 50)
    keyLight.castShadow = false
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5)
    fillLight.position.set(-40, 30, 60)
    scene.add(fillLight)

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.6)
    rimLight.position.set(-60, -40, -40)
    scene.add(rimLight)

    const bottomLight = new THREE.DirectionalLight(0xffffff, 0.35)
    bottomLight.position.set(30, -50, 30)
    scene.add(bottomLight)

    const pointLight = new THREE.PointLight(0xffffff, 0.3, 200)
    pointLight.position.set(0, 0, 100)
    scene.add(pointLight)

    loadModel()
  }

  function clearScene() {
    if (!scene) return

    // Remove the current model group if it exists
    if (currentModelGroup) {
      // Dispose of all geometries and materials in the group
      currentModelGroup.traverse(child => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) {
            child.geometry.dispose()
          }
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => mat.dispose())
            } else {
              child.material.dispose()
            }
          }
        }
      })
      scene.remove(currentModelGroup)
      currentModelGroup = null
    }

    // Remove all meshes (for STL-based models)
    const objectsToRemove: THREE.Object3D[] = []
    scene.traverse(child => {
      if (child instanceof THREE.Mesh) {
        objectsToRemove.push(child)
      }
    })
    objectsToRemove.forEach(obj => {
      if (scene) {
        scene.remove(obj)
      }
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        if (obj.material instanceof THREE.Material) {
          obj.material.dispose()
        }
      }
    })
    mesh = null
  }

  async function loadModel() {
    if (!scene || !camera || !controls) return

    clearScene()

    // If we have a model group, use it directly
    if (modelGroup) {
      const clonedGroup = modelGroup.clone()
      currentModelGroup = clonedGroup
      scene.add(clonedGroup)

      // Adjust camera to fit the model from bottom perspective
      const box = new THREE.Box3().setFromObject(clonedGroup)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const distance = maxDim * 2.5

      // Position camera below the model, looking up (bottom perspective)
      camera.position.set(center.x, center.y, center.z - distance)
      camera.lookAt(center)
      controls.target.copy(center)
      controls.update()
      return
    }

    // Otherwise load from STL
    let geometry: THREE.BufferGeometry | null = null

    if (stlBuffer) {
      const loader = new STLLoader()
      geometry = loader.parse(stlBuffer)
    } else if (stlUrl) {
      try {
        const response = await fetch(stlUrl)
        const buffer = await response.arrayBuffer()
        const loader = new STLLoader()
        geometry = loader.parse(buffer)
      } catch (error) {
        console.error('Failed to load STL:', error)
        return
      }
    } else {
      return
    }

    if (!geometry) return

    geometry.computeVertexNormals()
    geometry.center()

    // Apply rotation if specified (after centering so rotation is around the model's center)
    if (rotationX !== 0 || rotationY !== 0 || rotationZ !== 0) {
      const rx = (rotationX * Math.PI) / 180
      const ry = (rotationY * Math.PI) / 180
      const rz = (rotationZ * Math.PI) / 180
      if (rx !== 0) geometry.rotateX(rx)
      if (ry !== 0) geometry.rotateY(ry)
      if (rz !== 0) geometry.rotateZ(rz)
    }

    const material = createKeycapMaterial(KEYCAP_BODY_COLOR)

    mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    // Adjust camera to fit the model from bottom perspective
    const box = new THREE.Box3().setFromObject(mesh)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    const distance = maxDim * 2.5

    // Position camera below the model, looking up (bottom perspective)
    camera.position.set(center.x, center.y, center.z - distance)
    camera.lookAt(center)
    controls.target.copy(center)
    controls.update()
  }

  function animate() {
    if (!renderer || !scene || !camera || !controls) return
    requestAnimationFrame(animate)
    controls.update()
    renderer.render(scene, camera)
  }

  function handleResize() {
    if (!container || !camera || !renderer) return
    camera.aspect = container.clientWidth / container.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(container.clientWidth, container.clientHeight)
  }

  onMount(() => {
    initScene()
    if (renderer) animate()
    window.addEventListener('resize', handleResize)
  })

  onDestroy(() => {
    window.removeEventListener('resize', handleResize)
    if (mesh) {
      mesh.geometry.dispose()
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose()
      }
    }
    if (renderer) {
      renderer.dispose()
      renderer.domElement.remove()
    }
    if (controls) controls.dispose()
  })

  $: if (stlUrl !== null || stlBuffer !== null || modelGroup !== null) {
    loadModel()
  }

  // Reload when rotation changes
  $: (rotationX, rotationY, rotationZ, (stlUrl !== null || stlBuffer !== null) && loadModel())
</script>

<div bind:this={container} class="h-full w-full" style="min-height: 300px;"></div>
