import api from '../config/axios';

export const usuarioService = {
  obtenerTodos: () => api.get('/usuarios'),
  obtenerPorRol: (rol) => api.get(`/usuarios/por-rol/${rol}`),
  crear: (username, password, nombreCompleto, rol) => api.post('/usuarios', { username, password, nombreCompleto, rol }),
  actualizarEstado: (id, activo) => api.put(`/usuarios/${id}/estado`, { activo }),
  eliminar: (id) => api.delete(`/usuarios/${id}`),
};

