import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { categoryColor } from '../utils.js';

export default function Terrain({ allTimeLog }) {
  const meshRef = useRef();
  const progressRef = useRef(0); // 0→1 animation progress

  // Build 24-slot hourly data from allTimeLog.
  const hourlyData = useMemo(() => {
    const data = Array.from({ length: 24 }, () => ({ score: 0, category: 'Other', count: 0 }));
    allTimeLog.forEach((item) => {
      if (!item.captured_at) return;
      try {
        const hour = new Date(item.captured_at).getHours();
        const score = item.scores?.high_emotion ?? (item.category === 'High-Emotion / Rage-Bait' ? 0.9 : 0.2);
        const slot = data[hour];
        slot.score = (slot.score * slot.count + score) / (slot.count + 1);
        slot.count++;
        slot.category = item.category ?? 'Other';
      } catch {}
    });
    return data;
  }, [allTimeLog]);

  const SEGS_W = 23; // 24 columns (0-23 hours)
  const SEGS_D = 3;

  // Initialise the color attribute (PlaneGeometry doesn't have one by default).
  useEffect(() => {
    if (!meshRef.current) return;
    const geo = meshRef.current.geometry;
    const n = geo.attributes.position.count;
    const colors = new Float32Array(n * 3).fill(0.3);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    progressRef.current = 0; // re-trigger rise animation
  }, [hourlyData]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    progressRef.current = Math.min(progressRef.current + delta * 0.7, 1);
    const prog = progressRef.current;

    const geo = meshRef.current.geometry;
    const pos = geo.attributes.position;
    const col = geo.attributes.color;
    if (!col) return; // not yet initialised

    const vertsPerRow = SEGS_W + 1;
    for (let xi = 0; xi <= SEGS_W; xi++) {
      const hour = xi; // 0-23
      const targetH = hourlyData[hour]?.score ?? 0;
      const color = new THREE.Color(categoryColor(hourlyData[hour]?.category ?? 'Other'));

      for (let zi = 0; zi <= SEGS_D; zi++) {
        const idx = zi * vertsPerRow + xi;
        pos.setY(idx, targetH * 2.5 * prog);
        col.setXYZ(idx, color.r, color.g, color.b);
      }
    }

    pos.needsUpdate = true;
    col.needsUpdate = true;
    geo.computeVertexNormals();
  });

  return (
    <mesh ref={meshRef} position={[0, -2.2, -3]} rotation={[0, 0, 0]}>
      <planeGeometry args={[14, 3, SEGS_W, SEGS_D]} />
      <meshLambertMaterial vertexColors side={THREE.DoubleSide} />
    </mesh>
  );
}
