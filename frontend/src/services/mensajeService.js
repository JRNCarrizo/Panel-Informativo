import api from '../config/axios';

export const mensajeService = {
  obtenerTodos: () => api.get('/mensajes'),
  
  crear: (contenido, rolDestinatario) => 
    api.post('/mensajes', { contenido, rolDestinatario }),
  
  contarNoLeidos: () => api.get('/mensajes/no-leidos/count'),
  
  marcarComoLeido: (id) => api.put(`/mensajes/${id}/leido`),
  
  marcarTodosComoLeidos: () => api.put('/mensajes/marcar-todos-leidos')
};

