import api from '../config/axios';

export const zonaService = {
  crearObtener: (nombre) => api.post('/zonas/crear-o-obtener', { nombre }),
  obtenerTodas: () => api.get('/zonas'),
  obtenerActivas: () => api.get('/zonas/activas'),
  buscar: (q) => api.get(`/zonas/buscar?q=${encodeURIComponent(q)}`),
  obtenerPorId: (id) => api.get(`/zonas/${id}`),
  actualizar: (id, nombre, activo) => api.put(`/zonas/${id}`, { nombre, activo }),
  eliminar: (id) => api.delete(`/zonas/${id}`),
};

