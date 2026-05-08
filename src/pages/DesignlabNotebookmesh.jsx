import React, { useState, useRef, Suspense, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls, Grid, Html, useProgress } from '@react-three/drei';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import '../DesignLab.css';
import { Settings2, RefreshCw, Image as ImageIcon, Trash2, Type, Copy, ArrowUp, ArrowDown, Maximize, Download, Camera, Upload } from 'lucide-react';
import { fabric } from 'fabric';

function Loader() {
    const { progress } = useProgress();
    return <Html center><div style={{ color: 'white', background: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '5px' }}>Loading {progress.toFixed(0)}%</div></Html>;
}

// A component to load the model and apply textures
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

    // Calculate scale and position
    useEffect(() => {
        if (!scene) return;
        const box = new THREE.Box3().setFromObject(scene);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        const targetSize = 4.0; // Increased target size slightly just in case
        const maxDim = Math.max(size.x, size.y, size.z);
        const calculatedScale = maxDim > 0 ? targetSize / maxDim : 1;

        const offsetX = -center.x;
        const offsetY = -box.min.y;
        const offsetZ = -center.z;

        setModelTransform({
            scale: calculatedScale,
            position: [offsetX, offsetY, offsetZ]
        });

        // Extract meshes
        const extractedMeshes = [];
        scene.traverse((child) => {
            if (child.isMesh) {
                extractedMeshes.push(child.name);
                // Store original material to clone from
                if (!child.userData.originalMaterial) {
                    if (Array.isArray(child.material)) {
                        child.userData.originalMaterial = child.material.map(m => m.clone());
                    } else {
                        child.userData.originalMaterial = child.material.clone();
                    }
                }
            }
        });

        // Sort and set unique
        const uniqueMeshes = [...new Set(extractedMeshes)].sort();
        if (onMeshesExtracted) {
            onMeshesExtracted(uniqueMeshes);
        }

        window.logMeshPosition = (meshName) => {
            const mesh = scene.getObjectByName(meshName);
            if (mesh) {
                const worldPos = new THREE.Vector3();
                mesh.getWorldPosition(worldPos);
                console.log(`3D Mesh (${meshName}) World Position: X: ${worldPos.x.toFixed(4)}, Y: ${worldPos.y.toFixed(4)}, Z: ${worldPos.z.toFixed(4)}`);
                console.log(`3D Mesh (${meshName}) Local Position: X: ${mesh.position.x.toFixed(4)}, Y: ${mesh.position.y.toFixed(4)}, Z: ${mesh.position.z.toFixed(4)}`);
                console.log(`3D Mesh (${meshName}) Scale: X: ${mesh.scale.x.toFixed(4)}, Y: ${mesh.scale.y.toFixed(4)}, Z: ${mesh.scale.z.toFixed(4)}`);
                
                let colorHex = 'N/A';
                if (mesh.material) {
                    if (Array.isArray(mesh.material)) {
                        colorHex = mesh.material.map(m => m.color ? '#' + m.color.getHexString() : 'N/A').join(', ');
                    } else if (mesh.material.color) {
                        colorHex = '#' + mesh.material.color.getHexString();
                    }
                }
                console.log(`3D Mesh (${meshName}) Material Color: ${colorHex}`);
            } else {
                console.log(`Mesh ${meshName} not found in 3D scene.`);
            }
        };

        return () => {
            delete window.logMeshPosition;
        };
    }, [scene]);

    // Apply textures to specific meshes
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

                    if (settings) {
                        tex.repeat.set(settings.repeatX, settings.repeatY);
                        tex.offset.set(settings.offsetX, settings.offsetY);
                        tex.rotation = settings.rotation || 0;
                    } else {
                        tex.repeat.set(1, 1);
                        tex.offset.set(0, 0);
                        tex.rotation = 0;
                    }

                    tex.needsUpdate = true;
                    mat.map = tex;
                    mat.transparent = true;
                } else {
                    // If no texture assigned, use the original material map if any, or null
                    mat.map = null;
                }
                mat.needsUpdate = true;
            };

            const settings = meshSettings[child.name];

            // Clone material from original to avoid mutating shared materials
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

export default function DesignLabMeshPrint() {
    const [modelFile, setModelFile] = useState(null);
    const [meshes, setMeshes] = useState([]);
    const [selectedMesh, setSelectedMesh] = useState('');

    // A mapping of meshName -> { canvas, texture }
    const fabricInstances = useRef({});
    const containerRef = useRef(null);

    const [textures, setTextures] = useState({});
    const [activeCanvas, setActiveCanvas] = useState(null);

    // UV Settings per mesh
    const [meshSettings, setMeshSettings] = useState({});

    const handleModelUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setModelFile(file);
            setMeshes([]);
            setSelectedMesh('');
            fabricInstances.current = {};
            setTextures({});
            setActiveCanvas(null);
        }
    };

    const handleMeshesExtracted = (extractedMeshes) => {
        setMeshes(extractedMeshes);
        if (extractedMeshes.length > 0 && !selectedMesh) {
            setSelectedMesh(extractedMeshes[0]);
        }
    };

    // Initialize a canvas for a mesh if it doesn't exist
    useEffect(() => {
        if (!selectedMesh || !containerRef.current) return;

        if (!fabricInstances.current[selectedMesh]) {
            // Create a hidden canvas element
            const canvasEl = document.createElement('canvas');
            // Set dimensions
            const initialWidth = containerRef.current.clientWidth || 400;
            canvasEl.width = initialWidth;
            canvasEl.height = 400;

            const fCanvas = new fabric.Canvas(canvasEl, {
                width: initialWidth,
                height: 400,
                backgroundColor: '#ffffff'
            });

            const texture = new THREE.CanvasTexture(fCanvas.getElement());
            texture.anisotropy = 16;

            fCanvas.on('after:render', () => {
                texture.needsUpdate = true;
                // Force re-render of React component to pass new texture object if needed
                setTextures(prev => ({ ...prev, [selectedMesh]: texture }));
            });

            fabricInstances.current[selectedMesh] = {
                canvas: fCanvas,
                texture: texture,
                htmlElement: canvasEl
            };

            setTextures(prev => ({ ...prev, [selectedMesh]: texture }));
        }

        // Clear the container and append the active canvas wrapper
        const container = containerRef.current;
        container.innerHTML = ''; // Clear previous

        const activeData = fabricInstances.current[selectedMesh];
        if (activeData) {
            // We append the upper-canvas wrapper created by Fabric
            const fabricWrapper = activeData.canvas.wrapperEl;
            if (fabricWrapper) {
                container.appendChild(fabricWrapper);
            }
            setActiveCanvas(activeData.canvas);
        }

    }, [selectedMesh]);

    const handleAddText = () => {
        if (!activeCanvas) return;
        const text = new fabric.IText('Text', {
            left: 150,
            top: 130,
            fontFamily: 'Arial',
            fill: '#1E90FF',
            fontSize: 40
        });
        activeCanvas.add(text);
        activeCanvas.setActiveObject(text);
        activeCanvas.renderAll();
    };

    const handleAddImage = () => {
        if (!activeCanvas) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (f) => {
                fabric.Image.fromURL(f.target.result, (img) => {
                    const maxDim = 200;
                    if (img.width > maxDim || img.height > maxDim) {
                        const scale = Math.min(maxDim / img.width, maxDim / img.height);
                        img.scale(scale);
                    }
                    img.set({
                        left: activeCanvas.width / 2,
                        top: activeCanvas.height / 2,
                        originX: 'center',
                        originY: 'center'
                    });
                    activeCanvas.add(img);
                    activeCanvas.setActiveObject(img);
                    activeCanvas.renderAll();
                });
            };
            reader.readAsDataURL(file);
        };
        input.click();
    };

    const handleDelete = () => {
        if (!activeCanvas) return;
        const activeObjects = activeCanvas.getActiveObjects();
        if (activeObjects.length) {
            activeCanvas.discardActiveObject();
            activeObjects.forEach(obj => activeCanvas.remove(obj));
        }
    };

    const handleOpacityChange = (e) => {
        if (!activeCanvas) return;
        const obj = activeCanvas.getActiveObject();
        if (obj) {
            obj.set('opacity', parseFloat(e.target.value));
            activeCanvas.renderAll();
        }
    };

    const handleUVSettingsChange = (setting, value) => {
        setMeshSettings(prev => ({
            ...prev,
            [selectedMesh]: {
                ...(prev[selectedMesh] || { repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0, rotation: 0 }),
                [setting]: value
            }
        }));
    };

    const handleCheckConsole = () => {
        if (!selectedMesh) return;
        
        console.log(`\n--- Console Check for Mesh: ${selectedMesh} ---`);
        console.log(`Selected Mesh Color: ${meshSettings[selectedMesh]?.color || 'Default (#ffffff)'}`);
        
        // Log Fabric JS Objects
        if (activeCanvas) {
            const objects = activeCanvas.getObjects();
            const canvasWidth = activeCanvas.width;
            const canvasHeight = activeCanvas.height;
            console.log(`Fabric Canvas Objects (${objects.length}):`);
            objects.forEach((obj, idx) => {
                const xPercentage = (obj.left / canvasWidth) * 100;
                const yPercentage = (obj.top / canvasHeight) * 100;
                const objWidth = obj.width * (obj.scaleX || 1);
                const objHeight = obj.height * (obj.scaleY || 1);
                const widthPercentage = (objWidth / canvasWidth) * 100;
                const heightPercentage = (objHeight / canvasHeight) * 100;

                console.log(`  [${idx}] Type: ${obj.type}, Left: ${obj.left?.toFixed(2)}, Top: ${obj.top?.toFixed(2)}, ScaleX: ${obj.scaleX?.toFixed(2)}, ScaleY: ${obj.scaleY?.toFixed(2)}, Angle: ${obj.angle}`);
                console.log(`       xPercentage: ${xPercentage.toFixed(2)}%, yPercentage: ${yPercentage.toFixed(2)}%, widthPercentage: ${widthPercentage.toFixed(2)}%, heightPercentage: ${heightPercentage.toFixed(2)}%`);
            });
        }
        
        // Log 3D Mesh Position
        if (window.logMeshPosition) {
            window.logMeshPosition(selectedMesh);
        }
    };

    return (
        <div className="design-lab-container" style={{ flexDirection: 'row' }}>

            {/* LEFT SIDE: Controls Section */}
            <div className="controls-section" style={{ borderLeft: 'none', borderRight: '2px solid #555' }}>
                <div className="controls-header">
                    <h2>Mesh Print Customizer</h2>
                    <Link to="/" className="back-btn">Exit</Link>
                </div>

                <div className="control-group">
                    <span className="control-label">Upload 3D Model (.glb / .gltf):</span>
                    <label className="action-btn" style={{ cursor: 'pointer', marginBottom: '15px' }}>
                        <Upload size={16} /> Upload Model
                        <input type="file" accept=".glb,.gltf" style={{ display: 'none' }} onChange={handleModelUpload} />
                    </label>
                </div>

                {meshes.length > 0 && (
                    <div className="control-group">
                        <span className="control-label">Select Mesh:</span>
                        <select
                            value={selectedMesh}
                            onChange={(e) => setSelectedMesh(e.target.value)}
                            style={{ width: '100%', padding: '10px', backgroundColor: '#222', color: '#fff', border: '1px solid #777' }}
                        >
                            {meshes.map(mesh => (
                                <option key={mesh} value={mesh}>{mesh}</option>
                            ))}
                        </select>
                    </div>
                )}

                {selectedMesh && (
                    <>
                        <div className="control-group" style={{ marginBottom: '15px' }}>
                            <span className="control-label">Mesh Color:</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <input type="color" 
                                    value={meshSettings[selectedMesh]?.color || '#ffffff'} 
                                    onChange={(e) => handleUVSettingsChange('color', e.target.value)}
                                    style={{ width: '40px', height: '40px', padding: '0', border: '1px solid #777', cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: '0.85rem' }}>{meshSettings[selectedMesh]?.color || 'Default'}</span>
                            </div>
                        </div>

                        <div className="action-buttons">
                            <button className="action-btn" onClick={handleAddImage}><ImageIcon size={16} /> Add Image</button>
                            <button className="action-btn" onClick={handleAddText}><Type size={16} /> Add Text</button>
                            <button className="action-btn" onClick={handleCheckConsole} style={{ backgroundColor: '#444' }}>Check on Console</button>
                        </div>

                        <div className="editor-toolbar">
                            <button className="icon-btn" onClick={handleDelete} title="Delete"><Trash2 size={16} /></button>
                            <div className="opacity-slider">
                                Opacity:
                                <input type="range" min="0" max="1" step="0.1" defaultValue="1" onChange={handleOpacityChange} />
                            </div>
                        </div>

                        {/* 2D Canvas Area */}
                        <div className="image-preview">
                            <div className="fabric-container" ref={containerRef}>
                                {/* Fabric canvas wrappers will be injected here */}
                            </div>
                        </div>

                        {/* UV Mapping Controls */}
                        <div className="control-group" style={{ marginTop: '15px' }}>
                            <span className="control-label">Texture Mapping (UV):</span>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ width: '80px', fontSize: '0.8rem' }}>Scale X:</span>
                                    <input type="range" min="0.1" max="10" step="0.1"
                                        value={meshSettings[selectedMesh]?.repeatX || 1}
                                        onChange={(e) => handleUVSettingsChange('repeatX', parseFloat(e.target.value))}
                                        style={{ flex: 1 }} />
                                    <span style={{ fontSize: '0.8rem', width: '30px' }}>{meshSettings[selectedMesh]?.repeatX || 1}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ width: '80px', fontSize: '0.8rem' }}>Scale Y:</span>
                                    <input type="range" min="0.1" max="10" step="0.1"
                                        value={meshSettings[selectedMesh]?.repeatY || 1}
                                        onChange={(e) => handleUVSettingsChange('repeatY', parseFloat(e.target.value))}
                                        style={{ flex: 1 }} />
                                    <span style={{ fontSize: '0.8rem', width: '30px' }}>{meshSettings[selectedMesh]?.repeatY || 1}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ width: '80px', fontSize: '0.8rem' }}>Offset X:</span>
                                    <input type="range" min="-2" max="2" step="0.01"
                                        value={meshSettings[selectedMesh]?.offsetX || 0}
                                        onChange={(e) => handleUVSettingsChange('offsetX', parseFloat(e.target.value))}
                                        style={{ flex: 1 }} />
                                    <span style={{ fontSize: '0.8rem', width: '30px' }}>{meshSettings[selectedMesh]?.offsetX || 0}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ width: '80px', fontSize: '0.8rem' }}>Offset Y:</span>
                                    <input type="range" min="-2" max="2" step="0.01"
                                        value={meshSettings[selectedMesh]?.offsetY || 0}
                                        onChange={(e) => handleUVSettingsChange('offsetY', parseFloat(e.target.value))}
                                        style={{ flex: 1 }} />
                                    <span style={{ fontSize: '0.8rem', width: '30px' }}>{meshSettings[selectedMesh]?.offsetY || 0}</span>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* RIGHT SIDE: 3D Canvas Section */}
            <div className="canvas-section" style={{ backgroundColor: '#222' }}>
                <Canvas camera={{ position: [0, 0, 3.5], fov: 40 }}>
                    <ambientLight intensity={0.6} />
                    <directionalLight position={[5, 5, 5]} intensity={1} />
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
                        cellColor="#555555"
                        sectionSize={2.5}
                        sectionThickness={1.5}
                        sectionColor="#666666"
                        fadeDistance={20}
                    />

                    <OrbitControls
                        enablePan={true}
                        enableZoom={true}
                    />
                </Canvas>
            </div>

        </div>
    );
}