/**
 * Starting project: the Travel Jewelry Organizer from the Mission 1 concept images, rebuilt by Codex as editable parts.
 * (Built during development from the concept renders; the browser does not reconstruct 3D from images.)
 * Units: centimetres. Open size ≈ 25 × 21 cm.
 */
import { Kit, newProject } from './kit.ts'
import { mat } from './presets.ts'
import type { Project, Vec3 } from './types.ts'

const M = {
  leather: mat('leather', '#5e3a26'),
  leatherDark: mat('leather', '#3b2418', { sheen: 0.1 }),
  lining: mat('fabric', '#eee2cf'),
  pad: mat('fabric', '#e2d1b8', { sheen: 0.6 }),
  velvet: mat('velvet'),
  pocketFabric: mat('fabric', '#d9c6ab'),
  thread: { color: '#c9b089', roughness: 0.8, metalness: 0, opacity: 1 },
  gold: mat('gold'),
  goldBrushed: mat('gold', '#d9ad5c', { roughness: 0.38, clearcoat: 0 }),
  pearl: mat('pearl'),
  gem: mat('gem'),
  gemRose: mat('gem', '#f2b2b8'),
  vinyl: mat('glass', '#ffffff', { opacity: 0.14 }),
  hole: { color: '#5c4a3a', roughness: 1, metalness: 0, opacity: 1 },
}

const PW = 12, PD = 21, PT = 1.0, LT = 0.3, TOP = PT + LT

export function organizerProject(): Project {
  const k = new Kit('jo')
  const root = k.group('Travel Jewelry Organizer')

  const panel = (name: string, x: number) => {
    const g = k.group(name, { at: [x, 0, 0], parent: root })
    k.add(`${name} shell`, 'roundedBox', { w: PW, h: PT, d: PD, r: 0.45 }, { at: [0, PT / 2, 0], mat: M.leather, parent: g })
    k.add(`${name} lining`, 'roundedBox', { w: PW - 0.9, h: LT, d: PD - 0.9, r: 0.18 }, { at: [0, PT + LT / 2 - 0.02, 0], mat: M.lining, parent: g })
    k.add(`${name} lining stitching`, 'stitches', { w: PW - 1.5, d: PD - 1.5, r: 0.5, step: 0.42 }, { at: [0, TOP + 0.03, 0], mat: M.thread, parent: g })
    k.add(`${name} edge stitching`, 'stitches', { w: PW - 0.55, d: PD - 0.55, r: 0.4, step: 0.42 }, { at: [0, PT + 0.03, 0], mat: M.thread, parent: g })
    return g
  }

  k.add('Spine', 'roundedBox', { w: 1.0, h: PT * 0.9, d: PD - 0.4, r: 0.4 }, { at: [0, PT * 0.45, 0], mat: M.leatherDark, parent: root, note: 'Flexible spine folds the organizer flat for packing.' })

  // ---------- left panel: necklaces ----------
  const L = panel('Left panel', -(PW / 2 + 0.4))
  const barZ = -8.4, barY = TOP + 0.62
  const bar = k.group('Necklace bar', { parent: L, note: 'Necklace bar with individual hooks: each chain hangs separately so it cannot tangle.' })
  for (const [i, x] of [-4.7, 4.7].entries()) k.add(`Bar post ${i + 1}`, 'cylinder', { rt: 0.17, rb: 0.22, h: 0.65 }, { at: [x, TOP + 0.32, barZ], mat: M.gold, parent: bar })
  k.add('Bar', 'cylinder', { rt: 0.2, rb: 0.2, h: 9.8 }, { at: [0, barY, barZ], rot: [0, 0, 90], mat: M.gold, parent: bar })
  for (const [i, s] of [-1, 1].entries()) k.add(`Bar end cap ${i + 1}`, 'sphere', { r: 0.28 }, { at: [s * 4.95, barY, barZ], mat: M.gold, parent: bar })

  const necklaces = k.group('Necklaces', { parent: L })
  const list = [{ x: -3.6, len: 12.5, end: 'pearl' }, { x: -1.8, len: 15.5, end: 'coin' }, { x: 0, len: 10.5, end: 'gem' }, { x: 1.8, len: 14.5, end: 'pearl' }, { x: 3.6, len: 12, end: 'rose' }]
  list.forEach((n, i) => {
    const g = k.group(`Necklace ${i + 1}`, { parent: necklaces })
    k.add('Hook', 'torus', { R: 0.24, r: 0.045, arc: 252 }, { at: [n.x, barY - 0.05, barZ], rot: [0, 90, 144], mat: M.gold, parent: g })
    const zEnd = barZ + n.len, w = i % 2 ? 0.28 : -0.22
    const pts: Vec3[] = [[n.x, barY - 0.28, barZ + 0.05], [n.x + w * 0.3, TOP + 0.12, barZ + 1.4], [n.x + w, TOP + 0.06, barZ + n.len * 0.45], [n.x - w * 0.6, TOP + 0.06, barZ + n.len * 0.8], [n.x, TOP + 0.08, zEnd]]
    k.add('Chain', 'chain', { points: pts, link: 0.085 }, { mat: M.gold, parent: g })
    k.add('Bail', 'torus', { R: 0.11, r: 0.03 }, { at: [n.x, TOP + 0.14, zEnd + 0.05], rot: [90, 0, 0], mat: M.gold, parent: g })
    if (n.end === 'pearl') k.add('Pearl pendant', 'sphere', { r: 0.34 }, { at: [n.x, TOP + 0.32, zEnd + 0.4], scale: [1, 0.9, 1.3], mat: M.pearl, parent: g })
    else if (n.end === 'coin') k.add('Coin pendant', 'cylinder', { rt: 0.5, rb: 0.5, h: 0.07 }, { at: [n.x, TOP + 0.1, zEnd + 0.55], mat: M.goldBrushed, parent: g })
    else k.add('Gem pendant', 'gem', { r: 0.42 }, { at: [n.x, TOP + 0.3, zEnd + 0.45], rot: [90, 0, 0], mat: n.end === 'gem' ? M.gem : M.gemRose, parent: g })
  })

  const pockets = k.group('Clear necklace pockets', { parent: L, note: 'Clear vinyl pockets keep long necklaces apart and visible.' })
  for (const [i, x] of [-2.7, 0, 2.7].entries()) {
    k.add(`Pocket ${i + 1} window`, 'box', { w: 2.55, h: 0.03, d: 8.4 }, { at: [x, TOP + 0.5, 4.6], mat: M.vinyl, parent: pockets })
    k.add(`Pocket ${i + 1} welt`, 'roundedBox', { w: 2.6, h: 0.06, d: 0.22, r: 0.025 }, { at: [x, TOP + 0.5, 0.45], mat: M.pocketFabric, parent: pockets })
    for (const [j, s] of [-1, 1].entries()) k.add(`Pocket ${i + 1} side ${j + 1}`, 'roundedBox', { w: 0.14, h: 0.5, d: 8.4, r: 0.04 }, { at: [x + s * 1.28, TOP + 0.25, 4.6], mat: M.pocketFabric, parent: pockets })
  }
  k.add('Pocket base', 'roundedBox', { w: 8.3, h: 0.08, d: 0.3, r: 0.04 }, { at: [0, TOP + 0.04, 8.85], mat: M.pocketFabric, parent: pockets })

  // ---------- right panel ----------
  const R = panel('Right panel', PW / 2 + 0.4)
  const padTop = TOP + 0.38
  const ear = k.group('Earring pad', { parent: R, note: 'Padded earring panel holds studs and hoops in matched pairs.' })
  k.add('Pad', 'roundedBox', { w: 10.2, h: 0.4, d: 6.4, r: 0.18 }, { at: [0, TOP + 0.18, -6.4], mat: M.pad, parent: ear })
  k.add('Pad stitching', 'stitches', { w: 9.6, d: 5.8, r: 0.3, step: 0.42 }, { at: [0, padTop + 0.03, -6.4], mat: M.thread, parent: ear })
  const studs = k.group('Earrings', { parent: ear })
  for (let row = 0; row < 3; row++) for (let col = 0; col < 7; col++) {
    const x = -4.05 + col * 1.35, z = -8.4 + row * 2.0, kind = (col + row * 2) % 5
    if (kind === 0 || kind === 3) k.add(`Pearl stud ${row + 1}-${col + 1}`, 'sphere', { r: 0.19 }, { at: [x, padTop + 0.19, z], mat: M.pearl, parent: studs })
    else if (kind === 1) k.add(`Hoop ${row + 1}-${col + 1}`, 'torus', { R: 0.34, r: 0.045 }, { at: [x, padTop + 0.34, z + 0.05], mat: M.gold, parent: studs })
    else if (kind === 2) k.add(`Gem stud ${row + 1}-${col + 1}`, 'gem', { r: 0.18 }, { at: [x, padTop + 0.16, z], mat: row % 2 ? M.gemRose : M.gem, parent: studs })
    else k.add(`Empty hole ${row + 1}-${col + 1}`, 'cylinder', { rt: 0.075, rb: 0.075, h: 0.02, seg: 12 }, { at: [x, padTop + 0.005, z], mat: M.hole, parent: studs })
  }

  const rings = k.group('Ring roll', { parent: R, note: 'Velvet ring roll: rings slide on and stay put.' })
  k.add('Roll', 'capsule', { r: 0.8, len: 9.4 }, { at: [0, TOP + 0.8, -0.6], rot: [0, 0, 90], mat: M.velvet, parent: rings })
  k.add('Roll base', 'roundedBox', { w: 10.8, h: 0.5, d: 2.2, r: 0.2 }, { at: [0, TOP + 0.15, -0.6], mat: M.pad, parent: rings })
  ;[-3.3, -1.1, 1.1, 3.3].forEach((x, i) => {
    k.add(`Ring ${i + 1}`, 'torus', { R: 0.9, r: 0.12 }, { at: [x, TOP + 0.8, -0.6], rot: [0, 90, 0], mat: i === 2 ? M.goldBrushed : M.gold, parent: rings })
    if (i % 2 === 0) k.add(`Ring ${i + 1} stone`, 'gem', { r: 0.24 }, { at: [x, TOP + 1.88, -0.6], mat: i === 0 ? M.gem : M.gemRose, parent: rings })
  })

  const zip = k.group('Zip storage page', { parent: R, note: 'Separate zip storage page with room for bulky or odd-sized pieces.' })
  k.add('Page', 'roundedBox', { w: 10.6, h: 0.26, d: 8.6, r: 0.12 }, { at: [0, TOP + 0.1, 5.5], mat: M.pocketFabric, parent: zip })
  k.add('Page stitching', 'stitches', { w: 10.0, d: 8.0, r: 0.35, step: 0.42 }, { at: [0, TOP + 0.26, 5.5], mat: M.thread, parent: zip })
  k.add('Zipper tape', 'roundedBox', { w: 10.0, h: 0.05, d: 0.42, r: 0.02 }, { at: [0, TOP + 0.25, 2.05], mat: M.leatherDark, parent: zip })
  k.add('Zipper teeth', 'zipper', { len: 9.6 }, { at: [0, TOP + 0.29, 2.05], mat: M.gold, parent: zip })
  k.add('Zipper slider', 'roundedBox', { w: 0.45, h: 0.16, d: 0.5, r: 0.06 }, { at: [3.2, TOP + 0.34, 2.05], mat: M.gold, parent: zip })
  k.add('Zipper pull', 'roundedBox', { w: 0.32, h: 0.06, d: 1.0, r: 0.1 }, { at: [3.2, TOP + 0.36, 2.75], mat: M.gold, parent: zip })

  const snap = k.group('Snap closure', { parent: R, note: 'Reinforced snap closure, to be tested through repeated use (faulty snaps were the top defect in 80 reviews).' })
  k.add('Closure tab', 'roundedBox', { w: 3.0, h: 0.32, d: 4.2, r: 0.15 }, { at: [PW / 2 + 1.1, 0.16, 0.5], mat: M.leather, parent: snap })
  k.add('Tab stitching', 'stitches', { w: 2.4, d: 3.6, r: 0.3, step: 0.42 }, { at: [PW / 2 + 1.25, 0.35, 0.5], mat: M.thread, parent: snap })
  k.add('Snap base', 'cylinder', { rt: 0.55, rb: 0.6, h: 0.12 }, { at: [PW / 2 + 1.75, 0.38, 0.5], mat: M.gold, parent: snap })
  k.add('Snap cap', 'sphere', { r: 0.45, thetaFrac: 0.5 }, { at: [PW / 2 + 1.75, 0.43, 0.5], scale: [1, 0.45, 1], mat: M.gold, parent: snap })

  return newProject({
    name: 'Travel Jewelry Organizer: Mission 2',
    modelName: 'Travel Jewelry Organizer',
    modelType: 'Physical product',
    description: 'A compact fold-out leather organizer that keeps necklaces separated, protects rings and earrings, and packs flat for travel.',
    origin: 'Starting model built by Codex from the Mission 1 concept images (front, side, back and open views) using editable parametric parts. The browser does not reconstruct 3D from images automatically.',
    dimensions: { width: 25, height: 2.4, depth: 21, units: 'cm' },
    references: [
      { id: 'ref1', assetId: 'a_concept', label: 'concept' }, { id: 'ref2', assetId: 'a_front', label: 'front' },
      { id: 'ref3', assetId: 'a_side', label: 'side' }, { id: 'ref4', assetId: 'a_back', label: 'back' },
    ],
    assets: {
      a_concept: { id: 'a_concept', name: 'concept-open.jpg', mime: 'image/jpeg', url: 'references/concept-open.jpg' },
      a_front: { id: 'a_front', name: 'view-front.jpg', mime: 'image/jpeg', url: 'references/view-front.jpg' },
      a_side: { id: 'a_side', name: 'view-side.jpg', mime: 'image/jpeg', url: 'references/view-side.jpg' },
      a_back: { id: 'a_back', name: 'view-back.jpg', mime: 'image/jpeg', url: 'references/view-back.jpg' },
    },
    parts: k.parts,
  })
}
