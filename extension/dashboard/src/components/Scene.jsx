import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import MoodOrb from './MoodOrb.jsx';
import Terrain from './Terrain.jsx';
import Particles from './Particles.jsx';

export default function Scene({ allTimeLog, dominantCategory, avgEmotion }) {
  return (
    <Canvas
      camera={{ position: [0, 1, 7], fov: 55 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: '#080b14' }}
    >
      <fog attach="fog" args={['#080b14', 8, 22]} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[3, 5, 3]} intensity={0.8} color="#c0d8ff" />
      <directionalLight position={[-4, 2, -2]} intensity={0.3} color="#ff8060" />

      <Suspense fallback={null}>
        <MoodOrb dominantCategory={dominantCategory} avgEmotion={avgEmotion} />
        <Terrain allTimeLog={allTimeLog} />
        <Particles allTimeLog={allTimeLog} />
      </Suspense>

      <EffectComposer>
        <Bloom
          luminanceThreshold={0.6}
          luminanceSmoothing={0.9}
          intensity={0.8}
        />
      </EffectComposer>
    </Canvas>
  );
}
