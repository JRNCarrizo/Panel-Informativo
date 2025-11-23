import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import api from '../config/axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let refreshInterval = null;

    // Función para renovar el token automáticamente (usar axios directamente para evitar interceptor)
    const refreshTokenIfNeeded = async () => {
      const token = localStorage.getItem('token');
      const userDataStr = localStorage.getItem('user');
      if (!token || !userDataStr) {
        console.warn('No hay token o datos de usuario para renovar');
        return;
      }

      let currentUser;
      try {
        currentUser = JSON.parse(userDataStr);
      } catch (e) {
        console.error('Error al parsear datos de usuario:', e);
        return;
      }

      if (!currentUser || !currentUser.username || !currentUser.rol) {
        console.warn('Datos de usuario incompletos');
        return;
      }

      try {
        // Detectar la IP del backend automáticamente
        const hostname = window.location.hostname;
        const backendUrl = (hostname !== 'localhost' && hostname !== '127.0.0.1') 
          ? `http://${hostname}:8080/api`
          : 'http://localhost:8080/api';
        
        // Usar axios directamente para evitar el interceptor que podría causar loops
        const response = await axios.post(`${backendUrl}/auth/refresh`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const { token: newToken, ...userData } = response.data;
        
        // Validar que el usuario sigue siendo el mismo antes de actualizar
        if (userData.username !== currentUser.username) {
          console.error('Error: El token renovado pertenece a un usuario diferente. No se actualizará el estado.');
          console.error('Usuario actual:', currentUser.username, 'Usuario nuevo:', userData.username);
          console.error('Token actual pertenece a:', currentUser.username);
          // Limpiar datos corruptos
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
          return;
        }
        
        // Validar que el rol no haya cambiado (por seguridad)
        if (userData.rol !== currentUser.rol) {
          console.error('Error: El rol del usuario ha cambiado. Esto no debería pasar. No se actualizará el estado.');
          console.error('Rol actual:', currentUser.rol, 'Rol nuevo:', userData.rol);
          console.error('Usuario actual completo:', currentUser);
          console.error('Usuario nuevo completo:', userData);
          // NO actualizar si el rol cambió - esto previene el cambio de panel
          return;
        }
        
        // Solo actualizar si todo está correcto
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
      } catch (error) {
        // Si falla la renovación silenciosamente, no hacer nada
        // El interceptor de axios manejará el error cuando se haga una petición
        console.warn('No se pudo renovar el token automáticamente:', error.message);
      }
    };

    const initializeAuth = () => {
      try {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');
        
        // Solo cargar usuario si hay token Y datos de usuario
        if (token && userData) {
          try {
            const parsedUser = JSON.parse(userData);
            // Verificar que tenga los campos mínimos
            if (parsedUser && parsedUser.username && parsedUser.rol) {
              // Establecer usuario primero (sin esperar)
              setUser(parsedUser);
              
              // Configurar renovación automática cada hora (más frecuente para evitar expiración)
              refreshInterval = setInterval(() => {
                refreshTokenIfNeeded();
              }, 60 * 60 * 1000); // Cada hora
              
              // Intentar renovar el token una vez al cargar (sin bloquear)
              // Esperar un poco para que la app esté completamente cargada
              setTimeout(() => {
                refreshTokenIfNeeded().catch(err => {
                  console.warn('Error al renovar token inicial:', err);
                });
              }, 1000);
              
              // Renovar periódicamente cada 10 minutos para mantener el token siempre fresco
              // Esto asegura que la sesión nunca expire mientras uses la aplicación
              const frequentRefreshInterval = setInterval(() => {
                refreshTokenIfNeeded().catch(err => {
                  // Silencioso, solo para mantener el token fresco
                  // Si falla, el interceptor de axios se encargará de renovarlo cuando sea necesario
                });
              }, 10 * 60 * 1000); // Cada 10 minutos - renovación automática transparente

              // Escuchar eventos de renovación de token desde el interceptor
              const handleTokenRefreshed = (event) => {
                const newUserData = event.detail;
                // Obtener el usuario actual del estado o del localStorage
                const currentUserData = localStorage.getItem('user');
                const currentUser = currentUserData ? JSON.parse(currentUserData) : user;
                
                // Validar que el usuario sigue siendo el mismo antes de actualizar
                if (currentUser && newUserData.username !== currentUser.username) {
                  console.error('Error: El token renovado pertenece a un usuario diferente. No se actualizará el estado.');
                  console.error('Usuario actual:', currentUser.username, 'Usuario nuevo:', newUserData.username);
                  return;
                }
                
                // Validar que el rol no haya cambiado (por seguridad)
                if (currentUser && newUserData.rol !== currentUser.rol) {
                  console.error('Error: El rol del usuario ha cambiado. Esto no debería pasar. No se actualizará el estado.');
                  console.error('Rol actual:', currentUser.rol, 'Rol nuevo:', newUserData.rol);
                  return;
                }
                
                // Solo actualizar si las validaciones pasan
                setUser(newUserData);
              };
              window.addEventListener('tokenRefreshed', handleTokenRefreshed);
              
              return () => {
                if (refreshInterval) clearInterval(refreshInterval);
                if (frequentRefreshInterval) clearInterval(frequentRefreshInterval);
                window.removeEventListener('tokenRefreshed', handleTokenRefreshed);
              };
            } else {
              // Datos inválidos, limpiar
              localStorage.removeItem('token');
              localStorage.removeItem('user');
            }
          } catch (error) {
            // Error al parsear, limpiar datos corruptos
            console.warn('Error al cargar datos de usuario, limpiando sesión:', error);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
        }
      } catch (error) {
        console.error('Error inicializando autenticación:', error);
      } finally {
        // Siempre establecer loading a false inmediatamente
        setLoading(false);
      }
    };

    // Inicializar de forma síncrona para no bloquear
    initializeAuth();

    // El cleanup se maneja dentro de initializeAuth
  }, []);

  const login = async (username, password) => {
    try {
      const response = await api.post('/auth/login', { username, password });
      const { token, ...userData } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data || 'Error al iniciar sesión' };
    }
  };

  const registroPrimerAdmin = async (username, password, nombreCompleto) => {
    try {
      const response = await api.post('/auth/registro-primer-admin', {
        username,
        password,
        nombreCompleto,
      });
      const { token, ...userData } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data || 'Error al registrar' };
    }
  };

  const registro = async (username, password, nombreCompleto) => {
    try {
      const response = await api.post('/auth/registro', {
        username,
        password,
        nombreCompleto,
      });
      const { token, ...userData } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data || 'Error al registrar' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const isAdmin = () => user?.rol === 'ADMIN';
  const isDeposito = () => user?.rol === 'DEPOSITO';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        registroPrimerAdmin,
        registro,
        logout,
        isAdmin,
        isDeposito,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

