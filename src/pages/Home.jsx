import React, { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stage, Environment, ContactShadows, PresentationControls, Float, useGLTF } from '@react-three/drei';
import { Link } from 'react-router-dom';

function Model({ url }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} scale={1} />;
}

export default function Home() {
  const [currentModel, setCurrentModel] = useState('/models/oversized_tshirt.glb');

  const models = [
    { id: 'tshirt', name: 'T-Shirt', url: '/models/oversized_tshirt.glb' },
    { id: 'mug', name: 'Coffee Mug', url: '/models/coffee_mug.glb' },
    { id: 'cap', name: 'Cap', url: '/models/black_cap.glb' }
  ];

  return (
    <div className="app-container">
      <nav className="navbar">
        <Link to="/" className="nav-logo" style={{ textDecoration: 'none' }}>PrintX 3D</Link>
        <ul className="nav-links">
          <li>Products</li>
          <li><Link to="/design-lab" style={{ color: 'inherit', textDecoration: 'none' }}>Design Lab</Link></li>
          <li>Pricing</li>
          <li>Contact</li>
        </ul>
      </nav>

      <main>
        <section className="hero-section">
          <div className="hero-content">
            <div className="hero-tag">Next-Gen Printing</div>
            <h1 className="hero-title">
              Bring Your Ideas <br />
              to <span>Reality</span>
            </h1>
            <p className="hero-description">
              Upload your designs and visualize them instantly in stunning 3D. 
              Our premium on-demand printing service delivers unparalleled quality straight to your door.
            </p>
            <Link to="/design-lab" className="cta-button" style={{ textDecoration: 'none', display: 'inline-block' }}>Start Designing</Link>
          </div>

          <div className="model-viewer-container">
            <div className="model-glow"></div>
            <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0, 5], fov: 45 }}>
              <ambientLight intensity={0.5} />
              <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
              <Environment preset="city" />
              
              <PresentationControls 
                global 
                rotation={[0, -0.3, 0]} 
                polar={[-0.4, 0.2]} 
                azimuth={[-1, 0.75]} 
                config={{ mass: 2, tension: 400 }} 
                snap={{ mass: 4, tension: 400 }}
              >
                <Float rotationIntensity={0.4} floatIntensity={2} speed={1.5}>
                  <Suspense fallback={null}>
                    <Stage environment={null} intensity={0.5} contactShadow={{ opacity: 0.5, blur: 2 }}>
                      <Model url={currentModel} />
                    </Stage>
                  </Suspense>
                </Float>
              </PresentationControls>
              
              <ContactShadows position={[0, -1.4, 0]} opacity={0.75} scale={10} blur={2.5} far={4} />
            </Canvas>

            <div className="product-selector">
              {models.map(m => (
                <button 
                  key={m.id}
                  className={`product-btn ${currentModel === m.url ? 'active' : ''}`}
                  onClick={() => setCurrentModel(m.url)}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="features-section">
          <div className="features-header">
            <h2>Why Choose PrintX</h2>
            <p style={{ color: 'var(--text-muted)' }}>Experience the difference with our state-of-the-art print tech.</p>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">✨</div>
              <h3>Ultra HD Prints</h3>
              <p>Industry-leading resolution ensuring every tiny detail of your design is captured perfectly on any medium.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🚀</div>
              <h3>Fast Turnaround</h3>
              <p>From checkout to your doorstep in record time. We process and ship 90% of orders within 24 hours.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🌱</div>
              <h3>Eco-Friendly</h3>
              <p>Sustainable materials and water-based inks that are gentle on the environment and soft on the skin.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
