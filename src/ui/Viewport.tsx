import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Grid, Html, OrbitControls, OrthographicCamera, PerspectiveCamera, TransformControls } from '@react-three/drei'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { OrbitControls as OrbitImpl } from 'three-stdlib'
import { buildTree } from '../model/build.ts'
import { LIGHTING_PRESETS } from '../model/presets.ts'
import { partById, useStudio } from '../state/store.ts'
import { isoFraming } from '../export/exporter.ts'

const R2D = 180 / Math.PI
const DIRS: Record<string, [number, number, number]> = { iso: [1, 0.85, 1.25], front: [0, 0.12, 1], side: [1, 0.12, 0], top: [0, 1, 0.0001], back: [0, 0.12, -1] }

function useModel() {
  const project = useStudio((s) => s.project)
  const [bump, setBump] = useState(0)
  const built = useMemo(() => buildTree(project, { onAsync: () => setBump((b) => b + 1) }), [project.parts, project.assets, bump]) // eslint-disable-line react-hooks/exhaustive-deps
  const bounds = useMemo(() => {
    const b = new THREE.Box3().setFromObject(built.root)
    if (b.isEmpty()) b.set(new THREE.Vector3(-5, 0, -5), new THREE.Vector3(5, 5, 5))
    return { box: b, size: b.getSize(new THREE.Vector3()), center: b.getCenter(new THREE.Vector3()), radius: b.getBoundingSphere(new THREE.Sphere()).radius }
  }, [built])
  return { built, bounds }
}
type Model = ReturnType<typeof useModel>

function Environment({ intensity }: { intensity: number }) {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl)
    const tex = pm.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = tex
    return () => { tex.dispose(); pm.dispose() }
  }, [gl, scene])
  useEffect(() => { scene.environmentIntensity = intensity }, [scene, intensity])
  return null
}

function Lights({ m }: { m: Model }) {
  const scene = useStudio((s) => s.project.scene)
  const lp = LIGHTING_PRESETS.find((l) => l.id === scene.lighting) ?? LIGHTING_PRESETS[0]
  const r = Math.max(10, m.bounds.radius), c = m.bounds.center
  const k = new THREE.Vector3(...lp.key.pos).normalize().multiplyScalar(r * 3).add(c)
  const key = useRef<THREE.DirectionalLight>(null)
  useEffect(() => {
    const l = key.current; if (!l) return
    l.target.position.copy(c); l.target.updateMatrixWorld()
    Object.assign(l.shadow.camera, { left: -r * 1.4, right: r * 1.4, top: r * 1.4, bottom: -r * 1.4, near: 0.5, far: r * 8 })
    l.shadow.camera.updateProjectionMatrix(); l.shadow.needsUpdate = true
  })
  return (
    <group userData={{ keep: true }}>
      <directionalLight ref={key} position={k} color={lp.key.color} intensity={lp.key.intensity} castShadow={scene.shadows} shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02} />
      <directionalLight position={[c.x + r * 2.5, c.y + r, c.z + r * 2]} intensity={lp.fill} color="#e6eeff" />
      <directionalLight position={[c.x + r * 0.5, c.y + r * 1.5, c.z - r * 3]} intensity={lp.rim} color="#ffe2bd" />
      <hemisphereLight args={['#fff6ea', '#b9a48c', 0.18]} />
    </group>
  )
}

function CameraRig({ m }: { m: Model }) {
  const { camera, controls, size } = useThree()
  const req = useStudio((s) => s.viewRequest)
  const ortho = useStudio((s) => s.ortho)
  useEffect(() => {
    const preset = req.preset === 'reset' ? 'iso' : req.preset
    const dir = new THREE.Vector3(...DIRS[preset]).normalize()
    const fov = 35, r = m.bounds.radius
    const dist = (r / Math.sin((fov / 2) * (Math.PI / 180))) * 1.22
    camera.position.copy(m.bounds.center).addScaledVector(dir, dist)
    camera.up.set(0, 1, 0)
    if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
      const oc = camera as THREE.OrthographicCamera
      oc.zoom = Math.min(size.width, size.height) / (r * 2.3); oc.near = -5000; oc.far = 5000; oc.updateProjectionMatrix()
    }
    camera.lookAt(m.bounds.center)
    const oc = controls as unknown as OrbitImpl | null
    if (oc) { oc.target.copy(m.bounds.center); oc.update() }
  }, [req.n, ortho, camera, controls]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function Selection({ m }: { m: Model }) {
  const id = useStudio((s) => s.selectedId)
  const mode = useStudio((s) => s.mode)
  const obj = id ? m.built.objects.get(id) : undefined
  const helper = useMemo(() => { const h = new THREE.BoxHelper(new THREE.Object3D(), '#f5b942'); h.userData.helper = true; return h }, [])
  useFrame(() => { if (obj) { helper.setFromObject(obj); helper.visible = true } else helper.visible = false })
  const commit = () => {
    if (!obj || !id) return
    const p = partById(useStudio.getState().project, id); if (!p) return
    useStudio.getState().updatePart(id, {
      position: obj.position.toArray().map((v) => +v.toFixed(3)) as [number, number, number],
      rotation: [obj.rotation.x * R2D, obj.rotation.y * R2D, obj.rotation.z * R2D].map((v) => +v.toFixed(2)) as [number, number, number],
      scale: obj.scale.toArray().map((v) => +v.toFixed(4)) as [number, number, number],
    })
  }
  return (
    <>
      <primitive object={helper} />
      {obj && <TransformControls object={obj} mode={mode} size={0.8} onMouseUp={commit} />}
    </>
  )
}

function Notes({ m }: { m: Model }) {
  const show = useStudio((s) => s.showNotes)
  const parts = useStudio((s) => s.project.parts)
  const select = useStudio((s) => s.select)
  const notes = useMemo(() => {
    if (!show) return []
    m.built.root.updateMatrixWorld(true)
    return parts.filter((p) => p.note && p.visible).map((p, i) => {
      const o = m.built.objects.get(p.id)
      const c = o ? new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()) : new THREE.Vector3()
      return { id: p.id, n: i + 1, name: p.name, note: p.note!, pos: c }
    })
  }, [show, parts, m.built])
  return <>{notes.map((n) => (
    <Html key={n.id} position={n.pos} center zIndexRange={[20, 0]}>
      <button className="hotspot" onClick={() => select(n.id)} title={`${n.name}: ${n.note}`}>{n.n}<span className="hotspot-tip"><b>{n.name}</b>{n.note}</span></button>
    </Html>
  ))}</>
}

function CaptureRegistrar({ m }: { m: Model }) {
  const { gl, scene, size } = useThree()
  const set = useStudio((s) => s.set)
  useEffect(() => {
    set({
      capture: async (w, h) => {
        const f = isoFraming([m.bounds.size.x, m.bounds.size.y, m.bounds.size.z], [m.bounds.center.x, m.bounds.center.y, m.bounds.center.z])
        const cam = new THREE.PerspectiveCamera(f.fov, w / h, 0.5, 5000)
        cam.position.set(...f.positionCm); cam.lookAt(...f.targetCm); cam.updateMatrixWorld()
        const hidden: THREE.Object3D[] = []
        scene.children.forEach((c) => { if (!c.userData.keep && !c.userData.isModelRoot && c.visible) { c.visible = false; hidden.push(c) } })
        const dpr = gl.getPixelRatio()
        gl.setPixelRatio(1); gl.setSize(w, h, false)
        gl.render(scene, cam)
        const url = gl.domElement.toDataURL('image/png')
        gl.setPixelRatio(dpr); gl.setSize(size.width, size.height, false)
        hidden.forEach((c) => (c.visible = true))
        return url
      },
    })
  }, [gl, scene, size, m, set])
  return null
}

export default function Viewport() {
  const m = useModel()
  const scene = useStudio((s) => s.project.scene)
  const ortho = useStudio((s) => s.ortho)
  const select = useStudio((s) => s.select)
  const mark = useStudio((s) => s.mark)
  const r = m.bounds.radius, floorY = m.bounds.box.min.y
  return (
    <Canvas shadows gl={{ preserveDrawingBuffer: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 }} dpr={[1, 2]}
      onPointerMissed={(e) => { if (e.type === 'click') select(null) }} data-testid="viewport-canvas">
      <color attach="background" args={[scene.background]} />
      <PerspectiveCamera makeDefault={!ortho} fov={35} near={0.5} far={5000} position={[40, 35, 50]} />
      <OrthographicCamera makeDefault={ortho} near={-5000} far={5000} position={[40, 35, 50]} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} onStart={() => mark('explored')} />
      <CameraRig m={m} />
      <Environment intensity={scene.envIntensity} />
      <Lights m={m} />
      <group userData={{ keep: true }}>
        <primitive object={m.built.root} onClick={(e: { delta: number; stopPropagation: () => void; object: THREE.Object3D }) => {
          if (e.delta > 4) return
          e.stopPropagation()
          let o: THREE.Object3D | null = e.object
          while (o && !o.userData.partId) o = o.parent
          if (o) select(o.userData.partId)
        }} />
        {scene.shadows && (
          <>
            <mesh rotation-x={-Math.PI / 2} position={[m.bounds.center.x, floorY - 0.01, m.bounds.center.z]} receiveShadow>
              <planeGeometry args={[r * 12, r * 12]} />
              <shadowMaterial opacity={0.22} />
            </mesh>
            <ContactShadows position={[m.bounds.center.x, floorY + 0.005, m.bounds.center.z]} scale={r * 4} resolution={1024} blur={2.4} opacity={0.5} far={Math.max(4, r * 0.6)} />
          </>
        )}
      </group>
      {scene.grid && <Grid position={[0, floorY - 0.02, 0]} infiniteGrid cellSize={1} sectionSize={10} cellColor="#9aa3b5" sectionColor="#6b7489" fadeDistance={r * 12} />}
      {scene.axes && <axesHelper args={[Math.max(10, r * 1.2)]} />}
      <Selection m={m} />
      <Notes m={m} />
      <CaptureRegistrar m={m} />
    </Canvas>
  )
}
