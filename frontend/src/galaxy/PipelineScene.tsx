import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const STAGE_COLORS = ["#22d3ee", "#6366f1", "#8b5cf6", "#fb7185"];
const SPACING = 1.5;
const PACKETS_PER_LEG = 4;

function stageX(index: number, total: number) {
  return (index - (total - 1) / 2) * SPACING;
}

/** A wireframe node: one stage of the pipeline. */
function Stage({ x, color }: { x: number; color: string }) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((state, delta) => {
    if (!mesh.current) return;
    mesh.current.rotation.x += delta * 0.25;
    mesh.current.rotation.y += delta * 0.35;
    // Gentle bob, offset per stage so they don't move in lockstep.
    mesh.current.position.y = Math.sin(state.clock.elapsedTime * 0.8 + x) * 0.06;
  });
  return (
    <group position={[x, 0, 0]}>
      <mesh ref={mesh}>
        <icosahedronGeometry args={[0.34, 1]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.85} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.13, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

/** Data packets travelling from one stage to the next, on a loop. */
function Packets({ total }: { total: number }) {
  const group = useRef<THREE.Group>(null);
  const offsets = useMemo(
    () =>
      Array.from({ length: (total - 1) * PACKETS_PER_LEG }, (_, index) => ({
        leg: Math.floor(index / PACKETS_PER_LEG),
        phase: (index % PACKETS_PER_LEG) / PACKETS_PER_LEG,
      })),
    [total],
  );

  useFrame((state) => {
    if (!group.current) return;
    group.current.children.forEach((packet, index) => {
      const { leg, phase } = offsets[index]!;
      const progress = (state.clock.elapsedTime * 0.35 + phase) % 1;
      const from = stageX(leg, total);
      const to = stageX(leg + 1, total);
      packet.position.x = from + (to - from) * progress;
      // Fade in and out at the ends of each leg.
      const material = (packet as THREE.Mesh).material as THREE.MeshBasicMaterial;
      material.opacity = Math.sin(progress * Math.PI) * 0.9;
    });
  });

  return (
    <group ref={group}>
      {offsets.map(({ leg, phase }) => (
        <mesh key={`${leg}-${phase}`}>
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshBasicMaterial color={STAGE_COLORS[leg + 1] ?? "#8b5cf6"} transparent />
        </mesh>
      ))}
    </group>
  );
}

function Rail({ total }: { total: number }) {
  const points = useMemo(
    () => new Float32Array([stageX(0, total), 0, 0, stageX(total - 1, total), 0, 0]),
    [total],
  );
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[points, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#334066" transparent opacity={0.8} />
    </line>
  );
}

function Drift({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!group.current) return;
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, state.pointer.x * 0.35, 0.05);
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -state.pointer.y * 0.2, 0.05);
  });
  return <group ref={group}>{children}</group>;
}

/** The answering pipeline as moving 3D nodes; labels live in HTML beneath the canvas. */
export default function PipelineScene({ stages = 4 }: { stages?: number }) {
  return (
    <Canvas camera={{ position: [0, 0.35, 4.2], fov: 45 }} dpr={[1, 1.75]} gl={{ alpha: true }}>
      <Drift>
        <Rail total={stages} />
        <Packets total={stages} />
        {Array.from({ length: stages }, (_, index) => (
          <Stage key={index} x={stageX(index, stages)} color={STAGE_COLORS[index] ?? "#22d3ee"} />
        ))}
      </Drift>
    </Canvas>
  );
}
