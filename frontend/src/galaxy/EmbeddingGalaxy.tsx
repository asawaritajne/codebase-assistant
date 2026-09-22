import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { repoColor } from "../lib/repoColors";
import type { EmbeddingMap } from "../types";

/** Points not belonging to the highlighted repository fade into the background. */
const DIMMED = new THREE.Color("#1e293b");
const ROTATION_PER_SECOND = 0.06;

export interface HoveredPoint {
  index: number;
  x: number;
  y: number;
}

interface GalaxyProps {
  map: EmbeddingMap;
  /** Repository id to highlight, or null to show them all. */
  highlight: string | null;
  autoRotate: boolean;
  onHover: (point: HoveredPoint | null) => void;
  onSelect: (index: number) => void;
}

function Cloud({ map, highlight, onHover, onSelect }: Omit<GalaxyProps, "autoRotate">) {
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

  const handleMove = (event: ThreeEvent<PointerEvent>) => {
    if (event.index === undefined) return;
    event.stopPropagation();
    onHover({ index: event.index, x: event.nativeEvent.offsetX, y: event.nativeEvent.offsetY });
  };

  return (
    <points
      onPointerMove={handleMove}
      onPointerOut={() => onHover(null)}
      onClick={(event: ThreeEvent<MouseEvent>) => event.index !== undefined && onSelect(event.index)}
    >
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        {/* Re-created when the highlight changes, which is cheap for a few thousand points. */}
        <bufferAttribute key={highlight ?? "all"} attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.022} vertexColors sizeAttenuation transparent opacity={0.9} depthWrite={false} />
    </points>
  );
}

function Spin({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (enabled && group.current) group.current.rotation.y += delta * ROTATION_PER_SECOND;
  });
  return <group ref={group}>{children}</group>;
}

export default function EmbeddingGalaxy({ map, highlight, autoRotate, onHover, onSelect }: GalaxyProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 3.1], fov: 50 }}
      dpr={[1, 2]}
      // Points are infinitely thin, so the ray needs a radius to catch them on hover.
      onCreated={({ raycaster }) => {
        raycaster.params.Points = { threshold: 0.03 };
      }}
    >
      <color attach="background" args={["#020617"]} />
      <Spin enabled={autoRotate}>
        <Cloud map={map} highlight={highlight} onHover={onHover} onSelect={onSelect} />
      </Spin>
      <OrbitControls enablePan={false} enableDamping minDistance={1.4} maxDistance={6} />
    </Canvas>
  );
}
