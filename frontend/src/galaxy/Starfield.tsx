import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const COUNT = 900;
const RADIUS = 9;

/** Distant, slowly turning specks that give the scene depth behind the real data. */
export function Starfield() {
  const points = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const array = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      // Spread over a sphere shell so stars never sit inside the data cloud.
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = RADIUS * (0.75 + Math.random() * 0.25);
      array[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      array[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      array[i * 3 + 2] = radius * Math.cos(phi);
    }
    return array;
  }, []);

  useFrame((_, delta) => {
    if (points.current) points.current.rotation.y -= delta * 0.01;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#8ea0d0" size={0.035} sizeAttenuation transparent opacity={0.5} depthWrite={false} />
    </points>
  );
}
