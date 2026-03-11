import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout.jsx'
import EtiquetasPage from './pages/EtiquetasPage.jsx'
import HomePage from './pages/HomePage.jsx'
import InventarioDemoPage from './pages/InventarioDemoPage.jsx'
import PosDemoPage from './pages/PosDemoPage.jsx'
import TiendaAdminPage from './pages/TiendaAdminPage.jsx'

function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tienda-admin" element={<TiendaAdminPage />} />
        <Route path="/etiquetas" element={<EtiquetasPage />} />
        <Route path="/pos-demo" element={<PosDemoPage />} />
        <Route path="/inventario-demo" element={<InventarioDemoPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  )
}

export default App
