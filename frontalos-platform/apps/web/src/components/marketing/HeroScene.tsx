"use client";

import { useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";

const TEAL = "#00C2A8";
const AMBER = "#F4A261";
const NAVY = "#2C375C";

/** Evenly distribute `count` points on a sphere of the given radius. */
function fibonacciSphere(count: number, radius: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = goldenAngle * i;
    points.push(new THREE.Vector3(Math.cos(theta) * r * radius, y * radius, Math.sin(theta) * r * radius));
  }
  return points;
}

interface NeuralFormProps {
  scrollProgress: MutableRefObject<number>;
}

function NeuralForm({ scrollProgress }: NeuralFormProps) {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);

  const nodePositions = useMemo(() => fibonacciSphere(9, 2.5), []);

  const lineGeometry = useMemo(() => {
    const positions: number[] = [];
    nodePositions.forEach((p) => {
      positions.push(0, 0, 0, p.x, p.y, p.z);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
  }, [nodePositions]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const { pointer } = state;

    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.09 + pointer.x * 0.35 + scrollProgress.current * Math.PI * 0.6;
      groupRef.current.rotation.x = pointer.y * 0.18 + Math.sin(t * 0.25) * 0.06;
      groupRef.current.position.y = Math.sin(t * 0.4) * 0.12 - scrollProgress.current * 0.6;
    }
    if (coreRef.current) {
      const pulse = 1 + Math.sin(t * 1.4) * 0.04;
      coreRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group ref={groupRef}>
      {/* Wireframe core — the "unifying platform" at the center */}
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[1.35, 1]} />
        <meshBasicMaterial color={TEAL} wireframe transparent opacity={0.45} />
      </mesh>

      {/* Connecting lines from core to each orbiting node */}
      <lineSegments geometry={lineGeometry}>
        <lineBasicMaterial color={NAVY} transparent opacity={0.35} />
      </lineSegments>

      {/* Orbiting nodes — alternating teal/amber, referencing the three portals */}
      {nodePositions.map((pos, i) => (
        <mesh key={i} position={pos}>
          <icosahedronGeometry args={[0.16, 0]} />
          <meshStandardMaterial
            color={i % 3 === 0 ? AMBER : TEAL}
            emissive={i % 3 === 0 ? AMBER : TEAL}
            emissiveIntensity={0.6}
            roughness={0.4}
          />
        </mesh>
      ))}

      <Sparkles count={60} scale={5.5} size={2.2} speed={0.25} color={TEAL} opacity={0.5} />
    </group>
  );
}

interface HeroSceneProps {
  scrollProgress: MutableRefObject<number>;
}

/**
 * WebGL hero scene. Rendered only on desktop/tablet viewports with no
 * `prefers-reduced-motion` — see Hero.tsx for the fallback swap logic.
 */
export function HeroScene({ scrollProgress }: HeroSceneProps) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 6.2], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ pointerEvents: "none" }}
    >
      <ambientLight intensity={0.6} />
      <pointLight position={[4, 4, 4]} intensity={40} color={TEAL} />
      <pointLight position={[-4, -3, -2]} intensity={20} color={AMBER} />
      <NeuralForm scrollProgress={scrollProgress} />
    </Canvas>
  );
}
