import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { EmbeddingMap } from "../types";
import { CloudPoints, type HoveredPoint } from "./CloudPoints";
import { Starfield } from "./Starfield";

const ROTATION_PER_SECOND = 0.05;

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

/** The explorable view: drag to rotate, scroll to zoom, hover for details, click to select a chunk. */
export default function EmbeddingGalaxy({ map, highlight, autoRotate, onHover, onSelect }: GalaxyProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 3.1], fov: 50 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
      // Points are infinitely thin, so the ray needs a radius to catch them on hover.
      onCreated={({ raycaster, scene }) => {
        raycaster.params.Points = { threshold: 0.035 };
        scene.fog = new THREE.FogExp2("#05060f", 0.12);
      }}
    >
      <color attach="background" args={["#05060f"]} />
      <Starfield />
      <Spin enabled={autoRotate}>
        <CloudPoints map={map} highlight={highlight} onHover={onHover} onSelect={onSelect} />
      </Spin>
      <OrbitControls enablePan={false} enableDamping minDistance={1.3} maxDistance={7} />
    </Canvas>
  );
}
