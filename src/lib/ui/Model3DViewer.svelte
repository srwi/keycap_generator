<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import * as THREE from 'three'
  import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
  import type { Group } from 'three'

  export let stlUrl: string | null = null
  export let stlBuffer: ArrayBuffer | null = null
  export let modelGroup: Group | null = null

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
    scene.background = new THREE.Color(0x0f172a) // slate-950

    camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000)
    // Initial position: bottom perspective (camera below, looking up)
    camera.position.set(0, -80, 0)
    camera.lookAt(0, 0, 0)

    renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    container.appendChild(renderer.domElement)

    controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.minDistance = 20
    controls.maxDistance = 200
    controls.target.set(0, 0, 0)

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.4)
    directionalLight1.position.set(50, 50, 50)
    scene.add(directionalLight1)

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3)
    directionalLight2.position.set(-50, -50, 50)
    scene.add(directionalLight2)

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
      if (child instanceof THREE.Mesh && child !== currentModelGroup) {
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
      camera.position.set(center.x, center.y - distance, center.z)
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

    const material = new THREE.MeshStandardMaterial({
      color: 0x64748b, // slate-500
      metalness: 0.3,
      roughness: 0.7,
    })

    mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    // Adjust camera to fit the model from bottom perspective
    const box = new THREE.Box3().setFromObject(mesh)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    const distance = maxDim * 2.5

    // Position camera below the model, looking up (bottom perspective)
    camera.position.set(center.x, center.y - distance, center.z)
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
</script>

<div bind:this={container} class="h-full w-full rounded-lg bg-slate-950" style="min-height: 300px;"></div>
