import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { categoryColor } from '../utils.js';

const MAX_PARTICLES = 500;

export default function Particles({ allTimeLog }) {
  const pointsRef = useRef();

  const items = useMemo(() => allTimeLog.slice(-MAX_PARTICLES), [allTimeLog]);

  const { positions, colors, sizes } = useMemo(() => {
    const n = items.length;
    const positions = new Float32Array(n * 3);
    const colors    = new Float32Array(n * 3);
    const sizes     = new Float32Array(n);

    items.forEach((item, i) => {
      // Spherical distribution with slight orbital bias
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 1.8 + Math.random() * 3.5;
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6;
      positions[i * 3 + 2] = r * Math.cos(phi);

      const c = new THREE.Color(categoryColor(item.category ?? 'Other'));
      colors[i * 3]     = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      const risk = item.scores?.credibility_risk ?? 0.2;
      sizes[i] = 2 + risk * 6;
    });

    return { positions, colors, sizes };
  }, [items]);

  const driftRef = useRef(Array.from({ length: items.length }, () => ({
    speed: 0.05 + Math.random() * 0.08,
    offset: Math.random() * Math.PI * 2,
    axis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
  })));

  useFrame((state) => {
    if (!pointsRef.current || items.length === 0) return;
    const pos = pointsRef.current.geometry.attributes.position;
    const t = state.clock.elapsedTime;

    items.forEach((_, i) => {
      const d = driftRef.current[i];
      if (!d) return;
      const angle = (t * d.speed + d.offset) * 0.3;
      const drift = Math.sin(angle) * 0.04;
      pos.setY(i, pos.getY(i) + drift * 0.01);
    });
    pos.needsUpdate = true;
  });

  if (items.length === 0) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color"    args={[colors,    3]} />
        <bufferAttribute attach="attributes-size"     args={[sizes,     1]} />
      </bufferGeometry>
      <pointsMaterial
        vertexColors
        sizeAttenuation
        transparent
        opacity={0.75}
        depthWrite={false}
      />
    </points>
  );
}
