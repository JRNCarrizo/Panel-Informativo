import axios from 'axios';

// Función para obtener la URL del backend dinámicamente
// Si estás accediendo desde una IP (ej: http://192.168.1.100:5173), usa esa misma IP para el backend
// Si estás en localhost, usa localhost
const getBackendUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Si no es localhost, usar la misma IP para el backend
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `http://${hostname}:8080/api`;
    }
  }
  // Por defecto, usar localhost
  return 'http://localhost:8080/api';
};

const api = axios.create({
  baseURL: 'http://localhost:8080/api', // Valor inicial, se actualizará dinámicamente
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para actualizar la baseURL dinámicamente en cada petición
api.interceptors.request.use(
  (config) => {
    // Actualizar la baseURL en cada petición para que use la IP correcta
    config.baseURL = getBackendUrl();
    
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

let isRefreshing = false;
let failedQueue = [];
let refreshPromise = null;

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

// Función para renovar el token
const refreshToken = async () => {
  const token = localStorage.getItem('token');
  const userDataStr = localStorage.getItem('user');
  
  if (!token) {
    throw new Error('No hay token para renovar');
  }

  if (!userDataStr) {
    throw new Error('No hay datos de usuario para validar');
  }

  let currentUser;
  try {
    currentUser = JSON.parse(userDataStr);
  } catch (e) {
    console.error('Error al parsear datos de usuario:', e);
    throw new Error('Error al parsear datos de usuario');
  }

  if (!currentUser || !currentUser.username || !currentUser.rol) {
    console.error('Datos de usuario incompletos:', currentUser);
    throw new Error('Datos de usuario incompletos');
  }

  // Log para debugging
  console.log('Renovando token para usuario:', currentUser.username, 'con rol:', currentUser.rol);

  // Usar la misma URL base para el refresh token
  const backendUrl = getBackendUrl();
  const response = await axios.post(`${backendUrl}/auth/refresh`, {}, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const { token: newToken, ...userData } = response.data;
  
  // Validar que el usuario sigue siendo el mismo antes de actualizar
  if (userData.username !== currentUser.username) {
    console.error('Error: El token renovado pertenece a un usuario diferente. No se actualizará el estado.');
    console.error('Usuario actual:', currentUser.username, 'Usuario nuevo:', userData.username);
    // Limpiar datos corruptos
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    throw new Error('Token renovado pertenece a un usuario diferente');
  }
  
  // Validar que el rol no haya cambiado (por seguridad) - ESTO ES CRÍTICO
  if (userData.rol !== currentUser.rol) {
    console.error('Error: El rol del usuario ha cambiado. Esto no debería pasar. No se actualizará el estado.');
    console.error('Rol actual:', currentUser.rol, 'Rol nuevo:', userData.rol);
    console.error('Usuario actual completo:', currentUser);
    console.error('Usuario nuevo completo:', userData);
    // NO actualizar localStorage ni disparar evento si el rol cambió - esto previene el cambio de panel
    throw new Error('El rol del usuario ha cambiado');
  }
  
  // Solo actualizar si todo está correcto
  localStorage.setItem('token', newToken);
  localStorage.setItem('user', JSON.stringify(userData));
  
  // Disparar evento personalizado para actualizar el contexto de auth
  window.dispatchEvent(new CustomEvent('tokenRefreshed', { detail: userData }));
  
  return newToken;
};


// Interceptor para manejar errores de autenticación y renovar token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Si es error 401 (autenticación) y no estamos en pantalla pública, intentar refrescar token
    // 403 (Forbidden) es un error de permisos, no de token expirado, así que no intentamos refrescar
    if (error.response?.status === 401 && 
        window.location.pathname !== '/pantalla' &&
        !originalRequest._retry) {
      
      // Excluir la ruta de refresh para evitar loops infinitos
      if (originalRequest.url?.includes('/auth/refresh')) {
        // Si falla el refresh, limpiar y redirigir
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (window.location.pathname !== '/pantalla') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      // Si ya está refrescando, usar la misma promesa o esperar a que se cree
      if (isRefreshing) {
        // Si ya existe la promesa, usarla directamente
        if (refreshPromise) {
          return refreshPromise
            .then(newToken => {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              delete originalRequest._retry;
              return api(originalRequest);
            })
            .catch(refreshError => {
              return Promise.reject(refreshError);
            });
        }
        
        // Si aún no existe la promesa, esperar un poco y reintentar
        return new Promise((resolve, reject) => {
          const checkRefresh = setInterval(() => {
            if (refreshPromise) {
              clearInterval(checkRefresh);
              refreshPromise
                .then(newToken => {
                  originalRequest.headers.Authorization = `Bearer ${newToken}`;
                  delete originalRequest._retry;
                  resolve(api(originalRequest));
                })
                .catch(reject);
            } else if (!isRefreshing) {
              clearInterval(checkRefresh);
              reject(new Error('Refresh cancelled'));
            }
          }, 10);
          
          setTimeout(() => {
            clearInterval(checkRefresh);
            reject(new Error('Refresh timeout'));
          }, 3000);
        });
      }

      // Marcar como reintentado para evitar loops
      originalRequest._retry = true;
      // Marcar que estamos refrescando ANTES de crear la promesa
      isRefreshing = true;
      
      const token = localStorage.getItem('token');
      
      if (token) {
        // Crear una promesa de renovación que se compartirá entre todas las peticiones en cola
        refreshPromise = refreshToken()
          .then(newToken => {
            // Actualizar header de la petición original
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            
            // Procesar cola de peticiones pendientes
            processQueue(null, newToken);

            // Limpiar estado
            isRefreshing = false;
            refreshPromise = null;
            
            // Reintentar la petición original (sin el flag _retry para evitar loops)
            delete originalRequest._retry;
            return api(originalRequest);
          })
          .catch(refreshError => {
            // Si falla la renovación, limpiar y redirigir
            processQueue(refreshError, null);
            isRefreshing = false;
            refreshPromise = null;
            
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            
            // Solo redirigir si no estamos en pantalla pública o login
            if (window.location.pathname !== '/pantalla' && 
                window.location.pathname !== '/login' &&
                window.location.pathname !== '/registro-primer-admin') {
              window.location.href = '/login';
            }
            
            return Promise.reject(refreshError);
          });

        return refreshPromise;
      } else {
        // No hay token, limpiar y redirigir
        isRefreshing = false;
        refreshPromise = null;
        if (window.location.pathname !== '/pantalla' && 
            window.location.pathname !== '/login' &&
            window.location.pathname !== '/registro-primer-admin') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

