/** Seven editable starting templates, each made of named parts (not screenshots). Units: cm. */
import { Kit, newProject, defaultScene } from './kit.ts'
import { mat } from './presets.ts'
import type { ModelType, Project } from './types.ts'
import { organizerProject } from './organizer.ts'

const proj = (k: Kit, name: string, modelType: ModelType, description: string, dims: [number, number, number], scene = {}) =>
  newProject({ name, modelName: name, modelType, description, origin: `Started from the “${name}” template.`, parts: k.parts, dimensions: { width: dims[0], height: dims[1], depth: dims[2], units: 'cm' }, scene: defaultScene(scene) })

function bottle() {
  const k = new Kit('bt'), g = k.group('Bottle')
  k.add('Body', 'lathe', { points: [[0, 0], [3.4, 0], [3.6, 0.4], [3.6, 15], [3.3, 17.5], [1.6, 19.5], [1.4, 21.5], [0, 21.5]] }, { mat: mat('glossy', '#2f7d6d', { roughness: 0.2 }), parent: g })
  k.add('Label band', 'cylinder', { rt: 3.64, rb: 3.64, h: 6, seg: 64 }, { at: [0, 8, 0], mat: mat('plastic', '#f4efe6'), parent: g, note: 'Wrap-around label: upload your logo as a texture here.' })
  k.add('Cap', 'cylinder', { rt: 1.55, rb: 1.6, h: 2.2 }, { at: [0, 22.5, 0], mat: mat('silver'), parent: g })
  k.add('Cap ridge', 'torus', { R: 1.6, r: 0.12 }, { at: [0, 21.6, 0], rot: [90, 0, 0], mat: mat('silver'), parent: g })
  return proj(k, 'Bottle', 'Physical product', 'A cylindrical bottle with a wrap-around label and metal cap.', [7.2, 23.6, 7.2])
}

function boxProduct() {
  const k = new Kit('bx'), g = k.group('Box product')
  k.add('Box body', 'roundedBox', { w: 14, h: 9, d: 10, r: 0.4 }, { at: [0, 4.5, 0], mat: mat('plastic', '#f2ede4'), parent: g })
  k.add('Lid', 'roundedBox', { w: 14.4, h: 2.2, d: 10.4, r: 0.45 }, { at: [0, 9.6, 0], mat: mat('plastic', '#2f3a4a'), parent: g })
  k.add('Front label', 'plane', { w: 9, h: 4.5 }, { at: [0, 4.6, 5.01], mat: mat('plastic', '#e0b45e'), parent: g, note: 'Front label: apply your logo or packaging art.' })
  k.add('Logo mark', 'emblem', { s: 0.9, depth: 0.15 }, { at: [0, 9.6, 5.22], mat: mat('gold'), parent: g })
  return proj(k, 'Box product', 'Physical product', 'A rectangular consumer product box with lid and front label.', [14.4, 10.7, 10.4])
}

function bag() {
  const k = new Kit('bg'), g = k.group('Organizer bag')
  k.add('Bag body', 'roundedBox', { w: 22, h: 14, d: 8, r: 2.2 }, { at: [0, 7, 0], mat: mat('fabric', '#2f3a4a'), parent: g })
  k.add('Front pocket', 'roundedBox', { w: 14, h: 7, d: 1, r: 0.8 }, { at: [0, 5.5, 4.1], mat: mat('fabric', '#3d4a5e'), parent: g, note: 'Front quick-access pocket.' })
  k.add('Top zipper', 'zipper', { len: 18 }, { at: [0, 14.02, 0], mat: mat('silver'), parent: g })
  k.add('Zipper pull', 'roundedBox', { w: 0.5, h: 0.2, d: 1.6, r: 0.08 }, { at: [6, 14.2, 0.9], mat: mat('silver'), parent: g })
  for (const [i, x] of [-5, 5].entries()) k.add(`Handle ${i + 1}`, 'torus', { R: 3.5, r: 0.45, arc: 180 }, { at: [x, 14, 0], mat: mat('leather', '#7a4b32'), parent: g })
  k.add('Brand patch', 'roundedBox', { w: 4, h: 1.6, d: 0.15, r: 0.2 }, { at: [0, 10.8, 4.05], mat: mat('leather', '#7a4b32'), parent: g })
  return proj(k, 'Bag or organizer', 'Physical product', 'A soft organizer bag with handles, top zipper and front pocket.', [22, 21.5, 9])
}

function mascot() {
  const k = new Kit('ms'), g = k.group('Mascot')
  const body = mat('glossy', '#5b8def', { roughness: 0.35 }), white = mat('plastic', '#ffffff', { roughness: 0.3 }), dark = mat('plastic', '#1d2230', { roughness: 0.2 })
  k.add('Body', 'sphere', { r: 6 }, { at: [0, 7, 0], scale: [1, 1.1, 0.95], mat: body, parent: g })
  k.add('Belly', 'sphere', { r: 4.2 }, { at: [0, 6.2, 2.4], scale: [1, 1.05, 0.6], mat: white, parent: g })
  k.add('Head', 'sphere', { r: 4.6 }, { at: [0, 16.2, 0], mat: body, parent: g })
  for (const [i, x] of [-1.6, 1.6].entries()) {
    k.add(`Eye ${i + 1}`, 'sphere', { r: 1.1 }, { at: [x, 16.8, 3.9], mat: white, parent: g })
    k.add(`Pupil ${i + 1}`, 'sphere', { r: 0.55 }, { at: [x, 16.8, 4.85], mat: dark, parent: g })
    k.add(`Ear ${i + 1}`, 'cone', { r: 1.3, h: 3 }, { at: [x * 1.8, 20.6, 0], rot: [0, 0, -x * 12], mat: body, parent: g })
    k.add(`Arm ${i + 1}`, 'capsule', { r: 1.1, len: 4.5 }, { at: [x * 4.4, 8.5, 0.5], rot: [0, 0, x * 25], mat: body, parent: g })
    k.add(`Foot ${i + 1}`, 'sphere', { r: 1.8 }, { at: [x * 1.5, 0.9, 1], scale: [1, 0.55, 1.4], mat: white, parent: g })
  }
  k.add('Smile', 'torus', { R: 1.1, r: 0.18, arc: 180 }, { at: [0, 15.1, 4.25], rot: [0, 0, 180], mat: dark, parent: g })
  k.add('Chest badge', 'cylinder', { rt: 1.2, rb: 1.2, h: 0.2 }, { at: [0, 9.5, 5.6], rot: [80, 0, 0], mat: mat('gold'), parent: g, note: 'Badge: place your brand symbol here.' })
  return proj(k, 'Stylized mascot', 'Brand mascot / character', 'A friendly rounded character built from simple shapes.', [13, 23, 11.5])
}

function merch() {
  const k = new Kit('mg'), g = k.group('Branded mug')
  k.add('Mug body', 'lathe', { points: [[0, 0], [4, 0], [4.2, 0.3], [4.3, 10], [4.0, 10], [3.8, 0.8], [0, 0.8]] }, { mat: mat('ceramic', '#f4f1ea'), parent: g })
  k.add('Handle', 'torus', { R: 2.6, r: 0.55, arc: 200 }, { at: [4.3, 5.2, 0], rot: [0, 0, -100], mat: mat('ceramic', '#f4f1ea'), parent: g })
  k.add('Logo decal', 'cylinder', { rt: 4.33, rb: 4.33, h: 4, seg: 64 }, { at: [0, 5.5, 0], scale: [1, 1, 1], mat: mat('ceramic', '#e0b45e', { opacity: 1 }), parent: g, note: 'Logo band: upload your logo and apply it as a texture.' })
  k.add('Coaster', 'cylinder', { rt: 5.5, rb: 5.5, h: 0.5 }, { at: [0, -0.25, 0], mat: mat('wood'), parent: g })
  return proj(k, 'Branded merchandise', 'Merchandise', 'A branded ceramic mug on a wooden coaster.', [11, 10.5, 11])
}

function room() {
  const k = new Kit('rm'), g = k.group('Café corner')
  k.add('Floor', 'box', { w: 60, h: 1, d: 50 }, { at: [0, -0.5, 0], mat: mat('wood', '#b38658'), parent: g })
  k.add('Back wall', 'box', { w: 60, h: 36, d: 1 }, { at: [0, 18, -25], mat: mat('plastic', '#e9e2d6', { roughness: 0.9 }), parent: g })
  k.add('Side wall', 'box', { w: 1, h: 36, d: 50 }, { at: [-30, 18, 0], mat: mat('plastic', '#d8cfc1', { roughness: 0.9 }), parent: g })
  k.add('Counter', 'roundedBox', { w: 30, h: 11, d: 8, r: 0.6 }, { at: [6, 5.5, -14], mat: mat('wood', '#6e4a2e'), parent: g, note: 'Service counter where customers order.' })
  k.add('Counter top', 'roundedBox', { w: 31, h: 1, d: 9, r: 0.3 }, { at: [6, 11.4, -14], mat: mat('ceramic', '#f2f0eb'), parent: g })
  for (const [i, x] of [-2, 8, 18].entries()) {
    k.add(`Stool ${i + 1} seat`, 'cylinder', { rt: 2.4, rb: 2.4, h: 0.9 }, { at: [x, 8, -6], mat: mat('leather', '#2f3a4a'), parent: g })
    k.add(`Stool ${i + 1} leg`, 'cylinder', { rt: 0.4, rb: 0.6, h: 7.6 }, { at: [x, 3.8, -6], mat: mat('silver'), parent: g })
  }
  k.add('Pendant lamp', 'cone', { r: 3, h: 3 }, { at: [6, 28, -14], mat: mat('gold'), parent: g })
  k.add('Lamp cord', 'cylinder', { rt: 0.08, rb: 0.08, h: 6 }, { at: [6, 32.5, -14], mat: mat('rubber'), parent: g })
  k.add('Plant pot', 'cylinder', { rt: 3, rb: 2.2, h: 5 }, { at: [-22, 2.5, -18], mat: mat('ceramic', '#c46f4c'), parent: g })
  k.add('Plant', 'sphere', { r: 5 }, { at: [-22, 9, -18], scale: [1, 1.3, 1], mat: mat('fabric', '#4f7d4f'), parent: g })
  k.add('Wall sign', 'plane', { w: 16, h: 6 }, { at: [6, 24, -24.4], mat: mat('plastic', '#2f3a4a'), parent: g, note: 'Brand sign: upload your logo and apply it here.' })
  return proj(k, 'Service environment', 'Service environment', 'A miniature café corner with counter, stools, lamp and brand sign.', [60, 36, 50], { cameraPreset: 'iso' })
}

function sculpture() {
  const k = new Kit('sc'), g = k.group('Symbolic sculpture')
  k.add('Pedestal', 'roundedBox', { w: 10, h: 4, d: 10, r: 0.5 }, { at: [0, 2, 0], mat: mat('ceramic', '#2a2a2e', { roughness: 0.4 }), parent: g })
  k.add('Ring 1', 'torus', { R: 5, r: 0.5 }, { at: [0, 10, 0], rot: [70, 0, 20], mat: mat('gold'), parent: g, note: 'Interlocking rings symbolise connection.' })
  k.add('Ring 2', 'torus', { R: 5, r: 0.5 }, { at: [0, 10, 0], rot: [10, 75, 0], mat: mat('silver'), parent: g })
  k.add('Core gem', 'gem', { r: 2.2 }, { at: [0, 10, 0], mat: mat('gem', '#8fd6d1'), parent: g })
  k.add('Orb', 'sphere', { r: 0.9 }, { at: [3.6, 14.2, 1.2], mat: mat('glossy', '#e8473c'), parent: g })
  return proj(k, 'Abstract sculpture', 'Symbolic object', 'An abstract sculpture of interlocking rings around a gem on a pedestal.', [11, 16, 11])
}

export const TEMPLATES: { id: string; label: string; blurb: string; make: () => Project }[] = [
  { id: 'organizer', label: 'Travel Jewelry Organizer', blurb: 'Codex-built model from your Mission 1 concept', make: organizerProject },
  { id: 'bottle', label: 'Bottle', blurb: 'Cylindrical product', make: bottle },
  { id: 'box', label: 'Box product', blurb: 'Rectangular consumer product', make: boxProduct },
  { id: 'bag', label: 'Bag or organizer', blurb: 'Soft goods with handles', make: bag },
  { id: 'mascot', label: 'Stylized mascot', blurb: 'Character from simple shapes', make: mascot },
  { id: 'merch', label: 'Branded mug', blurb: 'Merchandise object', make: merch },
  { id: 'room', label: 'Café corner', blurb: 'Service environment', make: room },
  { id: 'sculpture', label: 'Abstract sculpture', blurb: 'Symbolic object', make: sculpture },
]
