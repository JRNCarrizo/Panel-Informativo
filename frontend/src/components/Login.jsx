import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../config/axios';
import './Login.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [mostrarRegistro, setMostrarRegistro] = useState(true);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Si hay usuario, redirigir al panel correspondiente
    if (user) {
      navigate(user.rol === 'ADMIN' ? '/admin' : '/deposito', { replace: true });
    }
  }, [user, navigate]);

  // Verificar si ya existe un administrador al cargar el componente
  useEffect(() => {
    const verificarAdmin = async () => {
      try {
        const response = await api.get('/auth/existe-admin');
        setMostrarRegistro(!response.data.existe);
      } catch (error) {
        console.error('Error al verificar si existe admin:', error);
        // En caso de error, mostrar el enlace por seguridad
        setMostrarRegistro(true);
      }
    };
    verificarAdmin();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const result = await login(username, password);
    if (result.success) {
      const userData = JSON.parse(localStorage.getItem('user'));
      navigate(userData.rol === 'ADMIN' ? '/admin' : '/deposito');
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="login-container">
      {/* Círculos decorativos adicionales */}
      <div style={{
        position: 'absolute',
        width: '300px',
        height: '300px',
        borderRadius: '50%',
        background: 'rgba(37, 99, 235, 0.08)',
        top: '50%',
        left: '10%',
        transform: 'translateY(-50%)',
        animation: 'float 18s ease-in-out infinite',
      }}></div>
      <div style={{
        position: 'absolute',
        width: '250px',
        height: '250px',
        borderRadius: '50%',
        background: 'rgba(30, 64, 175, 0.12)',
        top: '20%',
        right: '15%',
        animation: 'float 22s ease-in-out infinite reverse',
      }}></div>
      <div className="login-card" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ 
          textAlign: 'center', 
          marginBottom: '20px',
          lineHeight: '1',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <img 
            src="/logo-empresa.png" 
            alt="Logo Empresa" 
            style={{ 
              maxWidth: '200px', 
              height: 'auto',
              filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2))'
            }} 
          />
        </div>
        <h1>Panel Central</h1>
        <h2>Iniciar Sesión</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Usuario</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="btn-primary">
            Ingresar
          </button>
        </form>
        {mostrarRegistro && (
          <p className="register-link">
            ¿Primera vez? <a href="/registro-primer-admin">Registrar Administrador Principal</a>
          </p>
        )}
      </div>
    </div>
  );
};

export default Login;

