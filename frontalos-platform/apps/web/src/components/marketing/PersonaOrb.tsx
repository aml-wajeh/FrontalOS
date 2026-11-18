"use client";

import { Canvas } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Sparkles, Sphere } from "@react-three/drei";

interface PersonaOrbProps {
  color: string;
  wireframe?: boolean;
}

/**
 * Small, self-contained WebGL canvas rendering a single distorted, floating
 * sphere in the persona's brand color. Cheap enough to run three instances
 * side by side (low poly count, capped DPR, no shadows). Only ever mounted
 * once ThreePersonas has confirmed 3D is safe to render — see use3DCapable.
 */
export function PersonaOrb({ color, wireframe = false }: PersonaOrbProps) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 3.4], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      style={{ pointerEvents: "none" }}
    >
      <ambientLight intensity={0.75} />
      <pointLight position={[2, 2, 3]} intensity={26} color={color} />
      <pointLight position={[-2, -1, -2]} intensity={10} color="#ffffff" />
      <Float speed={2.2} rotationIntensity={1.2} floatIntensity={1.6}>
        <Sphere args={[1, 48, 48]}>
          <MeshDistortMaterial
            color={color}
            distort={0.42}
            speed={2.1}
            roughness={0.15}
            metalness={0.35}
            wireframe={wireframe}
          />
        </Sphere>
      </Float>
      <Sparkles count={22} scale={3.2} size={1.6} speed={0.3} color={color} opacity={0.5} />
    </Canvas>
  );
}
