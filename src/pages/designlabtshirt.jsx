import React, { useState, useRef, Suspense, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls, Grid, Html, useProgress } from '@react-three/drei';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import '../DesignLab.css';
import { Settings2, RefreshCw, Image as ImageIcon, Trash2, Type, Copy, ArrowUp, ArrowDown, Maximize, Download, Camera } from 'lucide-react';
import { fabric } from 'fabric';

const COLORS = [
    '#8B0000', '#FF0000', '#FF8C00', '#FFC0CB', '#FFFF00', '#9ACD32', '#1E90FF', '#4169E1', '#006400', '#4B0082', '#A9A9A9', '#000000'
];

function Loader() {
    const { progress } = useProgress();
    return <Html center><div style={{ color: 'white', background: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '5px' }}>Loading {progress.toFixed(0)}%</div></Html>;
}

function Model({ url, color, isAnimating, animSpeed, isReverse, rotationY, canvasTexture }) {
    const { scene } = useGLTF(url);
    const groupRef = useRef();

    // Clone the scene for the overlay/decal layer
    const decalScene = React.useMemo(() => scene.clone(), [scene]);

    // Apply color to the base model, and texture to the decal model
    useEffect(() => {
        // Base model setup
        scene.traverse((child) => {
            if (child.isMesh) {
                child.material = child.material.clone();
                child.material.color.set(color);
                child.material.map = null;
                child.material.needsUpdate = true;
            }
        });

        // Decal model setup
        decalScene.traverse((child) => {
            if (child.isMesh) {
                child.material = child.material.clone();
                if (canvasTexture) {
                    canvasTexture.wrapS = THREE.ClampToEdgeWrapping;
                    canvasTexture.wrapT = THREE.ClampToEdgeWrapping;
                    canvasTexture.flipY = false;

                    child.material.map = canvasTexture;
                    child.material.transparent = true;
                    // Use polygonOffset to prevent z-fighting with the base model
                    child.material.polygonOffset = true;
                    child.material.polygonOffsetFactor = -1;
                    child.material.polygonOffsetUnits = -1;
                    child.material.depthWrite = false;
                    child.material.visible = true;
                    child.material.needsUpdate = true;
                } else {
                    child.material.visible = false;
                }
            }
        });
    }, [scene, decalScene, color, canvasTexture]);

    // Set explicit rotation when static angle changes, else animate
    useEffect(() => {
        if (groupRef.current && !isAnimating) {
            groupRef.current.rotation.y = THREE.MathUtils.degToRad(rotationY);
        }
    }, [rotationY, isAnimating]);

    useFrame((state, delta) => {
        if (isAnimating && groupRef.current) {
            const speed = (animSpeed / 100) * 2; // scale speed
            const dir = isReverse ? -1 : 1;
            groupRef.current.rotation.y += delta * speed * dir;
        }
    });

    return (
        <group ref={groupRef} position={[0, -1, 0]}>
            <primitive object={scene} scale={1.2} />
            <primitive object={decalScene} scale={1.2} />
        </group>
    );
}

export default function DesignLab() {
    const [modelColor, setModelColor] = useState('#9ACD32');
    const [sceneBg, setSceneBg] = useState('#222222');

    // Animation states
    const [isAnimating, setIsAnimating] = useState(false);
    const [animSpeed, setAnimSpeed] = useState(50);
    const [isReverse, setIsReverse] = useState(false);
    const [showGrid, setShowGrid] = useState(true);

    // Rotation state
    const [rotationY, setRotationY] = useState(45);

    // Parts checkboxes
    const [parts, setParts] = useState({
        Collar: true, Cuff: true, BottomHem: true, Sleeves: true, Inner: true
    });

    const angles = [0, 45, 120, 180, 240, 315];

    // Fabric & Threejs Texture integration
    const canvasElRef = useRef(null);
    const [fabricCanvas, setFabricCanvas] = useState(null);
    const [canvasTexture, setCanvasTexture] = useState(null);

    useEffect(() => {
        if (!canvasElRef.current) return;

        const parent = canvasElRef.current.parentElement;
        const initialWidth = parent ? parent.clientWidth : 756;

        // Initialize Fabric Canvas
        const canvas = new fabric.Canvas(canvasElRef.current, {
            width: initialWidth,
            height: 400,
            backgroundColor: 'transparent'
        });

        // Create a ThreeJS texture from the fabric HTML canvas
        const texture = new THREE.CanvasTexture(canvas.getElement());
        texture.anisotropy = 16;
        setCanvasTexture(texture);
        setFabricCanvas(canvas);

        // Whenever fabric rerenders, tell ThreeJS to update the material
        canvas.on('after:render', () => {
            texture.needsUpdate = true;
        });

        // Handle window resize for responsive canvas
        const handleResize = () => {
            if (canvasElRef.current && canvasElRef.current.parentElement) {
                const newWidth = canvasElRef.current.parentElement.clientWidth;
                canvas.setWidth(newWidth);
                canvas.renderAll();
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            canvas.dispose();
            texture.dispose();
        };
    }, []);

    const handlePartToggle = (part) => {
        setParts(prev => ({ ...prev, [part]: !prev[part] }));
    };

    // Canvas Actions
    const handleAddText = () => {
        if (!fabricCanvas) return;
        const text = new fabric.IText('Text', {
            left: 150,
            top: 130,
            fontFamily: 'Arial',
            fill: '#1E90FF',
            fontSize: 40
        });
        fabricCanvas.add(text);
        fabricCanvas.setActiveObject(text);
        fabricCanvas.renderAll();
    };

    const handleAddImage = () => {
        if (!fabricCanvas) return;
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
                        left: fabricCanvas.width / 2,
                        top: fabricCanvas.height / 2,
                        originX: 'center',
                        originY: 'center'
                    });
                    fabricCanvas.add(img);
                    fabricCanvas.setActiveObject(img);
                    fabricCanvas.renderAll();
                });
            };
            reader.readAsDataURL(file);
        };
        input.click();
    };

    const handleDelete = () => {
        if (!fabricCanvas) return;
        const activeObjects = fabricCanvas.getActiveObjects();
        if (activeObjects.length) {
            fabricCanvas.discardActiveObject();
            activeObjects.forEach(obj => fabricCanvas.remove(obj));
        }
    };

    const handleCopy = () => {
        if (!fabricCanvas) return;
        const activeObject = fabricCanvas.getActiveObject();
        if (!activeObject) return;
        activeObject.clone((cloned) => {
            fabricCanvas.discardActiveObject();
            cloned.set({
                left: cloned.left + 20,
                top: cloned.top + 20,
                evented: true,
            });
            if (cloned.type === 'activeSelection') {
                cloned.canvas = fabricCanvas;
                cloned.forEachObject((obj) => fabricCanvas.add(obj));
                cloned.setCoords();
            } else {
                fabricCanvas.add(cloned);
            }
            fabricCanvas.setActiveObject(cloned);
            fabricCanvas.requestRenderAll();
        });
    };

    const handleBringForward = () => {
        if (!fabricCanvas) return;
        const obj = fabricCanvas.getActiveObject();
        if (obj) fabricCanvas.bringForward(obj);
    };

    const handleSendBackward = () => {
        if (!fabricCanvas) return;
        const obj = fabricCanvas.getActiveObject();
        if (obj) fabricCanvas.sendBackwards(obj);
    };

    const handleOpacityChange = (e) => {
        if (!fabricCanvas) return;
        const obj = fabricCanvas.getActiveObject();
        if (obj) {
            obj.set('opacity', parseFloat(e.target.value));
            fabricCanvas.renderAll();
        }
    };

    const handleClearBackground = () => {
        if (fabricCanvas) {
            fabricCanvas.clear();
            fabricCanvas.backgroundColor = 'transparent';
            fabricCanvas.renderAll();
        }
    };

    return (
        <div className="design-lab-container">
            {/* 3D Canvas Section */}
            <div className="canvas-section" style={{ backgroundColor: sceneBg }}>
                <Canvas camera={{ position: [0, 0, 3.5], fov: 40 }}>
                    <ambientLight intensity={0.6} />
                    <directionalLight position={[5, 5, 5]} intensity={1} />
                    <directionalLight position={[-5, 5, -5]} intensity={0.5} />

                    <Suspense fallback={<Loader />}>
                        <Model
                            url="/models/black_cap.glb"
                            color={modelColor}
                            isAnimating={isAnimating}
                            animSpeed={animSpeed}
                            isReverse={isReverse}
                            rotationY={rotationY}
                            canvasTexture={canvasTexture}
                        />
                    </Suspense>

                    {showGrid && (
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
                    )}

                    <OrbitControls
                        enablePan={false}
                        enableZoom={true}
                        minPolarAngle={Math.PI / 4}
                        maxPolarAngle={Math.PI / 1.5}
                    />
                </Canvas>
            </div>

            {/* Controls Section */}
            <div className="controls-section">
                <div className="controls-header">
                    <h2>3D T-shirt mockup designer</h2>
                    <Link to="/" className="back-btn">Exit</Link>
                </div>

                <div className="control-group">
                    <span className="control-label">Colors:</span>
                    <div className="colors-palette">
                        {COLORS.map(c => (
                            <div
                                key={c}
                                className={`color-swatch ${modelColor === c ? 'selected' : ''}`}
                                style={{ backgroundColor: c }}
                                onClick={() => setModelColor(c)}
                            />
                        ))}
                    </div>
                </div>

                <button className="accordion-btn">
                    <Settings2 size={16} /> Customize colors
                </button>

                <div className="control-group checkbox-grid">
                    <div className="checkbox-col" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label className="checkbox-item"><input type="checkbox" checked={parts.Collar} onChange={() => handlePartToggle('Collar')} /> Collar</label>
                        <label className="checkbox-item"><input type="checkbox" checked={parts.Cuff} onChange={() => handlePartToggle('Cuff')} /> Cuff</label>
                        <label className="checkbox-item"><input type="checkbox" checked={parts.BottomHem} onChange={() => handlePartToggle('BottomHem')} /> Bottom hem</label>
                        <label className="checkbox-item"><input type="checkbox" checked={parts.Sleeves} onChange={() => handlePartToggle('Sleeves')} /> Sleeves</label>
                        <label className="checkbox-item"><input type="checkbox" checked={parts.Inner} onChange={() => handlePartToggle('Inner')} /> Inner</label>
                    </div>

                    <div className="checkbox-col" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span className="control-label" style={{ marginBottom: '4px' }}>Animation speed:</span>
                        <div className="slider-container">
                            <input type="range" min="0" max="100" value={animSpeed} onChange={e => setAnimSpeed(e.target.value)} />
                        </div>
                        <label className="checkbox-item" style={{ marginTop: '8px' }}>
                            <input type="checkbox" checked={isAnimating} onChange={e => setIsAnimating(e.target.checked)} /> Animate
                        </label>
                        <label className="checkbox-item"><input type="checkbox" checked={isReverse} onChange={e => setIsReverse(e.target.checked)} /> Reverse</label>
                        <label className="checkbox-item"><input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} /> Grid</label>
                    </div>
                </div>

                <div className="control-group">
                    <span className="control-label">Static angles:</span>
                    <div className="angles-grid">
                        {angles.map(angle => (
                            <button
                                key={angle}
                                className={`angle-btn ${!isAnimating && rotationY === angle ? 'active' : ''}`}
                                onClick={() => { setIsAnimating(false); setRotationY(angle); }}
                            >
                                {angle}
                            </button>
                        ))}
                    </div>
                    <button className="custom-angle-btn"><RefreshCw size={16} /> Custom angle...</button>
                </div>

                <div className="control-group bg-picker">
                    <input type="color" value={sceneBg} onChange={(e) => setSceneBg(e.target.value)} />
                    <input type="text" value={sceneBg} onChange={(e) => setSceneBg(e.target.value)} />
                    <span style={{ fontSize: '0.85rem' }}>Scene background</span>
                </div>

                <div className="action-buttons">
                    <button className="action-btn"><ImageIcon size={16} /> Add Background Image</button>
                    <button className="action-btn" onClick={handleClearBackground}><Trash2 size={16} /> Clear Background Image</button>
                </div>

                {/* 2D Canvas Area */}
                <div className="image-preview">
                    <div className="fabric-container">
                        <canvas ref={canvasElRef}></canvas>
                    </div>
                </div>

                {/* 2D Editor Toolbar */}
                <div className="action-buttons">
                    <button className="action-btn" onClick={handleAddImage}><ImageIcon size={16} /> Add Image</button>
                    <button className="action-btn" onClick={handleAddText}><Type size={16} /> Add Text</button>
                </div>

                <div className="editor-toolbar">
                    <button className="icon-btn" onClick={handleDelete} title="Delete"><Trash2 size={16} /></button>
                    <button className="icon-btn" onClick={handleCopy} title="Copy"><Copy size={16} /></button>
                    <button className="icon-btn" onClick={handleBringForward} title="Bring Forward"><ArrowUp size={16} /></button>
                    <button className="icon-btn" onClick={handleSendBackward} title="Send Backward"><ArrowDown size={16} /></button>
                    <button className="icon-btn" title="Maximize"><Maximize size={16} /></button>

                    <div className="opacity-slider">
                        Opacity:
                        <input type="range" min="0" max="1" step="0.1" defaultValue="1" onChange={handleOpacityChange} />
                    </div>
                </div>

                <div className="action-buttons">
                    <button className="action-btn"><Camera size={16} /> Snapshot 3D scene</button>
                    <button className="action-btn"><Download size={16} /> Download Layout</button>
                </div>

            </div>
        </div>
    );
}
