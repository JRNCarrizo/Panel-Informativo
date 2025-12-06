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
  // Métodos para gestión de orden de prioridad de carga
  obtenerPendientesSinOrden: () => api.get('/pedidos/pendientes/sin-orden'),
  obtenerConOrdenPrioridadCarga: () => api.get('/pedidos/pendientes/con-orden'),
  actualizarOrdenPrioridadCarga: (pedidoIds) => api.put('/pedidos/prioridad-carga/orden', pedidoIds),
  agregarAColaPrioridadCarga: (id) => api.put(`/pedidos/${id}/prioridad-carga/agregar`),
  removerDeColaPrioridadCarga: (id) => api.put(`/pedidos/${id}/prioridad-carga/remover`),
  // Métodos para obtener planillas del día y resumen de transportistas
  obtenerPlanillasDelDia: () => api.get('/pedidos/del-dia'),
  obtenerTransportistasVueltasDelDia: () => api.get('/pedidos/transportistas-vueltas/del-dia'),
};

