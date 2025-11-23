import api from '../config/axios';

export const usuarioService = {
  obtenerTodos: () => api.get('/usuarios'),
  actualizarEstado: (id, activo) => api.put(`/usuarios/${id}/estado`, { activo }),
  eliminar: (id) => api.delete(`/usuarios/${id}`),
};

