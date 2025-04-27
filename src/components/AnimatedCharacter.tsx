import * as THREE from 'three'
import React, { useRef, useEffect, useState } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import { useFrame, useGraph } from '@react-three/fiber'
import { GLTF, SkeletonUtils } from 'three-stdlib'
import { time } from 'console'

type ActionName = 'Armature|6577333224704_TempMotion' | 'Key|6577333224704_TempMotion' | 'Key.002|6577333224704_TempMotion' | 'Key.001|6577333224704_TempMotion' | 'Key.003|6577333224704_TempMotion'

interface GLTFAction extends THREE.AnimationClip {
  name: ActionName
}

type GLTFResult = GLTF & {
  nodes: {
    Bang: THREE.SkinnedMesh
    Bun: THREE.SkinnedMesh
    Hair_Base_1: THREE.SkinnedMesh
    Hair_Base_2: THREE.SkinnedMesh
    High_Heels: THREE.SkinnedMesh
    Knee_length_skirt: THREE.SkinnedMesh
    Real_Hair: THREE.SkinnedMesh
    Rolled_sleeves_shirt: THREE.SkinnedMesh
    Underwear_Bottoms: THREE.SkinnedMesh
    CC_Base_Body_1: THREE.SkinnedMesh
    CC_Base_Body_2: THREE.SkinnedMesh
    CC_Base_Body_3: THREE.SkinnedMesh
    CC_Base_Body_4: THREE.SkinnedMesh
    CC_Base_Body_5: THREE.SkinnedMesh
    CC_Base_Body_6: THREE.SkinnedMesh
    CC_Base_Body_7: THREE.SkinnedMesh
    CC_Base_Body_8: THREE.SkinnedMesh
    CC_Base_Body_9: THREE.SkinnedMesh
    CC_Base_Body_10: THREE.SkinnedMesh
    CC_Base_Body_11: THREE.SkinnedMesh
    CC_Base_Body_12: THREE.SkinnedMesh
    CC_Base_Body_13: THREE.SkinnedMesh
    CC_Base_EyeOcclusion_1: THREE.SkinnedMesh
    CC_Base_EyeOcclusion_2: THREE.SkinnedMesh
    CC_Base_TearLine_1: THREE.SkinnedMesh
    CC_Base_TearLine_2: THREE.SkinnedMesh
    Female_Angled_1: THREE.SkinnedMesh
    Female_Angled_2: THREE.SkinnedMesh
    CC_Base_BoneRoot: THREE.Bone
  }
  materials: {
    ['Hair_Transparency.003']: THREE.MeshStandardMaterial
    ['Hair_Transparency.001']: THREE.MeshStandardMaterial
    Hair_Transparency: THREE.MeshStandardMaterial
    Scalp_Transparency: THREE.MeshStandardMaterial
    High_Heels: THREE.MeshStandardMaterial
    Knee_length_skirt: THREE.MeshStandardMaterial
    ['Hair_Transparency.002']: THREE.MeshStandardMaterial
    Rolled_sleeves_shirt: THREE.MeshStandardMaterial
    Underwear_Bottoms: THREE.MeshStandardMaterial
    Std_Tongue: THREE.MeshStandardMaterial
    Std_Skin_Head: THREE.MeshStandardMaterial
    Std_Skin_Body: THREE.MeshStandardMaterial
    Std_Skin_Arm: THREE.MeshStandardMaterial
    Std_Skin_Leg: THREE.MeshStandardMaterial
    Std_Nails: THREE.MeshStandardMaterial
    Std_Eyelash: THREE.MeshStandardMaterial
    Std_Upper_Teeth: THREE.MeshStandardMaterial
    Std_Lower_Teeth: THREE.MeshStandardMaterial
    Std_Eye_R: THREE.MeshStandardMaterial
    Std_Cornea_R: THREE.MeshStandardMaterial
    Std_Eye_L: THREE.MeshStandardMaterial
    Std_Cornea_L: THREE.MeshStandardMaterial
    Std_Eye_Occlusion_R: THREE.MeshStandardMaterial
    Std_Eye_Occlusion_L: THREE.MeshStandardMaterial
    Std_Tearline_R: THREE.MeshStandardMaterial
    Std_Tearline_L: THREE.MeshStandardMaterial
    Female_Angled_Transparency: THREE.MeshStandardMaterial
    Female_Angled_Base_Transparency: THREE.MeshStandardMaterial
  }
  animations: GLTFAction[]
}


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
  const { scene } = useGLTF('/models/ayla/Ayla_Simple.glb')
  
  // Clone the scene for animations
  const clone = React.useMemo(() => SkeletonUtils.clone(scene), [scene])
  
  // Load animations - use .glb instead of .fbx
  const standMotion = useGLTF('/models/ayla/Ayla_Stand_Motion.glb')
  
  // Console'a yüklənmiş modelləri çap et
  useEffect(() => {
    console.log("Yüklənmiş modellər:");
    console.log("- Əsas model: /models/ayla/Ayla_Simple.glb");
    console.log("- Animasiya modeli: /models/ayla/Ayla_Stand_Motion.glb");
  }, []);
  
  // Animation related refs
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const [isModelReady, setIsModelReady] = useState(false)
  
  // Update phoneme when prop changes
  useEffect(() => {
    if (props.phoneme !== undefined) {
      setCurrentPhoneme(props.phoneme);
    }
  }, [props.phoneme]);
  
  // Modelin yüklənməsini izləmək
  useEffect(() => {
    if (clone) {
      
      let foundCCBaseBody = false;
      
      // Tələb olunan bütün mesh obyektlərini əldə et
      let foundMeshes = {
        CC_Base_Body_1: null as THREE.SkinnedMesh | null,  // Dil
        CC_Base_Body_2: null as THREE.SkinnedMesh | null,  // Ağız/üz dərisi
        CC_Base_Body_9: null as THREE.SkinnedMesh | null   // Alt dişlər
      };
      
      clone.traverse((object: any) => {
        // Tələb olunan bütün mesh-ləri tap
        if (object.name === 'CC_Base_Body_1' && object.morphTargetDictionary) {
          foundMeshes.CC_Base_Body_1 = object as THREE.SkinnedMesh;
          foundCCBaseBody = true;
        }
        else if (object.name === 'CC_Base_Body_2' && object.morphTargetDictionary) {
          foundMeshes.CC_Base_Body_2 = object as THREE.SkinnedMesh;
        }
        else if (object.name === 'CC_Base_Body_9' && object.morphTargetDictionary) {
          foundMeshes.CC_Base_Body_9 = object as THREE.SkinnedMesh;
        }
      });
      
      // Əgər əsas mesh tapılıbsa, digər meshləri də nəzərə alaq
      if (foundCCBaseBody) {
        // Əsas mesh olaraq CC_Base_Body_1 istifadə edirik, amma 
        // digər meshləri də saxlayırıq ki, gələcəkdə istifadə edək
        meshRef.current = foundMeshes.CC_Base_Body_1;
        modelRef.current = foundMeshes.CC_Base_Body_1;
        
        // Əlavə məlumatları global dəyişəndə saxlayırıq ki, 
        // sonra frame loop içində istifadə edə bilək
        window.additionalMeshes = {
          face: foundMeshes.CC_Base_Body_2, // Üz/ağız dərisi
          lowerTeeth: foundMeshes.CC_Base_Body_9 // Alt dişlər
        };
        
        setIsModelReady(true);
      }
      // Əgər əsas mesh tapılmayıbsa, əvvəlki kimi alternativ mesh-ləri istifadə et
      else {
        clone.traverse((object: any) => {
          if (object.isMesh && object.morphTargetDictionary && !foundCCBaseBody) {
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
    
    // Sakin duruş animasiyası
    if (standMotion.animations && standMotion.animations.length > 0) {
      standAnim = standMotion.animations[0]
    }
    
    // Sakin duruş actionu
    if (standAnim) {
      const standAction = mixer.clipAction(standAnim)
      standAction.loop = THREE.LoopRepeat
      standAction.clampWhenFinished = false
      standAction.timeScale = 0.9
      standAction.play()
      standActionRef.current = standAction
    }
    
    return () => {
      mixer.stopAllAction()
    }
  }, [clone, standMotion.animations])
  
  // Phoneme to morph target mapping
  const getPhonemeTargets = (phoneme: string | undefined): Record<string, number> => {
    if (!phoneme) return {};
    // Azərbaycan dili fonem-viseme xəritəsi
    switch (phoneme) {
      // Ən çox istifadə olunan hərflər
      case 'a': return { "Merged_Open_Mouth": 0.6 };  // Tam açıq ağız
      case 'ə': return { "Merged_Open_Mouth": 0.6 }; // Orta açıq ağız
      case 'i': return getMultipleTargets(["Merged_Open_Mouth", "V_Wide"], [0.1, 0.7]); // Dar, geniş ağız
      case 'l': return { "Merged_Open_Mouth": 0.2 };  // Dil-diş təması
      case 'r': return { "Merged_Open_Mouth": 0.2 };  // "r" səsi üçün
      case 'n': return { "Merged_Open_Mouth": 0.2 };  // Dil-diş təması
      case 'm': return {"V_Explosive": 1};  // Dodaqlar birləşmiş
      case 'e': return getMultipleTargets(["Merged_Open_Mouth", "V_Wide"], [0.25, 0.7]);  // Orta açıq ağız
      case 's': return { "Merged_Open_Mouth": 0.2 }; // Diş arası səslər
      case 't': return { "Merged_Open_Mouth": 0.2 };  // Dil-diş təması
      
      // Orta tezlikdə istifadə olunan hərflər
      case 'd': return { "Merged_Open_Mouth": 0.2 };  // Dil-diş təması
      case 'k': return { "Merged_Open_Mouth": 0.2 }; 
      case 'b': return {"V_Explosive": 1};
      case 'g': return { "Merged_Open_Mouth": 0.2 }; 
      case 'y': return { "Merged_Open_Mouth": 0.2 };  // "y" səsi üçün
      case 'u': return { "V_Tight_O": 1 };   // Dar, dairəvi
      case 'o': return getMultipleTargets(["Merged_Open_Mouth", "V_Tight_O"], [0.1, 0.7]); // Dairəvi, orta açıq
      case 'ç': return { "Merged_Open_Mouth": 0.2 };
      case 'z': return { "Merged_Open_Mouth": 0.2 };  // Diş arası səslər
      case 'ş': return { "Merged_Open_Mouth": 0.2 };
      
      // Nisbətən az istifadə olunan hərflər
      case 'q': return { "Merged_Open_Mouth": 0.2 }; 
      case 'x': return { "Merged_Open_Mouth": 0.2 }; 
      case 'v': return {"V_Dental_Lip": 1};
      case 'j': return { "Merged_Open_Mouth": 0.2 };
      case 'ü': return { "V_Tight_O": 1 };  // Dar, dairəvi
      case 'ö': return getMultipleTargets(["Merged_Open_Mouth", "V_Tight_O"], [0.1, 0.7]); // Dairəvi, orta açıq
      case 'h': return { "Merged_Open_Mouth": 0.2 };  // Boğaz səsləri
      case 'ğ': return { "Merged_Open_Mouth": 0.2 }; 
      case 'c': return { "Merged_Open_Mouth": 0.2 }; 
      case 'ı': return getMultipleTargets(["Merged_Open_Mouth", "V_Wide"], [0.1, 0.7]);  // Dar ağız
      
      // Digər spesifik hərflər
      case 'p': return {"V_Explosive": 1};
      case 'f': return {"V_Dental_Lip": 1};
      
      // Xüsusi hallar
      case '_': return getMultipleTargets(["Merged_Open_Mouth", "V_Lip_Open", "V_Tight_O", "V_Dental_Lip", "V_Explosive", "V_Wide"], [0, 0, 0, 0, 0, 0]);   // Səssiz, ağız bağlı
      default: return { "Merged_Open_Mouth": 0 };  // Default - ağız bağlı
    }
  };
  
  // Bir neçə morph target-i eyni zamanda tətbiq etmək üçün funksiya
  const getMultipleTargets = (targetNames: string[], weights: number[]): Record<string, number> => {
    const result: Record<string, number> = {};
    
    // Hər target-i müvafiq çəki ilə əlavə et
    for (let i = 0; i < targetNames.length; i++) {
      if (i < weights.length) {
        result[targetNames[i]] = weights[i];
      } else {
        // Əgər çəki verilməyibsə, default 1.0 istifadə et
        result[targetNames[i]] = 0;
      }
    }
    
    return result;
  };
  
  // Bütün meshlərə morph target-i tətbiq edən funksiya
  const applyMorphTargetsToAllMeshes = (targetName: string, targetValue: number) => {
    // Bütün tələb olunan mesh-ləri əldə et
    const meshes = [
      window.additionalMeshes?.face, // CC_Base_Body_2 (üz/ağız dərisi mesh)
      window.additionalMeshes?.lowerTeeth // CC_Base_Body_9 (alt dişlər mesh)
    ];
    
    // Hər bir mesh üçün morph target tətbiq et
    meshes.forEach(mesh => {
      if (mesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        const index = mesh.morphTargetDictionary[targetName];
        if (index !== undefined) {
          const currentValue = mesh.morphTargetInfluences[index] || 0;
          mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(currentValue, targetValue, 0.2);
        }
      }
    });
  };
  
  // Update animation in frame loop
  useFrame((state, delta) => {
    // Update animation mixer
    if (mixerRef.current) {
      mixerRef.current.update(delta)
    }
    
    // Morph targetləri tətbiq et
    if (isModelReady && meshRef.current) {
      const mesh = meshRef.current
      
      // Get morph targets for current phoneme
      const morphTargets = getPhonemeTargets(currentPhoneme);
      
      if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        // Active morph targets əldə etmək üçün boş obyekt
        let activeTargets: Record<string, number> = {};
        
        // Apply new morph targets for current phoneme
        Object.entries(morphTargets).forEach(([targetName, weight]) => {
          const index = mesh.morphTargetDictionary?.[targetName];
          
          // Bütün mesh-lərə tətbiq et
          applyMorphTargetsToAllMeshes(targetName, weight);
        });
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
    additionalMeshes?: {
      face: THREE.SkinnedMesh | null;
      lowerTeeth: THREE.SkinnedMesh | null;
    };
  }
}

// React-three-fiber tipləri üçün
type GroupProps = React.ComponentProps<'group'>;

export function Model(props: GroupProps) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/models/ayla/Ayla_Simple.glb');
  const clone = React.useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { nodes, materials } = useGraph(clone) as unknown as GLTFResult;
  
  return (
    <group ref={group} {...props} dispose={null}>
      <group name="Scene">
        <group name="Armature" scale={0.01}>
          <primitive object={nodes.CC_Base_BoneRoot} />
          <skinnedMesh name="Bang" geometry={nodes.Bang.geometry} material={materials['Hair_Transparency.003']} skeleton={nodes.Bang.skeleton} />
          <skinnedMesh name="Bun" geometry={nodes.Bun.geometry} material={materials['Hair_Transparency.001']} skeleton={nodes.Bun.skeleton} />
          <group name="Hair_Base">
            <skinnedMesh name="Hair_Base_1" geometry={nodes.Hair_Base_1.geometry} material={materials.Hair_Transparency} skeleton={nodes.Hair_Base_1.skeleton} />
            <skinnedMesh name="Hair_Base_2" geometry={nodes.Hair_Base_2.geometry} material={materials.Scalp_Transparency} skeleton={nodes.Hair_Base_2.skeleton} />
          </group>
          <skinnedMesh name="High_Heels" geometry={nodes.High_Heels.geometry} material={materials.High_Heels} skeleton={nodes.High_Heels.skeleton} />
          <skinnedMesh name="Knee_length_skirt" geometry={nodes.Knee_length_skirt.geometry} material={materials.Knee_length_skirt} skeleton={nodes.Knee_length_skirt.skeleton} />
          <skinnedMesh name="Real_Hair" geometry={nodes.Real_Hair.geometry} material={materials['Hair_Transparency.002']} skeleton={nodes.Real_Hair.skeleton} />
          <skinnedMesh name="Rolled_sleeves_shirt" geometry={nodes.Rolled_sleeves_shirt.geometry} material={materials.Rolled_sleeves_shirt} skeleton={nodes.Rolled_sleeves_shirt.skeleton} />
          <skinnedMesh name="Underwear_Bottoms" geometry={nodes.Underwear_Bottoms.geometry} material={materials.Underwear_Bottoms} skeleton={nodes.Underwear_Bottoms.skeleton} />
          <group name="CC_Base_Body">
            <skinnedMesh name="CC_Base_Body_1" geometry={nodes.CC_Base_Body_1.geometry} material={materials.Std_Tongue} skeleton={nodes.CC_Base_Body_1.skeleton} morphTargetDictionary={nodes.CC_Base_Body_1.morphTargetDictionary} morphTargetInfluences={nodes.CC_Base_Body_1.morphTargetInfluences} />
            <skinnedMesh name="CC_Base_Body_2" geometry={nodes.CC_Base_Body_2.geometry} material={materials.Std_Skin_Head} skeleton={nodes.CC_Base_Body_2.skeleton} morphTargetDictionary={nodes.CC_Base_Body_2.morphTargetDictionary} morphTargetInfluences={nodes.CC_Base_Body_2.morphTargetInfluences} />
            <skinnedMesh name="CC_Base_Body_3" geometry={nodes.CC_Base_Body_3.geometry} material={materials.Std_Skin_Body} skeleton={nodes.CC_Base_Body_3.skeleton} morphTargetDictionary={nodes.CC_Base_Body_3.morphTargetDictionary} morphTargetInfluences={nodes.CC_Base_Body_3.morphTargetInfluences} />
            <skinnedMesh name="CC_Base_Body_4" geometry={nodes.CC_Base_Body_4.geometry} material={materials.Std_Skin_Arm} skeleton={nodes.CC_Base_Body_4.skeleton} morphTargetDictionary={nodes.CC_Base_Body_4.morphTargetDictionary} morphTargetInfluences={nodes.CC_Base_Body_4.morphTargetInfluences} />
            <skinnedMesh name="CC_Base_Body_5" geometry={nodes.CC_Base_Body_5.geometry} material={materials.Std_Skin_Leg} skeleton={nodes.CC_Base_Body_5.skeleton} morphTargetDictionary={nodes.CC_Base_Body_5.morphTargetDictionary} morphTargetInfluences={nodes.CC_Base_Body_5.morphTargetInfluences} />
            <skinnedMesh name="CC_Base_Body_6" geometry={nodes.CC_Base_Body_6.geometry} material={materials.Std_Nails} skeleton={nodes.CC_Base_Body_6.skeleton} morphTargetDictionary={nodes.CC_Base_Body_6.morphTargetDictionary} morphTargetInfluences={nodes.CC_Base_Body_6.morphTargetInfluences} />
            <skinnedMesh name="CC_Base_Body_7" geometry={nodes.CC_Base_Body_7.geometry} material={materials.Std_Eyelash} skeleton={nodes.CC_Base_Body_7.skeleton} morphTargetDictionary={nodes.CC_Base_Body_7.morphTargetDictionary} morphTargetInfluences={nodes.CC_Base_Body_7.morphTargetInfluences} />
            <skinnedMesh name="CC_Base_Body_8" geometry={nodes.CC_Base_Body_8.geometry} material={materials.Std_Upper_Teeth} skeleton={nodes.CC_Base_Body_8.skeleton} morphTargetDictionary={nodes.CC_Base_Body_8.morphTargetDictionary} morphTargetInfluences={nodes.CC_Base_Body_8.morphTargetInfluences} />
            <skinnedMesh name="CC_Base_Body_9" geometry={nodes.CC_Base_Body_9.geometry} material={materials.Std_Lower_Teeth} skeleton={nodes.CC_Base_Body_9.skeleton} morphTargetDictionary={nodes.CC_Base_Body_9.morphTargetDictionary} morphTargetInfluences={nodes.CC_Base_Body_9.morphTargetInfluences} />
            <skinnedMesh name="CC_Base_Body_10" geometry={nodes.CC_Base_Body_10.geometry} material={materials.Std_Eye_R} skeleton={nodes.CC_Base_Body_10.skeleton} morphTargetDictionary={nodes.CC_Base_Body_10.morphTargetDictionary} morphTargetInfluences={nodes.CC_Base_Body_10.morphTargetInfluences} />
            <skinnedMesh name="CC_Base_Body_11" geometry={nodes.CC_Base_Body_11.geometry} material={materials.Std_Cornea_R} skeleton={nodes.CC_Base_Body_11.skeleton} morphTargetDictionary={nodes.CC_Base_Body_11.morphTargetDictionary} morphTargetInfluences={nodes.CC_Base_Body_11.morphTargetInfluences} />
            <skinnedMesh name="CC_Base_Body_12" geometry={nodes.CC_Base_Body_12.geometry} material={materials.Std_Eye_L} skeleton={nodes.CC_Base_Body_12.skeleton} morphTargetDictionary={nodes.CC_Base_Body_12.morphTargetDictionary} morphTargetInfluences={nodes.CC_Base_Body_12.morphTargetInfluences} />
            <skinnedMesh name="CC_Base_Body_13" geometry={nodes.CC_Base_Body_13.geometry} material={materials.Std_Cornea_L} skeleton={nodes.CC_Base_Body_13.skeleton} morphTargetDictionary={nodes.CC_Base_Body_13.morphTargetDictionary} morphTargetInfluences={nodes.CC_Base_Body_13.morphTargetInfluences} />
          </group>
          <group name="CC_Base_EyeOcclusion">
            <skinnedMesh name="CC_Base_EyeOcclusion_1" geometry={nodes.CC_Base_EyeOcclusion_1.geometry} material={materials.Std_Eye_Occlusion_R} skeleton={nodes.CC_Base_EyeOcclusion_1.skeleton} morphTargetDictionary={nodes.CC_Base_EyeOcclusion_1.morphTargetDictionary} morphTargetInfluences={nodes.CC_Base_EyeOcclusion_1.morphTargetInfluences} />
            <skinnedMesh name="CC_Base_EyeOcclusion_2" geometry={nodes.CC_Base_EyeOcclusion_2.geometry} material={materials.Std_Eye_Occlusion_L} skeleton={nodes.CC_Base_EyeOcclusion_2.skeleton} morphTargetDictionary={nodes.CC_Base_EyeOcclusion_2.morphTargetDictionary} morphTargetInfluences={nodes.CC_Base_EyeOcclusion_2.morphTargetInfluences} />
          </group>
          <group name="CC_Base_TearLine">
            <skinnedMesh name="CC_Base_TearLine_1" geometry={nodes.CC_Base_TearLine_1.geometry} material={materials.Std_Tearline_R} skeleton={nodes.CC_Base_TearLine_1.skeleton} morphTargetDictionary={nodes.CC_Base_TearLine_1.morphTargetDictionary} morphTargetInfluences={nodes.CC_Base_TearLine_1.morphTargetInfluences} />
            <skinnedMesh name="CC_Base_TearLine_2" geometry={nodes.CC_Base_TearLine_2.geometry} material={materials.Std_Tearline_L} skeleton={nodes.CC_Base_TearLine_2.skeleton} morphTargetDictionary={nodes.CC_Base_TearLine_2.morphTargetDictionary} morphTargetInfluences={nodes.CC_Base_TearLine_2.morphTargetInfluences} />
          </group>
          <group name="Female_Angled">
            <skinnedMesh name="Female_Angled_1" geometry={nodes.Female_Angled_1.geometry} material={materials.Female_Angled_Transparency} skeleton={nodes.Female_Angled_1.skeleton} morphTargetDictionary={nodes.Female_Angled_1.morphTargetDictionary} morphTargetInfluences={nodes.Female_Angled_1.morphTargetInfluences} />
            <skinnedMesh name="Female_Angled_2" geometry={nodes.Female_Angled_2.geometry} material={materials.Female_Angled_Base_Transparency} skeleton={nodes.Female_Angled_2.skeleton} morphTargetDictionary={nodes.Female_Angled_2.morphTargetDictionary} morphTargetInfluences={nodes.Female_Angled_2.morphTargetInfluences} />
          </group>
        </group>
      </group>
    </group>
  )
}

useGLTF.preload('/models/ayla/Ayla_Simple.glb')
