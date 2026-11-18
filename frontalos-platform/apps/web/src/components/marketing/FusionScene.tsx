"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Sparkles, Stars } from "@react-three/drei";
import * as THREE from "three";

const TEAL = "#00C2A8";
const AMBER = "#F4A261";
const NAVY = "#2C375C";

/**
 * Two distinct forms — a soft, organic "structural" sphere (MRI) and a
 * faceted wireframe icosahedron (behavioral signal) — drifting toward and
 * around a shared center, joined by a thin connecting beam. Visual metaphor
 * for the platform's core claim: MRI + behavioral-AI fusion into one model.
 */
function FusionCore() {
  const groupRef = useRef<THREE.Group>(null);
  const structuralRef = useRef<THREE.Mesh>(null);
  const behavioralRef = useRef<THREE.Mesh>(null);
  const beamRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const { pointer } = state;

    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.1 + pointer.x * 0.25;
      groupRef.current.rotation.x = pointer.y * 0.12;
    }
    if (structuralRef.current) {
      structuralRef.current.position.x = -1.15 + Math.sin(t * 0.5) * 0.08;
      structuralRef.current.position.y = Math.cos(t * 0.4) * 0.05;
    }
    if (behavioralRef.current) {
      behavioralRef.current.position.x = 1.15 - Math.sin(t * 0.5) * 0.08;
      behavioralRef.current.rotation.y = t * 0.4;
      behavioralRef.current.rotation.z = t * 0.15;
    }
    if (beamRef.current) {
      const material = beamRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.25 + Math.sin(t * 1.6) * 0.12;
    }
  });

  return (
    <group ref={groupRef}>
      <Float speed={1.3} floatIntensity={0.5} rotationIntensity={0.25}>
        <mesh ref={structuralRef} position={[-1.15, 0, 0]}>
          <sphereGeometry args={[1.05, 64, 64]} />
          <MeshDistortMaterial
            color={NAVY}
            distort={0.32}
            speed={1.4}
            roughness={0.25}
            metalness={0.35}
            emissive={TEAL}
            emissiveIntensity={0.06}
          />
        </mesh>
      </Float>

      <Float speed={1.6} floatIntensity={0.55} rotationIntensity={0.2}>
        <mesh ref={behavioralRef} position={[1.15, 0, 0]}>
          <icosahedronGeometry args={[0.95, 1]} />
          <meshBasicMaterial color={TEAL} wireframe transparent opacity={0.75} />
        </mesh>
      </Float>

      {/* Connecting beam — the "fusion" between the two signals */}
      <mesh ref={beamRef} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 2.1, 8]} />
        <meshBasicMaterial color={AMBER} transparent opacity={0.3} />
      </mesh>

      <Sparkles count={90} scale={6.5} size={2} speed={0.28} color={AMBER} opacity={0.5} />
      <Stars radius={10} depth={18} count={600} factor={1.6} saturation={0} fade speed={0.4} />
    </group>
  );
}

export function FusionScene() {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 5.4], fov: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ pointerEvents: "none" }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[4, 3, 4]} intensity={45} color={TEAL} />
      <pointLight position={[-4, -2, -2]} intensity={22} color={AMBER} />
      <FusionCore />
    </Canvas>
  );
}
