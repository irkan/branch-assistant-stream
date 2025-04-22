import * as THREE from 'three'
import React, { useRef, useEffect, useState } from 'react'
import { useGLTF, useFBX } from '@react-three/drei'
import { useFrame, useGraph, useThree } from '@react-three/fiber'
import { SkeletonUtils } from 'three-stdlib'

type AnimatedCharacterProps = {
  position?: [number, number, number];
  scale?: [number, number, number];
  rotation?: [number, number, number];
  lipSyncValue?: number;
} & React.JSX.IntrinsicElements['group'];

export function AnimatedCharacter(props: AnimatedCharacterProps) {
  const group = useRef<THREE.Group>(null)
  const modelRef = useRef<THREE.Object3D | null>(null)
  const meshRef = useRef<THREE.SkinnedMesh | null>(null)
  
  // Animation action references
  const standActionRef = useRef<THREE.AnimationAction | null>(null)
  const talkActionRef = useRef<THREE.AnimationAction | null>(null)
  
  // Load model
  const { scene } = useGLTF('/models/ayla/Ayla.glb')
  
  // Clone the scene for animations
  const clone = React.useMemo(() => SkeletonUtils.clone(scene), [scene])
  
  // Load animations - use .glb instead of .fbx
  const standMotion = useGLTF('/models/ayla/Ayla_Stand_Motion.glb')
  const talkMotion = useGLTF('/models/ayla/Ayla_Talk_Motion.glb')
  const talkMotion1 = useGLTF('/models/ayla/Ayla_Talk_Motion1.glb')
  
  // Animation related refs
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const [isModelReady, setIsModelReady] = useState(false)
  
  // Modelin yüklənməsini izləməyə kömək edəcək bir state
  useEffect(() => {
    if (clone) {
      // Modeli tapmaq
      console.log('Character model loaded, searching for morph targets...')
      
      clone.traverse((object: any) => {
        if (object.isMesh && object.morphTargetDictionary) {
          meshRef.current = object as THREE.SkinnedMesh
          modelRef.current = object
          setIsModelReady(true)
        }
      })
    }
  }, [clone])
  
  // Setup animation with the GLB animations
  useEffect(() => {
    if (!clone) return
    
    // Create a mixer connected to the cloned scene
    const mixer = new THREE.AnimationMixer(clone)
    mixerRef.current = mixer
    
    // Prepare all animations
    let standAnim: THREE.AnimationClip | null = null
    let talkAnim: THREE.AnimationClip | null = null
    
    // Sakin duruş animasiyası
    if (standMotion.animations && standMotion.animations.length > 0) {
      standAnim = standMotion.animations[0]
      console.log('Standing animation loaded')
    }
    
    // Danışma animasiyası
    if (talkMotion.animations && talkMotion.animations.length > 0) {
      talkAnim = talkMotion.animations[0]
      console.log('Talking animation loaded')
    } else if (talkMotion1.animations && talkMotion1.animations.length > 0) {
      // Alternativ danışma animasiyası
      talkAnim = talkMotion1.animations[0]
      console.log('Talking animation 1 loaded')
    }
    
    // Sakin duruş actionu
    if (standAnim) {
      const standAction = mixer.clipAction(standAnim)
      standAction.loop = THREE.LoopRepeat
      standAction.clampWhenFinished = false
      standAction.timeScale = 1.0
      standAction.play()
      standActionRef.current = standAction
    }
    
    // Danışma actionu
    if (talkAnim) {
      const talkAction = mixer.clipAction(talkAnim)
      talkAction.loop = THREE.LoopRepeat
      talkAction.clampWhenFinished = false
      talkAction.timeScale = 1.5 // Biraz daha sürətli danışma
      talkAction.setEffectiveWeight(0) // Başlanğıcda 0 ağırlıq
      talkAction.play()
      talkActionRef.current = talkAction
      
      console.log('Talk animation action prepared with weight 0')
    }
    
    return () => {
      mixer.stopAllAction()
    }
  }, [clone, standMotion.animations, talkMotion.animations, talkMotion1.animations])
  
  // Update animation in frame loop - lip sync dəyərinə görə animasiyaları qarışdıraq
  useFrame((state, delta) => {
    // Update animation mixer
    if (mixerRef.current) {
      mixerRef.current.update(delta)
    }
    
    // Lip sync dəyəri varsa animasiyaları qarışdıraq
    if (standActionRef.current && talkActionRef.current && typeof props.lipSyncValue === 'number') {
      // Danışma animasiyası üçün ağırlığı hesablayın
      // Səs səviyyəsi arıqca danışma animasiyası daha çox görünəcək
      let talkWeight = props.lipSyncValue;
      
      // Səlis keçid üçün interpolasiya edək
      const currentTalkWeight = talkActionRef.current.getEffectiveWeight();
      const targetTalkWeight = talkWeight;
      
      // Hamar keçid üçün LERP (xətti interpolasiya)
      const newTalkWeight = THREE.MathUtils.lerp(currentTalkWeight, targetTalkWeight, 0.25);
      
      // Danışma actionunun ağırlığını təyin edək
      talkActionRef.current.setEffectiveWeight(newTalkWeight);
      
      // Sakin duruş actionunun ağırlığını tərs olaraq təyin edək (ikisi birlikdə 1.0 olmalıdır)
      standActionRef.current.setEffectiveWeight(1.0 - newTalkWeight);
      
      // Loqlar - nadir hallarda göstərmək üçün
      if (Math.random() < 0.005) {
        console.log(`Animation weights - Stand: ${standActionRef.current.getEffectiveWeight().toFixed(2)}, Talk: ${talkActionRef.current.getEffectiveWeight().toFixed(2)}, LipSync value: ${props.lipSyncValue.toFixed(2)}`);
      }
    }
    
    // Morph targetləri də eyni zamanda tətbiq edək - lip sync dəyərinə görə
    if (isModelReady && meshRef.current && typeof props.lipSyncValue === 'number') {
      const mesh = meshRef.current
      
      // Model spesifik morph target-lər
      const jawOpenIndex = mesh.morphTargetDictionary?.["Jaw_Open"] ?? -1;
      const vOpenIndex = mesh.morphTargetDictionary?.["V_Open"] ?? -1;
      
      // Lip sync dəyəri
      const lipSyncValue = props.lipSyncValue || 0;
      
      // Çənə açılması
      if (jawOpenIndex !== -1 && mesh.morphTargetInfluences) {
        const currentValue = mesh.morphTargetInfluences[jawOpenIndex] || 0;
        const targetValue = lipSyncValue * 0.8; // 80% maksimum 
        mesh.morphTargetInfluences[jawOpenIndex] = THREE.MathUtils.lerp(currentValue, targetValue, 0.2);
      }
      
      // Ağız açılması
      if (vOpenIndex !== -1 && mesh.morphTargetInfluences) {
        const currentValue = mesh.morphTargetInfluences[vOpenIndex] || 0;
        const targetValue = lipSyncValue * 0.6; // 60% maksimum
        mesh.morphTargetInfluences[vOpenIndex] = THREE.MathUtils.lerp(currentValue, targetValue, 0.2);
      }
    }
  })
  
  return (
    <group ref={group} {...props}>
      <primitive object={clone} />
    </group>
  )
}

// Declare missing type on window
declare global {
  interface Window {
    mouthMorphTargetWarningLogged?: boolean;
  }
}

// Preload model
useGLTF.preload('/models/ayla/Ayla.glb')
useGLTF.preload('/models/ayla/Ayla_Stand_Motion.glb')
useGLTF.preload('/models/ayla/Ayla_Talk_Motion.glb')
useGLTF.preload('/models/ayla/Ayla_Talk_Motion1.glb') 