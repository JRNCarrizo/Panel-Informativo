import api from '../config/axios';

export const vueltaService = {
  crearObtener: (nombre) => api.post('/vueltas/crear-o-obtener', { nombre }),
  obtenerTodas: () => api.get('/vueltas'),
  obtenerActivas: () => api.get('/vueltas/activas'),
  buscar: (q) => api.get(`/vueltas/buscar?q=${encodeURIComponent(q)}`),
  obtenerPorId: (id) => api.get(`/vueltas/${id}`),
  actualizar: (id, nombre, activo) => api.put(`/vueltas/${id}`, { nombre, activo }),
  eliminar: (id) => api.delete(`/vueltas/${id}`),
};

