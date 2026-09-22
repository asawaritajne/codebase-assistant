import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import type { EmbeddingMap } from "../types";
import { CloudPoints, type HoveredPoint } from "./CloudPoints";

const ROTATION_PER_SECOND = 0.06;

export type { HoveredPoint };

interface GalaxyProps {
  map: EmbeddingMap;
  highlight: string | null;
  autoRotate: boolean;
  onHover: (point: HoveredPoint | null) => void;
  onSelect: (index: number) => void;
}

function Spin({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (enabled && group.current) group.current.rotation.y += delta * ROTATION_PER_SECOND;
  });
  return <group ref={group}>{children}</group>;
}

/** The explorable view: drag to rotate, scroll to zoom, hover for details, click to open on GitHub. */
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
        <CloudPoints map={map} highlight={highlight} onHover={onHover} onSelect={onSelect} />
      </Spin>
      <OrbitControls enablePan={false} enableDamping minDistance={1.4} maxDistance={6} />
    </Canvas>
  );
}
