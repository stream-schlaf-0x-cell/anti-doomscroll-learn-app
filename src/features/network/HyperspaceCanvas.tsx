import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Platform, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as THREE from 'three';
import { ThemeColors } from '../../ui/theme';

export type GalaxyMode = 'orbital' | 'lotus' | 'torus';

export interface HyperspaceNode {
  id: string;
  title: string;
  subtitle?: string;
  type:
    | 'thought'
    | 'question'
    | 'thesis'
    | 'article_note'
    | 'concept'
    | 'article'
    | 'channel_core'
    | 'upvoted_saved'
    | 'user_note'
    | 'curated_insight'
    | 'reading_anchor'
    | 'saved_article'
    | 'upvoted_article'
    | 'hivemind_track';
  color: string;
  space?: string;
  articleId?: string;
  trackId?: string;
  progressPercent?: number;
  tags?: string[];
  reasonText?: string;
  noteText?: string;
  interactionDepth?: number; // 1 to 5
}

export interface HyperspaceEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relation: string;
  annotation?: string;
}

export interface Props {
  nodes: HyperspaceNode[];
  edges: HyperspaceEdge[];
  onSelectNode: (node: HyperspaceNode) => void;
  onSelectEdge?: (edge: HyperspaceEdge) => void;
  colors: ThemeColors;
  isDark: boolean;
  galaxyMode?: GalaxyMode;
  selectedNodeId?: string | null;
}

interface NodeTargetSpec {
  targetPos: THREE.Vector3;
  radius: number;
  colorHex: string;
  hasHalo: boolean;
  isCore: boolean;
  orbitAngle: number;
  orbitRadius: number;
  orbitSpeed: number;
  orbitTilt: number;
  torusU: number;
  torusV: number;
  torusMajorR: number;
  torusMinorR: number;
}

interface NodeVisual {
  id: string;
  node: HyperspaceNode;
  group: THREE.Group;
  sphereMesh: THREE.Mesh;
  hitMesh: THREE.Mesh;
  glowSprite: THREE.Sprite;
  haloMesh: THREE.Mesh | null;
  sphereMaterial: THREE.MeshStandardMaterial;
  glowMaterial: THREE.SpriteMaterial;
  haloMaterial: THREE.MeshBasicMaterial | null;
  currentPos: THREE.Vector3;
  spec: NodeTargetSpec;
  spawnScale: number;
}

interface LabelDomEntry {
  el: HTMLDivElement;
  titleEl: HTMLSpanElement;
}

interface CameraControllerApi {
  zoomBy: (deltaFactor: number) => void;
  resetView: () => void;
}

function resolveNodeColorHex(node: HyperspaceNode): string {
  if (node.id === 'atmen-breathing-core' || node.type === 'reading_anchor') {
    return '#10B981';
  }
  switch (node.type) {
    case 'saved_article':
      return '#38BDF8';
    case 'upvoted_article':
      return '#10B981';
    case 'hivemind_track':
      return '#818CF8';
    case 'user_note':
    case 'article_note':
    case 'question':
      return '#F59E0B';
    case 'thought':
    case 'thesis':
    case 'concept':
      return '#A78BFA';
    case 'upvoted_saved':
      return node.color || '#38BDF8';
    case 'curated_insight':
      return '#818CF8';
    default:
      return node.color || '#38BDF8';
  }
}

function isHaloNodeType(node: HyperspaceNode): boolean {
  return (
    node.type === 'user_note' ||
    node.type === 'article_note' ||
    node.type === 'thought' ||
    node.type === 'thesis' ||
    node.type === 'question' ||
    node.type === 'concept' ||
    Boolean(node.noteText)
  );
}

function createRadialGlowTexture(innerStop: string, midStop: string): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, innerStop);
  grad.addColorStop(0.32, midStop);
  grad.addColorStop(0.7, 'rgba(255,255,255,0.06)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createStardustTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function computeNodeTargetSpec(
  node: HyperspaceNode,
  index: number,
  totalNonCore: number,
  galaxyMode: GalaxyMode
): NodeTargetSpec {
  const isCore = node.id === 'atmen-breathing-core' || node.type === 'reading_anchor';
  const depthMultiplier = node.interactionDepth || 2;
  const radius = isCore ? 1.15 : Math.min(0.95, 0.36 + depthMultiplier * 0.11);
  const colorHex = resolveNodeColorHex(node);
  const hasHalo = !isCore && isHaloNodeType(node);

  if (isCore) {
    return {
      targetPos: new THREE.Vector3(0, 0, 0),
      radius,
      colorHex,
      hasHalo: false,
      isCore: true,
      orbitAngle: 0,
      orbitRadius: 0,
      orbitSpeed: 0,
      orbitTilt: 0,
      torusU: 0,
      torusV: 0,
      torusMajorR: 0,
      torusMinorR: 0
    };
  }

  const safeCount = Math.max(1, totalNonCore);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  if (galaxyMode === 'orbital') {
    const ringTier = index % 5;
    const orbitRadius = 7.5 + ringTier * 3.6 + ((index % 3) * 0.65);
    const orbitAngle = (index / safeCount) * Math.PI * 2 + ringTier * 0.45;
    const orbitTilt = ((index % 4) - 1.5) * 0.22;
    const yOffset = Math.sin(orbitAngle) * orbitRadius * orbitTilt + ((index % 3) - 1) * 1.4;
    const orbitSpeed = 0.032 + (index % 5) * 0.008;

    return {
      targetPos: new THREE.Vector3(
        Math.cos(orbitAngle) * orbitRadius,
        yOffset,
        Math.sin(orbitAngle) * orbitRadius
      ),
      radius,
      colorHex,
      hasHalo,
      isCore: false,
      orbitAngle,
      orbitRadius,
      orbitSpeed,
      orbitTilt,
      torusU: 0,
      torusV: 0,
      torusMajorR: 0,
      torusMinorR: 0
    };
  }

  if (galaxyMode === 'lotus') {
    const yNorm = safeCount === 1 ? 0 : 1 - (index / (safeCount - 1)) * 2;
    const rAtY = Math.sqrt(Math.max(0, 1 - yNorm * yNorm));
    const theta = goldenAngle * index;
    const sphereRadius = 13.5 + (index % 4) * 2.1;

    return {
      targetPos: new THREE.Vector3(
        Math.cos(theta) * rAtY * sphereRadius,
        yNorm * sphereRadius,
        Math.sin(theta) * rAtY * sphereRadius
      ),
      radius,
      colorHex,
      hasHalo,
      isCore: false,
      orbitAngle: theta,
      orbitRadius: sphereRadius,
      orbitSpeed: 0.014,
      orbitTilt: 0,
      torusU: 0,
      torusV: 0,
      torusMajorR: 0,
      torusMinorR: 0
    };
  }

  // Torus flow field
  const torusMajorR = 16.0;
  const torusMinorR = 5.2 + (index % 3) * 1.35;
  const torusU = (index / safeCount) * Math.PI * 2;
  const torusV = ((index * 3) / safeCount) * Math.PI * 2;

  return {
    targetPos: new THREE.Vector3(
      (torusMajorR + torusMinorR * Math.cos(torusV)) * Math.cos(torusU),
      (torusMajorR + torusMinorR * Math.cos(torusV)) * Math.sin(torusU) * 0.56,
      torusMinorR * Math.sin(torusV)
    ),
    radius,
    colorHex,
    hasHalo,
    isCore: false,
    orbitAngle: torusU,
    orbitRadius: torusMajorR,
    orbitSpeed: 0.025,
    orbitTilt: 0,
    torusU,
    torusV,
    torusMajorR,
    torusMinorR
  };
}

export const HyperspaceCanvas: React.FC<Props> = ({
  nodes,
  edges,
  onSelectNode,
  onSelectEdge,
  colors,
  isDark,
  galaxyMode = 'orbital',
  selectedNodeId: controlledSelectedNodeId
}) => {
  const webContainerRef = useRef<HTMLDivElement | null>(null);
  const labelOverlayRef = useRef<HTMLDivElement | null>(null);

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [internalSelectedNodeId, setInternalSelectedNodeId] = useState<string | null>(null);
  const [webglFailed, setWebglFailed] = useState<boolean>(false);

  const activeSelectedNodeId =
    controlledSelectedNodeId !== undefined ? controlledSelectedNodeId : internalSelectedNodeId;

  // Refs synced for the 60fps Three.js loop without re-creating the WebGL context
  const nodesRef = useRef<HyperspaceNode[]>(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef<HyperspaceEdge[]>(edges);
  edgesRef.current = edges;
  const galaxyModeRef = useRef<GalaxyMode>(galaxyMode);
  galaxyModeRef.current = galaxyMode;
  const hoveredNodeIdRef = useRef<string | null>(hoveredNodeId);
  hoveredNodeIdRef.current = hoveredNodeId;
  const selectedNodeIdRef = useRef<string | null>(activeSelectedNodeId);
  selectedNodeIdRef.current = activeSelectedNodeId;
  const isDarkRef = useRef<boolean>(isDark);
  isDarkRef.current = isDark;
  const colorsRef = useRef<ThemeColors>(colors);
  colorsRef.current = colors;
  const onSelectNodeRef = useRef(onSelectNode);
  onSelectNodeRef.current = onSelectNode;
  const onSelectEdgeRef = useRef(onSelectEdge);
  onSelectEdgeRef.current = onSelectEdge;

  // Scene object refs shared across effects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const nodesGroupRef = useRef<THREE.Group | null>(null);
  const nodeVisualsRef = useRef<Map<string, NodeVisual>>(new Map());
  const sharedSphereGeoRef = useRef<THREE.SphereGeometry | null>(null);
  const sharedHitGeoRef = useRef<THREE.SphereGeometry | null>(null);
  const sharedHaloGeoRef = useRef<THREE.TorusGeometry | null>(null);
  const hitMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const glowTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const stardustPointsRef = useRef<THREE.Points | null>(null);
  const stardustMaterialRef = useRef<THREE.PointsMaterial | null>(null);
  const baseLinesMatRef = useRef<THREE.LineBasicMaterial | null>(null);
  const activeLinesMatRef = useRef<THREE.LineBasicMaterial | null>(null);
  const orbitalGuidesGroupRef = useRef<THREE.Group | null>(null);
  const labelDomMapRef = useRef<Map<string, LabelDomEntry>>(new Map());
  const cameraApiRef = useRef<CameraControllerApi | null>(null);
  const focusNodeRequestRef = useRef<string | null | undefined>(undefined);

  // Request smooth camera focus glide when selectedNodeId changes
  useEffect(() => {
    focusNodeRequestRef.current = activeSelectedNodeId;
  }, [activeSelectedNodeId]);

  const disposeNodeVisual = useCallback((vis: NodeVisual, group: THREE.Group | null) => {
    if (group) {
      group.remove(vis.group);
    }
    vis.sphereMaterial.dispose();
    vis.glowMaterial.dispose();
    if (vis.haloMaterial) {
      vis.haloMaterial.dispose();
    }
  }, []);

  // Reconcile 3D node visuals & label DOM nodes when nodes or galaxyMode change
  const syncNodesAndLabels = useCallback(() => {
    const nodesGroup = nodesGroupRef.current;
    const sphereGeo = sharedSphereGeoRef.current;
    const hitGeo = sharedHitGeoRef.current;
    const haloGeo = sharedHaloGeoRef.current;
    const hitMat = hitMaterialRef.current;
    const glowTex = glowTextureRef.current;
    const labelOverlay = labelOverlayRef.current;
    if (!nodesGroup || !sphereGeo || !hitGeo || !haloGeo || !hitMat) return;

    const currentNodes = nodesRef.current;
    const mode = galaxyModeRef.current;
    const dark = isDarkRef.current;
    const visuals = nodeVisualsRef.current;
    const labelMap = labelDomMapRef.current;

    const nonCoreNodes = currentNodes.filter(
      n => n.id !== 'atmen-breathing-core' && n.type !== 'reading_anchor'
    );
    const nonCoreIndexMap = new Map<string, number>();
    nonCoreNodes.forEach((n, idx) => nonCoreIndexMap.set(n.id, idx));

    const nextIds = new Set(currentNodes.map(n => n.id));

    // Remove nodes no longer present
    for (const [id, vis] of visuals.entries()) {
      if (!nextIds.has(id)) {
        disposeNodeVisual(vis, nodesGroup);
        visuals.delete(id);
      }
    }
    for (const [id, domEntry] of labelMap.entries()) {
      if (!nextIds.has(id)) {
        domEntry.el.remove();
        labelMap.delete(id);
      }
    }

    // Add or update nodes
    currentNodes.forEach(node => {
      const nonCoreIdx = nonCoreIndexMap.get(node.id) ?? 0;
      const spec = computeNodeTargetSpec(node, nonCoreIdx, nonCoreNodes.length, mode);
      const existing = visuals.get(node.id);

      if (existing) {
        existing.node = node;
        existing.spec = spec;
        existing.sphereMesh.scale.setScalar(spec.radius);
        existing.hitMesh.scale.setScalar(Math.max(1.25, spec.radius * 2.1));
        existing.sphereMaterial.color.set(spec.colorHex);
        existing.sphereMaterial.emissive.set(spec.colorHex);
        existing.glowMaterial.color.set(spec.colorHex);
        existing.glowMaterial.opacity = spec.isCore ? 0.0 : dark ? 0.72 : 0.34;
        if (existing.haloMesh && existing.haloMaterial) {
          existing.haloMesh.visible = spec.hasHalo;
          existing.haloMesh.scale.setScalar(spec.radius * 1.05);
          existing.haloMaterial.color.set(spec.colorHex);
        }
      } else {
        const group = new THREE.Group();
        group.position.copy(spec.targetPos);

        const sphereMaterial = new THREE.MeshStandardMaterial({
          color: new THREE.Color(spec.colorHex),
          emissive: new THREE.Color(spec.colorHex),
          emissiveIntensity: spec.isCore ? 0.25 : dark ? 0.55 : 0.35,
          roughness: 0.28,
          metalness: 0.12,
          transparent: spec.isCore,
          opacity: spec.isCore ? 0.01 : 1.0
        });

        const sphereMesh = new THREE.Mesh(sphereGeo, sphereMaterial);
        sphereMesh.scale.setScalar(spec.radius);
        sphereMesh.userData = { nodeId: node.id };
        group.add(sphereMesh);

        // Generous invisible raycast proxy for effortless iPhone/iPad tap picking
        const hitMesh = new THREE.Mesh(hitGeo, hitMat);
        hitMesh.scale.setScalar(Math.max(1.25, spec.radius * 2.1));
        hitMesh.userData = { nodeId: node.id };
        group.add(hitMesh);

        const glowMaterial = new THREE.SpriteMaterial({
          map: glowTex ?? undefined,
          color: new THREE.Color(spec.colorHex),
          transparent: true,
          opacity: spec.isCore ? 0.0 : dark ? 0.72 : 0.34,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        });
        const glowSprite = new THREE.Sprite(glowMaterial);
        const spriteSize = spec.radius * 4.4;
        glowSprite.scale.set(spriteSize, spriteSize, 1);
        group.add(glowSprite);

        let haloMesh: THREE.Mesh | null = null;
        let haloMaterial: THREE.MeshBasicMaterial | null = null;
        if (spec.hasHalo) {
          haloMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color(spec.colorHex),
            transparent: true,
            opacity: dark ? 0.65 : 0.72,
            depthWrite: false
          });
          haloMesh = new THREE.Mesh(haloGeo, haloMaterial);
          haloMesh.scale.setScalar(spec.radius * 1.05);
          haloMesh.rotation.x = Math.PI * 0.38;
          haloMesh.rotation.y = (nonCoreIdx % 5) * 0.35;
          group.add(haloMesh);
        }

        nodesGroup.add(group);
        visuals.set(node.id, {
          id: node.id,
          node,
          group,
          sphereMesh,
          hitMesh,
          glowSprite,
          haloMesh,
          sphereMaterial,
          glowMaterial,
          haloMaterial,
          currentPos: spec.targetPos.clone(),
          spec,
          spawnScale: 0.05
        });
      }

      // Sync crisp HTML label overlay entry
      if (labelOverlay) {
        let entry = labelMap.get(node.id);
        const cleanTitle =
          node.title.length > 28 ? `${node.title.slice(0, 26)}…` : node.title;
        if (!entry) {
          const el = document.createElement('div');
          el.style.position = 'absolute';
          el.style.left = '0';
          el.style.top = '0';
          el.style.pointerEvents = 'none';
          el.style.padding = '3px 8px';
          el.style.borderRadius = '999px';
          el.style.fontSize = '11px';
          el.style.fontWeight = '600';
          el.style.lineHeight = '14px';
          el.style.whiteSpace = 'nowrap';
          el.style.letterSpacing = '-0.01em';
          el.style.backdropFilter = 'blur(8px)';
          el.style.transition = 'opacity 140ms ease';
          el.style.opacity = '0';
          el.style.willChange = 'transform, opacity';

          const titleEl = document.createElement('span');
          titleEl.textContent = cleanTitle;
          el.appendChild(titleEl);
          labelOverlay.appendChild(el);
          entry = { el, titleEl };
          labelMap.set(node.id, entry);
        } else {
          entry.titleEl.textContent = cleanTitle;
        }
      }
    });

    // Show faint orbital guide rings only in 'orbital' mode
    if (orbitalGuidesGroupRef.current) {
      orbitalGuidesGroupRef.current.visible = mode === 'orbital';
    }
  }, [disposeNodeVisual]);

  // Main WebGLRenderer initialization & animation loop (mount once on web)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const mountEl = webContainerRef.current;
    if (!mountEl || typeof window === 'undefined' || typeof document === 'undefined') return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    setWebglFailed(false);
    const initialWidth = mountEl.clientWidth || 840;
    const initialHeight = mountEl.clientHeight || 560;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(initialWidth, initialHeight, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.userSelect = 'none';
    mountEl.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const initDark = isDarkRef.current;
    const bgHex = initDark ? 0x060a14 : 0xeef3f9;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, initDark ? 0.011 : 0.0085);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(46, initialWidth / Math.max(1, initialHeight), 0.1, 280);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, initDark ? 0.55 : 0.85);
    const hemiLight = new THREE.HemisphereLight(0xc7dcf7, 0x111827, initDark ? 0.75 : 0.9);
    const corePointLight = new THREE.PointLight(0x10b981, initDark ? 24 : 12, 48, 1.4);
    corePointLight.position.set(0, 0, 0);
    const keyLight = new THREE.DirectionalLight(0xe2e8f0, initDark ? 1.5 : 1.8);
    keyLight.position.set(18, 26, 22);
    scene.add(ambientLight, hemiLight, corePointLight, keyLight);

    // Textures
    const stardustTexture = createStardustTexture();
    const glowTexture = createRadialGlowTexture(
      'rgba(255,255,255,0.92)',
      'rgba(255,255,255,0.34)'
    );
    glowTextureRef.current = glowTexture;

    // 700 multi-depth background stardust particles
    const starCount = 700;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const paletteDark = [new THREE.Color('#94A3B8'), new THREE.Color('#BAE6FD'), new THREE.Color('#C7D2FE')];
    const paletteLight = [new THREE.Color('#64748B'), new THREE.Color('#3B82F6'), new THREE.Color('#6366F1')];
    const activePalette = initDark ? paletteDark : paletteLight;

    for (let i = 0; i < starCount; i++) {
      // Deterministic golden spiral distribution across spherical shell (r = 22..92)
      const u = ((i * 0.61803398875) % 1) * 2 - 1;
      const theta = i * 2.399963229728653;
      const r = 22 + ((i * 37) % 70);
      const s = Math.sqrt(Math.max(0, 1 - u * u));
      starPositions[i * 3] = Math.cos(theta) * s * r;
      starPositions[i * 3 + 1] = u * r;
      starPositions[i * 3 + 2] = Math.sin(theta) * s * r;

      const c = activePalette[i % activePalette.length];
      starColors[i * 3] = c.r;
      starColors[i * 3 + 1] = c.g;
      starColors[i * 3 + 2] = c.b;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    const starMat = new THREE.PointsMaterial({
      size: initDark ? 0.65 : 0.55,
      map: stardustTexture ?? undefined,
      vertexColors: true,
      transparent: true,
      opacity: initDark ? 0.72 : 0.38,
      depthWrite: false,
      blending: initDark ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    const stardust = new THREE.Points(starGeo, starMat);
    scene.add(stardust);
    stardustPointsRef.current = stardust;
    stardustMaterialRef.current = starMat;

    // Subtle orbital guide rings
    const orbitalGuidesGroup = new THREE.Group();
    const guideGeometries: THREE.BufferGeometry[] = [];
    const guideMaterials: THREE.Material[] = [];
    [7.5, 11.1, 14.7, 18.3, 21.9].forEach(r => {
      const ringGeo = new THREE.RingGeometry(r - 0.025, r + 0.025, 96);
      ringGeo.rotateX(Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: initDark ? 0x64748b : 0x94a3b8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: initDark ? 0.12 : 0.18,
        depthWrite: false
      });
      guideGeometries.push(ringGeo);
      guideMaterials.push(ringMat);
      orbitalGuidesGroup.add(new THREE.Mesh(ringGeo, ringMat));
    });
    orbitalGuidesGroup.visible = galaxyModeRef.current === 'orbital';
    scene.add(orbitalGuidesGroup);
    orbitalGuidesGroupRef.current = orbitalGuidesGroup;

    // Central 0.1 Hz Coherent Breathing Core (layered spheres + additive glow sprites)
    const breathingGroup = new THREE.Group();
    const coreInnerGeo = new THREE.SphereGeometry(0.92, 32, 24);
    const coreInnerMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#10B981'),
      emissive: new THREE.Color('#10B981'),
      emissiveIntensity: initDark ? 1.15 : 0.7,
      roughness: 0.18,
      metalness: 0.1
    });
    const coreInnerMesh = new THREE.Mesh(coreInnerGeo, coreInnerMat);
    breathingGroup.add(coreInnerMesh);

    const coreShellGeo = new THREE.SphereGeometry(1.55, 32, 24);
    const coreShellMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#34D399'),
      transparent: true,
      opacity: initDark ? 0.18 : 0.14,
      depthWrite: false
    });
    const coreShellMesh = new THREE.Mesh(coreShellGeo, coreShellMat);
    breathingGroup.add(coreShellMesh);

    const coreGlowMatOuter = new THREE.SpriteMaterial({
      map: glowTexture ?? undefined,
      color: new THREE.Color('#10B981'),
      transparent: true,
      opacity: initDark ? 0.65 : 0.28,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const coreGlowSpriteOuter = new THREE.Sprite(coreGlowMatOuter);
    coreGlowSpriteOuter.scale.set(9.5, 9.5, 1);
    breathingGroup.add(coreGlowSpriteOuter);

    const coreGlowMatInner = new THREE.SpriteMaterial({
      map: glowTexture ?? undefined,
      color: new THREE.Color('#6EE7B7'),
      transparent: true,
      opacity: initDark ? 0.72 : 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const coreGlowSpriteInner = new THREE.Sprite(coreGlowMatInner);
    coreGlowSpriteInner.scale.set(4.8, 4.8, 1);
    breathingGroup.add(coreGlowSpriteInner);

    scene.add(breathingGroup);

    // Shared geometries for trace orbs & halos
    const sharedSphereGeo = new THREE.SphereGeometry(1, 24, 16);
    const sharedHitGeo = new THREE.SphereGeometry(1, 12, 8);
    const sharedHaloGeo = new THREE.TorusGeometry(1.5, 0.055, 10, 42);
    const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
    sharedSphereGeoRef.current = sharedSphereGeo;
    sharedHitGeoRef.current = sharedHitGeo;
    sharedHaloGeoRef.current = sharedHaloGeo;
    hitMaterialRef.current = hitMaterial;

    const nodesGroup = new THREE.Group();
    scene.add(nodesGroup);
    nodesGroupRef.current = nodesGroup;

    // 3D Connection Filaments (base + highlighted)
    const maxEdgeSegments = 2048;
    const baseEdgeGeo = new THREE.BufferGeometry();
    const baseEdgePositions = new Float32Array(maxEdgeSegments * 6);
    baseEdgeGeo.setAttribute('position', new THREE.BufferAttribute(baseEdgePositions, 3));
    baseEdgeGeo.setDrawRange(0, 0);
    const baseEdgeMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(initDark ? '#94A3B8' : '#475569'),
      transparent: true,
      opacity: initDark ? 0.24 : 0.28,
      depthWrite: false
    });
    const baseEdgeLines = new THREE.LineSegments(baseEdgeGeo, baseEdgeMat);
    baseEdgeLines.frustumCulled = false;
    scene.add(baseEdgeLines);
    baseLinesMatRef.current = baseEdgeMat;

    const activeEdgeGeo = new THREE.BufferGeometry();
    const activeEdgePositions = new Float32Array(maxEdgeSegments * 6);
    activeEdgeGeo.setAttribute('position', new THREE.BufferAttribute(activeEdgePositions, 3));
    activeEdgeGeo.setDrawRange(0, 0);
    const activeEdgeMat = new THREE.LineBasicMaterial({
      color: new THREE.Color('#38BDF8'),
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    });
    const activeEdgeLines = new THREE.LineSegments(activeEdgeGeo, activeEdgeMat);
    activeEdgeLines.frustumCulled = false;
    scene.add(activeEdgeLines);
    activeLinesMatRef.current = activeEdgeMat;

    // Populate initial nodes
    syncNodesAndLabels();

    // Spherical inertial camera controller state
    let theta = 0.22;
    let phi = 1.18;
    let radius = 36;
    let velTheta = 0;
    let velPhi = 0;
    let velRadius = 0;
    const currentTarget = new THREE.Vector3(0, 0, 0);
    const desiredTarget = new THREE.Vector3(0, 0, 0);
    let desiredRadius: number | null = null;
    let isUserControlling = false;

    const updateCameraTransform = () => {
      const sinPhi = Math.sin(phi);
      camera.position.set(
        currentTarget.x + radius * sinPhi * Math.sin(theta),
        currentTarget.y + radius * Math.cos(phi),
        currentTarget.z + radius * sinPhi * Math.cos(theta)
      );
      camera.lookAt(currentTarget);
    };
    updateCameraTransform();

    cameraApiRef.current = {
      zoomBy: (deltaFactor: number) => {
        desiredRadius = null;
        velRadius += deltaFactor * 3.8;
      },
      resetView: () => {
        theta = 0.22;
        phi = 1.18;
        velTheta = 0;
        velPhi = 0;
        velRadius = 0;
        desiredRadius = 36;
        desiredTarget.set(0, 0, 0);
      }
    };

    // Raycaster & pointer tracking (supports mouse drag, 1-finger orbit, 2-finger pinch zoom)
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const activePointers = new Map<number, { x: number; y: number }>();
    let downStartPos: { x: number; y: number } | null = null;
    let totalDragDist = 0;
    let prevPinchDist: number | null = null;

    const getPickables = (): THREE.Object3D[] => {
      const list: THREE.Object3D[] = [];
      for (const vis of nodeVisualsRef.current.values()) {
        list.push(vis.hitMesh);
      }
      return list;
    };

    const raycastAtClientPos = (clientX: number, clientY: number): string | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      pointerNdc.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(getPickables(), false);
      if (hits.length > 0) {
        const nodeId = hits[0].object.userData?.nodeId;
        if (typeof nodeId === 'string') return nodeId;
      }
      return null;
    };

    const handlePointerDown = (e: PointerEvent) => {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      isUserControlling = true;
      desiredRadius = null;
      try {
        renderer.domElement.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture unsupported
      }

      if (activePointers.size === 1) {
        downStartPos = { x: e.clientX, y: e.clientY };
        totalDragDist = 0;
        prevPinchDist = null;
      } else if (activePointers.size === 2) {
        const pts = Array.from(activePointers.values());
        prevPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        downStartPos = null;
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const prev = activePointers.get(e.pointerId);
      if (prev) {
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (activePointers.size === 1) {
          const dx = e.clientX - prev.x;
          const dy = e.clientY - prev.y;
          totalDragDist += Math.hypot(dx, dy);
          velTheta -= dx * 0.0022;
          velPhi -= dy * 0.0022;
          theta -= dx * 0.0042;
          phi = THREE.MathUtils.clamp(phi - dy * 0.0042, 0.18, Math.PI - 0.18);
          return;
        }

        if (activePointers.size === 2 && prevPinchDist !== null) {
          const pts = Array.from(activePointers.values());
          const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
          const deltaDist = dist - prevPinchDist;
          velRadius -= deltaDist * 0.045;
          radius = THREE.MathUtils.clamp(radius - deltaDist * 0.075, 11, 78);
          prevPinchDist = dist;
          return;
        }
      }

      // Hover picking (desktop mouse)
      if (e.pointerType === 'mouse' && activePointers.size === 0) {
        const hitId = raycastAtClientPos(e.clientX, e.clientY);
        if (hitId !== hoveredNodeIdRef.current) {
          setHoveredNodeId(hitId);
        }
        renderer.domElement.style.cursor = hitId ? 'pointer' : 'grab';
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const wasSingleTap =
        activePointers.size === 1 && downStartPos !== null && totalDragDist < 8;
      activePointers.delete(e.pointerId);
      if (activePointers.size < 2) {
        prevPinchDist = null;
      }
      if (activePointers.size === 0) {
        isUserControlling = false;
      }

      if (wasSingleTap) {
        const hitId = raycastAtClientPos(e.clientX, e.clientY);
        if (hitId) {
          const matched = nodesRef.current.find(n => n.id === hitId);
          if (matched) {
            if (controlledSelectedNodeId === undefined) {
              setInternalSelectedNodeId(matched.id);
            }
            focusNodeRequestRef.current = matched.id;
            onSelectNodeRef.current(matched);
          }
        }
      }
      downStartPos = null;
    };

    const handlePointerLeave = () => {
      if (hoveredNodeIdRef.current !== null) {
        setHoveredNodeId(null);
      }
      renderer.domElement.style.cursor = 'grab';
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      desiredRadius = null;
      const step = Math.sign(e.deltaY) * Math.min(3.5, Math.abs(e.deltaY) * 0.012);
      velRadius += step;
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointercancel', handlePointerUp);
    renderer.domElement.addEventListener('pointerleave', handlePointerLeave);
    renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });

    // ResizeObserver for crisp layout adaptation
    let viewportWidth = initialWidth;
    let viewportHeight = initialHeight;
    const handleResize = () => {
      const w = mountEl.clientWidth || 840;
      const h = mountEl.clientHeight || 560;
      if (w <= 0 || h <= 0) return;
      viewportWidth = w;
      viewportHeight = h;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
    };

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(handleResize) : null;
    if (resizeObserver) {
      resizeObserver.observe(mountEl);
    }

    // Reusable scratch vectors (zero per-frame heap allocation)
    const scratchProj = new THREE.Vector3();
    const scratchOrbitTarget = new THREE.Vector3();
    let lastTimeMs = performance.now();
    const startTimeMs = lastTimeMs;

    const animate = () => {
      if (document.visibilityState === 'hidden') {
        lastTimeMs = performance.now();
        return;
      }

      const nowMs = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (nowMs - lastTimeMs) * 0.001));
      const elapsedSec = (nowMs - startTimeMs) * 0.001;
      lastTimeMs = nowMs;

      const dark = isDarkRef.current;
      const mode = galaxyModeRef.current;

      // 0.1 Hz Coherent Breathing Core wave (10-second period)
      const breathWave = Math.sin(elapsedSec * Math.PI * 0.2);
      const corePulse = 1 + breathWave * 0.18;
      const shellPulse = 1 + breathWave * 0.3;
      const constellationBreath = 1 + breathWave * 0.022;

      coreInnerMesh.scale.setScalar(corePulse);
      coreShellMesh.scale.setScalar(shellPulse);
      coreShellMat.opacity = (dark ? 0.18 : 0.13) + breathWave * 0.05;
      coreGlowSpriteOuter.scale.setScalar(9.5 + breathWave * 2.2);
      coreGlowSpriteInner.scale.setScalar(4.8 + breathWave * 1.1);
      corePointLight.intensity = (dark ? 22 : 10) + breathWave * 5;

      // Subtle slow stardust drift
      stardust.rotation.y = elapsedSec * 0.012;

      // Check camera focus request
      const focusReq = focusNodeRequestRef.current;
      if (focusReq !== undefined) {
        if (focusReq === null) {
          desiredTarget.set(0, 0, 0);
        } else {
          const vis = nodeVisualsRef.current.get(focusReq);
          if (vis) {
            desiredTarget.copy(vis.currentPos).multiplyScalar(0.55);
            if (radius > 34) {
              desiredRadius = 29;
            }
          }
        }
        focusNodeRequestRef.current = undefined;
      }

      // Apply inertial camera damping
      const damping = Math.exp(-7.5 * dt);
      if (!isUserControlling) {
        theta += velTheta * (dt * 60) * 0.35;
        phi = THREE.MathUtils.clamp(phi + velPhi * (dt * 60) * 0.35, 0.18, Math.PI - 0.18);
        // Gentle idle cosmos drift when untouched
        theta += dt * 0.035;
      }
      radius = THREE.MathUtils.clamp(radius + velRadius * (dt * 60) * 0.32, 11, 78);
      velTheta *= damping;
      velPhi *= damping;
      velRadius *= damping;

      if (desiredRadius !== null && !isUserControlling) {
        radius = THREE.MathUtils.lerp(radius, desiredRadius, Math.min(1, dt * 4.5));
        if (Math.abs(radius - desiredRadius) < 0.08) {
          desiredRadius = null;
        }
      }
      currentTarget.lerp(desiredTarget, Math.min(1, dt * 4.2));
      updateCameraTransform();

      // Update node positions with smooth lerp + gentle orbital motion
      const lerpAlpha = Math.min(1, dt * 5.2);
      const hoveredId = hoveredNodeIdRef.current;
      const selectedId = selectedNodeIdRef.current;

      const labelCandidates: {
        id: string;
        sx: number;
        sy: number;
        depth: number;
        priority: number;
        colorHex: string;
      }[] = [];

      for (const vis of nodeVisualsRef.current.values()) {
        const { spec } = vis;
        if (spec.isCore) {
          vis.currentPos.set(0, 0, 0);
        } else {
          if (mode === 'orbital') {
            const a = spec.orbitAngle + elapsedSec * spec.orbitSpeed;
            const yOff = Math.sin(a) * spec.orbitRadius * spec.orbitTilt + (spec.targetPos.y - Math.sin(spec.orbitAngle) * spec.orbitRadius * spec.orbitTilt);
            scratchOrbitTarget.set(
              Math.cos(a) * spec.orbitRadius * constellationBreath,
              yOff * constellationBreath,
              Math.sin(a) * spec.orbitRadius * constellationBreath
            );
          } else if (mode === 'torus') {
            const u = spec.torusU + elapsedSec * spec.orbitSpeed;
            scratchOrbitTarget.set(
              (spec.torusMajorR + spec.torusMinorR * Math.cos(spec.torusV)) * Math.cos(u) * constellationBreath,
              (spec.torusMajorR + spec.torusMinorR * Math.cos(spec.torusV)) * Math.sin(u) * 0.56 * constellationBreath,
              spec.torusMinorR * Math.sin(spec.torusV) * constellationBreath
            );
          } else {
            scratchOrbitTarget.copy(spec.targetPos).multiplyScalar(constellationBreath);
          }
          vis.currentPos.lerp(scratchOrbitTarget, lerpAlpha);
        }

        vis.group.position.copy(vis.currentPos);

        if (vis.spawnScale < 1) {
          vis.spawnScale = Math.min(1, vis.spawnScale + dt * 4.5);
          vis.group.scale.setScalar(vis.spawnScale);
        }

        const isActive = vis.id === hoveredId || vis.id === selectedId;
        vis.sphereMaterial.emissiveIntensity = spec.isCore
          ? 0.2
          : isActive
          ? dark
            ? 1.15
            : 0.72
          : dark
          ? 0.55
          : 0.35;
        const targetGlowScale = spec.radius * (isActive ? 6.2 : 4.4) * (1 + breathWave * 0.08);
        vis.glowSprite.scale.set(targetGlowScale, targetGlowScale, 1);

        if (vis.haloMesh) {
          vis.haloMesh.rotation.z += dt * 0.55;
        }

        // Screen-space projection for HTML label pills
        scratchProj.copy(vis.currentPos).project(camera);
        if (scratchProj.z >= -1 && scratchProj.z <= 1) {
          const sx = (scratchProj.x * 0.5 + 0.5) * viewportWidth;
          const sy = (-scratchProj.y * 0.5 + 0.5) * viewportHeight;
          if (sx > 24 && sx < viewportWidth - 24 && sy > 20 && sy < viewportHeight - 20) {
            const priority =
              vis.id === selectedId
                ? 100
                : vis.id === hoveredId
                ? 90
                : spec.isCore
                ? 50
                : 10 - scratchProj.z * 5;
            labelCandidates.push({
              id: vis.id,
              sx,
              sy,
              depth: scratchProj.z,
              priority,
              colorHex: spec.colorHex
            });
          }
        }
      }

      // Update 3D Connection Filaments
      const basePosAttr = baseEdgeGeo.getAttribute('position') as THREE.BufferAttribute;
      const activePosAttr = activeEdgeGeo.getAttribute('position') as THREE.BufferAttribute;
      const baseArr = basePosAttr.array as Float32Array;
      const activeArr = activePosAttr.array as Float32Array;
      let baseVertexCount = 0;
      let activeVertexCount = 0;

      for (const edge of edgesRef.current) {
        const v1 = nodeVisualsRef.current.get(edge.sourceId);
        const v2 = nodeVisualsRef.current.get(edge.targetId);
        if (!v1 || !v2) continue;

        const isEdgeActive =
          hoveredId === edge.sourceId ||
          hoveredId === edge.targetId ||
          selectedId === edge.sourceId ||
          selectedId === edge.targetId;

        if (isEdgeActive) {
          if (activeVertexCount + 2 <= maxEdgeSegments * 2) {
            const idx = activeVertexCount * 3;
            activeArr[idx] = v1.currentPos.x;
            activeArr[idx + 1] = v1.currentPos.y;
            activeArr[idx + 2] = v1.currentPos.z;
            activeArr[idx + 3] = v2.currentPos.x;
            activeArr[idx + 4] = v2.currentPos.y;
            activeArr[idx + 5] = v2.currentPos.z;
            activeVertexCount += 2;
          }
        } else if (baseVertexCount + 2 <= maxEdgeSegments * 2) {
          const idx = baseVertexCount * 3;
          baseArr[idx] = v1.currentPos.x;
          baseArr[idx + 1] = v1.currentPos.y;
          baseArr[idx + 2] = v1.currentPos.z;
          baseArr[idx + 3] = v2.currentPos.x;
          baseArr[idx + 4] = v2.currentPos.y;
          baseArr[idx + 5] = v2.currentPos.z;
          baseVertexCount += 2;
        }
      }
      baseEdgeGeo.setDrawRange(0, baseVertexCount);
      basePosAttr.needsUpdate = true;
      activeEdgeGeo.setDrawRange(0, activeVertexCount);
      activePosAttr.needsUpdate = true;

      // Position non-overlapping floating HTML labels (60fps GPU-composited translate3d)
      labelCandidates.sort((a, b) => b.priority - a.priority);
      const placedBoxes: { x: number; y: number; w: number; h: number }[] = [];
      const visibleLabelIds = new Set<string>();
      const maxLabels = 9;

      for (const cand of labelCandidates) {
        if (visibleLabelIds.size >= maxLabels && cand.id !== selectedId && cand.id !== hoveredId) {
          continue;
        }
        const entry = labelDomMapRef.current.get(cand.id);
        if (!entry) continue;

        const estWidth = Math.min(180, (entry.titleEl.textContent?.length || 10) * 6.4 + 20);
        const estHeight = 22;
        const lx = cand.sx + 12;
        const ly = cand.sy - 11;

        const overlaps =
          cand.id !== selectedId &&
          cand.id !== hoveredId &&
          placedBoxes.some(
            b =>
              lx < b.x + b.w + 6 &&
              lx + estWidth + 6 > b.x &&
              ly < b.y + b.h + 4 &&
              ly + estHeight + 4 > b.y
          );

        if (overlaps) continue;

        placedBoxes.push({ x: lx, y: ly, w: estWidth, h: estHeight });
        visibleLabelIds.add(cand.id);

        const isFocused = cand.id === selectedId || cand.id === hoveredId;
        entry.el.style.transform = `translate3d(${Math.round(lx)}px, ${Math.round(ly)}px, 0)`;
        entry.el.style.opacity = isFocused ? '1' : '0.88';
        entry.el.style.backgroundColor = dark
          ? isFocused
            ? 'rgba(15, 23, 42, 0.92)'
            : 'rgba(10, 15, 28, 0.72)'
          : isFocused
          ? 'rgba(255, 255, 255, 0.96)'
          : 'rgba(248, 250, 252, 0.82)';
        entry.el.style.color = dark ? '#F1F5F9' : '#0F172A';
        entry.el.style.border = isFocused
          ? `1px solid ${cand.colorHex}`
          : dark
          ? '1px solid rgba(148, 163, 184, 0.22)'
          : '1px solid rgba(100, 116, 139, 0.24)';
        entry.el.style.zIndex = isFocused ? '6' : '2';
      }

      for (const [id, entry] of labelDomMapRef.current.entries()) {
        if (!visibleLabelIds.has(id)) {
          entry.el.style.opacity = '0';
        }
      }

      renderer.render(scene, camera);
    };

    renderer.setAnimationLoop(animate);

    const visualsMap = nodeVisualsRef.current;
    const labelMap = labelDomMapRef.current;

    return () => {
      renderer.setAnimationLoop(null);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }

      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointercancel', handlePointerUp);
      renderer.domElement.removeEventListener('pointerleave', handlePointerLeave);
      renderer.domElement.removeEventListener('wheel', handleWheel);

      // Dispose all node visuals
      for (const vis of visualsMap.values()) {
        disposeNodeVisual(vis, nodesGroup);
      }
      visualsMap.clear();

      for (const entry of labelMap.values()) {
        entry.el.remove();
      }
      labelMap.clear();

      // Dispose shared & scene resources
      sharedSphereGeo.dispose();
      sharedHitGeo.dispose();
      sharedHaloGeo.dispose();
      hitMaterial.dispose();
      starGeo.dispose();
      starMat.dispose();
      coreInnerGeo.dispose();
      coreInnerMat.dispose();
      coreShellGeo.dispose();
      coreShellMat.dispose();
      coreGlowMatOuter.dispose();
      coreGlowMatInner.dispose();
      baseEdgeGeo.dispose();
      baseEdgeMat.dispose();
      activeEdgeGeo.dispose();
      activeEdgeMat.dispose();
      guideGeometries.forEach(g => g.dispose());
      guideMaterials.forEach(m => m.dispose());
      stardustTexture?.dispose();
      glowTexture?.dispose();

      if (renderer.domElement.parentNode === mountEl) {
        mountEl.removeChild(renderer.domElement);
      }
      renderer.dispose();

      sceneRef.current = null;
      nodesGroupRef.current = null;
      sharedSphereGeoRef.current = null;
      sharedHitGeoRef.current = null;
      sharedHaloGeoRef.current = null;
      hitMaterialRef.current = null;
      glowTextureRef.current = null;
      stardustPointsRef.current = null;
      stardustMaterialRef.current = null;
      baseLinesMatRef.current = null;
      activeLinesMatRef.current = null;
      orbitalGuidesGroupRef.current = null;
      cameraApiRef.current = null;
    };
    // Mount once on web; theme & data updates reconcile dynamically via dedicated effects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconcile Theme updates without recreating WebGL context
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const bgHex = isDark ? 0x060a14 : 0xeef3f9;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, isDark ? 0.011 : 0.0085);

    if (stardustMaterialRef.current) {
      stardustMaterialRef.current.opacity = isDark ? 0.72 : 0.38;
      stardustMaterialRef.current.size = isDark ? 0.65 : 0.55;
      stardustMaterialRef.current.blending = isDark ? THREE.AdditiveBlending : THREE.NormalBlending;
      stardustMaterialRef.current.needsUpdate = true;
    }
    if (baseLinesMatRef.current) {
      baseLinesMatRef.current.color.set(isDark ? '#94A3B8' : '#475569');
      baseLinesMatRef.current.opacity = isDark ? 0.24 : 0.28;
    }
    if (activeLinesMatRef.current) {
      activeLinesMatRef.current.color.set(isDark ? '#38BDF8' : colors.accent);
    }
    syncNodesAndLabels();
  }, [isDark, colors, syncNodesAndLabels]);

  // Reconcile Nodes, Edges & Geometry Mode dynamically with smooth lerp transitions
  useEffect(() => {
    syncNodesAndLabels();
  }, [nodes, edges, galaxyMode, syncNodesAndLabels]);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? '#060A14' : '#EEF3F9',
          borderColor: colors.borderSubtle
        }
      ]}
    >
      {Platform.OS === 'web' && !webglFailed ? (
        React.createElement(
          'div',
          {
            style: {
              position: 'relative',
              width: '100%',
              height: '100%',
              touchAction: 'none',
              overflow: 'hidden'
            }
          },
          React.createElement('div', {
            ref: webContainerRef,
            style: {
              width: '100%',
              height: '100%',
              touchAction: 'none'
            }
          }),
          React.createElement('div', {
            ref: labelOverlayRef,
            style: {
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              overflow: 'hidden'
            }
          })
        )
      ) : (
        <View style={styles.nativeFallback}>
          <Ionicons name="planet-outline" size={32} color={colors.accent} style={{ marginBottom: 10 }} />
          <Text style={[styles.fallbackTitle, { color: colors.textPrimary }]}>
            {webglFailed ? 'WebGL-Kontext nicht verfügbar' : '3D-Kosmos auf Web optimiert'}
          </Text>
          <Text style={[styles.fallbackSubtitle, { color: colors.textSecondary }]}>
            {webglFailed
              ? 'Wechsle oben zur 2D-Liste, um alle gespeicherten Funde, Notizen und Lernpfade direkt zu durchsuchen.'
              : 'Öffne Atem im Browser für den interaktiven Three.js WebGL-Kosmos oder nutze oben die 2D-Liste.'}
          </Text>
        </View>
      )}

      {/* Control Overlay Buttons (Single Ionicon each) */}
      <View style={styles.controlBar}>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
          onPress={() => cameraApiRef.current?.zoomBy(-1.2)}
          accessibilityRole="button"
          accessibilityLabel="Heranzoomen"
        >
          <Ionicons name="add" size={18} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
          onPress={() => cameraApiRef.current?.zoomBy(1.2)}
          accessibilityRole="button"
          accessibilityLabel="Herauszoomen"
        >
          <Ionicons name="remove" size={18} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
          onPress={() => {
            if (controlledSelectedNodeId === undefined) {
              setInternalSelectedNodeId(null);
            }
            cameraApiRef.current?.resetView();
          }}
          accessibilityRole="button"
          accessibilityLabel="Ansicht zurücksetzen"
        >
          <Ionicons name="refresh-outline" size={16} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Info Legend */}
      <View style={[styles.legend, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
        <Text style={[styles.legendTitle, { color: colors.textSecondary }]}>
          {nodes.length} Knoten · {edges.length} Filamente
        </Text>
        <Text style={[styles.legendHint, { color: colors.textMuted }]}>
          Ziehen zum Orbit · Pinch zum Zoomen · Tippen zum Öffnen
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 540,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative'
  },
  nativeFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28
  },
  fallbackTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center'
  },
  fallbackSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 360
  },
  controlBar: {
    position: 'absolute',
    right: 14,
    top: 14,
    flexDirection: 'column',
    gap: 8,
    zIndex: 10
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 2
  },
  legend: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
    zIndex: 10
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: '600'
  },
  legendHint: {
    fontSize: 10,
    marginTop: 2
  }
});
