import React, { useState, useRef, Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, OrbitControls, Grid, Html, useProgress } from '@react-three/drei';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import '../DesignLab.css';
import { Image as ImageIcon, Type, Upload } from 'lucide-react';
import { fabric } from 'fabric';

function Loader() {
    const { progress } = useProgress();
    return <Html center><div style={{ color: 'white', background: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '5px' }}>Loading {progress.toFixed(0)}%</div></Html>;
}

// Fixed placement config based on user request
const PLACEMENT_CONFIG = {
    "Mesh[0]": {
        color: "#d82a2aff",
        uv: { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: -0.04 },
        text: { Left: 445.38, Top: 208.87, ScaleX: 0.41, ScaleY: 0.41, Angle: 180.63964113580428 },
        image: { Left: 377.25, Top: 198.73, ScaleX: 0.26, ScaleY: 0.28, Angle: 0 },
    },
    "Mesh[1]": {
        color: "#ffffffff",
        uv: { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: -0.04 },
        text: { left: 150.00, Top: 118.01, ScaleX: 3.47, ScaleY: 3.47, Angle: 0 },
        image: { Left: 379.00, Top: 196.25, ScaleX: 0.26, ScaleY: 0.29, Angle: 0 }
    },
    "Mesh[2]": {
        color: "#ffffff",
        uv: { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 },
        text: { Left: 193.57, Top: 162.64, ScaleX: 0.61, ScaleY: 0.49, Angle: 180.6993440962088 },
        image: { left: 378.00, top: 200.00, scaleX: 0.07, scaleY: 0.07, angle: 0 }
    },
    default: {
        color: "#c51515ff",
        uv: { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 },
        text: { left: 150.00, Top: 118.01, ScaleX: 3.47, ScaleY: 3.47, Angle: 0 },
        image: { Left: 540.00, Top: 273.95, ScaleX: 0.07, ScaleY: 0.07, Angle: 0 }
    }
};

// Model component
function Model({ url, file, textures, onMeshesExtracted }) {
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
    const [uniqueMeshesList, setUniqueMeshesList] = useState([]);

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

        const offsetX = 0;
        const offsetY = -0.04;
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
        setUniqueMeshesList(uniqueMeshes);
        if (onMeshesExtracted) {
            onMeshesExtracted(uniqueMeshes);
        }
    }, [scene]);

    useEffect(() => {
        if (!scene || uniqueMeshesList.length === 0) return;
        scene.traverse((child) => {
            if (!child.isMesh) return;

            const index = uniqueMeshesList.indexOf(child.name);
            const meshKey = `Mesh[${index}]`;
            const config = PLACEMENT_CONFIG[meshKey] || PLACEMENT_CONFIG.default;

            const applyTexture = (mat, tex) => {
                if (config && config.color) {
                    mat.color.set(config.color.slice(0, 7));
                }

                if (tex) {
                    tex.wrapS = THREE.RepeatWrapping;
                    tex.wrapT = THREE.RepeatWrapping;
                    tex.flipY = false;

                    if (config && config.uv) {
                        tex.repeat.set(config.uv.scaleX ?? 1, config.uv.scaleY ?? 1);
                        tex.offset.set(config.uv.offsetX ?? 0, config.uv.offsetY ?? 0);
                    } else {
                        tex.repeat.set(1, 1);
                        tex.offset.set(0, 0);
                    }

                    tex.needsUpdate = true;
                    mat.map = tex;
                    mat.transparent = true;
                } else {
                    mat.map = null;
                }
                mat.needsUpdate = true;
            };

            if (Array.isArray(child.userData.originalMaterial)) {
                child.material = child.userData.originalMaterial.map(m => m.clone());
                child.material.forEach(mat => {
                    applyTexture(mat, textures[meshKey]);
                });
            } else if (child.userData.originalMaterial) {
                child.material = child.userData.originalMaterial.clone();
                applyTexture(child.material, textures[meshKey]);
            }
        });
    }, [scene, textures, uniqueMeshesList]);

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

const DesignPlacement = () => {
    const [modelFile, setModelFile] = useState(null);
    const [meshes, setMeshes] = useState([]);
    const [selectedMesh, setSelectedMesh] = useState('');
    console.log("selectedMesh", selectedMesh);
    // For text input
    const [textContent, setTextContent] = useState('My Custom Text');

    const fabricInstances = useRef({});
    const [textures, setTextures] = useState({});

    const activeConfig = PLACEMENT_CONFIG[selectedMesh] || PLACEMENT_CONFIG.default;
    console.log("activeConfig", activeConfig);
    const handleModelUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setModelFile(file);
            setMeshes([]);
            setSelectedMesh('');
            fabricInstances.current = {};
            setTextures({});
        }
    };

    const handleMeshesExtracted = (extractedMeshes) => {
        console.log("ex", extractedMeshes)
        const renameMeshes = extractedMeshes.map((_, index) => `Mesh[${index}]`)
        console.log("renameMeshes", renameMeshes)
        setMeshes(renameMeshes);
        if (extractedMeshes.length > 0 && !selectedMesh) {
            setSelectedMesh(renameMeshes[0]);
        }
    };

    // Auto-create hidden fabric canvas for the selected mesh
    useEffect(() => {
        if (!selectedMesh) return;

        if (!fabricInstances.current[selectedMesh]) {
            const canvasEl = document.createElement('canvas');
            // Provide a fixed resolution for reliable fixed positioning
            canvasEl.width = 800;
            canvasEl.height = 800;

            const fCanvas = new fabric.Canvas(canvasEl, {
                width: 800,
                height: 800,
                backgroundColor: null
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

    const handleAddText = () => {
        const activeData = fabricInstances.current[selectedMesh];
        if (!activeData || !activeData.canvas) return;

        const fCanvas = activeData.canvas;

        // Remove existing text if any to keep it clean, or just add
        const text = new fabric.IText(textContent, {
            left: activeConfig.text.left ?? activeConfig.text.Left,
            top: activeConfig.text.top ?? activeConfig.text.Top,
            scaleX: activeConfig.text.scaleX ?? activeConfig.text.ScaleX,
            scaleY: activeConfig.text.scaleY ?? activeConfig.text.ScaleY,
            angle: activeConfig.text.angle ?? activeConfig.text.Angle,
            fontFamily: 'Arial',
            fill: '#1E90FF',
            originX: 'center',
            originY: 'center'
        });

        fCanvas.add(text);
        fCanvas.renderAll();
    };

    const handleAddImage = (e) => {
        const activeData = fabricInstances.current[selectedMesh];
        if (!activeData || !activeData.canvas) return;

        const file = e.target.files[0];
        if (!file) return;

        const fCanvas = activeData.canvas;
        const reader = new FileReader();

        reader.onload = (f) => {
            fabric.Image.fromURL(f.target.result, (img) => {
                img.set({
                    left: activeConfig.image.left ?? activeConfig.image.Left,
                    top: activeConfig.image.top ?? activeConfig.image.Top,
                    scaleX: activeConfig.image.scaleX ?? activeConfig.image.ScaleX,
                    scaleY: activeConfig.image.scaleY ?? activeConfig.image.ScaleY,
                    angle: activeConfig.image.angle ?? activeConfig.image.Angle,
                    originX: 'center',
                    originY: 'center'
                });
                fCanvas.add(img);
                fCanvas.renderAll();
            });
        };
        reader.readAsDataURL(file);
    };
    console.log("meshes", meshes)
    return (
        <div className="design-lab-container" style={{ flexDirection: 'row' }}>
            {/* LEFT SIDE: Controls Section */}
            <div className="controls-section" style={{ borderLeft: 'none', borderRight: '2px solid #555', flex: '0 0 300px' }}>
                <div className="controls-header">
                    <h2>Design Placement</h2>
                    <Link to="/" className="back-btn">Exit</Link>
                </div>

                <div className="control-group">
                    <span className="control-label">Upload 3D Model:</span>
                    <label className="action-btn" style={{ cursor: 'pointer', marginBottom: '15px' }}>
                        <Upload size={16} /> Upload Model
                        <input type="file" accept=".glb,.gltf" style={{ display: 'none' }} onChange={handleModelUpload} />
                    </label>
                </div>

                {meshes.length > 0 && (
                    <div className="control-group" style={{ marginBottom: '20px' }}>
                        <span className="control-label">Target Mesh:</span>
                        <select
                            value={selectedMesh}
                            onChange={(e) => { setSelectedMesh(e.target.value); console.log('e.target.value', e.target.value) }}
                            style={{ width: '100%', padding: '10px', backgroundColor: '#222', color: '#fff', border: '1px solid #777' }}
                        >
                            {meshes.map((mesh, idx) => (
                                <option key={mesh} value={mesh}>[{idx}] {mesh}</option>
                            ))}
                        </select>
                    </div>
                )}

                {selectedMesh && (
                    <div style={{ backgroundColor: '#2a2a2a', padding: '15px', borderRadius: '8px' }}>
                        <h3 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '15px' }}>Apply Design Elements</h3>
                        <p style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '15px' }}>
                            Elements will be applied at predefined fixed coordinates.
                        </p>

                        <div className="control-group" style={{ marginBottom: '15px' }}>
                            <span className="control-label">Text Content:</span>
                            <input
                                type="text"
                                value={textContent}
                                onChange={(e) => setTextContent(e.target.value)}
                                style={{ width: '100%', padding: '8px', marginBottom: '10px', backgroundColor: '#111', color: '#fff', border: '1px solid #555' }}
                            />
                            <button className="action-btn" onClick={handleAddText} style={{ width: '100%' }}>
                                <Type size={16} /> Place Text
                            </button>
                        </div>

                        <div className="control-group">
                            <span className="control-label">Image Upload:</span>
                            <label className="action-btn" style={{ cursor: 'pointer', width: '100%' }}>
                                <ImageIcon size={16} /> Place Image
                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAddImage} />
                            </label>
                        </div>

                        <div style={{ marginTop: '30px', fontSize: '0.75rem', color: '#888' }}>
                            <div><strong>Current Placement Settings ({selectedMesh}):</strong></div>
                            <div style={{ marginTop: '5px' }}>Text: Left {activeConfig.text.left ?? activeConfig.text.Left}, Top {activeConfig.text.top ?? activeConfig.text.Top}, Scale {activeConfig.text.scaleX ?? activeConfig.text.ScaleX}</div>
                            <div style={{ marginTop: '5px' }}>Image: Left {activeConfig.image.left ?? activeConfig.image.Left}, Top {activeConfig.image.top ?? activeConfig.image.Top}, Scale {activeConfig.image.scaleX ?? activeConfig.image.ScaleX}</div>
                        </div>
                    </div>
                )}
            </div>

            {/* RIGHT SIDE: 3D Canvas Section (Only 3D Viewer) */}
            <div className="canvas-section" style={{ backgroundColor: '#222', flex: 1 }}>
                <Canvas camera={{ position: [0, 0, 3.5], fov: 40 }}>
                    <ambientLight intensity={0.6} />
                    <directionalLight position={[5, 5, 5]} intensity={1} />
                    <directionalLight position={[-5, 5, -5]} intensity={0.5} />

                    <Suspense fallback={<Loader />}>
                        <Model
                            url="/models/Frame.glb"
                            file={modelFile}
                            textures={textures}
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
};

export default DesignPlacement;