"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sparkles, Stars } from "@react-three/drei";
import type * as THREE from "three";

/**
 * Slow-drifting starfield + sparkle backdrop for the StatsBand section.
 * Purely ambient — no pointer interaction, no shadows, capped DPR — so it
 * adds visual depth behind the count-up numbers without competing with
 * them for attention.
 */
function DriftingField() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.015;
    }
  });

  return (
    <group ref={groupRef}>
      <Stars radius={14} depth={26} count={1400} factor={2.2} saturation={0} fade speed={0.4} />
      <Sparkles count={70} scale={9} size={1.8} speed={0.2} color="#00C2A8" opacity={0.35} />
    </group>
  );
}

export function StatsFieldScene() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 6], fov: 50 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      style={{ pointerEvents: "none" }}
    >
      <ambientLight intensity={0.4} />
      <DriftingField />
    </Canvas>
  );
}
