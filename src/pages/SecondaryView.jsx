import React, { useState, useRef, Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Bounds } from '@react-three/drei';
import * as THREE from 'three';
import { Image as ImageIcon, Trash2, Type } from 'lucide-react';
import { fabric } from 'fabric';
import { Model, Loader } from './designplacementbypercentage';

export default function SecondaryView({
    meshes,
    selectedMainMesh,
    activePlacement,
    models
}) {
    const [selectedSecondaryMesh, setSelectedSecondaryMesh] = useState('');
    const secondaryFabricInstances = useRef({});
    const secondaryContainerRef = useRef(null);
    const [secondaryTextures, setSecondaryTextures] = useState({});
    const [secondaryActiveCanvas, setSecondaryActiveCanvas] = useState(null);
    const [secondaryMeshSettings, setSecondaryMeshSettings] = useState({});
    const [copiedPlacement, setCopiedPlacement] = useState(null);
    const [secondaryTextInput, setSecondaryTextInput] = useState('Text');
    console.log("meshes", meshes)
    console.log("selected", selectedMainMesh);
    console.log("activePlacement", activePlacement)
    // Reset when meshes change (new model loaded)
    useEffect(() => {
        setSelectedSecondaryMesh('');
        secondaryFabricInstances.current = {};
        setSecondaryTextures({});
        setSecondaryActiveCanvas(null);
        setCopiedPlacement(null);
    }, [meshes]);

    useEffect(() => {
        if (meshes && meshes.length > 0) {
            if (!selectedSecondaryMesh) setSelectedSecondaryMesh(meshes[0]);
        }
    }, [meshes, selectedSecondaryMesh]);

    // Initialize Secondary Canvas
    useEffect(() => {
        if (!selectedSecondaryMesh || !secondaryContainerRef.current) return;
        if (!secondaryFabricInstances.current[selectedSecondaryMesh]) {
            const canvasEl = document.createElement('canvas');
            canvasEl.width = 300;
            canvasEl.height = 300;

            const fCanvas = new fabric.Canvas(canvasEl, {
                width: 300,
                height: 300,
                backgroundColor: '#ffffff'
            });

            const texture = new THREE.CanvasTexture(fCanvas.getElement());
            texture.anisotropy = 16;

            fCanvas.on('after:render', () => {
                texture.needsUpdate = true;
                setSecondaryTextures(prev => ({ ...prev, [selectedSecondaryMesh]: texture }));
            });

            secondaryFabricInstances.current[selectedSecondaryMesh] = {
                canvas: fCanvas,
                texture: texture,
                htmlElement: canvasEl
            };

            setSecondaryTextures(prev => ({ ...prev, [selectedSecondaryMesh]: texture }));
        }

        const container = secondaryContainerRef.current;
        container.innerHTML = '';
        const activeData = secondaryFabricInstances.current[selectedSecondaryMesh];
        if (activeData) {
            if (activeData.canvas.wrapperEl) {
                container.appendChild(activeData.canvas.wrapperEl);
            }
            setSecondaryActiveCanvas(activeData.canvas);
        }
    }, [selectedSecondaryMesh]);

    const handleSecondaryCopyPlacement = () => {
        if (!activePlacement) {
            alert("Please select an object in the first column first.");
            return;
        }
        setCopiedPlacement(activePlacement);

        const logData = {
            sourceMesh: selectedMainMesh,
            targetMesh: selectedSecondaryMesh,
            copiedElement: {
                xPercentage: Number(activePlacement.x.toFixed(2)),
                yPercentage: Number(activePlacement.y.toFixed(2)),
                widthPercentage: Number(activePlacement.w.toFixed(2)),
                heightPercentage: Number(activePlacement.h.toFixed(2)),
                angle: activePlacement.angle
            }
        };

        console.log("📌 COPIED POSITION DATA:");
        console.log(JSON.stringify(logData, null, 2));
    };

    const handleSecondaryAddText = () => {
        if (!secondaryActiveCanvas) return;
        if (!copiedPlacement) {
            alert("Please click 'Copy Position' first to grab coordinates.");
            return;
        }

        const canvasWidth = secondaryActiveCanvas.width;
        const canvasHeight = secondaryActiveCanvas.height;

        const text = new fabric.IText(secondaryTextInput, {
            fontFamily: 'Arial',
            fill: '#1E90FF',
            fontSize: 40
        });

        const targetW = (copiedPlacement.w / 100) * canvasWidth;
        const targetH = (copiedPlacement.h / 100) * canvasHeight;

        const scaleX = targetW / text.width;
        const scaleY = targetH / text.height;

        text.set({
            scaleX: scaleX,
            scaleY: scaleY,
            left: (copiedPlacement.x / 100) * canvasWidth,
            top: (copiedPlacement.y / 100) * canvasHeight,
            angle: copiedPlacement.angle,
            originX: copiedPlacement.originX,
            originY: copiedPlacement.originY
        });

        secondaryActiveCanvas.add(text);
        secondaryActiveCanvas.setActiveObject(text);
        secondaryActiveCanvas.renderAll();
    };

    const handleSecondaryAddImage = () => {
        if (!secondaryActiveCanvas) return;
        if (!copiedPlacement) {
            alert("Please click 'Copy Position' first to grab coordinates.");
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
                fabric.Image.fromURL(f.target.result, (img) => {
                    const canvasWidth = secondaryActiveCanvas.width;
                    const canvasHeight = secondaryActiveCanvas.height;

                    const targetW = (copiedPlacement.w / 100) * canvasWidth;
                    const targetH = (copiedPlacement.h / 100) * canvasHeight;

                    const scaleX = targetW / img.width;
                    const scaleY = targetH / img.height;

                    img.set({
                        scaleX: scaleX,
                        scaleY: scaleY,
                        left: (copiedPlacement.x / 100) * canvasWidth,
                        top: (copiedPlacement.y / 100) * canvasHeight,
                        angle: copiedPlacement.angle,
                        originX: copiedPlacement.originX,
                        originY: copiedPlacement.originY
                    });

                    secondaryActiveCanvas.add(img);
                    secondaryActiveCanvas.setActiveObject(img);
                    secondaryActiveCanvas.renderAll();
                });
            };
            reader.readAsDataURL(file);
        };
        input.click();
    };
    //const models = '/models/Mug.glb'
    const handleSecondaryDelete = () => {
        if (!secondaryActiveCanvas) return;
        const activeObjects = secondaryActiveCanvas.getActiveObjects();
        if (activeObjects.length) {
            secondaryActiveCanvas.discardActiveObject();
            activeObjects.forEach(obj => secondaryActiveCanvas.remove(obj));
        }
    };

    const handleSecondaryColorChange = (color) => {
        setSecondaryMeshSettings(prev => ({
            ...prev,
            [selectedSecondaryMesh]: {
                ...(prev[selectedSecondaryMesh] || {}),
                color: color
            }
        }));
    };

    return (
        <div style={{ flex: '1', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', backgroundColor: '#1a1a1a' }}>

            {/* TOP: Secondary 3D Canvas */}
            <div style={{ flex: '1', borderBottom: '2px solid #555', position: 'relative', minHeight: '300px' }}>
                <Canvas camera={{ position: [0, 0, 3.5], fov: 40 }} style={{ background: '#ffffff' }}>
                    <ambientLight intensity={0.6} />
                    <directionalLight position={[5, 5, 5]} intensity={1} />
                    <directionalLight position={[-5, 5, -5]} intensity={0.5} />
                    <Suspense fallback={<Loader />}>
                        <Bounds fit clip observe margin={1.5}>
                            <Model
                                url={models}
                                textures={secondaryTextures}
                                meshSettings={secondaryMeshSettings}
                            />
                        </Bounds>
                    </Suspense>
                    <OrbitControls enablePan={true} enableZoom={true} makeDefault />
                </Canvas>
                <div style={{ position: 'absolute', top: '10px', left: '10px', backgroundColor: 'rgba(0,0,0,0.5)', padding: '5px 10px', borderRadius: '5px', pointerEvents: 'none', color: '#fff' }}>
                    Secondary View
                </div>
            </div>

            {/* BOTTOM: Secondary Controls */}
            <div style={{ flex: '1', padding: '15px', overflowY: 'auto' }}>
                <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem', color: '#fff' }}>Placement By Percentage</h3>

                <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#2a2a2a', borderRadius: '5px', border: '1px solid #444' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#aaa' }}>Copied Coordinates</h4>
                        <button onClick={handleSecondaryCopyPlacement} style={{ padding: '4px 8px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>
                            Copy Position
                        </button>
                    </div>
                    {copiedPlacement ? (
                        <div style={{ fontSize: '0.85rem', color: '#4ade80', fontFamily: 'monospace' }}>
                            <p style={{ margin: '4px 0' }}>X: {copiedPlacement.x.toFixed(2)}% | Y: {copiedPlacement.y.toFixed(2)}%</p>
                            <p style={{ margin: '4px 0' }}>W: {copiedPlacement.w.toFixed(2)}% | H: {copiedPlacement.h.toFixed(2)}%</p>
                        </div>
                    ) : (
                        <p style={{ fontSize: '0.8rem', color: '#888', margin: 0 }}>Click 'Copy Position' to grab coordinates.</p>
                    )}
                </div>

                {meshes.length > 0 && (
                    <div className="control-group" style={{ marginBottom: '15px' }}>
                        <span className="control-label" style={{ display: 'block', marginBottom: '5px', color: '#fff' }}>Select Separate Mesh:</span>
                        <select
                            value={selectedSecondaryMesh}
                            onChange={(e) => setSelectedSecondaryMesh(e.target.value)}
                            style={{ width: '100%', padding: '10px', backgroundColor: '#222', color: '#fff', border: '1px solid #777', borderRadius: '5px' }}
                        >
                            {meshes.map(mesh => (
                                <option key={mesh} value={mesh}>{mesh}</option>
                            ))}
                        </select>
                    </div>
                )}

                {selectedSecondaryMesh && (
                    <>
                        <div className="control-group" style={{ marginBottom: '15px' }}>
                            <span className="control-label" style={{ display: 'block', marginBottom: '5px', color: '#fff' }}>Mesh Color:</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <input type="color"
                                    value={secondaryMeshSettings[selectedSecondaryMesh]?.color || '#ffffff'}
                                    onChange={(e) => handleSecondaryColorChange(e.target.value)}
                                    style={{ width: '40px', height: '40px', padding: '0', border: '1px solid #777', cursor: 'pointer', borderRadius: '5px' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px' }}>
                            <button onClick={handleSecondaryAddImage} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '8px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '5px', cursor: 'pointer' }}><ImageIcon size={16} /> Add New Image Here</button>

                            <div style={{ display: 'flex', gap: '5px' }}>
                                <input
                                    type="text"
                                    value={secondaryTextInput}
                                    onChange={(e) => setSecondaryTextInput(e.target.value)}
                                    placeholder="Enter text..."
                                    style={{ flex: 1, padding: '8px', backgroundColor: '#222', color: '#fff', border: '1px solid #555', borderRadius: '5px' }}
                                />
                                <button onClick={handleSecondaryAddText} style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '8px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '5px', cursor: 'pointer' }}><Type size={16} /> Add Text</button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <button onClick={handleSecondaryDelete} title="Delete" style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                        </div>

                        <div style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', zIndex: -1 }}>
                            <div ref={secondaryContainerRef} style={{ width: '300px', height: '300px' }}></div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
