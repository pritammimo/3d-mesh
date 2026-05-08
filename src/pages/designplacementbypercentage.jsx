import React, { useState, useRef, Suspense, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, OrbitControls, Grid, Html, useProgress } from '@react-three/drei';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import '../DesignLab.css';
import { Image as ImageIcon, Trash2, Type, Upload, Copy } from 'lucide-react';
import { fabric } from 'fabric';

export function Loader() {
    const { progress } = useProgress();
    return <Html center><div style={{ color: 'white', background: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '5px' }}>Loading {progress.toFixed(0)}%</div></Html>;
}

export function Model({ url, file, textures, meshSettings, onMeshesExtracted }) {
    const [modelUrl, setModelUrl] = useState(url || '/models/Notebook.glb');

    useEffect(() => {
        if (file) {
            const newUrl = URL.createObjectURL(file);
            setModelUrl(newUrl);
            return () => URL.revokeObjectURL(newUrl);
        } else {
            setModelUrl(url || '/models/Notebook.glb');
        }
    }, [file, url]);

    const { scene: originalScene } = useGLTF(modelUrl);
    const scene = useMemo(() => originalScene.clone(), [originalScene]);
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

                    if (settings) {
                        tex.repeat.set(settings.repeatX !== undefined ? settings.repeatX : 1, settings.repeatY !== undefined ? settings.repeatY : 1);
                        tex.offset.set(settings.offsetX || 0, settings.offsetY || 0);
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

import SecondaryView from './SecondaryView';

export default function DesignPlacementPercentage() {
    const [modelFile, setModelFile] = useState(null);
    const [meshes, setMeshes] = useState([]);
    const [activePlacement, setActivePlacement] = useState(null);

    // Column 1 (Main)
    const [selectedMainMesh, setSelectedMainMesh] = useState('');
    const mainFabricInstances = useRef({});
    const mainContainerRef = useRef(null);
    const [mainTextures, setMainTextures] = useState({});
    const [mainActiveCanvas, setMainActiveCanvas] = useState(null);
    const [mainMeshSettings, setMainMeshSettings] = useState({});

    // Column 3 logic has been moved to SecondaryView component

    const handleModelUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setModelFile(file);
            setMeshes([]);
            setSelectedMainMesh('');
            mainFabricInstances.current = {};
            setMainTextures({});
            setMainActiveCanvas(null);
            setActivePlacement(null);
        }
    };

    const handleMeshesExtracted = (extractedMeshes) => {
        setMeshes(prev => {
            if (prev.length === extractedMeshes.length && prev.every((v, i) => v === extractedMeshes[i])) {
                return prev;
            }
            return extractedMeshes;
        });
    };

    useEffect(() => {
        if (meshes.length > 0) {
            if (!selectedMainMesh) setSelectedMainMesh(meshes[0]);
        }
    }, [meshes, selectedMainMesh]);

    // Initialize Main Canvas
    useEffect(() => {
        if (!selectedMainMesh || !mainContainerRef.current) return;
        if (!mainFabricInstances.current[selectedMainMesh]) {
            const canvasEl = document.createElement('canvas');
            const initialWidth = mainContainerRef.current.clientWidth || 300;
            canvasEl.width = initialWidth;
            canvasEl.height = 300;

            const fCanvas = new fabric.Canvas(canvasEl, {
                width: initialWidth,
                height: 300,
                backgroundColor: '#ffffff'
            });

            const texture = new THREE.CanvasTexture(fCanvas.getElement());
            texture.anisotropy = 16;

            fCanvas.on('after:render', () => {
                texture.needsUpdate = true;
                setMainTextures(prev => ({ ...prev, [selectedMainMesh]: texture }));
            });

            mainFabricInstances.current[selectedMainMesh] = {
                canvas: fCanvas,
                texture: texture,
                htmlElement: canvasEl
            };

            setMainTextures(prev => ({ ...prev, [selectedMainMesh]: texture }));
        }

        const container = mainContainerRef.current;
        container.innerHTML = '';
        const activeData = mainFabricInstances.current[selectedMainMesh];
        if (activeData) {
            if (activeData.canvas.wrapperEl) {
                container.appendChild(activeData.canvas.wrapperEl);
            }
            setMainActiveCanvas(activeData.canvas);
        }
    }, [selectedMainMesh]);

    // Active Placement Tracker (Column 1)
    useEffect(() => {
        if (!mainActiveCanvas) return;
        const handleSelection = () => {
            const obj = mainActiveCanvas.getActiveObject();
            if (obj) {
                const canvasWidth = mainActiveCanvas.width;
                const canvasHeight = mainActiveCanvas.height;
                const objWidth = obj.width * (obj.scaleX || 1);
                const objHeight = obj.height * (obj.scaleY || 1);

                // Normalize left/top to always represent the top-left corner,
                // regardless of the object's originX/originY setting.
                let adjustedLeft = obj.left;
                let adjustedTop = obj.top;

                if (obj.originX === 'center') adjustedLeft -= objWidth / 2;
                else if (obj.originX === 'right') adjustedLeft -= objWidth;

                if (obj.originY === 'center') adjustedTop -= objHeight / 2;
                else if (obj.originY === 'bottom') adjustedTop -= objHeight;

                const xPercentage = (adjustedLeft / canvasWidth) * 100;
                const yPercentage = (adjustedTop / canvasHeight) * 100;
                const widthPercentage = (objWidth / canvasWidth) * 100;
                const heightPercentage = (objHeight / canvasHeight) * 100;

                setActivePlacement({
                    x: xPercentage,
                    y: yPercentage,
                    w: widthPercentage,
                    h: heightPercentage,
                    angle: obj.angle || 0,
                    originX: 'left',
                    originY: 'top'
                });
            } else {
                setActivePlacement(null);
            }
        };

        mainActiveCanvas.on('selection:created', handleSelection);
        mainActiveCanvas.on('selection:updated', handleSelection);
        mainActiveCanvas.on('object:modified', handleSelection);
        mainActiveCanvas.on('object:moving', handleSelection);
        mainActiveCanvas.on('object:scaling', handleSelection);
        mainActiveCanvas.on('object:rotating', handleSelection);
        mainActiveCanvas.on('selection:cleared', handleSelection);

        return () => {
            mainActiveCanvas.off('selection:created', handleSelection);
            mainActiveCanvas.off('selection:updated', handleSelection);
            mainActiveCanvas.off('object:modified', handleSelection);
            mainActiveCanvas.off('object:moving', handleSelection);
            mainActiveCanvas.off('object:scaling', handleSelection);
            mainActiveCanvas.off('object:rotating', handleSelection);
            mainActiveCanvas.off('selection:cleared', handleSelection);
        };
    }, [mainActiveCanvas]);



    // Main Canvas Actions
    const handleMainAddText = () => {
        if (!mainActiveCanvas) return;
        const text = new fabric.IText('Text', {
            left: mainActiveCanvas.width / 2,
            top: mainActiveCanvas.height / 2,
            originX: 'center',
            originY: 'center',
            fontFamily: 'Arial',
            fill: '#1E90FF',
            fontSize: 40
        });
        mainActiveCanvas.add(text);
        mainActiveCanvas.setActiveObject(text);
        mainActiveCanvas.renderAll();
    };

    const handleMainAddImage = () => {
        if (!mainActiveCanvas) return;
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
                        left: mainActiveCanvas.width / 2,
                        top: mainActiveCanvas.height / 2,
                        originX: 'center',
                        originY: 'center'
                    });
                    mainActiveCanvas.add(img);
                    mainActiveCanvas.setActiveObject(img);
                    mainActiveCanvas.renderAll();
                });
            };
            reader.readAsDataURL(file);
        };
        input.click();
    };

    const handleMainDelete = () => {
        if (!mainActiveCanvas) return;
        const activeObjects = mainActiveCanvas.getActiveObjects();
        if (activeObjects.length) {
            mainActiveCanvas.discardActiveObject();
            activeObjects.forEach(obj => mainActiveCanvas.remove(obj));
        }
    };

    const handleMainOpacityChange = (e) => {
        if (!mainActiveCanvas) return;
        const obj = mainActiveCanvas.getActiveObject();
        if (obj) {
            obj.set('opacity', parseFloat(e.target.value));
            mainActiveCanvas.renderAll();
        }
    };

    const handleMainUVSettingsChange = (setting, value) => {
        setMainMeshSettings(prev => ({
            ...prev,
            [selectedMainMesh]: {
                ...(prev[selectedMainMesh] || { repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0, rotation: 0 }),
                [setting]: value
            }
        }));
    };


    return (
        <div style={{ display: 'flex', flexDirection: 'row', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#111', color: '#fff' }}>

            {/* COLUMN 1: Main Controls */}
            <div style={{ flex: '0 0 28%', borderRight: '2px solid #555', display: 'flex', flexDirection: 'column', padding: '15px', overflowY: 'auto', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Main Customizer</h2>
                    <Link to="/" style={{ color: '#aaa', textDecoration: 'none' }}>Exit</Link>
                </div>

                <div className="control-group" style={{ marginBottom: '15px' }}>
                    <span className="control-label" style={{ display: 'block', marginBottom: '5px' }}>Upload 3D Model:</span>
                    <label className="action-btn" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '10px', backgroundColor: '#333', borderRadius: '5px', border: '1px solid #555' }}>
                        <Upload size={16} /> Upload Model
                        <input type="file" accept=".glb,.gltf" style={{ display: 'none' }} onChange={handleModelUpload} />
                    </label>
                </div>

                {meshes.length > 0 && (
                    <div className="control-group" style={{ marginBottom: '15px' }}>
                        <span className="control-label" style={{ display: 'block', marginBottom: '5px' }}>Select Main Mesh:</span>
                        <select
                            value={selectedMainMesh}
                            onChange={(e) => setSelectedMainMesh(e.target.value)}
                            style={{ width: '100%', padding: '10px', backgroundColor: '#222', color: '#fff', border: '1px solid #777', borderRadius: '5px' }}
                        >
                            {meshes.map(mesh => (
                                <option key={mesh} value={mesh}>{mesh}</option>
                            ))}
                        </select>
                    </div>
                )}

                {selectedMainMesh && (
                    <>
                        <div className="control-group" style={{ marginBottom: '15px' }}>
                            <span className="control-label" style={{ display: 'block', marginBottom: '5px' }}>Mesh Color:</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <input type="color"
                                    value={mainMeshSettings[selectedMainMesh]?.color || '#ffffff'}
                                    onChange={(e) => handleMainUVSettingsChange('color', e.target.value)}
                                    style={{ width: '40px', height: '40px', padding: '0', border: '1px solid #777', cursor: 'pointer', borderRadius: '5px' }}
                                />
                                <span style={{ fontSize: '0.85rem' }}>{mainMeshSettings[selectedMainMesh]?.color || 'Default'}</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                            <button onClick={handleMainAddImage} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '8px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '5px', cursor: 'pointer' }}><ImageIcon size={16} /> Add Image</button>
                            <button onClick={handleMainAddText} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '8px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '5px', cursor: 'pointer' }}><Type size={16} /> Add Text</button>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', padding: '10px', backgroundColor: '#222', borderRadius: '5px' }}>
                            <button onClick={handleMainDelete} title="Delete" style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '0.8rem' }}>Opacity:</span>
                                <input type="range" min="0" max="1" step="0.1" defaultValue="1" onChange={handleMainOpacityChange} />
                            </div>
                        </div>

                        <div style={{ width: '100%', height: '300px', backgroundColor: '#fff', borderRadius: '5px', overflow: 'hidden', position: 'relative' }}>
                            <div ref={mainContainerRef} style={{ width: '100%', height: '100%' }}></div>
                        </div>

                        <div className="control-group" style={{ marginTop: '15px' }}>
                            <span className="control-label" style={{ display: 'block', marginBottom: '10px' }}>Texture Mapping (UV):</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ width: '60px', fontSize: '0.8rem' }}>Scale X:</span>
                                    <input type="range" min="0.1" max="10" step="0.1" value={mainMeshSettings[selectedMainMesh]?.repeatX || 1} onChange={(e) => handleMainUVSettingsChange('repeatX', parseFloat(e.target.value))} style={{ flex: 1 }} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ width: '60px', fontSize: '0.8rem' }}>Scale Y:</span>
                                    <input type="range" min="0.1" max="10" step="0.1" value={mainMeshSettings[selectedMainMesh]?.repeatY || 1} onChange={(e) => handleMainUVSettingsChange('repeatY', parseFloat(e.target.value))} style={{ flex: 1 }} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ width: '60px', fontSize: '0.8rem' }}>Offset X:</span>
                                    <input type="range" min="-2" max="2" step="0.01" value={mainMeshSettings[selectedMainMesh]?.offsetX || 0} onChange={(e) => handleMainUVSettingsChange('offsetX', parseFloat(e.target.value))} style={{ flex: 1 }} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ width: '60px', fontSize: '0.8rem' }}>Offset Y:</span>
                                    <input type="range" min="-2" max="2" step="0.01" value={mainMeshSettings[selectedMainMesh]?.offsetY || 0} onChange={(e) => handleMainUVSettingsChange('offsetY', parseFloat(e.target.value))} style={{ flex: 1 }} />
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* COLUMN 2: Main 3D Canvas */}
            <div style={{ flex: '0 0 37%', borderRight: '2px solid #555', position: 'relative', boxSizing: 'border-box' }}>
                <Canvas camera={{ position: [0, 0, 3.5], fov: 40 }}>
                    <ambientLight intensity={0.6} />
                    <directionalLight position={[5, 5, 5]} intensity={1} />
                    <directionalLight position={[-5, 5, -5]} intensity={0.5} />
                    <Suspense fallback={<Loader />}>
                        <Model
                            url="/models/Notebook.glb"
                            file={modelFile}
                            textures={mainTextures}
                            meshSettings={mainMeshSettings}
                            onMeshesExtracted={handleMeshesExtracted}
                        />
                    </Suspense>
                    <Grid position={[0, -1, 0]} args={[10.5, 10.5]} cellSize={0.5} cellThickness={1} cellColor="#555555" sectionSize={2.5} sectionThickness={1.5} sectionColor="#666666" fadeDistance={20} />
                    <OrbitControls enablePan={true} enableZoom={true} />
                </Canvas>
                <div style={{ position: 'absolute', top: '10px', left: '10px', backgroundColor: 'rgba(0,0,0,0.5)', padding: '5px 10px', borderRadius: '5px', pointerEvents: 'none' }}>
                    Main View
                </div>
            </div>

            {/* COLUMN 3: Secondary View & Controls */}
            <SecondaryView
                meshes={meshes}
                selectedMainMesh={selectedMainMesh}
                activePlacement={activePlacement}
            />
        </div>
    );
}