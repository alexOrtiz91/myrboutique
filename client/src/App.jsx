import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout.jsx";
import EtiquetasPage from "./pages/EtiquetasPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import InventarioPage from "./pages/InventarioPage.jsx";
import PosPage from "./pages/PosPage.jsx";
import SeparadoresPage from "./pages/SeparadoresPage.jsx";
import TiendaAdminPage from "./pages/TiendaAdminPage.jsx";
import VentasPage from "./pages/VentasPage.jsx";

function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tienda-admin" element={<TiendaAdminPage />} />
        <Route path="/etiquetas" element={<EtiquetasPage />} />
        <Route path="/separadores" element={<SeparadoresPage />} />
        <Route path="/ventas" element={<VentasPage />} />
        <Route path="/pos-demo" element={<PosPage />} />
        <Route path="/inventario-demo" element={<InventarioPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}

export default App;
