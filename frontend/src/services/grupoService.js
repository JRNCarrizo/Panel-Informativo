import api from '../config/axios';

export const grupoService = {
  obtenerTodos: () => api.get('/grupos'),
  obtenerActivos: () => api.get('/grupos/activos'),
  crear: (nombre) => api.post('/grupos', { nombre }),
  actualizar: (id, data) => api.put(`/grupos/${id}`, data),
  eliminar: (id) => api.delete(`/grupos/${id}`),
};

