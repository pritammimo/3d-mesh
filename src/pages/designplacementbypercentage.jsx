import React, { useState, useRef, Suspense, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, OrbitControls, Grid, Html, useProgress, Bounds } from '@react-three/drei';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import '../DesignLab.css';
import { Image as ImageIcon, Trash2, Type, Upload, Copy, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import { fabric } from 'fabric';

export function Loader() {
    const { progress } = useProgress();
    return <Html center><div style={{ color: 'white', background: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '5px' }}>Loading {progress.toFixed(0)}%</div></Html>;
}

export function Model({ url, file, textures, meshSettings, onMeshesExtracted }) {
    const [modelUrl, setModelUrl] = useState(url || '/models/Mug.glb');

    useEffect(() => {
        if (file) {
            const newUrl = URL.createObjectURL(file);
            setModelUrl(newUrl);
            return () => URL.revokeObjectURL(newUrl);
        } else {
            setModelUrl(url || '/models/Mug.glb');
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

const FILTER_OPTIONS = [
    { label: 'None', value: 'none' },
    { label: 'Grayscale', value: 'grayscale' },
    { label: 'Sepia', value: 'sepia' },
    { label: 'Invert', value: 'invert' },
    { label: 'Brightness (+)', value: 'brightness' },
    { label: 'Contrast (+)', value: 'contrast' },
    { label: 'Blur', value: 'blur' },
    { label: 'Saturate', value: 'saturate' },
];

function getFilterInstance(filterName) {
    switch (filterName) {
        case 'grayscale': return new fabric.Image.filters.Grayscale();
        case 'sepia': return new fabric.Image.filters.Sepia();
        case 'invert': return new fabric.Image.filters.Invert();
        case 'brightness': return new fabric.Image.filters.Brightness({ brightness: 0.3 });
        case 'contrast': return new fabric.Image.filters.Contrast({ contrast: 0.3 });
        case 'blur': return new fabric.Image.filters.Blur({ blur: 0.2 });
        case 'saturate': return new fabric.Image.filters.Saturation({ saturation: 0.5 });
        default: return null;
    }
}

export default function DesignPlacementPercentage() {
    const [modelFile, setModelFile] = useState(null);
    const [meshes, setMeshes] = useState([]);
    const [activePlacement, setActivePlacement] = useState(null);
    const predefinedModel = "/models/Mug.glb";

    // Column 1 (Main)
    const [selectedMainMesh, setSelectedMainMesh] = useState('');
    const mainFabricInstances = useRef({});
    const mainContainerRef = useRef(null);
    const [mainTextures, setMainTextures] = useState({});
    const [mainActiveCanvas, setMainActiveCanvas] = useState(null);
    const [mainMeshSettings, setMainMeshSettings] = useState({});

    // Column 3 logic has been moved to SecondaryView component

    // Saved mesh data for "Get All" in Column 3
    const [savedMeshData, setSavedMeshData] = useState({});

    // Track if the currently selected object is marked as default
    const [isDefaultActive, setIsDefaultActive] = useState(false);
    // Track the element tag/category of the selected object
    const [activeElementTag, setActiveElementTag] = useState('');
    // Track the type of the selected object ('text' or 'image')
    const [activeObjectType, setActiveObjectType] = useState('');
    // Text font and color for main canvas
    const [mainTextFont, setMainTextFont] = useState('Arial');
    const [mainTextColor, setMainTextColor] = useState('#1E90FF');
    // Image filter for main canvas
    const [mainImageFilter, setMainImageFilter] = useState('none');

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

                // Read isDefault custom property
                setIsDefaultActive(!!obj.isDefault);
                setActiveElementTag(obj.elementTag || '');
                setActiveObjectType((obj.type === 'i-text' || obj.type === 'text') ? 'text' : (obj.type === 'image' ? 'image' : ''));

                // Read font/color from selected text
                if (obj.type === 'i-text' || obj.type === 'text') {
                    setMainTextFont(obj.fontFamily || 'Arial');
                    setMainTextColor(obj.fill || '#1E90FF');
                }
                // Read filter from selected image
                if (obj.type === 'image') {
                    setMainImageFilter(obj.imageFilter || 'none');
                }
            } else {
                setActivePlacement(null);
                setIsDefaultActive(false);
                setActiveElementTag('');
                setActiveObjectType('');
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

    // Save current mesh's elements (percentage-based)
    const handleSaveMeshData = () => {
        if (!selectedMainMesh || !mainActiveCanvas) return;

        const canvasWidth = mainActiveCanvas.width;
        const canvasHeight = mainActiveCanvas.height;
        const color = mainMeshSettings[selectedMainMesh]?.color || '#ffffff';

        const elements = mainActiveCanvas.getObjects().map(obj => {
            const objWidth = obj.width * (obj.scaleX || 1);
            const objHeight = obj.height * (obj.scaleY || 1);

            // Normalize to top-left origin
            let adjustedLeft = obj.left;
            let adjustedTop = obj.top;
            if (obj.originX === 'center') adjustedLeft -= objWidth / 2;
            else if (obj.originX === 'right') adjustedLeft -= objWidth;
            if (obj.originY === 'center') adjustedTop -= objHeight / 2;
            else if (obj.originY === 'bottom') adjustedTop -= objHeight;

            const base = {
                angle: Number((obj.angle || 0).toFixed(2)),
                h: Number(((objHeight / canvasHeight) * 100).toFixed(2)),
                w: Number(((objWidth / canvasWidth) * 100).toFixed(2)),
                x: Number(((adjustedLeft / canvasWidth) * 100).toFixed(2)),
                y: Number(((adjustedTop / canvasHeight) * 100).toFixed(2)),
                isDefault: !!obj.isDefault,
                elementTag: obj.elementTag || ''
            };

            if (obj.type === 'i-text' || obj.type === 'text') {
                return { ...base, type: 'text', text: obj.text, fontFamily: obj.fontFamily || 'Arial', fill: obj.fill || '#1E90FF' };
            } else if (obj.type === 'image') {
                return { ...base, type: 'image', imageFilter: obj.imageFilter || 'none' };
            } else {
                return { ...base, type: obj.type };
            }
        });

        setSavedMeshData(prev => ({
            ...prev,
            [selectedMainMesh]: {
                color,
                elements
            }
        }));

        console.log(`✅ Saved mesh "${selectedMainMesh}" with ${elements.length} element(s)`);
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

                        {/* Text Font & Color - only when a text object is selected */}
                        {activeObjectType === 'text' && (
                            <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#1e293b', borderRadius: '5px', border: '1px solid #334155' }}>
                                <span style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: '#94a3b8' }}>Text Font & Color:</span>
                                <div style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
                                    <input
                                        type="text"
                                        value={mainTextFont}
                                        onChange={(e) => setMainTextFont(e.target.value)}
                                        placeholder="Font name..."
                                        style={{ flex: 1, padding: '8px', backgroundColor: '#222', color: '#fff', border: '1px solid #555', borderRadius: '5px', fontSize: '0.85rem' }}
                                    />
                                    <button
                                        onClick={() => {
                                            if (!mainActiveCanvas) return;
                                            const obj = mainActiveCanvas.getActiveObject();
                                            if (obj && (obj.type === 'i-text' || obj.type === 'text')) {
                                                obj.set('fontFamily', mainTextFont);
                                                mainActiveCanvas.renderAll();
                                            }
                                        }}
                                        style={{ padding: '8px 12px', backgroundColor: '#6d28d9', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}
                                    >
                                        Apply
                                    </button>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Color:</span>
                                    <input
                                        type="color"
                                        value={mainTextColor}
                                        onChange={(e) => {
                                            setMainTextColor(e.target.value);
                                            if (!mainActiveCanvas) return;
                                            const obj = mainActiveCanvas.getActiveObject();
                                            if (obj && (obj.type === 'i-text' || obj.type === 'text')) {
                                                obj.set('fill', e.target.value);
                                                mainActiveCanvas.renderAll();
                                            }
                                        }}
                                        style={{ width: '36px', height: '36px', padding: '0', border: '1px solid #555', cursor: 'pointer', borderRadius: '5px' }}
                                    />
                                    <span style={{ fontSize: '0.8rem', color: '#fff', fontFamily: 'monospace' }}>{mainTextColor}</span>
                                </div>
                            </div>
                        )}

                        {/* Image Filter - only when an image object is selected */}
                        {activeObjectType === 'image' && (
                            <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#1e293b', borderRadius: '5px', border: '1px solid #334155' }}>
                                <span style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: '#94a3b8' }}>Image Filter:</span>
                                <select
                                    value={mainImageFilter}
                                    onChange={(e) => {
                                        const filterName = e.target.value;
                                        setMainImageFilter(filterName);
                                        if (!mainActiveCanvas) return;
                                        const obj = mainActiveCanvas.getActiveObject();
                                        if (obj && obj.type === 'image') {
                                            obj.filters = [];
                                            const filterInst = getFilterInstance(filterName);
                                            if (filterInst) obj.filters.push(filterInst);
                                            obj.applyFilters();
                                            obj.imageFilter = filterName;
                                            mainActiveCanvas.renderAll();
                                        }
                                    }}
                                    style={{ width: '100%', padding: '8px', backgroundColor: '#222', color: '#fff', border: '1px solid #555', borderRadius: '5px' }}
                                >
                                    {FILTER_OPTIONS.map(f => (
                                        <option key={f.value} value={f.value}>{f.label}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', padding: '10px', backgroundColor: '#222', borderRadius: '5px' }}>
                            <button onClick={handleMainDelete} title="Delete" style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer' }}><Trash2 size={16} /></button>

                            {/* isDefault Toggle */}
                            <button
                                onClick={() => {
                                    if (!mainActiveCanvas) return;
                                    const obj = mainActiveCanvas.getActiveObject();
                                    if (!obj) { alert('Select an object first.'); return; }
                                    obj.isDefault = !obj.isDefault;
                                    setIsDefaultActive(obj.isDefault);
                                }}
                                title={isDefaultActive ? 'Remove Default' : 'Set as Default'}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '5px',
                                    padding: '4px 10px', border: 'none', borderRadius: '5px', cursor: 'pointer',
                                    backgroundColor: isDefaultActive ? '#16a34a' : '#555',
                                    color: '#fff', fontSize: '0.75rem', fontWeight: 'bold'
                                }}
                            >
                                {isDefaultActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                                {isDefaultActive ? 'Default ON' : 'Default OFF'}
                            </button>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '0.8rem' }}>Opacity:</span>
                                <input type="range" min="0" max="1" step="0.1" defaultValue="1" onChange={handleMainOpacityChange} />
                            </div>
                        </div>


                        {/* Element Tag Checkboxes - only when isDefault is OFF */}
                        {!isDefaultActive && activeObjectType && (
                            <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#1e293b', borderRadius: '5px', border: '1px solid #334155' }}>
                                <span style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: '#94a3b8' }}>Element Category:</span>
                                {activeObjectType === 'image' ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#fff', cursor: 'pointer' }}>
                                            <input
                                                type="radio"
                                                name="elementTag"
                                                checked={activeElementTag === 'main_canvas_image'}
                                                onChange={() => {
                                                    const obj = mainActiveCanvas?.getActiveObject();
                                                    if (obj) { obj.elementTag = 'main_canvas_image'; setActiveElementTag('main_canvas_image'); }
                                                }}
                                            />
                                            Main Canvas Image
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#fff', cursor: 'pointer' }}>
                                            <input
                                                type="radio"
                                                name="elementTag"
                                                checked={activeElementTag === 'artist_signature'}
                                                onChange={() => {
                                                    const obj = mainActiveCanvas?.getActiveObject();
                                                    if (obj) { obj.elementTag = 'artist_signature'; setActiveElementTag('artist_signature'); }
                                                }}
                                            />
                                            Artist Signature Image
                                        </label>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#fff', cursor: 'pointer' }}>
                                            <input
                                                type="radio"
                                                name="elementTag"
                                                checked={activeElementTag === 'customer_text'}
                                                onChange={() => {
                                                    const obj = mainActiveCanvas?.getActiveObject();
                                                    if (obj) { obj.elementTag = 'customer_text'; setActiveElementTag('customer_text'); }
                                                }}
                                            />
                                            Customer Text
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#fff', cursor: 'pointer' }}>
                                            <input
                                                type="radio"
                                                name="elementTag"
                                                checked={activeElementTag === 'customer_name'}
                                                onChange={() => {
                                                    const obj = mainActiveCanvas?.getActiveObject();
                                                    if (obj) { obj.elementTag = 'customer_name'; setActiveElementTag('customer_name'); }
                                                }}
                                            />
                                            Customer Name
                                        </label>
                                    </div>
                                )}
                            </div>
                        )}

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

                {selectedMainMesh && (
                    <button
                        onClick={handleSaveMeshData}
                        style={{
                            width: '100%',
                            marginTop: '15px',
                            padding: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            backgroundColor: '#2563eb',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: 'bold'
                        }}
                    >
                        <Save size={16} /> Save Mesh Data
                    </button>
                )}
            </div>

            {/* COLUMN 2: Main 3D Canvas */}
            <div style={{ flex: '0 0 37%', borderRight: '2px solid #555', position: 'relative', boxSizing: 'border-box' }}>
                <Canvas camera={{ position: [0, 0, 3.5], fov: 40 }}>
                    <ambientLight intensity={0.6} />
                    <directionalLight position={[5, 5, 5]} intensity={1} />
                    <directionalLight position={[-5, 5, -5]} intensity={0.5} />
                    <Suspense fallback={<Loader />}>
                        <Bounds fit clip observe margin={1.5}>
                            <Model
                                url="/models/Mug.glb"
                                file={modelFile}
                                textures={mainTextures}
                                meshSettings={mainMeshSettings}
                                onMeshesExtracted={handleMeshesExtracted}
                            />
                        </Bounds>
                    </Suspense>
                    <Grid position={[0, -1, 0]} args={[10.5, 10.5]} cellSize={0.5} cellThickness={1} cellColor="#555555" sectionSize={2.5} sectionThickness={1.5} sectionColor="#666666" fadeDistance={20} />
                    <OrbitControls enablePan={true} enableZoom={true} makeDefault />
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
                models={predefinedModel}
                savedMeshData={savedMeshData}
                mainCanvasWidth={mainContainerRef.current?.clientWidth || 300}
            />


        </div>
    );
}