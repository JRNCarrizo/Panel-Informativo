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
    let isRefreshing = false; // Bandera para prevenir múltiples refreshes simultáneos
    let refreshFailureCount = 0; // Contador de fallos consecutivos
    let isCleanedUp = false; // Bandera para prevenir operaciones después de cleanup

    // Función para limpiar el intervalo
    const cleanupRefreshInterval = () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
    };

    // Función para renovar el token automáticamente (usar axios directamente para evitar interceptor)
    const refreshTokenIfNeeded = async () => {
      // Prevenir múltiples llamadas simultáneas o si ya se hizo cleanup
      if (isRefreshing || isCleanedUp) {
        return;
      }

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

      isRefreshing = true;
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
        
        // Resetear contador de fallos si tuvo éxito
        refreshFailureCount = 0;
        
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
          isRefreshing = false;
          return;
        }
        
        // Validar que el rol no haya cambiado (por seguridad)
        if (userData.rol !== currentUser.rol) {
          console.error('Error: El rol del usuario ha cambiado. Esto no debería pasar. No se actualizará el estado.');
          console.error('Rol actual:', currentUser.rol, 'Rol nuevo:', userData.rol);
          console.error('Usuario actual completo:', currentUser);
          console.error('Usuario nuevo completo:', userData);
          // NO actualizar si el rol cambió - esto previene el cambio de panel
          isRefreshing = false;
          return;
        }
        
        // Solo actualizar si todo está correcto y los datos realmente cambiaron
        const userDataStr = JSON.stringify(userData);
        const currentUserStr = JSON.stringify(currentUser);
        
        // Solo actualizar si los datos realmente cambiaron (evitar re-renders innecesarios)
        if (userDataStr !== currentUserStr) {
          localStorage.setItem('token', newToken);
          localStorage.setItem('user', userDataStr);
          setUser(userData);
        } else {
          // Solo actualizar el token sin cambiar el estado del usuario
          localStorage.setItem('token', newToken);
        }
      } catch (error) {
        refreshFailureCount++;
        
        // Si el error es 400 (Bad Request), probablemente el token es inválido
        // Limpiar y detener los intentos para evitar loops infinitos
        if (error.response?.status === 400 || refreshFailureCount >= 3) {
          console.error('Error al renovar el token: el token parece ser inválido. Limpiando sesión.');
          console.error('Detalles del error:', error.response?.data || error.message);
          
          // Marcar como cleanup para evitar más intentos
          isCleanedUp = true;
          
          // Limpiar sesión y detener el intervalo
          cleanupRefreshInterval();
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
          
          isRefreshing = false;
          return;
        }
        
        // Para otros errores, solo loguear silenciosamente
        console.warn('No se pudo renovar el token automáticamente:', error.message);
      } finally {
        isRefreshing = false;
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
            // Verificar que tenga los campos mínimos y que el rol sea válido
            const rolesValidos = ['ADMIN_PRINCIPAL', 'ADMIN_DEPOSITO', 'PLANILLERO', 'CONTROL'];
            if (parsedUser && parsedUser.username && parsedUser.rol && rolesValidos.includes(parsedUser.rol)) {
              // Establecer usuario primero (sin esperar)
              setUser(parsedUser);
              
              // Intentar renovar el token una vez al cargar (sin bloquear)
              // Esperar un poco para que la app esté completamente cargada
              // Solo intentar si el token existe y parece válido
              setTimeout(() => {
                const currentToken = localStorage.getItem('token');
                if (currentToken) {
                  refreshTokenIfNeeded().catch(err => {
                    // Si falla con 400, el error ya fue manejado dentro de refreshTokenIfNeeded
                    if (err.response?.status !== 400) {
                      console.warn('Error al renovar token inicial:', err);
                    }
                  });
                }
              }, 3000); // Aumentar el delay inicial para evitar conflictos
              
              // Renovar periódicamente cada 15 minutos para mantener el token fresco
              // Esto asegura que la sesión nunca expire mientras uses la aplicación
              // Solo un intervalo para evitar múltiples llamadas simultáneas
              refreshInterval = setInterval(() => {
                const currentToken = localStorage.getItem('token');
                const currentUser = localStorage.getItem('user');
                // Solo intentar refresh si hay token y usuario válidos
                if (currentToken && currentUser) {
                  refreshTokenIfNeeded().catch(err => {
                    // Silencioso, solo para mantener el token fresco
                    // Si falla, el interceptor de axios se encargará de renovarlo cuando sea necesario
                  });
                } else {
                  // Si no hay token/usuario, limpiar el intervalo
                  cleanupRefreshInterval();
                }
              }, 15 * 60 * 1000); // Cada 15 minutos - renovación automática transparente

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
                
                // Solo actualizar si los datos realmente cambiaron (evitar re-renders innecesarios)
                const newUserDataStr = JSON.stringify(newUserData);
                const currentUserStr = JSON.stringify(currentUser);
                if (newUserDataStr !== currentUserStr) {
                  setUser(newUserData);
                }
              };
              window.addEventListener('tokenRefreshed', handleTokenRefreshed);
              
              return () => {
                isCleanedUp = true;
                cleanupRefreshInterval();
                window.removeEventListener('tokenRefreshed', handleTokenRefreshed);
              };
            } else {
              // Datos inválidos o rol inválido (probablemente de la versión anterior), limpiar
              console.warn('Datos de usuario inválidos o rol obsoleto. Limpiando sesión.');
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              setUser(null);
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

  const isAdminPrincipal = () => user?.rol === 'ADMIN_PRINCIPAL';
  const isAdminDeposito = () => user?.rol === 'ADMIN_DEPOSITO';
  const isPlanillero = () => user?.rol === 'PLANILLERO';
  const isControl = () => user?.rol === 'CONTROL';
  
  // Funciones de compatibilidad (para verificar si es cualquier tipo de admin o depósito)
  const isAdmin = () => user?.rol === 'ADMIN_PRINCIPAL';
  const isDeposito = () => ['ADMIN_DEPOSITO', 'PLANILLERO', 'CONTROL'].includes(user?.rol);

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
        isAdminPrincipal,
        isAdminDeposito,
        isPlanillero,
        isControl,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

