import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './components/Login';
import RegistroPrimerAdmin from './components/RegistroPrimerAdmin';
import AdminPanel from './components/AdminPanel';
import DepositoPanel from './components/DepositoPanel';
import PantallaPublica from './components/PantallaPublica';
import './App.css';

const PrivateRoute = ({ children, requiredRole }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px'
      }}>
        Cargando...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.rol !== requiredRole) {
    return <Navigate to={user.rol === 'ADMIN' ? '/admin' : '/deposito'} replace />;
  }

  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px'
      }}>
        Cargando...
      </div>
    );
  }

  // Si ya está autenticado, redirigir al panel correspondiente
  if (user) {
    return <Navigate to={user.rol === 'ADMIN' ? '/admin' : '/deposito'} replace />;
  }

  return children;
};

function App() {
  // Ruta raíz: siempre redirigir a login (el componente Login verificará si hay usuario)
  const RootRedirect = () => {
    return <Navigate to="/login" replace />;
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        } />
        <Route path="/registro-primer-admin" element={
          <PublicRoute>
            <RegistroPrimerAdmin />
          </PublicRoute>
        } />
        <Route
          path="/admin"
          element={
            <PrivateRoute requiredRole="ADMIN">
              <AdminPanel />
            </PrivateRoute>
          }
        />
        <Route
          path="/deposito"
          element={
            <PrivateRoute requiredRole="DEPOSITO">
              <DepositoPanel />
            </PrivateRoute>
          }
        />
        <Route path="/pantalla" element={<PantallaPublica />} />
        <Route path="/" element={<RootRedirect />} />
      </Routes>
    </Router>
  );
}

export default App;
