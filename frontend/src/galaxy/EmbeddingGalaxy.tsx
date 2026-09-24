import { Line, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { EmbeddingMap } from "../types";
import { CloudPoints, type HoveredPoint } from "./CloudPoints";
import { Starfield } from "./Starfield";

const ROTATION_PER_SECOND = 0.05;

export type { HoveredPoint };

export interface GalaxyQuery {
  position: [number, number, number];
  neighbourPositions: [number, number, number][];
}

interface GalaxyProps {
  map: EmbeddingMap;
  highlight: string | null;
  autoRotate: boolean;
  /** A live question placed in the same space, with lines to what it retrieved. */
  query: GalaxyQuery | null;
  onHover: (point: HoveredPoint | null) => void;
  onSelect: (index: number) => void;
}

/** The question itself: a pulsing white star, tied by light to the chunks it pulled. */
function QueryMarker({ query }: { query: GalaxyQuery }) {
  const star = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (star.current) star.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 3) * 0.18);
  });

  return (
    <group>
      {query.neighbourPositions.map((position, index) => (
        <Line
          key={`line-${index}`}
          points={[query.position, position]}
          color="#22d3ee"
          lineWidth={1}
          transparent
          opacity={0.55}
        />
      ))}
      {query.neighbourPositions.map((position, index) => (
        <mesh key={`neighbour-${index}`} position={position}>
          <sphereGeometry args={[0.035, 12, 12]} />
          <meshBasicMaterial color="#22d3ee" />
        </mesh>
      ))}
      <mesh ref={star} position={query.position}>
        <sphereGeometry args={[0.055, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

function Spin({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (enabled && group.current) group.current.rotation.y += delta * ROTATION_PER_SECOND;
  });
  return <group ref={group}>{children}</group>;
}

/** The explorable view: drag to rotate, scroll to zoom, hover for details, click to select a chunk. */
export default function EmbeddingGalaxy({ map, highlight, autoRotate, query, onHover, onSelect }: GalaxyProps) {
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
        {query && <QueryMarker query={query} />}
      </Spin>
      <OrbitControls enablePan={false} enableDamping minDistance={1.3} maxDistance={7} />
    </Canvas>
  );
}
