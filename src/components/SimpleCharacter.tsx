import * as THREE from 'three'
import React, { useRef, useEffect } from 'react'
import { useGLTF, useFBX } from '@react-three/drei'
import { useFrame, useGraph } from '@react-three/fiber'
import { SkeletonUtils } from 'three-stdlib'

type SimpleCharacterProps = {
  position?: [number, number, number];
  scale?: [number, number, number];
  rotation?: [number, number, number];
} & React.JSX.IntrinsicElements['group'];

export function SimpleCharacter(props: SimpleCharacterProps) {
  const group = useRef<THREE.Group>(null)
  
  // Load model
  const { scene, animations } = useGLTF('/models/ayla/Ayla.glb')
  
  // Create a clone to work with
  const clone = React.useMemo(() => SkeletonUtils.clone(scene), [scene])
  
  // Load stand animation
  const standFBX = useFBX('/models/ayla/Ayla_Stand_Motion.Fbx')
  
  // Set up animation mixer and action
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const actionRef = useRef<THREE.AnimationAction | null>(null)
  
  // Initialize animation
  useEffect(() => {
    if (!group.current) return
    
    console.log('Setting up animation mixer and action')
    
    // Find the armature in the model
    const armature = clone.getObjectByName('Armature');
    if (!armature) {
      console.error('Could not find Armature in the model');
      return;
    }
    
    console.log('Found Armature:', armature);
    
    // Create mixer attached to the armature
    const mixer = new THREE.AnimationMixer(armature);
    mixerRef.current = mixer;
    
    // Prepare FBX animation
    const standAnim = standFBX.animations[0]
    standAnim.name = 'Stand'
    
    // Log animation details for debugging
    console.log('Stand animation:', {
      name: standAnim.name,
      duration: standAnim.duration,
      tracks: standAnim.tracks.length
    })
    
    // Process animation tracks to match bone names
    standAnim.tracks = standAnim.tracks.map(track => {
      // Extract bone name from track
      const parts = track.name.split('.');
      // Skip scale tracks
      if (parts[1]?.includes('scale')) return null;
      
      // Map FBX bone names to glTF model bone names if needed
      const boneMappings: Record<string, string> = {
        'RootNode': 'CC_Base_BoneRoot',
        'Root': 'CC_Base_BoneRoot',
        'Hips': 'CC_Base_Hip',
        'Spine': 'CC_Base_Spine01',
        // Add more mappings as needed
      };
      
      // Remap bone name if needed
      if (boneMappings[parts[0]]) {
        parts[0] = boneMappings[parts[0]];
      }
      
      // Create new track name
      const newName = `${parts[0]}.${parts[1]}`;
      if (newName !== track.name) {
        console.log(`Remapped track: ${track.name} -> ${newName}`);
        track.name = newName;
      }
      
      return track;
    }).filter(Boolean) as THREE.KeyframeTrack[];
    
    // Create and configure action
    const standAction = mixer.clipAction(standAnim);
    standAction.loop = THREE.LoopRepeat;
    standAction.timeScale = 0.8; // Slower for more natural motion
    standAction.play();
    
    actionRef.current = standAction;
    
    return () => {
      // Clean up on unmount
      mixer.stopAllAction();
    }
  }, [standFBX, clone, group]);
  
  // Update animation in each frame
  useFrame((state, delta) => {
    // Update animation mixer
    if (mixerRef.current) {
      mixerRef.current.update(delta)
    }
    
    // Simple breathing animation as fallback
    if (group.current) {
      // Tiny breathing motion (will be subtle compared to the actual animation)
      group.current.position.y = Math.sin(state.clock.elapsedTime) * 0.01 + (props.position?.[1] || 0);
    }
  })
  
  return (
    <group ref={group} {...props}>
      <primitive object={clone} />
      
      {/* Debug marker to confirm component is rendering */}
      <mesh position={[0, 2, 0]} scale={[0.2, 0.2, 0.2]}>
        <sphereGeometry />
        <meshStandardMaterial color="red" />
      </mesh>
    </group>
  )
}

// Preload assets
useGLTF.preload('/models/ayla/Ayla.glb') 