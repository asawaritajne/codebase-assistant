import type { ThreeEvent } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { repoColor } from "../lib/repoColors";
import type { EmbeddingMap } from "../types";

/** Points not belonging to the highlighted repository fade into the background. */
const DIMMED = new THREE.Color("#1e293b");

export interface HoveredPoint {
  index: number;
  x: number;
  y: number;
}

interface CloudPointsProps {
  map: EmbeddingMap;
  /** Repository id to highlight, or null to show them all. */
  highlight?: string | null;
  size?: number;
  opacity?: number;
  onHover?: (point: HoveredPoint | null) => void;
  onSelect?: (index: number) => void;
}

/** The point cloud itself, shared by the interactive galaxy and the hero backdrop. */
export function CloudPoints({ map, highlight = null, size = 0.022, opacity = 0.9, onHover, onSelect }: CloudPointsProps) {
  const positions = useMemo(() => new Float32Array(map.positions), [map]);

  const colors = useMemo(() => {
    const array = new Float32Array(map.count * 3);
    const color = new THREE.Color();
    for (let index = 0; index < map.count; index++) {
      const repo = map.repos[map.repoIndex[index]!];
      const isDimmed = highlight !== null && repo?.id !== highlight;
      color.set(isDimmed ? DIMMED : repoColor(repo?.id ?? "", map.repoIndex[index]!));
      color.toArray(array, index * 3);
    }
    return array;
  }, [map, highlight]);

  const handleMove = onHover
    ? (event: ThreeEvent<PointerEvent>) => {
        if (event.index === undefined) return;
        event.stopPropagation();
        onHover({ index: event.index, x: event.nativeEvent.offsetX, y: event.nativeEvent.offsetY });
      }
    : undefined;

  return (
    <points
      onPointerMove={handleMove}
      onPointerOut={onHover ? () => onHover(null) : undefined}
      onClick={onSelect ? (event: ThreeEvent<MouseEvent>) => event.index !== undefined && onSelect(event.index) : undefined}
    >
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        {/* Re-created when the highlight changes, which is cheap for a few thousand points. */}
        <bufferAttribute key={highlight ?? "all"} attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={size} vertexColors sizeAttenuation transparent opacity={opacity} depthWrite={false} />
    </points>
  );
}
