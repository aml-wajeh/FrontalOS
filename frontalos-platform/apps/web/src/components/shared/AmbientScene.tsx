"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * components/shared/AmbientScene.tsx
 *
 * A quiet, corner-anchored WebGL backdrop shared by every portal dashboard
 * (Doctor/Parent/Patient/School/Admin) so the "one platform" 3D language
 * from the marketing Hero (see components/marketing/HeroScene.tsx) doesn't
 * stop the moment someone logs in. This is intentionally NOT the marketing
 * scene turned down — it's simpler (no lines/core/orbit), lower-opacity,
 * and purely decorative: it never has scroll-linked or pointer-linked
 * motion, so it can't distract from clinical/dashboard content.
 *
 * Motion is entirely driven by the `intensity` prop, which AmbientBackdrop
 * derives from the persona's existing PERSONA_THEME.motion setting:
 *   - "subtle"  (Parent portal)  -> slow drift, small amplitude
 *   - "playful" (Patient portal) -> slightly larger, warmer drift
 * "none" (Doctor/School/Admin) and prefers-reduced-motion never reach this
 * component at all — AmbientBackdrop renders AmbientSceneFallback (a fully
 * static SVG) for those instead, so no WebGL/animation cost is paid where
 * professional-calm / accessibility requires it.
 */

interface AmbientSceneProps {
  primaryColor: string;
  secondaryColor: string;
  intensity: "subtle" | "playful";
}

function DriftingCluster({ primaryColor, secondaryColor, intensity }: AmbientSceneProps) {
  const groupRef = useRef<THREE.Group>(null);
  const amplitude = intensity === "playful" ? 0.35 : 0.18;
  const speed = intensity === "playful" ? 0.22 : 0.14;

  const shapes = useMemo(
    () => [
      { position: [1.6, 0.6, 0], scale: 0.62, color: primaryColor, offset: 0 },
      { position: [0.5, -0.8, -0.6], scale: 0.4, color: secondaryColor, offset: 1.4 },
      { position: [2.3, -0.4, -1.1], scale: 0.28, color: secondaryColor, offset: 2.7 },
      { position: [1.1, 1.2, -0.8], scale: 0.22, color: primaryColor, offset: 4.1 },
    ],
    [primaryColor, secondaryColor]
  );

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (!groupRef.current) return;
    groupRef.current.rotation.y = t * speed * 0.3;
    groupRef.current.children.forEach((child, i) => {
      const shape = shapes[i];
      if (!shape) return;
      child.position.y = shape.position[1] + Math.sin(t * speed + shape.offset) * amplitude;
      child.rotation.x = t * speed * 0.4 + shape.offset;
      child.rotation.z = t * speed * 0.25;
    });
  });

  return (
    <group ref={groupRef}>
      {shapes.map((shape, i) => (
        <mesh key={i} position={shape.position as [number, number, number]} scale={shape.scale}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={shape.color}
            transparent
            opacity={0.34}
            roughness={0.55}
            metalness={0.1}
            wireframe={i % 2 === 1}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Rendered only by AmbientBackdrop, only on the client, only once WebGL
 * support + viewport + prefers-reduced-motion have all been checked.
 */
export function AmbientScene({ primaryColor, secondaryColor, intensity }: AmbientSceneProps) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 5], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      style={{ pointerEvents: "none" }}
    >
      <ambientLight intensity={0.7} />
      <pointLight position={[3, 2, 4]} intensity={18} color={primaryColor} />
      <DriftingCluster primaryColor={primaryColor} secondaryColor={secondaryColor} intensity={intensity} />
    </Canvas>
  );
}
