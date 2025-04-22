import React from 'react';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

type TestCharacterProps = {
  position?: [number, number, number];
  scale?: [number, number, number];
  rotation?: [number, number, number];
} & React.JSX.IntrinsicElements['group'];

export function TestCharacter(props: TestCharacterProps) {
  const group = useRef<THREE.Group>(null);
  const boxRef = useRef<THREE.Mesh>(null);
  
  // Simple animation
  useFrame((state, delta) => {
    if (boxRef.current) {
      boxRef.current.rotation.y += delta;
    }
  });
  
  return (
    <group ref={group} {...props}>
      {/* Body */}
      <mesh ref={boxRef} position={[0, 1.5, 0]}>
        <boxGeometry args={[1, 1.5, 0.5]} />
        <meshStandardMaterial color="blue" />
      </mesh>
      
      {/* Head */}
      <mesh position={[0, 2.5, 0]}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial color="pink" />
      </mesh>
      
      {/* Base/feet */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 0.5, 16]} />
        <meshStandardMaterial color="darkblue" />
      </mesh>
      
      {/* Debug text to show position */}
      <mesh position={[0, 3.5, 0]} rotation={[0, -Math.PI / 4, 0]}>
        <planeGeometry args={[2, 0.5]} />
        <meshBasicMaterial color="white" transparent opacity={0.8} />
        <primitive object={new THREE.Group()} />
      </mesh>
    </group>
  );
} 