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
  phoneme?: string;
} & React.JSX.IntrinsicElements['group'];

export function AnimatedCharacter(props: AnimatedCharacterProps) {
  const group = useRef<THREE.Group>(null)
  const modelRef = useRef<THREE.Object3D | null>(null)
  const meshRef = useRef<THREE.SkinnedMesh | null>(null)
  
  // Animation action references
  const standActionRef = useRef<THREE.AnimationAction | null>(null)
  const talkActionRef = useRef<THREE.AnimationAction | null>(null)
  
  // Current phoneme state
  const [currentPhoneme, setCurrentPhoneme] = useState<string | undefined>(undefined)
  // Fonem dəyişimini izləmək üçün ref
  const prevPhonemeRef = useRef<string | undefined>(undefined)
  // Son dəfə log göstərilən zaman
  const lastLogTimeRef = useRef<number>(0)
  
  // Load model
  const { scene } = useGLTF('/models/ayla/Ayla_Viseme.glb')
  
  // Clone the scene for animations
  const clone = React.useMemo(() => SkeletonUtils.clone(scene), [scene])
  
  // Load animations - use .glb instead of .fbx
  const standMotion = useGLTF('/models/ayla/Ayla_Stand_Motion.glb')
  const talkMotion = useGLTF('/models/ayla/Ayla_Talk_Motion.glb')
  const talkMotion1 = useGLTF('/models/ayla/Ayla_Talk_Motion1.glb')
  
  // Animation related refs
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const [isModelReady, setIsModelReady] = useState(false)
  
  // Update phoneme when prop changes
  useEffect(() => {
    if (props.phoneme !== undefined) {
      setCurrentPhoneme(props.phoneme);
      // console.log('Phoneme value updated:', props.phoneme);
    }
  }, [props.phoneme]);
  
  // Modelin yüklənməsini izləməyə kömək edəcək bir state
  useEffect(() => {
    if (clone) {
      // Modeli tapmaq
      // console.log('Character model loaded, searching for morph targets...')
      
      // CC_Base_Body_1 meshini əldə etmək üçün dəyişən
      let foundCCBaseBody = false;
      
      clone.traverse((object: any) => {
        // Log CC_Base_Body_1 morph targets specifically
        if (object.name === 'CC_Base_Body_1' && object.morphTargetDictionary) {
          // console.log('Found CC_Base_Body_1 mesh with morph targets:');
          // console.log('All morph targets in CC_Base_Body_1:', Object.keys(object.morphTargetDictionary));
          
          // Əsas mesh olaraq CC_Base_Body_1 istifadə et
          meshRef.current = object as THREE.SkinnedMesh;
          modelRef.current = object;
          setIsModelReady(true);
          foundCCBaseBody = true;
          
          // Log each morph target with its index
          Object.entries(object.morphTargetDictionary).forEach(([name, index]) => {
            // console.log(`Morph Target: ${name}, Index: ${index}`);
          });
        }
      });
      
      // Əgər CC_Base_Body_1 tapılmadısa, ilk morph targetli mesh-i istifadə et
      if (!foundCCBaseBody) {
        clone.traverse((object: any) => {
          if (object.isMesh && object.morphTargetDictionary && !foundCCBaseBody) {
            // console.log('CC_Base_Body_1 not found, using alternative mesh:', object.name);
            // console.log('Available morph targets:', Object.keys(object.morphTargetDictionary));
            meshRef.current = object as THREE.SkinnedMesh;
            modelRef.current = object;
            setIsModelReady(true);
            foundCCBaseBody = true;
          }
        });
      }
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
      // console.log('Standing animation loaded')
    }
    
    // Danışma animasiyası
    if (talkMotion.animations && talkMotion.animations.length > 0) {
      talkAnim = talkMotion.animations[0]
      // console.log('Talking animation loaded')
    } else if (talkMotion1.animations && talkMotion1.animations.length > 0) {
      // Alternativ danışma animasiyası
      talkAnim = talkMotion1.animations[0]
      // console.log('Talking animation 1 loaded')
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
      
      // console.log('Talk animation action prepared with weight 0')
    }
    
    return () => {
      mixer.stopAllAction()
    }
  }, [clone, standMotion.animations, talkMotion.animations, talkMotion1.animations])
  
  // Map phoneme to mouth shape value
  const getPhonemeValue = (phoneme: string | undefined): number => {
    if (!phoneme) return 0;
    
    // Phoneme values based on Rhubarb phoneme set (A B C D E F G H X)
    // Daha yaxşı animasiya üçün hər fonemin optimal ağız açıqlığı dəyəri
    switch (phoneme) {
      case 'A': return 1; // A - açıq ağız (a, ə səsləri) - "a" kimi
      case 'B': return 1;  // B - yarı açıq ağız (e, ə səsləri) - "e" kimi
      case 'C': return 1;  // C - qapalı ağız (m, b, p səsləri) - "m" kimi
      case 'D': return 1; // D - dairəvi ağız (o, u səsləri) - "o" kimi
      case 'E': return 1; // E - dar ağız (i, ı səsləri) - "i" kimi
      case 'F': return 1; // F - dişlər arası (f, v səsləri) - "f" kimi
      case 'G': return 1;  // G - "l" səsi - dil dişlərə toxunur
      case 'H': return 1;  // H - nəfəsli səslər (h, x) - "h" kimi
      case 'X': return 0.0;  // X - səssiz, ağız bağlı
      default: return 0.0;   // Tanınmayan fonem - default olaraq qapalı
    }
  };
  
  // Phoneme to morph target mapping - each phoneme maps to multiple morph targets with weights
  const getPhonemeTargets = (phoneme: string | undefined): Record<string, number> => {
    if (!phoneme) return {};
    
    // Default weights for each phoneme based on Reallusion Character Creator visemes
    // https://manual.reallusion.com/Character-Creator-4/Content/ENU/4.0/06-Facial-Profile-Editor/8_7_and_1_1.htm
    switch (phoneme) {
      case 'A': // A - açıq ağız (a, ə səsləri) - "Ah" viseme
        return {
          "Ah": 1.0
        };
      case 'B': // B - yarı açıq ağız (e, ə səsləri) - "AE" viseme
        return {
          "AE": 1.0
        };
      case 'C': // C - qapalı ağız (m, b, p səsləri) - "B_M_P" viseme
        return {
          "B_M_P": 1.0
        };
      case 'D': // D - dairəvi ağız (o, u səsləri) - "Oh" və "W_OO" viseme qarışığı
        return {
          "Oh": 1
        };
      case 'E': // E - dar ağız (i, ı səsləri) - "IH" və "EE" viseme qarışığı
        return {
          "IH": 1
        };
      case 'F': // F - dişlər arası (f, v səsləri) - "F_V" viseme
        return {
          "F_V": 1.0
        };
      case 'G': // G - dil ön dişlərdə (l səsi) - "T_L_D_N" viseme
        return {
          "T_L_D_N": 1.0
        };
      case 'H': // H - nəfəsli səslər (h, x) - "K_G_H_NG" viseme
        return {
          "K_G_H_NG": 1.0
        };
      case 'X': // X - səssiz, ağız bağlı - neytral
        return {
          // Boş obyekt - heç bir morph target tətbiq olunmasın
        };
      default: // Default - ağız bağlı
        return {};
    }
  };
  
  // Rhubarb phoneme to Reallusion viseme mapping helper
  const mapRhubarbToViseme = (phoneme: string | undefined): string | undefined => {
    if (!phoneme) return undefined;
    
    switch (phoneme) {
      case 'A': return "Ah";      // A - açıq ağız (a, ə səsləri) 
      case 'B': return "AE";      // B - yarı açıq ağız (e, ə səsləri)
      case 'C': return "B_M_P";   // C - qapalı ağız (m, b, p səsləri)
      case 'D': return "Oh";      // D - dairəvi ağız (o, u səsləri)
      case 'E': return "EE";      // E - dar ağız (i, ı səsləri)
      case 'F': return "F_V";     // F - dişlər arası (f, v səsləri)
      case 'G': return "T_L_D_N"; // G - "l" səsi 
      case 'H': return "K_G_H_NG"; // H - nəfəsli səslər (h, x)
      case 'X': return undefined;  // X - səssiz, ağız bağlı
      default: return undefined;
    }
  };
  
  // Update animation in frame loop
  useFrame((state, delta) => {
    // Update animation mixer
    if (mixerRef.current) {
      mixerRef.current.update(delta)
    }
    
    // Get lip sync value from either phoneme or direct lipSyncValue
    let lipSyncValue = props.lipSyncValue || 0;
    
    // If phoneme is provided, override the lipSyncValue with phoneme-derived value
    if (currentPhoneme) {
      lipSyncValue = getPhonemeValue(currentPhoneme);
    }
    
    // Sabit animasiya - character sadəcə ilkin animasiyada qalsın
    if (standActionRef.current && talkActionRef.current) {
      // Danışma animasiyasını daima 0 ağırlığında saxlayaq
      talkActionRef.current.setEffectiveWeight(0);
      
      // Sakin duruş animasiyasını daima tam ağırlıqda saxlayaq
      standActionRef.current.setEffectiveWeight(1.0);
    }
    
    // Morph targetləri tətbiq edək - fonemə və lip sync dəyərinə görə
    if (isModelReady && meshRef.current) {
      const mesh = meshRef.current
      
      // Check if we just transitioned to X phoneme (silence)
      const justTransitionedToSilence = currentPhoneme === 'X' && prevPhonemeRef.current !== 'X';
      
      // If we just transitioned to silence, perform a hard reset of all morph targets
      if (justTransitionedToSilence && mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        const visemeTargets = [
          "AE", "Ah", "B_M_P", "Ch_J", "EE", "Er", "F_V", "IH", 
          "K_G_H_NG", "Oh", "R", "S_Z", "T_L_D_N", "TH", "W_OO"
        ];
        
        // Reset ALL morph targets immediately
        visemeTargets.forEach(viseme => {
          const index = mesh.morphTargetDictionary?.[viseme];
          if (index !== undefined && mesh.morphTargetInfluences) {
            // Direct reset - no lerping
            mesh.morphTargetInfluences[index] = 0;
          }
        });
        
        // Update prevPhoneme ref
        prevPhonemeRef.current = 'X';
        console.log('X foneminə keçid - bütün morph targetlər sıfırlandı');
        
        // No need to continue processing morph targets
        return;
      }
      
      // Get morph targets for current phoneme
      const morphTargets = getPhonemeTargets(currentPhoneme);
      const currentViseme = mapRhubarbToViseme(currentPhoneme);
      
      // Reset all viseme morph targets first
      if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        const visemeTargets = [
          "AE", "Ah", "B_M_P", "Ch_J", "EE", "Er", "F_V", "IH", 
          "K_G_H_NG", "Oh", "R", "S_Z", "T_L_D_N", "TH", "W_OO"
        ];
        
        // Reset all viseme targets
        visemeTargets.forEach(viseme => {
          const index = mesh.morphTargetDictionary?.[viseme];
          if (index !== undefined && mesh.morphTargetInfluences) {
            // Gradually decay when not in use
            if (mesh.morphTargetInfluences[index] > 0.01) {
              mesh.morphTargetInfluences[index] *= 0.9;
            } else {
              mesh.morphTargetInfluences[index] = 0;
            }
          }
        });
        
        // Log active morph target values - sırf debug üçün
        let activeTargets: Record<string, number> = {};
        
        // Apply new morph targets for current phoneme
        Object.entries(morphTargets).forEach(([targetName, weight]) => {
          const index = mesh.morphTargetDictionary?.[targetName];
          if (index !== undefined && mesh.morphTargetInfluences) {
            const currentValue = mesh.morphTargetInfluences[index] || 0;
            const targetValue = weight * Math.max(0.6, lipSyncValue); // Minimum 0.6 intensity for better visibility
            // Smooth transition for viseme application
            mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(currentValue, targetValue, 0.5);
            
            // Tədbiq olunan və müəyyən dəyərdən yüksək olan morph targetləri saxlayırıq
            if (mesh.morphTargetInfluences[index] > 0.05) {
              activeTargets[targetName] = parseFloat(mesh.morphTargetInfluences[index].toFixed(2));
            }
          } else if (index === undefined) {
            // Log missing morph targets once
            if (!window.mouthMorphTargetWarningLogged) {
              // console.warn(`Viseme morph target not found: ${targetName}. Available targets:`, 
              //   mesh.morphTargetDictionary ? Object.keys(mesh.morphTargetDictionary) : []);
              window.mouthMorphTargetWarningLogged = true;
            }
          }
        });
        
        // Add slight smile for X phoneme (when quiet)
        if (currentPhoneme === 'X') {
          // X fonemi zamanı heç bir morph target tətbiq olunmasın
          // Bütün morph target-ləri sıfırlayaq
          visemeTargets.forEach(viseme => {
            const index = mesh.morphTargetDictionary?.[viseme];
            if (index !== undefined && mesh.morphTargetInfluences) {
              // Birdəfəlik sıfırlama
              mesh.morphTargetInfluences[index] = 0;
            }
          });
        }
        
        // Aktiv morph targetləri və dəyərlərini konsola çıxar - cari fonem üçün
        if (Object.keys(activeTargets).length > 0 && currentPhoneme !== 'X') {
          // Sadəcə aşağıdakı hallarda log edək:
          // 1. Fonem dəyişdiyi halda
          // 2. Və ya son log-dan ən az 500ms keçdikdə (çox sıx olmasın deyə)
          const now = Date.now();
          const timeSinceLastLog = now - lastLogTimeRef.current;
          const shouldLog = prevPhonemeRef.current !== currentPhoneme && timeSinceLastLog > 500;
          
          if (shouldLog) {
            console.log(`Phoneme: ${currentPhoneme} - Active morph targets:`, activeTargets);
            prevPhonemeRef.current = currentPhoneme;
            lastLogTimeRef.current = now;
          }
        }
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
useGLTF.preload('/models/ayla/Ayla_Viseme.glb')
useGLTF.preload('/models/ayla/Ayla_Stand_Motion.glb')
useGLTF.preload('/models/ayla/Ayla_Talk_Motion.glb')
useGLTF.preload('/models/ayla/Ayla_Talk_Motion1.glb') 