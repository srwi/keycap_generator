<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import * as THREE from 'three'
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
  import { processStlForModel } from '../generate/stl'
  import { KEYCAP_BODY_COLOR } from '../generate/materials'

  export let stlUrl: string | null = null
  export let stlBuffer: ArrayBuffer | null = null
  export let generatedMesh: THREE.Group | null = null
  export let widthMm: number = 20
  export let heightMm: number = 20
  export let rotationX = 0
  export let rotationY = 0
  export let rotationZ = 0
  export let orthographic = true
  export let enableControls = true

  let displayedWidthMm = widthMm
  let displayedHeightMm = heightMm

  let prevMesh: THREE.Group | null = null
  let prevStlUrl: string | null = null
  let prevStlBuffer: ArrayBuffer | null = null

  let container: HTMLDivElement
  let canvas: HTMLCanvasElement
  let scene: THREE.Scene
  let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
  let renderer: THREE.WebGLRenderer
  let controls: OrbitControls
  let contentGroup: THREE.Group
  let resizeObserver: ResizeObserver
  let frameId: number

  onMount(() => {
    initScene()
    updateContent()
    updateCamera()
    animate()
    resizeObserver = new ResizeObserver(onResize)
    resizeObserver.observe(container)
  })

  onDestroy(() => {
    if (frameId) cancelAnimationFrame(frameId)
    resizeObserver?.disconnect()
    renderer?.dispose()
    controls?.dispose()
  })

  $: (stlUrl, stlBuffer, generatedMesh, updateContent())
  $: if (displayedWidthMm || displayedHeightMm || orthographic) {
    updateCameraType()
    updateCamera()
  }
  $: if (!generatedMesh && (rotationX || rotationY || rotationZ)) updateContent()
  $: if (controls) {
    controls.enabled = enableControls
    if (!enableControls) {
      controls.reset()
      updateCamera()
    }
  }

  function initScene() {
    scene = new THREE.Scene()

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

    contentGroup = new THREE.Group()
    scene.add(contentGroup)

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setClearColor(0x000000, 0)

    updateCameraType()
    controls = new OrbitControls(camera, renderer.domElement)
    controls.enabled = enableControls
    controls.enableDamping = false
  }

  function updateCameraType() {
    if (!container) return
    const aspect = container.clientWidth / container.clientHeight

    camera = orthographic
      ? new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000)
      : new THREE.PerspectiveCamera(45, aspect, 0.1, 1000)

    if (controls) controls.object = camera
  }

  function updateCamera() {
    if (!camera || !container) return

    const aspect = container.clientWidth / container.clientHeight
    const padding = 1.2
    const w = displayedWidthMm || 20
    const h = displayedHeightMm || 20

    if (camera instanceof THREE.OrthographicCamera) {
      const modelAspect = w / h
      let frustumW: number, frustumH: number

      if (aspect > modelAspect) {
        frustumH = h * padding
        frustumW = frustumH * aspect
      } else {
        frustumW = w * padding
        frustumH = frustumW / aspect
      }

      camera.left = -frustumW / 2
      camera.right = frustumW / 2
      camera.top = frustumH / 2
      camera.bottom = -frustumH / 2
      camera.position.set(0, 0, -100)
      camera.lookAt(0, 0, 0)
      camera.updateProjectionMatrix()
    } else {
      camera.aspect = aspect
      camera.updateProjectionMatrix()
      const dist = Math.max(w, h) * 2 * padding
      camera.position.set(0, 0, dist)
      camera.lookAt(0, 0, 0)
    }
  }

  function clearContentGroup() {
    while (contentGroup.children.length > 0) {
      const child = contentGroup.children[0]
      if (child instanceof THREE.Mesh) child.geometry.dispose()
      contentGroup.remove(child)
    }
  }

  function centerObject(obj: THREE.Object3D) {
    const box = new THREE.Box3().setFromObject(obj)
    obj.position.sub(box.getCenter(new THREE.Vector3()))
  }

  async function updateContent() {
    if (!contentGroup) return

    const meshChanged = generatedMesh !== prevMesh
    const stlUrlChanged = stlUrl !== prevStlUrl
    const stlBufferChanged = stlBuffer !== prevStlBuffer

    if (generatedMesh) {
      if (!meshChanged) return

      prevMesh = generatedMesh
      prevStlUrl = stlUrl
      prevStlBuffer = stlBuffer

      clearContentGroup()
      const mesh = generatedMesh.clone()
      centerObject(mesh)
      contentGroup.add(mesh)

      displayedWidthMm = widthMm
      displayedHeightMm = heightMm
      return
    }

    if (stlBuffer || stlUrl) {
      const meshCleared = prevMesh !== null && generatedMesh === null
      if (!meshCleared && !stlBufferChanged && !stlUrlChanged) return

      prevMesh = generatedMesh
      prevStlUrl = stlUrl
      prevStlBuffer = stlBuffer

      clearContentGroup()

      try {
        let geometry: THREE.BufferGeometry
        if (stlBuffer) {
          geometry = await processStlForModel(stlBuffer, rotationX, rotationY, rotationZ)
        } else {
          const res = await fetch(stlUrl!)
          const buf = await res.arrayBuffer()
          geometry = await processStlForModel(buf, rotationX, rotationY, rotationZ)
        }

        geometry.computeBoundingBox()
        const center = new THREE.Vector3()
        geometry.boundingBox!.getCenter(center)
        geometry.translate(-center.x, -center.y, -center.z)

        const material = new THREE.MeshStandardMaterial({
          color: KEYCAP_BODY_COLOR,
          roughness: 0.7,
          metalness: 0.1,
        })
        contentGroup.add(new THREE.Mesh(geometry, material))

        displayedWidthMm = widthMm
        displayedHeightMm = heightMm
      } catch (err) {
        console.error('Failed to load STL for preview', err)
      }
      return
    }

    if (prevMesh || prevStlUrl || prevStlBuffer) {
      clearContentGroup()
      prevMesh = null
      prevStlUrl = null
      prevStlBuffer = null
    }
  }

  function onResize() {
    if (!container || !renderer || !camera) return
    renderer.setSize(container.clientWidth, container.clientHeight)
    updateCamera()
  }

  function animate() {
    frameId = requestAnimationFrame(animate)
    controls?.update()
    renderer.render(scene, camera)
  }
</script>

<div
  bind:this={container}
  class="w-full h-full relative overflow-hidden flex items-center justify-center bg-transparent"
>
  <canvas bind:this={canvas} class="outline-none"></canvas>
</div>
