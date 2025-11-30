import api from '../config/axios';

export const pedidoService = {
  obtenerTodos: () => api.get('/pedidos'),
  obtenerPorEstado: (estado) => api.get(`/pedidos/estado/${estado}`),
  obtenerPorId: (id) => api.get(`/pedidos/${id}`),
  crear: (data) => api.post('/pedidos', data),
  actualizar: (id, data) => api.put(`/pedidos/${id}`, data),
  actualizarEstado: (id, estado) => {
    // Enviar el estado como string JSON
    return api.put(`/pedidos/${id}/estado`, JSON.stringify(estado));
  },
  avanzarEtapaPreparacion: (id) => api.put(`/pedidos/${id}/avanzar-etapa`),
  asignarGrupo: (id, grupoId) => api.put(`/pedidos/${id}/grupo`, grupoId),
  quitarGrupo: (id) => api.delete(`/pedidos/${id}/grupo`),
  eliminar: (id) => api.delete(`/pedidos/${id}`),
};

