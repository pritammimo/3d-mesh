import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import DesignLab from './pages/DesignLab';
import DesignLabMug from './pages/designlabmug';
import DesignLabMeshPrint from './pages/designlabmeshprint';
import DesignLabNotebookPrint from './pages/DesignlabNotebookmesh';
import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/design-lab" element={<DesignLab />} />
        <Route path="/design-lab-mug" element={<DesignLabMug />} />
        <Route path="/design-lab-mesh-print" element={<DesignLabMeshPrint />} />
        <Route path="/design-lab-note-print" element={<DesignLabNotebookPrint />} />
      </Routes>
    </Router>
  );
}

export default App;
