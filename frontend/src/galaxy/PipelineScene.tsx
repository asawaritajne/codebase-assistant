import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const STAGE_COLORS = ["#22d3ee", "#6366f1", "#8b5cf6", "#fb7185"];
const SPACING = 1.5;
/** How many motes ride the busiest leg; quieter legs carry proportionally fewer. */
const MAX_PACKETS_PER_LEG = 9;

function stageX(index: number, total: number) {
  return (index - (total - 1) / 2) * SPACING;
}

/** Motes per leg, from the share of data that survives into the stage the leg feeds. */
const packetsForLeg = (weights: number[], leg: number) =>
  Math.max(1, Math.round((weights[leg + 1] ?? 0.3) * MAX_PACKETS_PER_LEG));

/**
 * One stage of the pipeline. Its size is the amount of data the stage holds — the whole index at
 * the search step, a handful of sources at the answer step — so the shapes narrow as the pipeline
 * does. Dimming the others when one is hovered ties a sphere to its caption.
 */
function Stage({
  x,
  color,
  weight,
  active,
  dimmed,
  onHover,
}: {
  x: number;
  color: string;
  weight: number;
  active: boolean;
  dimmed: boolean;
  onHover: (hovering: boolean) => void;
}) {
  const shell = useRef<THREE.Mesh>(null);
  const group = useRef<THREE.Group>(null);
  const radius = 0.2 + weight * 0.26;

  useFrame((state, delta) => {
    if (!shell.current || !group.current) return;
    // A busy stage turns faster, and the hovered one faster still.
    const speed = 0.18 + weight * 0.3 + (active ? 0.5 : 0);
    shell.current.rotation.x += delta * speed * 0.7;
    shell.current.rotation.y += delta * speed;
    group.current.position.y = Math.sin(state.clock.elapsedTime * 0.8 + x) * 0.06;

    const target = active ? 1.18 : 1;
    const scale = THREE.MathUtils.lerp(group.current.scale.x, target, 0.12);
    group.current.scale.setScalar(scale);

    const shellMaterial = shell.current.material as THREE.MeshBasicMaterial;
    const shellTarget = dimmed ? 0.14 : active ? 1 : 0.85;
    shellMaterial.opacity = THREE.MathUtils.lerp(shellMaterial.opacity, shellTarget, 0.12);
  });

  return (
    <group ref={group} position={[x, 0, 0]}>
      {/* A generous invisible target, so the small spheres are still easy to point at. */}
      <mesh
        onPointerOver={(event) => {
          event.stopPropagation();
          onHover(true);
        }}
        onPointerOut={() => onHover(false)}
        visible={false}
      >
        <sphereGeometry args={[Math.max(radius, 0.34) * 1.5, 8, 8]} />
      </mesh>
      <mesh ref={shell}>
        {/* More facets where more data passes through. */}
        <icosahedronGeometry args={[radius, weight > 0.6 ? 2 : 1]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.85} />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius * 0.38, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={dimmed ? 0.2 : 0.95} />
      </mesh>
    </group>
  );
}

/** Chunks travelling between stages: dense where thousands move, sparse where only an answer does. */
function Packets({ total, weights }: { total: number; weights: number[] }) {
  const group = useRef<THREE.Group>(null);
  const motes = useMemo(() => {
    const list: { leg: number; phase: number; drift: number }[] = [];
    for (let leg = 0; leg < total - 1; leg += 1) {
      const count = packetsForLeg(weights, leg);
      for (let index = 0; index < count; index += 1) {
        list.push({ leg, phase: index / count, drift: (index % 3) - 1 });
      }
    }
    return list;
  }, [total, weights]);

  useFrame((state) => {
    if (!group.current) return;
    group.current.children.forEach((packet, index) => {
      const { leg, phase, drift } = motes[index]!;
      const progress = (state.clock.elapsedTime * 0.35 + phase) % 1;
      const from = stageX(leg, total);
      const to = stageX(leg + 1, total);
      packet.position.x = from + (to - from) * progress;
      // Motes bow away from the rail and converge back onto the next stage.
      packet.position.y = Math.sin(progress * Math.PI) * 0.12 * drift;
      const material = (packet as THREE.Mesh).material as THREE.MeshBasicMaterial;
      material.opacity = Math.sin(progress * Math.PI) * 0.9;
    });
  });

  return (
    <group ref={group}>
      {motes.map(({ leg, phase }) => (
        <mesh key={`${leg}-${phase}`}>
          <sphereGeometry args={[0.04, 8, 8]} />
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
export default function PipelineScene({
  stages = 4,
  weights,
  active = null,
  onHover,
}: {
  stages?: number;
  /** Share of the data at each stage, 0 to 1, in stage order. */
  weights: number[];
  active?: number | null;
  onHover?: (index: number | null) => void;
}) {
  return (
    <Canvas camera={{ position: [0, 0.35, 4.2], fov: 45 }} dpr={[1, 1.75]} gl={{ alpha: true }}>
      <Drift>
        <Rail total={stages} />
        <Packets total={stages} weights={weights} />
        {Array.from({ length: stages }, (_, index) => (
          <Stage
            key={index}
            x={stageX(index, stages)}
            color={STAGE_COLORS[index] ?? "#22d3ee"}
            weight={weights[index] ?? 0.5}
            active={active === index}
            dimmed={active !== null && active !== index}
            onHover={(hovering) => onHover?.(hovering ? index : null)}
          />
        ))}
      </Drift>
    </Canvas>
  );
}
