import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Platform, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeColors } from '../../ui/theme';

export interface HyperspaceNode {
  id: string;
  title: string;
  subtitle?: string;
  type: 'thought' | 'question' | 'thesis' | 'article_note' | 'concept' | 'article';
  color: string;
  space?: string;
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
  vx: number;
  vy: number;
  vz: number;
}

interface Props {
  nodes: HyperspaceNode[];
  edges: HyperspaceEdge[];
  onSelectNode: (node: HyperspaceNode) => void;
  onSelectEdge?: (edge: HyperspaceEdge) => void;
  colors: ThemeColors;
  isDark: boolean;
}

export const HyperspaceCanvas: React.FC<Props> = ({
  nodes,
  edges,
  onSelectNode,
  onSelectEdge,
  colors,
  isDark
}) => {
  const containerRef = useRef<View>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [rotX, setRotX] = useState<number>(0.2);
  const [rotY, setRotY] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(1.0);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Store 3D coordinates in ref
  const pointsRef = useRef<Map<string, Point3D>>(new Map());
  const isDraggingRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const animFrameRef = useRef<number | null>(null);
  const projectedRef = useRef<Map<string, { sx: number; sy: number; scale: number; depth: number }>>(new Map());

  // Deterministically position nodes on a 3D sphere/torus
  useEffect(() => {
    const map = new Map<string, Point3D>();
    const count = nodes.length;
    const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle

    nodes.forEach((node, i) => {
      const existing = pointsRef.current.get(node.id);
      if (existing) {
        map.set(node.id, existing);
        return;
      }
      const y = 1 - (i / Math.max(1, count - 1)) * 2; // -1 to 1
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = phi * i;
      const sphereRadius = 180 + (i % 3) * 30;

      map.set(node.id, {
        x: Math.cos(theta) * radiusAtY * sphereRadius,
        y: y * sphereRadius,
        z: Math.sin(theta) * radiusAtY * sphereRadius,
        vx: 0,
        vy: 0,
        vz: 0
      });
    });

    pointsRef.current = map;
  }, [nodes]);

  // Canvas render loop on Web
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;

      // Pause when browser tab is hidden to save battery & CPU (Masterplan §6)
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;
      const fov = 450 * zoom;

      ctx.clearRect(0, 0, width, height);

      // Subtle background ambient vignette
      const bgGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.max(width, height) * 0.7);
      bgGrad.addColorStop(0, isDark ? 'rgba(30, 32, 42, 0.4)' : 'rgba(240, 243, 248, 0.5)');
      bgGrad.addColorStop(1, isDark ? 'rgba(15, 17, 23, 0)' : 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 3D rotation matrix calculation
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);

      const projected = new Map<string, { sx: number; sy: number; scale: number; depth: number }>();

      // Project 3D nodes to 2D
      for (const [id, pt] of pointsRef.current.entries()) {
        // Rotate around Y
        const x1 = pt.x * cosY + pt.z * sinY;
        const z1 = -pt.x * sinY + pt.z * cosY;
        // Rotate around X
        const y2 = pt.y * cosX - z1 * sinX;
        const z2 = pt.y * sinX + z1 * cosX;

        const distance = fov + z2;
        if (distance > 10) {
          const scale = fov / distance;
          const sx = cx + x1 * scale;
          const sy = cy + y2 * scale;
          projected.set(id, { sx, sy, scale, depth: z2 });
        }
      }
      projectedRef.current = projected;

      // Draw connective edges
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
        const depthAlpha = Math.max(0.12, Math.min(0.85, (avgDepth + 250) / 500));

        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);

        if (isEdgeActive) {
          ctx.strokeStyle = colors.accent;
          ctx.lineWidth = 1.8;
          ctx.setLineDash([4, 4]);
        } else {
          ctx.strokeStyle = isDark
            ? `rgba(160, 175, 205, ${depthAlpha * 0.4})`
            : `rgba(90, 110, 140, ${depthAlpha * 0.35})`;
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // If edge active, render subtle relation badge midway
        if (isEdgeActive && edge.relation) {
          const midX = (p1.sx + p2.sx) / 2;
          const midY = (p1.sy + p2.sy) / 2;
          ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillStyle = isDark ? '#FFFFFF' : '#111827';
          ctx.fillText(edge.relation.replace('_', ' '), midX + 6, midY - 4);
        }
      }

      // Sort nodes back-to-front for proper depth occlusion
      const sortedNodeEntries = Array.from(projected.entries()).sort(
        (a, b) => a[1].depth - b[1].depth
      );

      // Draw nodes
      for (const [id, proj] of sortedNodeEntries) {
        const node = nodes.find(n => n.id === id);
        if (!node) continue;

        const isHovered = hoveredNodeId === id;
        const isSelected = selectedNodeId === id;
        const baseRadius = node.type === 'question' ? 9 : node.type === 'thesis' ? 8 : 7;
        const radius = Math.max(3, Math.min(22, baseRadius * proj.scale));
        const alpha = Math.max(0.35, Math.min(1.0, (proj.depth + 240) / 450));

        // Outer glow on hover or select
        if (isHovered || isSelected) {
          ctx.beginPath();
          ctx.arc(proj.sx, proj.sy, radius + 6, 0, Math.PI * 2);
          ctx.fillStyle = `${colors.accent}40`;
          ctx.fill();
        }

        // Main node sphere
        ctx.beginPath();
        ctx.arc(proj.sx, proj.sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = node.color || colors.accent;
        ctx.globalAlpha = alpha;
        ctx.fill();
        ctx.globalAlpha = 1.0;

        ctx.strokeStyle = isDark ? '#FFFFFF' : '#0F172A';
        ctx.lineWidth = isSelected ? 2.5 : isHovered ? 1.5 : 0.7;
        ctx.stroke();

        // Node label if close to front or hovered
        if (proj.scale > 0.85 || isHovered || isSelected) {
          ctx.font = `${isHovered || isSelected ? 'bold ' : ''}11px -apple-system, BlinkMacSystemFont, sans-serif`;
          ctx.fillStyle = isDark ? '#E2E8F0' : '#1E293B';
          let label = node.title;
          if (label.length > 24) label = label.slice(0, 22) + '…';
          ctx.fillText(label, proj.sx + radius + 5, proj.sy + 4);
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [nodes, edges, rotX, rotY, zoom, hoveredNodeId, selectedNodeId, colors, isDark]);

  // Pointer interactions for rotation and clicking
  const handlePointerDown = (e: any) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: any) => {
    if (isDraggingRef.current) {
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;
      setRotY(prev => prev + dx * 0.006);
      setRotX(prev => Math.max(-1.2, Math.min(1.2, prev + dy * 0.006)));
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Hover detection
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let closestId: string | null = null;
    let closestDist = 20;

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
      if (dx < 4 && dy < 4 && hoveredNodeId) {
        const node = nodes.find(n => n.id === hoveredNodeId);
        if (node) {
          setSelectedNodeId(node.id);
          onSelectNode(node);
        }
      }
    }
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
          width={800}
          height={550}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            cursor: hoveredNodeId ? 'pointer' : 'grab'
          }}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
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
            setRotX(0.2);
            setRotY(0);
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
          {nodes.length} Knoten • {edges.length} Beziehungen
        </Text>
        <Text style={[styles.legendHint, { color: colors.textMuted }]}>
          Drehen durch Ziehen • Klicken zum Öffnen
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 550,
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
    gap: 8
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
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
    elevation: 2
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
