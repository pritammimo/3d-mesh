import React, { useState, useRef, Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Bounds } from '@react-three/drei';
import * as THREE from 'three';
import { Image as ImageIcon, Trash2, Type, Download } from 'lucide-react';
import { fabric } from 'fabric';
import { Model, Loader } from './designplacementbypercentage';

export default function SecondaryView({
    meshes,
    selectedMainMesh,
    activePlacement,
    models,
    savedMeshData
}) {
    const [selectedSecondaryMesh, setSelectedSecondaryMesh] = useState('');
    const secondaryFabricInstances = useRef({});
    const secondaryContainerRef = useRef(null);
    const [secondaryTextures, setSecondaryTextures] = useState({});
    const [secondaryActiveCanvas, setSecondaryActiveCanvas] = useState(null);
    const [secondaryMeshSettings, setSecondaryMeshSettings] = useState({});
    const [secondaryTextInput, setSecondaryTextInput] = useState('Text');

    // Controls are hidden until "Get All" is clicked
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [loadedData, setLoadedData] = useState(null);

    // Track which element index to place next for the selected mesh
    const [currentElementIndex, setCurrentElementIndex] = useState(0);

    // Reset when meshes change (new model loaded)
    useEffect(() => {
        setSelectedSecondaryMesh('');
        secondaryFabricInstances.current = {};
        setSecondaryTextures({});
        setSecondaryActiveCanvas(null);
        setIsDataLoaded(false);
        setLoadedData(null);
        setCurrentElementIndex(0);
    }, [meshes]);

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

    // When a mesh is selected and data is loaded, apply the saved color
    useEffect(() => {
        if (!isDataLoaded || !loadedData || !selectedSecondaryMesh) return;
        const meshEntry = loadedData[selectedSecondaryMesh];
        if (meshEntry && meshEntry.color) {
            setSecondaryMeshSettings(prev => ({
                ...prev,
                [selectedSecondaryMesh]: {
                    ...(prev[selectedSecondaryMesh] || {}),
                    color: meshEntry.color
                }
            }));
        }
        // Reset element index when switching meshes
        setCurrentElementIndex(0);
    }, [selectedSecondaryMesh, isDataLoaded, loadedData]);

    // Get the current element position from loaded data for the selected mesh
    const getCurrentElementPosition = () => {
        if (!loadedData || !selectedSecondaryMesh) return null;
        const meshEntry = loadedData[selectedSecondaryMesh];
        if (!meshEntry || !meshEntry.elements || meshEntry.elements.length === 0) return null;
        if (currentElementIndex >= meshEntry.elements.length) return null;
        return meshEntry.elements[currentElementIndex];
    };

    const handleGetAllData = () => {
        if (!savedMeshData || Object.keys(savedMeshData).length === 0) {
            alert('No saved mesh data yet. Use the Save button in Column 1 first.');
            return;
        }
        console.log('📦 ALL SAVED MESH DATA:');
        console.log(JSON.stringify(savedMeshData, null, 2));

        setLoadedData(savedMeshData);
        setIsDataLoaded(true);

        // Apply ALL saved mesh colors at once to the secondary 3D model
        const allColorSettings = {};
        const savedMeshNames = Object.keys(savedMeshData);
        savedMeshNames.forEach(meshName => {
            if (savedMeshData[meshName].color) {
                allColorSettings[meshName] = {
                    color: savedMeshData[meshName].color
                };
            }
        });
        setSecondaryMeshSettings(prev => ({ ...prev, ...allColorSettings }));

        // Auto-select the first saved mesh
        if (savedMeshNames.length > 0) {
            setSelectedSecondaryMesh(savedMeshNames[0]);
        }
    };

    const handleSecondaryAddText = () => {
        if (!secondaryActiveCanvas) return;
        const elementPos = getCurrentElementPosition();
        if (!elementPos) {
            alert('No more saved element positions available for this mesh.');
            return;
        }

        const canvasWidth = secondaryActiveCanvas.width;
        const canvasHeight = secondaryActiveCanvas.height;

        const text = new fabric.IText(secondaryTextInput, {
            fontFamily: 'Arial',
            fill: '#1E90FF',
            fontSize: 40
        });

        const targetW = (elementPos.w / 100) * canvasWidth;
        const targetH = (elementPos.h / 100) * canvasHeight;

        const scaleX = targetW / text.width;
        const scaleY = targetH / text.height;

        text.set({
            scaleX: scaleX,
            scaleY: scaleY,
            left: (elementPos.x / 100) * canvasWidth,
            top: (elementPos.y / 100) * canvasHeight,
            angle: elementPos.angle || 0,
            originX: 'left',
            originY: 'top'
        });

        secondaryActiveCanvas.add(text);
        secondaryActiveCanvas.setActiveObject(text);
        secondaryActiveCanvas.renderAll();

        // Advance to next element position
        setCurrentElementIndex(prev => prev + 1);
    };

    const handleSecondaryAddImage = () => {
        if (!secondaryActiveCanvas) return;
        const elementPos = getCurrentElementPosition();
        if (!elementPos) {
            alert('No more saved element positions available for this mesh.');
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

                    const targetW = (elementPos.w / 100) * canvasWidth;
                    const targetH = (elementPos.h / 100) * canvasHeight;

                    const scaleX = targetW / img.width;
                    const scaleY = targetH / img.height;

                    img.set({
                        scaleX: scaleX,
                        scaleY: scaleY,
                        left: (elementPos.x / 100) * canvasWidth,
                        top: (elementPos.y / 100) * canvasHeight,
                        angle: elementPos.angle || 0,
                        originX: 'left',
                        originY: 'top'
                    });

                    secondaryActiveCanvas.add(img);
                    secondaryActiveCanvas.setActiveObject(img);
                    secondaryActiveCanvas.renderAll();

                    // Advance to next element position
                    setCurrentElementIndex(prev => prev + 1);
                });
            };
            reader.readAsDataURL(file);
        };
        input.click();
    };

    const handleSecondaryDelete = () => {
        if (!secondaryActiveCanvas) return;
        const activeObjects = secondaryActiveCanvas.getActiveObjects();
        if (activeObjects.length) {
            secondaryActiveCanvas.discardActiveObject();
            activeObjects.forEach(obj => secondaryActiveCanvas.remove(obj));
        }
    };

    // Get saved meshes list and current element info
    const savedMeshNames = loadedData ? Object.keys(loadedData) : [];
    const currentElement = getCurrentElementPosition();
    const totalElements = loadedData && selectedSecondaryMesh && loadedData[selectedSecondaryMesh]
        ? loadedData[selectedSecondaryMesh].elements.length
        : 0;

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

                {/* Get All Button - always visible */}
                <button
                    onClick={handleGetAllData}
                    style={{
                        width: '100%',
                        marginBottom: '15px',
                        padding: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        backgroundColor: '#16a34a',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: 'bold'
                    }}
                >
                    <Download size={16} /> Get All Saved Data
                </button>

                {/* Controls only appear after "Get All" is clicked */}
                {isDataLoaded && loadedData && (
                    <>
                        {/* Saved meshes info */}
                        <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#1e3a2f', borderRadius: '5px', border: '1px solid #2d5a3f' }}>
                            <span style={{ fontSize: '0.8rem', color: '#4ade80' }}>
                                {savedMeshNames.length} mesh(es) loaded: {savedMeshNames.join(', ')}
                            </span>
                        </div>

                        {/* Mesh selector - only saved meshes */}
                        <div className="control-group" style={{ marginBottom: '15px' }}>
                            <span className="control-label" style={{ display: 'block', marginBottom: '5px', color: '#fff' }}>Select Mesh:</span>
                            <select
                                value={selectedSecondaryMesh}
                                onChange={(e) => setSelectedSecondaryMesh(e.target.value)}
                                style={{ width: '100%', padding: '10px', backgroundColor: '#222', color: '#fff', border: '1px solid #777', borderRadius: '5px' }}
                            >
                                {savedMeshNames.map(mesh => (
                                    <option key={mesh} value={mesh}>{mesh}</option>
                                ))}
                            </select>
                        </div>

                        {selectedSecondaryMesh && loadedData[selectedSecondaryMesh] && (
                            <>
                                {/* Show saved color */}
                                <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#2a2a2a', borderRadius: '5px', border: '1px solid #444' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '0.85rem', color: '#aaa' }}>Mesh Color:</span>
                                        <div style={{
                                            width: '24px', height: '24px',
                                            backgroundColor: loadedData[selectedSecondaryMesh].color,
                                            borderRadius: '4px', border: '1px solid #666'
                                        }} />
                                        <span style={{ fontSize: '0.8rem', color: '#fff', fontFamily: 'monospace' }}>
                                            {loadedData[selectedSecondaryMesh].color}
                                        </span>
                                    </div>
                                </div>

                                {/* Element position queue info */}
                                <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#2a2a2a', borderRadius: '5px', border: '1px solid #444' }}>
                                    <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#aaa' }}>
                                        Element Positions ({currentElementIndex}/{totalElements})
                                    </h4>
                                    {currentElement ? (
                                        <div style={{ fontSize: '0.8rem', color: '#4ade80', fontFamily: 'monospace' }}>
                                            <p style={{ margin: '3px 0' }}>Next: [{currentElement.type}] X: {currentElement.x}% | Y: {currentElement.y}%</p>
                                            <p style={{ margin: '3px 0' }}>W: {currentElement.w}% | H: {currentElement.h}%</p>
                                            {currentElement.text && (
                                                <p style={{ margin: '3px 0' }}>Original text: "{currentElement.text}"</p>
                                            )}
                                        </div>
                                    ) : (
                                        <p style={{ fontSize: '0.8rem', color: '#888', margin: 0 }}>
                                            {totalElements === 0 ? 'No elements saved for this mesh.' : 'All element positions used.'}
                                        </p>
                                    )}
                                </div>

                                {/* Add controls - only if there are positions left */}
                                {currentElement && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px' }}>
                                        <button onClick={handleSecondaryAddImage} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '8px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '5px', cursor: 'pointer' }}>
                                            <ImageIcon size={16} /> Add Image at Position {currentElementIndex + 1}
                                        </button>

                                        <div style={{ display: 'flex', gap: '5px' }}>
                                            <input
                                                type="text"
                                                value={secondaryTextInput}
                                                onChange={(e) => setSecondaryTextInput(e.target.value)}
                                                placeholder="Enter text..."
                                                style={{ flex: 1, padding: '8px', backgroundColor: '#222', color: '#fff', border: '1px solid #555', borderRadius: '5px' }}
                                            />
                                            <button onClick={handleSecondaryAddText} style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '8px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '5px', cursor: 'pointer' }}>
                                                <Type size={16} /> Add Text
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                    <button onClick={handleSecondaryDelete} title="Delete" style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                </div>

                                <div style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', zIndex: -1 }}>
                                    <div ref={secondaryContainerRef} style={{ width: '300px', height: '300px' }}></div>
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
