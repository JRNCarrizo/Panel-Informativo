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

  const rolUsuario = user?.rol; // ADMIN_PRINCIPAL, ADMIN_DEPOSITO, PLANILLERO, CONTROL

  // Determinar el rol destinatario
  // Si viene como prop, usarlo. Si no, determinar según el rol del usuario:
  // ADMIN_PRINCIPAL -> ADMIN_DEPOSITO (para que todos los del depósito vean los mensajes)
  // Cualquier rol de depósito -> ADMIN_PRINCIPAL
  const destinoRol = rolDestinatario || (
    rolUsuario === 'ADMIN_PRINCIPAL' ? 'ADMIN_DEPOSITO' : 'ADMIN_PRINCIPAL'
  );

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
      remitenteId: user?.id, // Asegurar que sea el mismo tipo que se usa en la comparación
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
              if (String(nuevoMensaje.remitenteId) === String(user?.id)) {
                // Buscar mensaje optimista con el mismo contenido
                const mensajeOptimista = prev.find(m => 
                  m.id?.toString().startsWith('temp-') &&
                  m.contenido === nuevoMensaje.contenido &&
                  String(m.remitenteId) === String(nuevoMensaje.remitenteId)
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
                String(m.remitenteId) === String(mensajeLeido.remitenteId)) {
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
  const isAdminChat = rolUsuario === 'ADMIN_PRINCIPAL';
  
  return (
    <div className={`chat-container ${isAdminChat ? 'chat-admin' : 'chat-deposito'}`}>
      <div className={`chat-header ${isAdminChat ? 'chat-header-admin' : 'chat-header-deposito'}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img 
            src="/logo-empresa.png" 
            alt="Logo Empresa" 
            style={{ 
              height: '32px',
              width: 'auto',
              objectFit: 'contain'
            }}
          />
          <h3>Chat - {destinoRol === 'ADMIN_PRINCIPAL' ? 'Administración' : 'Depósito'}</h3>
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
            // Comparar IDs de forma robusta (manejar string y number)
            const remitenteId = mensaje.remitenteId;
            const userId = user?.id;
            
            // También comparar por rol como respaldo
            const mismoRol = mensaje.rolRemitente === rolUsuario;
            
            // Comparar IDs
            const remitenteIdStr = remitenteId != null ? String(remitenteId) : '';
            const userIdStr = userId != null ? String(userId) : '';
            const idsCoinciden = remitenteIdStr !== '' && userIdStr !== '' && remitenteIdStr === userIdStr;
            
            // El mensaje es mío si los IDs coinciden O si el rol coincide (respaldo)
            const esMio = idsCoinciden || (mismoRol && remitenteIdStr !== '');
            
            return (
              <div
                key={mensaje.id}
                className={`chat-message ${esMio ? 'own-message' : 'other-message'} ${!mensaje.leido && !esMio ? 'unread' : ''}`}
                style={esMio ? { alignSelf: 'flex-start', marginLeft: '8px', marginRight: 'auto' } : { alignSelf: 'flex-end', marginRight: '8px', marginLeft: 'auto' }}
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

