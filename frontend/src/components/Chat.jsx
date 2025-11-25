import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { mensajeService } from '../services/mensajeService';
import { connectWebSocket, disconnectWebSocket } from '../services/websocketService';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import './Chat.css';

const Chat = ({ onClose, rolDestinatario }) => {
  const { user } = useAuth();
  const [mensajes, setMensajes] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [cantidadNoLeidos, setCantidadNoLeidos] = useState(0);
  const [loading, setLoading] = useState(true);
  const mensajesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const stompClientRef = useRef(null);

  const rolUsuario = user?.rol; // ADMIN o DEPOSITO

  // Determinar el rol destinatario (el opuesto al actual)
  const destinoRol = rolDestinatario || (rolUsuario === 'ADMIN' ? 'DEPOSITO' : 'ADMIN');

  // Función para obtener la URL base del backend
  const getBackendBaseUrl = () => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        return `http://${hostname}:8080`;
      }
    }
    return 'http://localhost:8080';
  };

  // Cargar mensajes
  const cargarMensajes = async () => {
    try {
      setLoading(true);
      const response = await mensajeService.obtenerTodos();
      setMensajes(response.data || []);
      
      // Contar no leídos
      await actualizarCantidadNoLeidos();
    } catch (error) {
      console.error('Error al cargar mensajes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Actualizar cantidad de mensajes no leídos
  const actualizarCantidadNoLeidos = async () => {
    try {
      const response = await mensajeService.contarNoLeidos();
      setCantidadNoLeidos(response.data || 0);
    } catch (error) {
      console.error('Error al contar mensajes no leídos:', error);
    }
  };

  // Marcar mensajes no leídos como leídos cuando se abre el chat
  const marcarMensajesComoLeidos = async () => {
    try {
      await mensajeService.marcarTodosComoLeidos();
      await actualizarCantidadNoLeidos();
      // Actualizar estado local de mensajes
      setMensajes(prev => prev.map(m => ({ ...m, leido: true })));
    } catch (error) {
      console.error('Error al marcar mensajes como leídos:', error);
    }
  };

  // Enviar mensaje
  const enviarMensaje = async (e) => {
    e.preventDefault();
    if (!nuevoMensaje.trim()) return;

    const mensajeTexto = nuevoMensaje.trim();
    setNuevoMensaje(''); // Limpiar el input inmediatamente

    // Crear mensaje optimista (temporal) para mostrar inmediatamente
    const mensajeOptimista = {
      id: `temp-${Date.now()}`, // ID temporal
      contenido: mensajeTexto,
      remitenteId: user?.id,
      remitenteNombre: user?.nombreCompleto || user?.username,
      rolRemitente: rolUsuario,
      rolDestinatario: destinoRol,
      leido: false,
      fechaCreacion: new Date().toISOString()
    };

    // Agregar mensaje optimista inmediatamente
    setMensajes(prev => [...prev, mensajeOptimista]);
    scrollToBottom(true);

    try {
      const response = await mensajeService.crear(mensajeTexto, destinoRol);
      const mensajeReal = response.data;
      
      // Asegurarse de que el mensaje real tenga todos los campos necesarios
      const mensajeCompleto = {
        ...mensajeReal,
        leido: mensajeReal.leido !== undefined ? mensajeReal.leido : false
      };
      
      // Reemplazar el mensaje optimista con el real inmediatamente
      setMensajes(prev => prev.map(m => 
        m.id === mensajeOptimista.id ? mensajeCompleto : m
      ));
      
      scrollToBottom(true);
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      // Remover el mensaje optimista en caso de error
      setMensajes(prev => prev.filter(m => m.id !== mensajeOptimista.id));
      alert('Error al enviar el mensaje');
      // Restaurar el mensaje si falla
      setNuevoMensaje(mensajeTexto);
    }
  };

  // Scroll al final cuando hay nuevos mensajes
  const scrollToBottom = (instant = false) => {
    // Usar requestAnimationFrame para asegurar que el DOM esté actualizado
    requestAnimationFrame(() => {
      if (chatContainerRef.current) {
        const container = chatContainerRef.current;
        if (instant) {
          container.scrollTop = container.scrollHeight;
        } else {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth'
          });
        }
      } else if (mensajesEndRef.current) {
        mensajesEndRef.current.scrollIntoView({ behavior: instant ? 'auto' : 'smooth' });
      }
    });
  };

  useEffect(() => {
    // Hacer scroll al final cuando cambian los mensajes
    // Usar un pequeño delay para asegurar que el DOM se haya actualizado
    const timeoutId = setTimeout(() => {
      scrollToBottom();
    }, 50);
    
    return () => clearTimeout(timeoutId);
  }, [mensajes]);

  // Cargar mensajes al montar y marcar como leídos
  useEffect(() => {
    const cargarYMarcar = async () => {
      await cargarMensajes();
      // Marcar todos los mensajes como leídos cuando se abre el chat
      await marcarMensajesComoLeidos();
    };
    cargarYMarcar();
  }, []);

  // Ref para rastrear mensajes ya procesados para evitar loops
  const mensajesProcesadosRef = useRef(new Set());

  // Marcar mensajes no leídos como leídos cuando se agregan nuevos mensajes y el chat está abierto
  useEffect(() => {
    // Si hay mensajes no leídos que aún no han sido procesados, marcarlos como leídos
    const mensajesNoLeidos = mensajes.filter(m => 
      !m.leido && 
      m.rolDestinatario === rolUsuario &&
      !mensajesProcesadosRef.current.has(m.id)
    );
    
    if (mensajesNoLeidos.length > 0) {
      // Marcar cada mensaje no leído como leído
      mensajesNoLeidos.forEach(mensaje => {
        mensajesProcesadosRef.current.add(mensaje.id);
        mensajeService.marcarComoLeido(mensaje.id).catch(err => {
          console.error('Error al marcar mensaje como leído:', err);
          mensajesProcesadosRef.current.delete(mensaje.id); // Reintentar si falla
        });
      });
    }
  }, [mensajes, rolUsuario]);

  // Conectar WebSocket para mensajes en tiempo real
  useEffect(() => {
    const backendUrl = getBackendBaseUrl();
    const socket = new SockJS(`${backendUrl}/ws`);
    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        // Suscribirse a mensajes nuevos para el rol del usuario
        const topicDestino = `/topic/mensajes/${rolUsuario?.toLowerCase()}`;
        const topicNuevo = '/topic/mensajes/nuevo';
        const topicLeido = `/topic/mensajes/leido/${rolUsuario?.toLowerCase()}`;
        const topicTodosLeidos = `/topic/mensajes/todos-leidos/${rolUsuario?.toLowerCase()}`;

        client.subscribe(topicDestino, (message) => {
          const nuevoMensaje = JSON.parse(message.body);
          setMensajes(prev => {
            // Evitar duplicados
            const existe = prev.find(m => m.id === nuevoMensaje.id);
            if (existe) return prev;
            return [...prev, nuevoMensaje];
          });
          // Si el chat está abierto, marcar el mensaje como leído automáticamente
          if (nuevoMensaje.rolDestinatario === rolUsuario && !nuevoMensaje.leido) {
            mensajeService.marcarComoLeido(nuevoMensaje.id).catch(err => {
              console.error('Error al marcar mensaje como leído:', err);
            });
          }
          actualizarCantidadNoLeidos();
        });

        client.subscribe(topicNuevo, (message) => {
          const nuevoMensaje = JSON.parse(message.body);
          // Solo agregar si es para nuestro rol
          if (nuevoMensaje.rolDestinatario === rolUsuario) {
            setMensajes(prev => {
              // Evitar duplicados por ID
              const existePorId = prev.find(m => m.id === nuevoMensaje.id);
              if (existePorId) {
                // Si ya existe, actualizar el estado de "leído" por si cambió
                return prev.map(m => m.id === nuevoMensaje.id ? nuevoMensaje : m);
              }
              
              // Si es nuestro mensaje, reemplazar el optimista
              if (nuevoMensaje.remitenteId === user?.id) {
                // Buscar mensaje optimista con el mismo contenido
                const mensajeOptimista = prev.find(m => 
                  m.id?.toString().startsWith('temp-') &&
                  m.contenido === nuevoMensaje.contenido &&
                  m.remitenteId === nuevoMensaje.remitenteId
                );
                
                if (mensajeOptimista) {
                  // Reemplazar el optimista con el real (manteniendo el estado de leído actualizado)
                  return prev.map(m => m.id === mensajeOptimista.id ? nuevoMensaje : m);
                }
              }
              
              // Si no es nuestro mensaje o no hay optimista, agregar normalmente
              return [...prev, nuevoMensaje];
            });
            // Si el chat está abierto, marcar el mensaje como leído automáticamente
            if (!nuevoMensaje.leido) {
              mensajeService.marcarComoLeido(nuevoMensaje.id).catch(err => {
                console.error('Error al marcar mensaje como leído:', err);
              });
            }
            actualizarCantidadNoLeidos();
            scrollToBottom();
          }
        });

        client.subscribe(topicLeido, () => {
          // Actualizar contador cuando se marca un mensaje como leído
          actualizarCantidadNoLeidos();
        });

        client.subscribe(topicTodosLeidos, () => {
          setMensajes(prev => prev.map(m => ({ ...m, leido: true })));
          setCantidadNoLeidos(0);
        });

        // Suscribirse a notificaciones de mensajes leídos para el remitente
        const topicLeidoRemitente = `/topic/mensajes/leido-remitente/${rolUsuario?.toLowerCase()}`;
        client.subscribe(topicLeidoRemitente, (message) => {
          const mensajeLeido = JSON.parse(message.body);
          // Actualizar el estado del mensaje como leído (buscar por ID o por contenido si es mensaje optimista)
          setMensajes(prev => prev.map(m => {
            // Si coincide el ID, actualizar
            if (m.id === mensajeLeido.id) {
              return { ...m, leido: true };
            }
            // Si es un mensaje optimista con el mismo contenido y remitente, también actualizar
            if (m.id?.toString().startsWith('temp-') && 
                m.contenido === mensajeLeido.contenido &&
                m.remitenteId === mensajeLeido.remitenteId) {
              return { ...m, leido: true };
            }
            return m;
          }));
        });
      },
    });

    stompClientRef.current = client;
    client.activate();

    return () => {
      if (stompClientRef.current) {
        stompClientRef.current.deactivate();
      }
    };
  }, [rolUsuario]);

  // Actualizar cantidad de no leídos periódicamente
  useEffect(() => {
    const interval = setInterval(() => {
      actualizarCantidadNoLeidos();
    }, 5000); // Cada 5 segundos

    return () => clearInterval(interval);
  }, []);

  // Determinar la clase CSS según el rol del usuario para aplicar colores
  const isAdminChat = rolUsuario === 'ADMIN';
  
  return (
    <div className={`chat-container ${isAdminChat ? 'chat-admin' : 'chat-deposito'}`}>
      <div className={`chat-header ${isAdminChat ? 'chat-header-admin' : 'chat-header-deposito'}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isAdminChat ? (
            <svg 
              width="24" 
              height="24" 
              viewBox="0 0 100 100" 
              style={{ 
                verticalAlign: 'middle',
                display: 'inline-block'
              }}
            >
              <rect width="100" height="100" fill="rgba(255, 255, 255, 0.2)" rx="10"/>
              <g fill="white" opacity="0.95">
                <rect x="20" y="60" width="12" height="25" rx="2"/>
                <rect x="36" y="50" width="12" height="35" rx="2"/>
                <rect x="52" y="40" width="12" height="45" rx="2"/>
                <rect x="68" y="55" width="12" height="30" rx="2"/>
              </g>
              <polyline points="20,70 36,60 52,50 68,55" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.95"/>
            </svg>
          ) : (
            <svg 
              width="24" 
              height="24" 
              viewBox="0 0 100 100" 
              style={{ 
                verticalAlign: 'middle',
                display: 'inline-block'
              }}
            >
              <rect width="100" height="100" fill="rgba(255, 255, 255, 0.2)" rx="10"/>
              <g fill="white" opacity="0.95">
                <rect x="20" y="60" width="12" height="25" rx="2"/>
                <rect x="36" y="50" width="12" height="35" rx="2"/>
                <rect x="52" y="40" width="12" height="45" rx="2"/>
                <rect x="68" y="55" width="12" height="30" rx="2"/>
              </g>
              <polyline points="20,70 36,60 52,50 68,55" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.95"/>
            </svg>
          )}
          <h3>Chat - {destinoRol === 'ADMIN' ? 'Administración' : 'Depósito'}</h3>
        </div>
        <button onClick={onClose} className="chat-close-btn">✕</button>
      </div>
      
      <div 
        className="chat-messages" 
        ref={chatContainerRef}
        onScroll={(e) => {
          // Prevenir scroll automático si el usuario está scrolleando manualmente hacia arriba
          const container = e.target;
          const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
          // Si el usuario está cerca del final, permitir scroll automático
          if (!isNearBottom) {
            // El usuario está scrolleando hacia arriba, no hacer scroll automático
          }
        }}
      >
        {loading ? (
          <div className="chat-loading">Cargando mensajes...</div>
        ) : mensajes.length === 0 ? (
          <div className="chat-empty">No hay mensajes hoy</div>
        ) : (
          mensajes.map((mensaje) => {
            const esMio = mensaje.remitenteId === user?.id;
            return (
              <div
                key={mensaje.id}
                className={`chat-message ${esMio ? 'own-message' : 'other-message'} ${!mensaje.leido && !esMio ? 'unread' : ''}`}
              >
                <div className="message-header">
                  <strong>{mensaje.remitenteNombre}</strong>
                  <span className="message-time">
                    {new Date(mensaje.fechaCreacion).toLocaleTimeString('es-AR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    })}
                  </span>
                </div>
                <div className="message-content">{mensaje.contenido}</div>
                {!mensaje.leido && !esMio && (
                  <span className="unread-indicator">●</span>
                )}
                {esMio && (
                  <div className="read-indicator">
                    {mensaje.leido ? (
                      <span className="read-check" title="Leído">✓✓</span>
                    ) : (
                      <span className="sent-check" title="Enviado">✓</span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={mensajesEndRef} />
      </div>

      <form onSubmit={enviarMensaje} className="chat-input-form">
        <input
          type="text"
          value={nuevoMensaje}
          onChange={(e) => setNuevoMensaje(e.target.value)}
          placeholder="Escribe un mensaje..."
          className="chat-input"
          autoFocus
        />
        <button type="submit" className="chat-send-btn">Enviar</button>
      </form>
    </div>
  );
};

export default Chat;

