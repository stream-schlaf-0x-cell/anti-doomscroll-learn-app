import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Platform, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
    | 'reading_anchor';
  color: string;
  space?: string;
  articleId?: string;
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

interface Point3D {
  x: number;
  y: number;
  z: number;
  baseRadius: number;
  orbitAngle?: number;
  orbitRadius?: number;
  orbitSpeed?: number;
}

interface Props {
  nodes: HyperspaceNode[];
  edges: HyperspaceEdge[];
  onSelectNode: (node: HyperspaceNode) => void;
  onSelectEdge?: (edge: HyperspaceEdge) => void;
  colors: ThemeColors;
  isDark: boolean;
  galaxyMode?: GalaxyMode;
}

export const HyperspaceCanvas: React.FC<Props> = ({
  nodes,
  edges,
  onSelectNode,
  onSelectEdge,
  colors,
  isDark,
  galaxyMode = 'orbital'
}) => {
  const containerRef = useRef<View>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [rotX, setRotX] = useState<number>(0.25);
  const [rotY, setRotY] = useState<number>(0.1);
  const [zoom, setZoom] = useState<number>(1.0);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const pointsRef = useRef<Map<string, Point3D>>(new Map());
  const isDraggingRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchDistanceRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const projectedRef = useRef<Map<string, { sx: number; sy: number; scale: number; depth: number }>>(new Map());

  // Deterministically position nodes in 3D according to selected Tonglen Visual Lab geometry
  useEffect(() => {
    const map = new Map<string, Point3D>();
    const count = Math.max(1, nodes.length);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    // Separate cores (channels / topics) from satellite articles & notes
    const cores = nodes.filter(n => n.type === 'channel_core');
    const coreCount = Math.max(1, cores.length);

    nodes.forEach((node, i) => {
      const depthMultiplier = node.interactionDepth || 1;
      const baseRadius = node.type === 'channel_core' ? 14 : Math.min(18, 5 + depthMultiplier * 2.5);

      if (galaxyMode === 'orbital') {
        // Mode 1: Cosmic Galaxy (Orbital Discs)
        if (node.type === 'channel_core') {
          const coreIdx = cores.findIndex(c => c.id === node.id);
          const angle = (coreIdx / coreCount) * Math.PI * 2;
          const dist = coreCount === 1 ? 0 : 130 + (coreIdx % 2) * 40;
          map.set(node.id, {
            x: Math.cos(angle) * dist,
            y: (Math.sin(angle * 2) * 20),
            z: Math.sin(angle) * dist,
            baseRadius: 15,
            orbitAngle: angle,
            orbitRadius: dist,
            orbitSpeed: 0.0003
          });
        } else {
          // Orbiting planets around the central plane
          const phi = (i / count) * Math.PI * 2;
          const orbitR = 90 + (i % 6) * 35;
          const tilt = ((i % 4) - 1.5) * 0.22;
          map.set(node.id, {
            x: Math.cos(phi) * orbitR,
            y: Math.sin(phi) * orbitR * tilt + ((i % 3) - 1) * 25,
            z: Math.sin(phi) * orbitR,
            baseRadius,
            orbitAngle: phi,
            orbitRadius: orbitR,
            orbitSpeed: 0.0006 + (i % 5) * 0.0002
          });
        }
      } else if (galaxyMode === 'lotus') {
        // Mode 2: Tonglen Sphäre / Sacred Lotus (Fibonacci 3D Mandala)
        const y = 1 - (i / Math.max(1, count - 1)) * 2; // -1 to 1
        const rAtY = Math.sqrt(1 - y * y);
        const theta = goldenAngle * i;
        const sphereRadius = 160 + (i % 4) * 25;

        map.set(node.id, {
          x: Math.cos(theta) * rAtY * sphereRadius,
          y: y * sphereRadius,
          z: Math.sin(theta) * rAtY * sphereRadius,
          baseRadius
        });
      } else {
        // Mode 3: Prana Torus (Flussfeld)
        const majorR = 170;
        const minorR = 65 + (i % 3) * 15;
        const u = (i / count) * Math.PI * 2;
        const v = ((i * 3) / count) * Math.PI * 2;

        map.set(node.id, {
          x: (majorR + minorR * Math.cos(v)) * Math.cos(u),
          y: (majorR + minorR * Math.cos(v)) * Math.sin(u) * 0.6,
          z: minorR * Math.sin(v),
          baseRadius,
          orbitAngle: u,
          orbitRadius: majorR,
          orbitSpeed: 0.0004
        });
      }
    });

    pointsRef.current = map;
  }, [nodes, galaxyMode]);

  // Tonglen 3D Breathing Canvas Render Loop
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) return;

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;

      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;
      const fov = 460 * zoom;
      const timeSec = performance.now() * 0.001;

      // Authentic Tonglen coherent breathing oscillation (0.1 Hz -> ~6 breaths/minute)
      const breathPhase = Math.sin(timeSec * 0.628); // -1 to 1
      const breathScale = 1.0 + breathPhase * 0.045; // 0.955 to 1.045
      const breathGlow = 0.5 + breathPhase * 0.35;

      // Deep cosmic space background with subtle vignette
      ctx.globalCompositeOperation = 'source-over';
      const bgGrad = ctx.createRadialGradient(cx, cy, 30, cx, cy, Math.max(width, height) * 0.7);
      if (isDark) {
        bgGrad.addColorStop(0, '#0E1117');
        bgGrad.addColorStop(0.6, '#080A0E');
        bgGrad.addColorStop(1, '#030406');
      } else {
        bgGrad.addColorStop(0, '#F1F5F9');
        bgGrad.addColorStop(0.7, '#E2E8F0');
        bgGrad.addColorStop(1, '#CBD5E1');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 3D rotation matrix calculation
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);

      const projected = new Map<string, { sx: number; sy: number; scale: number; depth: number }>();

      // Project 3D nodes to 2D screen coordinates with breathing expansion
      for (const [id, pt] of pointsRef.current.entries()) {
        const px = pt.x * breathScale;
        const py = pt.y * breathScale;
        const pz = pt.z * breathScale;

        // Rotate around Y
        const x1 = px * cosY + pz * sinY;
        const z1 = -px * sinY + pz * cosY;
        // Rotate around X
        const y2 = py * cosX - z1 * sinX;
        const z2 = py * sinX + z1 * cosX;

        const distance = fov + z2;
        if (distance > 20) {
          const scale = fov / distance;
          const sx = cx + x1 * scale;
          const sy = cy + y2 * scale;
          projected.set(id, { sx, sy, scale, depth: z2 });
        }
      }
      projectedRef.current = projected;

      // Switch to Tonglen Additive Blending for ethereal light particles
      ctx.globalCompositeOperation = 'lighter';

      // 1. Render Semantic Gravity Filaments (Edges)
      for (const edge of edges) {
        const p1 = projected.get(edge.sourceId);
        const p2 = projected.get(edge.targetId);
        if (!p1 || !p2) continue;

        const isEdgeActive =
          hoveredNodeId === edge.sourceId ||
          hoveredNodeId === edge.targetId ||
          selectedNodeId === edge.sourceId ||
          selectedNodeId === edge.targetId;

        const avgDepth = (p1.depth + p2.depth) / 2;
        const depthAlpha = Math.max(0.12, Math.min(0.85, (avgDepth + 260) / 520));

        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);

        if (isEdgeActive) {
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 2.2;
          ctx.setLineDash([4, 3]);
        } else {
          ctx.strokeStyle = isDark
            ? `rgba(148, 163, 184, ${depthAlpha * 0.28})`
            : `rgba(71, 85, 105, ${depthAlpha * 0.22})`;
          ctx.lineWidth = 1.0;
          ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 2. Sort nodes back-to-front for proper depth perception
      const sortedNodeEntries = Array.from(projected.entries()).sort(
        (a, b) => a[1].depth - b[1].depth
      );

      // 3. Render Luminous Stars & Halos (Tonglen Additive Light)
      for (const [id, proj] of sortedNodeEntries) {
        const node = nodes.find(n => n.id === id);
        if (!node) continue;

        const pt = pointsRef.current.get(id);
        const baseRadius = pt?.baseRadius || 7;
        const radius = Math.max(3, Math.min(32, baseRadius * proj.scale));
        const depthAlpha = Math.max(0.25, Math.min(1.0, (proj.depth + 260) / 480));
        const isHovered = hoveredNodeId === id;
        const isSelected = selectedNodeId === id;

        // Color coding from Tonglen Visual Lab
        let coreColor = node.color || '#38BDF8';
        let glowColor = 'rgba(56, 189, 248, 0.4)';

        if (node.type === 'channel_core') {
          coreColor = '#F8FAFC';
          glowColor = isDark ? 'rgba(250, 204, 21, 0.45)' : 'rgba(217, 119, 6, 0.35)';
        } else if (node.type === 'user_note' || node.noteText) {
          coreColor = '#F59E0B'; // Warm amber
          glowColor = 'rgba(245, 158, 11, 0.5)';
        } else if (node.type === 'upvoted_saved') {
          coreColor = '#10B981'; // Emerald
          glowColor = 'rgba(16, 185, 129, 0.45)';
        } else if (node.type === 'curated_insight') {
          coreColor = '#818CF8'; // Indigo shimmer
          glowColor = 'rgba(129, 140, 248, 0.45)';
        }

        // Multi-stop radial glow aura (Tonglen Engine)
        const auraRadius = radius * (node.type === 'channel_core' ? 3.4 : 2.6) * (1.0 + breathGlow * 0.15);
        const auraGrad = ctx.createRadialGradient(proj.sx, proj.sy, 0, proj.sx, proj.sy, auraRadius);
        auraGrad.addColorStop(0, glowColor);
        auraGrad.addColorStop(0.5, glowColor.replace(/[\d\.]+\)$/, '0.15)'));
        auraGrad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(proj.sx, proj.sy, auraRadius, 0, Math.PI * 2);
        ctx.fill();

        // Extra dual corona for personal notes
        if (node.noteText || node.type === 'user_note') {
          ctx.beginPath();
          ctx.arc(proj.sx, proj.sy, radius + 4, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        // Sharp central starlight core
        ctx.beginPath();
        ctx.arc(proj.sx, proj.sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = coreColor;
        ctx.globalAlpha = depthAlpha;
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Selection ring
        if (isSelected || isHovered) {
          ctx.beginPath();
          ctx.arc(proj.sx, proj.sy, radius + 6, 0, Math.PI * 2);
          ctx.strokeStyle = isSelected ? '#FFFFFF' : '#38BDF8';
          ctx.lineWidth = isSelected ? 2.4 : 1.5;
          ctx.stroke();
        }

        // Crisp typography label for frontmost or active stars
        if (proj.scale > 0.88 || isHovered || isSelected || node.type === 'channel_core') {
          ctx.font = `${isHovered || isSelected || node.type === 'channel_core' ? 'bold ' : ''}11px -apple-system, BlinkMacSystemFont, sans-serif`;
          ctx.fillStyle = isDark ? '#F1F5F9' : '#0F172A';
          let label = node.title;
          if (label.length > 26) label = label.slice(0, 24) + '…';
          ctx.fillText(label, proj.sx + radius + 6, proj.sy + 4);
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [nodes, edges, rotX, rotY, zoom, hoveredNodeId, selectedNodeId, colors, isDark, galaxyMode]);

  // Pointer interactions with touch & mouse support
  const handlePointerDown = (e: any) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: any) => {
    if (isDraggingRef.current) {
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;
      setRotY(prev => prev + dx * 0.005);
      setRotX(prev => Math.max(-1.3, Math.min(1.3, prev + dy * 0.005)));
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let closestId: string | null = null;
    let closestDist = 24;

    for (const [id, proj] of projectedRef.current.entries()) {
      const d = Math.hypot(proj.sx - mx, proj.sy - my);
      if (d < closestDist) {
        closestDist = d;
        closestId = id;
      }
    }

    setHoveredNodeId(closestId);
  };

  const handlePointerUp = (e: any) => {
    if (isDraggingRef.current) {
      const dx = Math.abs(e.clientX - lastMousePosRef.current.x);
      const dy = Math.abs(e.clientY - lastMousePosRef.current.y);
      isDraggingRef.current = false;
      if (dx < 5 && dy < 5 && hoveredNodeId) {
        const node = nodes.find(n => n.id === hoveredNodeId);
        if (node) {
          setSelectedNodeId(node.id);
          onSelectNode(node);
        }
      }
    }
  };

  // Touch gesture support (single finger orbit, 2-finger pinch zoom)
  const handleTouchStart = (e: any) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      lastMousePosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      touchDistanceRef.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  };

  const handleTouchMove = (e: any) => {
    if (e.touches.length === 1 && isDraggingRef.current) {
      const dx = e.touches[0].clientX - lastMousePosRef.current.x;
      const dy = e.touches[0].clientY - lastMousePosRef.current.y;
      setRotY(prev => prev + dx * 0.005);
      setRotX(prev => Math.max(-1.3, Math.min(1.3, prev + dy * 0.005)));
      lastMousePosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2 && touchDistanceRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = (dist - touchDistanceRef.current) * 0.005;
      setZoom(prev => Math.max(0.4, Math.min(2.5, prev + delta)));
      touchDistanceRef.current = dist;
    }
  };

  const handleTouchEnd = (e: any) => {
    isDraggingRef.current = false;
    touchDistanceRef.current = null;
  };

  const handleWheel = (e: any) => {
    e.preventDefault?.();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prev => Math.max(0.4, Math.min(2.5, prev + delta)));
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0A0C10' : '#F8FAFC' }]} ref={containerRef}>
      {Platform.OS === 'web' ? (
        <canvas
          ref={canvasRef}
          width={840}
          height={560}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            cursor: hoveredNodeId ? 'pointer' : 'grab'
          }}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        />
      ) : (
        <View style={styles.nativeFallback}>
          <Text style={{ color: colors.textSecondary }}>3D-Hyperspace ist auf dem Web-Canvas optimiert.</Text>
        </View>
      )}

      {/* Control Overlay Buttons */}
      <View style={styles.controlBar}>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
          onPress={() => setZoom(prev => Math.min(2.5, prev + 0.2))}
          accessibilityLabel="Heranzoomen"
        >
          <Ionicons name="add" size={18} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
          onPress={() => setZoom(prev => Math.max(0.4, prev - 0.2))}
          accessibilityLabel="Herauszoomen"
        >
          <Ionicons name="remove" size={18} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
          onPress={() => {
            setRotX(0.25);
            setRotY(0.1);
            setZoom(1.0);
          }}
          accessibilityLabel="Ansicht zurücksetzen"
        >
          <Ionicons name="refresh-outline" size={16} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Info Legend */}
      <View style={[styles.legend, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
        <Text style={[styles.legendTitle, { color: colors.textSecondary }]}>
          {nodes.length} Gestirne • {edges.length} Filamente
        </Text>
        <Text style={[styles.legendHint, { color: colors.textMuted }]}>
          3D-Orbit ziehen • Tippen zum Untersuchen
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 560,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative'
  },
  nativeFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  controlBar: {
    position: 'absolute',
    right: 16,
    top: 16,
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
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2
  },
  legend: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
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
