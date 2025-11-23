import api from '../config/axios';

export const transportistaService = {
  obtenerTodos: async () => {
    return await api.get('/transportistas');
  },

  obtenerActivos: async () => {
    return await api.get('/transportistas/activos');
  },

  crear: async (codigoInterno, chofer, vehiculo) => {
    return await api.post('/transportistas', {
      codigoInterno,
      chofer,
      vehiculo,
    });
  },

  actualizar: async (id, codigoInterno, chofer, vehiculo, activo) => {
    return await api.put(`/transportistas/${id}`, {
      codigoInterno,
      chofer,
      vehiculo,
      activo,
    });
  },

  eliminar: async (id) => {
    return await api.delete(`/transportistas/${id}`);
  },
};

