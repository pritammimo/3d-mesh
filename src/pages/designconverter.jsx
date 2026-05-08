import React, { useState, useRef, Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, OrbitControls, Grid, Html, useProgress } from '@react-three/drei';
import * as THREE from 'three';
import { fabric } from 'fabric';

// Predefined placement configuration based on mesh index (mesh[0], mesh[1], etc.)
const placementConfig = {
    0: {
        color: '#e31515ff',
        image: {
            xpercentage: 49.97, // 30% from the left
            ypercentage: 53.78, // 30% from the top
            widthpercentage: 100.82, // 40% of canvas width
            heightpercentage: 107.89,
            angle: 179.19 // 40% of canvas height
        },
        text: {
            xPercentage: 42.03,
            yPercentage: 48.8,
            widthPercentage: 21.07,
            heightPercentage: 8.06,
            angle: 180.55114065027848
        }
    },
    1: {
        color: '#ffffff',
        image: {
            xpercentage: 50,
            ypercentage: 50,
            widthpercentage: 30,
            heightpercentage: 30,
            angle: 0
        }
    }
    // Add more configurations for mesh[2], mesh[3], etc. as needed
};

function Loader() {
    const { progress } = useProgress();
    return <Html center><div style={{ color: 'white', background: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '5px' }}>Loading {progress.toFixed(0)}%</div></Html>;
}

function Model({ url, file, textures, meshSettings, onMeshesExtracted }) {
    const [modelUrl, setModelUrl] = useState(url || '/models/Frame.glb');

    useEffect(() => {
        if (file) {
            const newUrl = URL.createObjectURL(file);
            setModelUrl(newUrl);
            return () => URL.revokeObjectURL(newUrl);
        } else {
            setModelUrl(url || '/models/Frame.glb');
        }
    }, [file, url]);

    const { scene } = useGLTF(modelUrl);
    const groupRef = useRef();
    const [modelTransform, setModelTransform] = useState({ scale: 1, position: [0, 0, 0] });

    useEffect(() => {
        if (!scene) return;
        const box = new THREE.Box3().setFromObject(scene);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        const targetSize = 4.0;
        const maxDim = Math.max(size.x, size.y, size.z);
        const calculatedScale = maxDim > 0 ? targetSize / maxDim : 1;

        const offsetX = -center.x;
        const offsetY = -box.min.y;
        const offsetZ = -center.z;

        setModelTransform({
            scale: calculatedScale,
            position: [offsetX, offsetY, offsetZ]
        });

        const extractedMeshes = [];
        scene.traverse((child) => {
            if (child.isMesh) {
                extractedMeshes.push(child.name);
                if (!child.userData.originalMaterial) {
                    if (Array.isArray(child.material)) {
                        child.userData.originalMaterial = child.material.map(m => m.clone());
                    } else {
                        child.userData.originalMaterial = child.material.clone();
                    }
                }
            }
        });

        // Use unique names to stabilize array indexing for placementConfig
        const uniqueMeshes = [...new Set(extractedMeshes)].sort();
        if (onMeshesExtracted) {
            onMeshesExtracted(uniqueMeshes);
        }
    }, [scene]);

    useEffect(() => {
        if (!scene) return;
        scene.traverse((child) => {
            if (!child.isMesh) return;

            const applyTexture = (mat, tex, settings) => {
                if (settings && settings.color) {
                    mat.color.set(settings.color);
                }

                if (tex) {
                    tex.wrapS = THREE.RepeatWrapping;
                    tex.wrapT = THREE.RepeatWrapping;
                    tex.flipY = false;
                    tex.needsUpdate = true;
                    mat.map = tex;
                    mat.transparent = true;
                } else {
                    mat.map = null;
                }
                mat.needsUpdate = true;
            };

            const settings = meshSettings[child.name];

            if (Array.isArray(child.userData.originalMaterial)) {
                child.material = child.userData.originalMaterial.map(m => m.clone());
                child.material.forEach(mat => {
                    applyTexture(mat, textures[child.name], settings);
                });
            } else if (child.userData.originalMaterial) {
                child.material = child.userData.originalMaterial.clone();
                applyTexture(child.material, textures[child.name], settings);
            }
        });
    }, [scene, textures, meshSettings]);

    return (
        <group ref={groupRef} position={[0, -1, 0]}>
            <group scale={modelTransform.scale}>
                <group position={modelTransform.position}>
                    <primitive object={scene} />
                </group>
            </group>
        </group>
    );
}

const DesignConverter = () => {
    const [modelFile, setModelFile] = useState(null);
    const [meshes, setMeshes] = useState([]);
    const [selectedMesh, setSelectedMesh] = useState('');
    const [textures, setTextures] = useState({});
    const [meshSettings, setMeshSettings] = useState({});

    const fabricInstances = useRef({});

    const handleMeshesExtracted = (extractedMeshes) => {
        setMeshes(extractedMeshes);
        if (extractedMeshes.length > 0 && !selectedMesh) {
            setSelectedMesh(extractedMeshes[0]);
        }

        // Initialize mesh colors from placementConfig if defined as string (hex code)
        const initialSettings = {};
        extractedMeshes.forEach((meshName, index) => {
            const config = placementConfig[index];
            if (config && typeof config.color === 'string') {
                initialSettings[meshName] = { color: config.color };
            }
        });
        setMeshSettings(prev => ({ ...initialSettings, ...prev }));
    };

    // Ensure Fabric canvas exists for the selected mesh texture mapping
    useEffect(() => {
        if (!selectedMesh) return;

        if (!fabricInstances.current[selectedMesh]) {
            const canvasEl = document.createElement('canvas');
            canvasEl.width = 1024;
            canvasEl.height = 1024;

            const fCanvas = new fabric.Canvas(canvasEl, {
                width: 1024,
                height: 1024,
                backgroundColor: '#ffffff'
            });

            const texture = new THREE.CanvasTexture(fCanvas.getElement());
            texture.anisotropy = 16;

            fCanvas.on('after:render', () => {
                texture.needsUpdate = true;
                setTextures(prev => ({ ...prev, [selectedMesh]: texture }));
            });

            fabricInstances.current[selectedMesh] = {
                canvas: fCanvas,
                texture: texture
            };

            setTextures(prev => ({ ...prev, [selectedMesh]: texture }));
        }
    }, [selectedMesh]);

    // Retrieve placement config for the active mesh by index
    const getMeshConfig = () => {
        if (!selectedMesh) return null;
        const index = meshes.indexOf(selectedMesh);
        return placementConfig[index] || null;
    };

    const handleColorChange = (e) => {
        const config = getMeshConfig();
        if (config && config.color) {
            const color = e.target.value;
            setMeshSettings(prev => ({
                ...prev,
                [selectedMesh]: { ...prev[selectedMesh], color }
            }));
        } else {
            alert(`Color is not available/configured for ${selectedMesh} (mesh[${meshes.indexOf(selectedMesh)}]) in the placement config.`);
        }
    };

    const handleAddImage = () => {
        const config = getMeshConfig();
        if (!config || !config.image) {
            alert(`Image placement is not configured for ${selectedMesh} (mesh[${meshes.indexOf(selectedMesh)}]) in the placement config.`);
            return;
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (f) => {
                const activeData = fabricInstances.current[selectedMesh];
                if (!activeData) return;
                const canvas = activeData.canvas;

                fabric.Image.fromURL(f.target.result, (img) => {
                    const canvasW = canvas.width;
                    const canvasH = canvas.height;

                    const targetW = canvasW * (config.image.widthpercentage / 100);
                    const targetH = canvasH * (config.image.heightpercentage / 100);
                    const targetX = canvasW * (config.image.xpercentage / 100);
                    const targetY = canvasH * (config.image.ypercentage / 100);

                    const scaleX = targetW / img.width;
                    const scaleY = targetH / img.height;
                    const scale = Math.min(scaleX, scaleY); // Maintain aspect ratio within percentage bounding box

                    img.set({
                        left: targetX,
                        top: targetY,
                        originX: 'left',
                        originY: 'top',
                        scaleX: scale,
                        scaleY: scale,
                        angle: config.image.angle || 0
                    });

                    canvas.add(img);
                    canvas.setActiveObject(img);
                    canvas.renderAll();
                });
            };
            reader.readAsDataURL(file);
        };
        input.click();
    };

    const handleAddText = () => {
        const config = getMeshConfig();
        if (!config || !config.text) {
            alert(`Text placement is not configured for ${selectedMesh} (mesh[${meshes.indexOf(selectedMesh)}]) in the placement config.`);
            return;
        }

        const activeData = fabricInstances.current[selectedMesh];
        if (!activeData) return;
        const canvas = activeData.canvas;

        const canvasW = canvas.width;
        const canvasH = canvas.height;

        const targetX = canvasW * (config.text.xpercentage / 100);
        const targetY = canvasH * (config.text.ypercentage / 100);

        const targetW = canvasW * (config.text.widthpercentage / 100);
        const targetH = canvasH * (config.text.heightpercentage / 100);

        const textObj = new fabric.IText('Your Text Here', {
            left: targetX,
            top: targetY,
            originX: 'left',
            originY: 'top',
            fontFamily: 'Arial',
            fill: '#ffffff',
            fontSize: targetH, // Roughly base the font size on height percentage
            angle: config.text.angle || 0
        });

        // Scale to fit width percentage if the text exceeds it
        if (textObj.width > targetW) {
            textObj.scaleToWidth(targetW);
        }

        canvas.add(textObj);
        canvas.setActiveObject(textObj);
        canvas.renderAll();
    };

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#111', color: '#eee', fontFamily: 'sans-serif' }}>
            {/* Left Column: Option Controller */}
            <div style={{ width: '380px', padding: '25px', backgroundColor: '#1a1a1a', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
                <h2 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #333', paddingBottom: '10px' }}>Option Controller</h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontWeight: 'bold' }}>Upload 3D Model:</label>
                    <input
                        type="file"
                        accept=".glb,.gltf"
                        style={{ padding: '8px', backgroundColor: '#222', border: '1px solid #444', borderRadius: '4px', color: '#fff' }}
                        onChange={(e) => {
                            if (e.target.files[0]) {
                                setModelFile(e.target.files[0]);
                                setMeshes([]);
                                setSelectedMesh('');
                                setMeshSettings({});
                                fabricInstances.current = {};
                            }
                        }}
                    />
                </div>

                {meshes.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontWeight: 'bold' }}>Select Mesh to Customize:</label>
                        <select
                            value={selectedMesh}
                            onChange={(e) => setSelectedMesh(e.target.value)}
                            style={{ width: '100%', padding: '12px', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                        >
                            {meshes.map((mesh, index) => (
                                <option key={mesh} value={mesh}>{mesh} (mesh[{index}])</option>
                            ))}
                        </select>
                    </div>
                )}

                {selectedMesh && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '10px' }}>
                        <div style={{ padding: '15px', backgroundColor: '#252525', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 'bold' }}>Set Mesh Color</span>
                            <input
                                type="color"
                                value={meshSettings[selectedMesh]?.color || (typeof getMeshConfig()?.color === 'string' ? getMeshConfig().color : '#ffffff')}
                                onChange={handleColorChange}
                                style={{ width: '40px', height: '40px', padding: '0', border: 'none', cursor: 'pointer', background: 'transparent' }}
                                title="Change Color"
                            />
                        </div>

                        <button
                            onClick={handleAddImage}
                            style={{ padding: '14px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', transition: 'background 0.2s' }}
                            onMouseOver={e => e.target.style.backgroundColor = '#2563eb'}
                            onMouseOut={e => e.target.style.backgroundColor = '#3b82f6'}
                        >
                            Add Image
                        </button>

                        <button
                            onClick={handleAddText}
                            style={{ padding: '14px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', transition: 'background 0.2s' }}
                            onMouseOver={e => e.target.style.backgroundColor = '#059669'}
                            onMouseOut={e => e.target.style.backgroundColor = '#10b981'}
                        >
                            Add Text
                        </button>

                        <div style={{ fontSize: '0.85rem', color: '#aaa', marginTop: '20px', padding: '15px', border: '1px dashed #444', borderRadius: '6px' }}>
                            <strong>Active Placement Rules:</strong>
                            <p style={{ margin: '8px 0 4px' }}>Objects added will snap to positions defined in <code>placementConfig</code> for <code>mesh[{meshes.indexOf(selectedMesh)}]</code>.</p>
                            <ul style={{ margin: '0', paddingLeft: '20px', lineHeight: '1.6' }}>
                                <li>Images use <code>xpercentage</code>, <code>ypercentage</code></li>
                                <li>Texts use <code>widthpercentage</code>, <code>heightpercentage</code></li>
                                <li>Colors require <code>color: true</code></li>
                            </ul>
                        </div>
                    </div>
                )}
            </div>

            {/* Right Column: 3D Model Viewer */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <Canvas camera={{ position: [0, 0, 4], fov: 45 }} gl={{ preserveDrawingBuffer: true }}>
                    <ambientLight intensity={0.7} />
                    <directionalLight position={[5, 5, 5]} intensity={1.2} />
                    <directionalLight position={[-5, 5, -5]} intensity={0.5} />

                    <Suspense fallback={<Loader />}>
                        <Model
                            url="/models/Frame.glb"
                            file={modelFile}
                            textures={textures}
                            meshSettings={meshSettings}
                            onMeshesExtracted={handleMeshesExtracted}
                        />
                    </Suspense>

                    <Grid
                        position={[0, -1, 0]}
                        args={[10.5, 10.5]}
                        cellSize={0.5}
                        cellThickness={1}
                        cellColor="#333"
                        sectionSize={2.5}
                        sectionThickness={1.5}
                        sectionColor="#444"
                        fadeDistance={20}
                    />

                    <OrbitControls enablePan={true} enableZoom={true} makeDefault />
                </Canvas>
            </div>
        </div>
    );
};

export default DesignConverter;