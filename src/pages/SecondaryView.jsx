import React, { useState, useRef, Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Bounds } from '@react-three/drei';
import * as THREE from 'three';
import { Image as ImageIcon, Trash2, Type, Download, Palette, PenTool, User, SlidersHorizontal } from 'lucide-react';
import { fabric } from 'fabric';
import { Model, Loader } from './designplacementbypercentage';

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

export default function SecondaryView({
    meshes,
    selectedMainMesh,
    activePlacement,
    models,
    savedMeshData,
    mainCanvasWidth
}) {
    console.log("sa", savedMeshData)
    const [selectedSecondaryMesh, setSelectedSecondaryMesh] = useState('');
    const secondaryFabricInstances = useRef({});
    const secondaryContainerRef = useRef(null);
    const [secondaryTextures, setSecondaryTextures] = useState({});
    const [secondaryActiveCanvas, setSecondaryActiveCanvas] = useState(null);
    const [secondaryMeshSettings, setSecondaryMeshSettings] = useState({});

    // Text styling
    const [textFont, setTextFont] = useState('Arial');
    const [textColor, setTextColor] = useState('#1E90FF');
    const loadedFontsRef = useRef(new Set(['Arial']));

    // Controls are hidden until "Get All" is clicked
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [loadedData, setLoadedData] = useState(null);

    // Global inputs for the 4 categories
    const [customerText, setCustomerText] = useState('');
    const [customerName, setCustomerName] = useState('');
    // Image filter for right column uploads
    const [mainCanvasFilter, setMainCanvasFilter] = useState('none');
    const [artistSignatureFilter, setArtistSignatureFilter] = useState('none');

    // Reset when meshes change (new model loaded)
    useEffect(() => {
        setSelectedSecondaryMesh('');
        secondaryFabricInstances.current = {};
        setSecondaryTextures({});
        setSecondaryActiveCanvas(null);
        setIsDataLoaded(false);
        setLoadedData(null);
    }, [meshes]);

    // Initialize Secondary Canvas
    useEffect(() => {
        if (!selectedSecondaryMesh || !secondaryContainerRef.current) return;
        if (!secondaryFabricInstances.current[selectedSecondaryMesh]) {
            const canvasEl = document.createElement('canvas');
            const cWidth = mainCanvasWidth || 300;
            canvasEl.width = cWidth;
            canvasEl.height = 300;

            const fCanvas = new fabric.Canvas(canvasEl, {
                width: cWidth,
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
    }, [selectedSecondaryMesh, isDataLoaded, loadedData]);

    // Ensure a canvas exists for a given mesh name
    const ensureCanvasForMesh = (meshName) => {
        if (!secondaryFabricInstances.current[meshName]) {
            const canvasEl = document.createElement('canvas');
            const cWidth = mainCanvasWidth || 300;
            canvasEl.width = cWidth;
            canvasEl.height = 300;

            const fCanvas = new fabric.Canvas(canvasEl, {
                width: cWidth,
                height: 300,
                backgroundColor: '#ffffff'
            });

            const texture = new THREE.CanvasTexture(fCanvas.getElement());
            texture.anisotropy = 16;

            fCanvas.on('after:render', () => {
                texture.needsUpdate = true;
                setSecondaryTextures(prev => ({ ...prev, [meshName]: texture }));
            });

            secondaryFabricInstances.current[meshName] = {
                canvas: fCanvas,
                texture: texture,
                htmlElement: canvasEl
            };

            setSecondaryTextures(prev => ({ ...prev, [meshName]: texture }));
        }
        return secondaryFabricInstances.current[meshName].canvas;
    };

    // Place default elements on a specific mesh's canvas
    const placeDefaultElementsOnMesh = (meshName, meshData) => {
        const fCanvas = ensureCanvasForMesh(meshName);
        const canvasWidth = fCanvas.width;
        const canvasHeight = fCanvas.height;

        const defaultElements = meshData.elements.filter(el => el.isDefault);

        defaultElements.forEach(elementPos => {
            if (elementPos.type === 'text' && elementPos.text) {
                const text = new fabric.IText(elementPos.text, {
                    fontFamily: elementPos.fontFamily || 'Arial',
                    fill: elementPos.fill || '#1E90FF',
                    fontSize: 40
                });

                const targetW = (elementPos.w / 100) * canvasWidth;
                const targetH = (elementPos.h / 100) * canvasHeight;

                text.set({
                    scaleX: targetW / text.width,
                    scaleY: targetH / text.height,
                    left: (elementPos.x / 100) * canvasWidth,
                    top: (elementPos.y / 100) * canvasHeight,
                    angle: elementPos.angle || 0,
                    originX: 'left',
                    originY: 'top',
                    hasControls: false,
                    hasBorders: false,
                    selectable: false,
                    evented: false,
                    isDefaultPlaced: true,
                    elementTag: elementPos.elementTag || ''
                });

                fCanvas.add(text);
            } else if (elementPos.type === 'image') {
                fabric.Image.fromURL('https://placehold.co/400x400/png', (img) => {
                    const targetW = (elementPos.w / 100) * canvasWidth;
                    const targetH = (elementPos.h / 100) * canvasHeight;

                    // Apply saved filter
                    if (elementPos.imageFilter && elementPos.imageFilter !== 'none') {
                        const filterInst = getFilterInstance(elementPos.imageFilter);
                        if (filterInst) {
                            img.filters = [filterInst];
                            img.applyFilters();
                        }
                    }

                    img.set({
                        scaleX: targetW / img.width,
                        scaleY: targetH / img.height,
                        left: (elementPos.x / 100) * canvasWidth,
                        top: (elementPos.y / 100) * canvasHeight,
                        angle: elementPos.angle || 0,
                        originX: 'left',
                        originY: 'top',
                        hasControls: false,
                        hasBorders: false,
                        selectable: false,
                        evented: false,
                        isDefaultPlaced: true,
                        elementTag: elementPos.elementTag || ''
                    });

                    fCanvas.add(img);
                    fCanvas.renderAll();
                }, { crossOrigin: 'anonymous' });
            }
        });

        fCanvas.discardActiveObject();
        fCanvas.renderAll();
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

        // Apply ALL saved mesh colors at once
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

        // Auto-place default elements on ALL meshes
        savedMeshNames.forEach(meshName => {
            placeDefaultElementsOnMesh(meshName, savedMeshData[meshName]);
        });

        // Auto-select the first saved mesh
        if (savedMeshNames.length > 0) {
            setSelectedSecondaryMesh(savedMeshNames[0]);
        }
    };

    // Load a Google Font dynamically
    const loadGoogleFont = (fontName) => {
        if (loadedFontsRef.current.has(fontName)) return Promise.resolve();
        return new Promise((resolve) => {
            const link = document.createElement('link');
            link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}&display=swap`;
            link.rel = 'stylesheet';
            link.onload = () => {
                loadedFontsRef.current.add(fontName);
                resolve();
            };
            link.onerror = () => {
                console.warn(`Failed to load font: ${fontName}`);
                resolve();
            };
            document.head.appendChild(link);
        });
    };

    // Find all tagged NON-default positions across all meshes
    const findTaggedPositions = (tag) => {
        if (!loadedData) return [];
        const results = [];
        Object.entries(loadedData).forEach(([meshName, meshData]) => {
            meshData.elements.forEach(el => {
                if (el.elementTag === tag && !el.isDefault) {
                    results.push({ meshName, element: el });
                }
            });
        });
        return results;
    };

    // Place an image on all meshes with a given tag
    const handleGlobalImageUpload = (tag) => {
        const positions = findTaggedPositions(tag);
        if (positions.length === 0) {
            alert(`No positions tagged as "${tag}" found in saved data.`);
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
                positions.forEach(({ meshName, element: elementPos }) => {
                    const fCanvas = ensureCanvasForMesh(meshName);
                    const canvasWidth = fCanvas.width;
                    const canvasHeight = fCanvas.height;

                    // Remove existing placeholder for this tag on this mesh
                    const existing = fCanvas.getObjects().filter(obj => obj.elementTag === tag && obj.isDefaultPlaced);
                    existing.forEach(obj => fCanvas.remove(obj));

                    fabric.Image.fromURL(f.target.result, (img) => {
                        const targetW = (elementPos.w / 100) * canvasWidth;
                        const targetH = (elementPos.h / 100) * canvasHeight;

                        // Apply the selected filter
                        const filterName = tag === 'main_canvas_image' ? mainCanvasFilter : artistSignatureFilter;
                        if (filterName && filterName !== 'none') {
                            const filterInst = getFilterInstance(filterName);
                            if (filterInst) {
                                img.filters = [filterInst];
                                img.applyFilters();
                            }
                        }

                        img.set({
                            scaleX: targetW / img.width,
                            scaleY: targetH / img.height,
                            left: (elementPos.x / 100) * canvasWidth,
                            top: (elementPos.y / 100) * canvasHeight,
                            angle: elementPos.angle || 0,
                            originX: 'left',
                            originY: 'top',
                            hasControls: false,
                            hasBorders: false,
                            selectable: false,
                            evented: false,
                            isDefaultPlaced: true,
                            elementTag: tag
                        });

                        fCanvas.add(img);
                        fCanvas.discardActiveObject();
                        fCanvas.renderAll();
                    });
                });
            };
            reader.readAsDataURL(file);
        };
        input.click();
    };

    // Place text on all meshes with a given tag
    const handleGlobalTextApply = async (tag, textValue) => {
        if (!textValue.trim()) {
            alert('Please enter text first.');
            return;
        }

        const positions = findTaggedPositions(tag);
        if (positions.length === 0) {
            alert(`No positions tagged as "${tag}" found in saved data.`);
            return;
        }

        await loadGoogleFont(textFont);

        positions.forEach(({ meshName, element: elementPos }) => {
            const fCanvas = ensureCanvasForMesh(meshName);
            const canvasWidth = fCanvas.width;
            const canvasHeight = fCanvas.height;

            // Remove existing default text for this tag on this mesh
            const existing = fCanvas.getObjects().filter(obj => obj.elementTag === tag && obj.isDefaultPlaced);
            existing.forEach(obj => fCanvas.remove(obj));

            const text = new fabric.IText(textValue, {
                fontFamily: textFont,
                fill: textColor,
                fontSize: 40
            });

            const targetW = (elementPos.w / 100) * canvasWidth;
            const targetH = (elementPos.h / 100) * canvasHeight;

            text.set({
                scaleX: targetW / text.width,
                scaleY: targetH / text.height,
                left: (elementPos.x / 100) * canvasWidth,
                top: (elementPos.y / 100) * canvasHeight,
                angle: elementPos.angle || 0,
                originX: 'left',
                originY: 'top',
                hasControls: false,
                hasBorders: false,
                selectable: false,
                evented: false,
                isDefaultPlaced: true,
                elementTag: tag
            });

            fCanvas.add(text);
            fCanvas.discardActiveObject();
            fCanvas.renderAll();
        });
    };

    const handleSecondaryDelete = () => {
        if (!secondaryActiveCanvas) return;
        const activeObjects = secondaryActiveCanvas.getActiveObjects();
        if (activeObjects.length) {
            secondaryActiveCanvas.discardActiveObject();
            activeObjects.forEach(obj => secondaryActiveCanvas.remove(obj));
        }
    };

    // Count tagged positions
    const savedMeshNames = loadedData ? Object.keys(loadedData) : [];
    const mainCanvasImageCount = findTaggedPositions('main_canvas_image').length;
    const artistSignatureCount = findTaggedPositions('artist_signature').length;
    const customerTextCount = findTaggedPositions('customer_text').length;
    const customerNameCount = findTaggedPositions('customer_name').length;

    const tagBtnStyle = (hasPositions) => ({
        width: '100%', padding: '8px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        backgroundColor: hasPositions ? '#333' : '#222',
        color: hasPositions ? '#fff' : '#555',
        border: `1px solid ${hasPositions ? '#555' : '#333'}`,
        borderRadius: '5px', cursor: hasPositions ? 'pointer' : 'not-allowed',
        fontSize: '0.85rem'
    });

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

                        {/* Mesh selector - for viewing */}
                        <div className="control-group" style={{ marginBottom: '15px' }}>
                            <span className="control-label" style={{ display: 'block', marginBottom: '5px', color: '#fff' }}>View Mesh:</span>
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

                        {/* === 4 GLOBAL UPLOAD SLOTS === */}
                        <div style={{ marginBottom: '15px', padding: '12px', backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
                            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#e2e8f0' }}>
                                Global Content Uploads
                            </h4>

                            {/* 1. Main Canvas Image */}
                            <div style={{ marginBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Main Canvas Image</span>
                                    <span style={{ fontSize: '0.7rem', color: mainCanvasImageCount > 0 ? '#4ade80' : '#666', fontFamily: 'monospace' }}>
                                        {mainCanvasImageCount} position(s)
                                    </span>
                                </div>
                                <button
                                    onClick={() => handleGlobalImageUpload('main_canvas_image')}
                                    disabled={mainCanvasImageCount === 0}
                                    style={tagBtnStyle(mainCanvasImageCount > 0)}
                                >
                                    <ImageIcon size={14} /> Upload Main Image
                                </button>
                                {mainCanvasImageCount > 0 && (
                                    <div style={{ marginTop: '6px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <SlidersHorizontal size={12} style={{ color: '#94a3b8' }} />
                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Filter:</span>
                                            <select
                                                value={mainCanvasFilter}
                                                onChange={(e) => setMainCanvasFilter(e.target.value)}
                                                style={{ flex: 1, padding: '4px 6px', backgroundColor: '#222', color: '#fff', border: '1px solid #555', borderRadius: '4px', fontSize: '0.75rem' }}
                                            >
                                                {FILTER_OPTIONS.map(f => (
                                                    <option key={f.value} value={f.value}>{f.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 2. Artist Signature Image */}
                            <div style={{ marginBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Artist Signature</span>
                                    <span style={{ fontSize: '0.7rem', color: artistSignatureCount > 0 ? '#4ade80' : '#666', fontFamily: 'monospace' }}>
                                        {artistSignatureCount} position(s)
                                    </span>
                                </div>
                                <button
                                    onClick={() => handleGlobalImageUpload('artist_signature')}
                                    disabled={artistSignatureCount === 0}
                                    style={tagBtnStyle(artistSignatureCount > 0)}
                                >
                                    <PenTool size={14} /> Upload Artist Signature
                                </button>
                                {artistSignatureCount > 0 && (
                                    <div style={{ marginTop: '6px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <SlidersHorizontal size={12} style={{ color: '#94a3b8' }} />
                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Filter:</span>
                                            <select
                                                value={artistSignatureFilter}
                                                onChange={(e) => setArtistSignatureFilter(e.target.value)}
                                                style={{ flex: 1, padding: '4px 6px', backgroundColor: '#222', color: '#fff', border: '1px solid #555', borderRadius: '4px', fontSize: '0.75rem' }}
                                            >
                                                {FILTER_OPTIONS.map(f => (
                                                    <option key={f.value} value={f.value}>{f.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 3. Customer Text */}
                            <div style={{ marginBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Customer Text</span>
                                    <span style={{ fontSize: '0.7rem', color: customerTextCount > 0 ? '#4ade80' : '#666', fontFamily: 'monospace' }}>
                                        {customerTextCount} position(s)
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    <input
                                        type="text"
                                        value={customerText}
                                        onChange={(e) => setCustomerText(e.target.value)}
                                        placeholder="Enter customer text..."
                                        disabled={customerTextCount === 0}
                                        style={{ flex: 1, padding: '8px', backgroundColor: '#222', color: '#fff', border: '1px solid #555', borderRadius: '5px', fontSize: '0.85rem' }}
                                    />
                                    <button
                                        onClick={() => handleGlobalTextApply('customer_text', customerText)}
                                        disabled={customerTextCount === 0}
                                        style={{ ...tagBtnStyle(customerTextCount > 0), width: 'auto', padding: '8px 12px' }}
                                    >
                                        <Type size={14} /> Apply
                                    </button>
                                </div>
                            </div>

                            {/* 4. Customer Name */}
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Customer Name</span>
                                    <span style={{ fontSize: '0.7rem', color: customerNameCount > 0 ? '#4ade80' : '#666', fontFamily: 'monospace' }}>
                                        {customerNameCount} position(s)
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    <input
                                        type="text"
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        placeholder="Enter customer name..."
                                        disabled={customerNameCount === 0}
                                        style={{ flex: 1, padding: '8px', backgroundColor: '#222', color: '#fff', border: '1px solid #555', borderRadius: '5px', fontSize: '0.85rem' }}
                                    />
                                    <button
                                        onClick={() => handleGlobalTextApply('customer_name', customerName)}
                                        disabled={customerNameCount === 0}
                                        style={{ ...tagBtnStyle(customerNameCount > 0), width: 'auto', padding: '8px 12px' }}
                                    >
                                        <User size={14} /> Apply
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Text Font & Color Controls */}
                        <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#2a2a2a', borderRadius: '5px', border: '1px solid #444' }}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#aaa' }}>
                                <Palette size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                                Text Styling (for Customer Text & Name)
                            </h4>

                            {/* Font Input */}
                            <div style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
                                <input
                                    type="text"
                                    value={textFont}
                                    onChange={(e) => setTextFont(e.target.value)}
                                    placeholder="Google Font name..."
                                    style={{ flex: 1, padding: '8px', backgroundColor: '#222', color: '#fff', border: '1px solid #555', borderRadius: '5px', fontSize: '0.85rem' }}
                                />
                            </div>

                            {/* Text Color */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '0.8rem', color: '#aaa' }}>Text Color:</span>
                                <input
                                    type="color"
                                    value={textColor}
                                    onChange={(e) => setTextColor(e.target.value)}
                                    style={{ width: '36px', height: '36px', padding: '0', border: '1px solid #555', cursor: 'pointer', borderRadius: '5px' }}
                                />
                                <span style={{ fontSize: '0.8rem', color: '#fff', fontFamily: 'monospace' }}>{textColor}</span>
                            </div>
                        </div>

                        {/* Hidden canvas container for Fabric.js */}
                        <div style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', zIndex: -1 }}>
                            <div ref={secondaryContainerRef} style={{ width: '300px', height: '300px' }}></div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
