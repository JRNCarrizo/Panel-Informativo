import api from '../config/axios';

export const transportistaService = {
  obtenerTodos: async () => {
    return await api.get('/transportistas');
  },

  obtenerActivos: async () => {
    return await api.get('/transportistas/activos');
  },

  buscar: async (busqueda) => {
    return await api.get(`/transportistas/buscar?busqueda=${encodeURIComponent(busqueda)}`);
  },

  crear: async (nombre) => {
    return await api.post('/transportistas', {
      nombre,
    });
  },

  actualizar: async (id, nombre, activo) => {
    return await api.put(`/transportistas/${id}`, {
      nombre,
      activo,
    });
  },

  eliminar: async (id) => {
    return await api.delete(`/transportistas/${id}`);
  },
};

