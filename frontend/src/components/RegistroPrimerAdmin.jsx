import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const RegistroPrimerAdmin = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    nombreCompleto: '',
  });
  const [error, setError] = useState('');
  const { registroPrimerAdmin, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/admin');
    }
  }, [user, navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const result = await registroPrimerAdmin(
      formData.username,
      formData.password,
      formData.nombreCompleto
    );
    if (result.success) {
      navigate('/admin');
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Panel Informativo</h1>
        <h2>Registro Administrador Principal</h2>
        <p className="info-text">Solo se puede registrar el primer administrador una vez</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Usuario</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Nombre Completo</label>
            <input
              type="text"
              name="nombreCompleto"
              value={formData.nombreCompleto}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="btn-primary">
            Registrar
          </button>
        </form>
        <p className="register-link">
          <a href="/login">Volver al Login</a>
        </p>
      </div>
    </div>
  );
};

export default RegistroPrimerAdmin;

