import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { EmbeddingMap } from "../types";
import { CloudPoints } from "./CloudPoints";

const DRIFT_PER_SECOND = 0.045;
/** How far the cloud leans towards the pointer, in radians and world units. */
const LEAN = 0.22;
const SHIFT = 0.28;

function Drift({ interactive, children }: { interactive: boolean; children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    const group3d = group.current;
    if (!group3d) return;
    group3d.rotation.y += delta * DRIFT_PER_SECOND;
    if (!interactive) return;
    // Ease towards the pointer rather than snapping, so the motion stays calm.
    group3d.rotation.x = THREE.MathUtils.lerp(group3d.rotation.x, state.pointer.y * LEAN, 0.04);
    group3d.position.x = THREE.MathUtils.lerp(group3d.position.x, state.pointer.x * SHIFT, 0.04);
  });
  return <group ref={group}>{children}</group>;
}

/** The ambient backdrop behind the home page headline: no controls, no hit-testing, just motion. */
export default function HeroGalaxy({ map, interactive }: { map: EmbeddingMap; interactive: boolean }) {
  return (
    <Canvas camera={{ position: [0, 0, 2.4], fov: 55 }} dpr={[1, 1.75]} gl={{ alpha: true, antialias: true }}>
      <Drift interactive={interactive}>
        <CloudPoints map={map} size={0.019} opacity={0.75} />
      </Drift>
    </Canvas>
  );
}
