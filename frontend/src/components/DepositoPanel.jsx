import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { pedidoService } from '../services/pedidoService';
import { grupoService } from '../services/grupoService';
import { transportistaService } from '../services/transportistaService';
import { mensajeService } from '../services/mensajeService';
import { connectWebSocket, disconnectWebSocket } from '../services/websocketService';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import Chat from './Chat';
import './DepositoPanel.css';

const DepositoPanel = () => {
  const { user, logout } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [transportistas, setTransportistas] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('PENDIENTE'); // 'PENDIENTE', 'EN_PREPARACION', 'REALIZADO', 'TRANSPORTISTAS', o 'EQUIPOS'
  const [filtroEtapaPreparacion, setFiltroEtapaPreparacion] = useState('TODOS'); // 'TODOS', 'SIN_CONTROL', 'CONTROL', 'PENDIENTE_CARGA'
  const [textoBusqueda, setTextoBusqueda] = useState(''); // Texto de búsqueda avanzada
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Estado para controlar qué días están expandidos en la sección de realizados
  const [diasExpandidos, setDiasExpandidos] = useState(new Set());
  // Rastrear pedidos vistos por estado (con persistencia en localStorage)
  const [pedidosVistos, setPedidosVistos] = useState(() => {
    try {
      const saved = localStorage.getItem('pedidosVistosDeposito');
      if (saved) {
        const data = JSON.parse(saved);
        return {
          PENDIENTE: new Set(data.PENDIENTE || []),
          EN_PREPARACION: new Set(data.EN_PREPARACION || []),
        };
      }
    } catch (e) {
      console.error('Error al cargar pedidos vistos:', e);
    }
    return {
      PENDIENTE: new Set(),
      EN_PREPARACION: new Set(),
    };
  });
  // Cache de todos los pedidos para calcular notificaciones
  const [todosLosPedidos, setTodosLosPedidos] = useState({
    PENDIENTE: [],
    EN_PREPARACION: [],
  });
  // Estado para crear equipos
  const [showGrupoModal, setShowGrupoModal] = useState(false);
  const [grupoForm, setGrupoForm] = useState({ nombre: '' });
  // Estado para el modal de resumen
  const [showResumenModal, setShowResumenModal] = useState(false);
  const [pedidosResumen, setPedidosResumen] = useState([]);
  const [fechaResumen, setFechaResumen] = useState('');
  // Estado para el tooltip de equipos
  const [showEquipoTooltip, setShowEquipoTooltip] = useState(false);
  const [equipoTooltipPedidoId, setEquipoTooltipPedidoId] = useState(null);
  // Estado para el chat
  const [showChat, setShowChat] = useState(false);
  const [cantidadMensajesNoLeidos, setCantidadMensajesNoLeidos] = useState(0);

  // Ref para rastrear si es la primera carga
  const isInitialLoad = useRef(true);
  // Ref para el campo del formulario de equipos
  const grupoNombreRef = useRef(null);
  // Estado para rastrear el índice del pedido seleccionado en Pendientes
  const [pedidoSeleccionadoIndex, setPedidoSeleccionadoIndex] = useState(-1);
  // Estado para saber si estamos en modo navegación de registros
  const [enModoNavegacionRegistros, setEnModoNavegacionRegistros] = useState(false);
  // Estado para saber si estamos en modo navegación de sub-pestañas
  const [enModoNavegacionSubPestanas, setEnModoNavegacionSubPestanas] = useState(false);
  // Estado para rastrear el índice de la sub-pestaña seleccionada
  const [subPestanaSeleccionadaIndex, setSubPestanaSeleccionadaIndex] = useState(-1);
  // Refs para los selects de "Asignar Equipo" y botones "Preparar"
  const equipoSelectRefs = useRef({});
  const prepararButtonRefs = useRef({});
  // Refs para los botones de "En Preparación" (Volver a Pendiente y Finalizar)
  const volverPendienteButtonRefs = useRef({});
  const finalizarButtonRefs = useRef({});
  // Estado para rastrear qué botón está seleccionado en un pedido de "En Preparación"
  const [botonSeleccionadoEnPreparacion, setBotonSeleccionadoEnPreparacion] = useState({});
  // Estado para rastrear si estamos navegando botones dentro de un registro
  const [enModoNavegacionBotonesRegistro, setEnModoNavegacionBotonesRegistro] = useState(false);
  // Estado para rastrear qué botón está seleccionado dentro de un registro (para PENDIENTE)
  const [botonSeleccionadoEnRegistro, setBotonSeleccionadoEnRegistro] = useState({});
  // Refs para los botones de sub-pestañas (filtros de etapa)
  const subPestanaButtonRefs = useRef([]);
  // Estados para navegación en "Realizados"
  const [diaSeleccionadoIndex, setDiaSeleccionadoIndex] = useState(-1);
  const [enModoNavegacionDias, setEnModoNavegacionDias] = useState(false);
  const [enModoNavegacionRegistrosRealizados, setEnModoNavegacionRegistrosRealizados] = useState(false);
  const [pedidoSeleccionadoIndexRealizados, setPedidoSeleccionadoIndexRealizados] = useState(-1);
  // Refs para los botones de días en "Realizados"
  const diaButtonRefs = useRef([]);

  // Cargar datos y conectar WebSocket, similar a AdminPanel
  useEffect(() => {
    if (!user) {
      return;
    }

    const cargarDatos = async () => {
      try {
        // Solo mostrar loading en la carga inicial, no al cambiar de pestaña
        if (isInitialLoad.current) {
          setLoading(true);
        }
        setError(null);
        
        // Cargar grupos activos siempre (se necesitan para asignar pedidos)
        const gruposActivos = await cargarGruposActivos();
        setGrupos(gruposActivos);

        // Cargar datos según la pestaña activa
        if (filtroEstado === 'TRANSPORTISTAS') {
          await cargarTransportistas();
        } else if (filtroEstado === 'EQUIPOS') {
          await cargarGrupos();
        } else {
          // Para PENDIENTE, EN_PREPARACION, REALIZADO
          await cargarPedidos();
        }

        await cargarTodosLosPedidosParaNotificaciones();
      } catch (err) {
        console.error('Error cargando datos:', err);
        setError('Error al cargar los datos. Verifica que el backend esté corriendo.');
      } finally {
        if (isInitialLoad.current) {
          setLoading(false);
          isInitialLoad.current = false;
        }
      }
    };

    cargarDatos();

    // Conectar WebSocket (solo una vez, el servicio maneja múltiples conexiones)
    connectWebSocket((message) => {
      if (message.tipo === 'eliminado') {
        setPedidos((prev) => prev.filter((p) => p.id !== message.id));
        // Actualizar cache también
        setTodosLosPedidos(prev => ({
          PENDIENTE: prev.PENDIENTE.filter(p => p.id !== message.id),
          EN_PREPARACION: prev.EN_PREPARACION.filter(p => p.id !== message.id),
        }));
      } else {
        // Recargar datos según la pestaña activa
        if (filtroEstado === 'TRANSPORTISTAS') {
          cargarTransportistas().catch(err => {
            console.error('Error al recargar transportistas desde WebSocket:', err);
          });
        } else if (filtroEstado === 'EQUIPOS') {
          cargarGrupos().catch(err => {
            console.error('Error al recargar equipos desde WebSocket:', err);
          });
        } else {
          // Para PENDIENTE, EN_PREPARACION, REALIZADO
          cargarPedidos().catch(err => {
            console.error('Error al recargar pedidos desde WebSocket:', err);
          });
        }
        // Recargar cache para notificaciones
        Promise.all([
          pedidoService.obtenerPorEstado('PENDIENTE'),
          pedidoService.obtenerPorEstado('EN_PREPARACION'),
        ]).then(([pendientes, enPreparacion]) => {
          setTodosLosPedidos({
            PENDIENTE: pendientes.data || [],
            EN_PREPARACION: enPreparacion.data || [],
          });
        }).catch(err => {
          console.error('Error al actualizar cache desde WebSocket:', err);
        });
      }
    });

    return () => {
      disconnectWebSocket();
    };
  }, [filtroEstado]); // Similar a AdminPanel que usa activeTab

  // Cargar cantidad de mensajes no leídos
  const actualizarCantidadMensajesNoLeidos = async () => {
    try {
      const response = await mensajeService.contarNoLeidos();
      setCantidadMensajesNoLeidos(response.data || 0);
    } catch (error) {
      console.error('Error al contar mensajes no leídos:', error);
    }
  };

  // Cargar cantidad de mensajes no leídos al montar y periódicamente
  useEffect(() => {
    actualizarCantidadMensajesNoLeidos();
    const interval = setInterval(() => {
      actualizarCantidadMensajesNoLeidos();
    }, 5000); // Cada 5 segundos

    return () => clearInterval(interval);
  }, []);

  // Suscribirse a mensajes nuevos vía WebSocket para actualizar contador en tiempo real
  useEffect(() => {
    if (!user?.rol) return;

    const backendUrl = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
      ? `http://${window.location.hostname}:8080`
      : 'http://localhost:8080';

    const socket = new SockJS(`${backendUrl}/ws`);
    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        const rolUsuario = user.rol.toLowerCase();
        const topicNuevo = '/topic/mensajes/nuevo';
        const topicLeido = `/topic/mensajes/leido/${rolUsuario}`;
        const topicTodosLeidos = `/topic/mensajes/todos-leidos/${rolUsuario}`;

        // Suscribirse a mensajes nuevos
        client.subscribe(topicNuevo, (message) => {
          const nuevoMensaje = JSON.parse(message.body);
          // Solo actualizar si el mensaje es para nuestro rol
          if (nuevoMensaje.rolDestinatario === user.rol) {
            // Actualizar contador de forma optimista (incrementar inmediatamente)
            setCantidadMensajesNoLeidos(prev => {
              // Si el mensaje no está leído, incrementar
              if (!nuevoMensaje.leido) {
                return prev + 1;
              }
              return prev;
            });
            // También actualizar desde el servidor para confirmar
            actualizarCantidadMensajesNoLeidos();
          }
        });

        // Suscribirse a mensajes leídos
        client.subscribe(topicLeido, () => {
          actualizarCantidadMensajesNoLeidos();
        });

        // Suscribirse a todos los mensajes leídos
        client.subscribe(topicTodosLeidos, () => {
          setCantidadMensajesNoLeidos(0);
        });
      },
    });

    client.activate();

    return () => {
      if (client) {
        client.deactivate();
      }
    };
  }, [user?.rol]);

  // Resetear el índice del pedido seleccionado y el modo navegación al cambiar de pestaña
  useEffect(() => {
    setPedidoSeleccionadoIndex(-1);
    setEnModoNavegacionRegistros(false);
    setEnModoNavegacionSubPestanas(false);
    setSubPestanaSeleccionadaIndex(-1);
    setEnModoNavegacionBotonesRegistro(false);
    setBotonSeleccionadoEnPreparacion({});
    setBotonSeleccionadoEnRegistro({});
    // Resetear filtro de etapa y búsqueda cuando cambias de pestaña
    if (filtroEstado !== 'EN_PREPARACION') {
      setFiltroEtapaPreparacion('TODOS');
    }
    setTextoBusqueda('');
  }, [filtroEstado]);

  // Navegación con flechas entre pestañas y entre pedidos en Pendientes
  useEffect(() => {
    const handleKeyDown = (event) => {
      // No navegar si hay un modal abierto
      if (showGrupoModal || showResumenModal) {
        return;
      }

      const focusedElement = document.activeElement;
      const isInputFocused = focusedElement && (
        focusedElement.tagName === 'INPUT' || 
        focusedElement.tagName === 'TEXTAREA' || 
        focusedElement.tagName === 'SELECT' ||
        focusedElement.isContentEditable
      );

      const pedidosPendientes = pedidos.filter(p => p.estado === 'PENDIENTE');
      const pedidosEnPreparacion = pedidos.filter(p => p.estado === 'EN_PREPARACION');

      // Si estamos en Pendientes
      if (filtroEstado === 'PENDIENTE') {
        // Si estamos en un select de "Asignar Equipo" y presionamos Enter
        if (isInputFocused && focusedElement.tagName === 'SELECT') {
          const selectPedidoId = focusedElement.getAttribute('data-pedido-id');
          if (event.key === 'Enter' && selectPedidoId) {
            event.preventDefault();
            // Hacer click en el botón "Preparar" de ese pedido
            const prepararButton = prepararButtonRefs.current[selectPedidoId];
            if (prepararButton) {
              prepararButton.click();
            }
          }
          return;
        }

        // Si no estamos en un input/select, manejar navegación entre pedidos
        if (!isInputFocused) {
          // Entrar en modo navegación de registros con flecha abajo
          if (event.key === 'ArrowDown' && pedidosPendientes.length > 0) {
            event.preventDefault();
            const nuevoIndex = enModoNavegacionRegistros 
              ? (pedidoSeleccionadoIndex < pedidosPendientes.length - 1 ? pedidoSeleccionadoIndex + 1 : 0)
              : 0;
            setPedidoSeleccionadoIndex(nuevoIndex);
            setEnModoNavegacionRegistros(true);
            
            // Enfocar el card del pedido
            const pedidoId = pedidosPendientes[nuevoIndex].id;
            const pedidoCard = document.querySelector(`[data-pedido-id="${pedidoId}"]`);
            if (pedidoCard) {
              pedidoCard.focus();
            }
            return;
          }

          // Si estamos en modo navegación de registros
          if (enModoNavegacionRegistros && pedidoSeleccionadoIndex >= 0) {
            // Salir del modo navegación si estamos en el primer registro y presionamos flecha arriba
            if (event.key === 'ArrowUp' && pedidoSeleccionadoIndex === 0 && !enModoNavegacionBotonesRegistro) {
              event.preventDefault();
              setEnModoNavegacionRegistros(false);
              setPedidoSeleccionadoIndex(-1);
              setEnModoNavegacionBotonesRegistro(false);
              setBotonSeleccionadoEnRegistro({});
              // Enfocar el botón de la pestaña para que las flechas izquierda/derecha funcionen
              const tabButton = document.querySelector('.filtros-buttons button.active');
              if (tabButton) {
                tabButton.focus();
              }
              return;
            }

            // Si estamos navegando botones y presionamos flecha arriba, salir del modo navegación de botones
            if (event.key === 'ArrowUp' && enModoNavegacionBotonesRegistro) {
              event.preventDefault();
              setEnModoNavegacionBotonesRegistro(false);
              setBotonSeleccionadoEnRegistro({});
              // Enfocar el card del pedido
              const pedidoId = pedidosPendientes[pedidoSeleccionadoIndex].id;
              const pedidoCard = document.querySelector(`[data-pedido-id="${pedidoId}"]`);
              if (pedidoCard) {
                pedidoCard.focus();
              }
              return;
            }

            // Navegación entre registros con todas las flechas (solo si NO estamos navegando botones)
            if (!enModoNavegacionBotonesRegistro) {
            if (event.key === 'ArrowUp' && pedidosPendientes.length > 0) {
              event.preventDefault();
              const nuevoIndex = pedidoSeleccionadoIndex > 0 
                ? pedidoSeleccionadoIndex - 1 
                : pedidosPendientes.length - 1;
              setPedidoSeleccionadoIndex(nuevoIndex);
                setBotonSeleccionadoEnRegistro({});
              
              const pedidoId = pedidosPendientes[nuevoIndex].id;
              const pedidoCard = document.querySelector(`[data-pedido-id="${pedidoId}"]`);
              if (pedidoCard) {
                pedidoCard.focus();
              }
              return;
            }

            if (event.key === 'ArrowDown' && pedidosPendientes.length > 0) {
              event.preventDefault();
              const nuevoIndex = pedidoSeleccionadoIndex < pedidosPendientes.length - 1 
                ? pedidoSeleccionadoIndex + 1 
                : 0;
              setPedidoSeleccionadoIndex(nuevoIndex);
                setBotonSeleccionadoEnRegistro({});
              
              const pedidoId = pedidosPendientes[nuevoIndex].id;
              const pedidoCard = document.querySelector(`[data-pedido-id="${pedidoId}"]`);
              if (pedidoCard) {
                pedidoCard.focus();
              }
              return;
              }
            }

            // Navegación izquierda/derecha entre registros (si hay más de uno y NO estamos navegando botones)
            if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && pedidosPendientes.length > 1 && !enModoNavegacionBotonesRegistro) {
              event.preventDefault();
              const nuevoIndex = event.key === 'ArrowLeft'
                ? (pedidoSeleccionadoIndex > 0 ? pedidoSeleccionadoIndex - 1 : pedidosPendientes.length - 1)
                : (pedidoSeleccionadoIndex < pedidosPendientes.length - 1 ? pedidoSeleccionadoIndex + 1 : 0);
              setPedidoSeleccionadoIndex(nuevoIndex);
              setEnModoNavegacionBotonesRegistro(false);
              setBotonSeleccionadoEnRegistro({});
              
              const pedidoId = pedidosPendientes[nuevoIndex].id;
              const pedidoCard = document.querySelector(`[data-pedido-id="${pedidoId}"]`);
              if (pedidoCard) {
                pedidoCard.focus();
              }
              return;
            }

            // Si estamos navegando botones, flechas izquierda/derecha para navegar entre botones
            if (enModoNavegacionBotonesRegistro && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
              event.preventDefault();
              const pedidoId = pedidosPendientes[pedidoSeleccionadoIndex].id;
              const botonActual = botonSeleccionadoEnRegistro[pedidoId];
              
              if (botonActual === 'select') {
                // Navegar al botón Preparar
                const prepararButton = prepararButtonRefs.current[pedidoId];
                if (prepararButton) {
                  setBotonSeleccionadoEnRegistro({ ...botonSeleccionadoEnRegistro, [pedidoId]: 'preparar' });
                  prepararButton.focus();
                }
              } else if (botonActual === 'preparar') {
                // Volver al select
                const equipoSelect = equipoSelectRefs.current[pedidoId];
                if (equipoSelect) {
                  setBotonSeleccionadoEnRegistro({ ...botonSeleccionadoEnRegistro, [pedidoId]: 'select' });
                  equipoSelect.focus();
                }
              }
              return;
            }

            // Enter para navegar entre botones del registro
            if (event.key === 'Enter' && pedidosPendientes.length > 0) {
              event.preventDefault();
              const pedidoId = pedidosPendientes[pedidoSeleccionadoIndex].id;
              
              // Si ya estamos navegando botones, activar el botón seleccionado o navegar al siguiente
              if (enModoNavegacionBotonesRegistro && botonSeleccionadoEnRegistro[pedidoId]) {
                const botonActual = botonSeleccionadoEnRegistro[pedidoId];
                
                // Si estamos en el select, navegar al botón Preparar
                if (botonActual === 'select') {
                  const prepararButton = prepararButtonRefs.current[pedidoId];
                  if (prepararButton) {
                    setBotonSeleccionadoEnRegistro({ ...botonSeleccionadoEnRegistro, [pedidoId]: 'preparar' });
                    prepararButton.focus();
                  }
                } 
                // Si estamos en el botón Preparar, activarlo
                else if (botonActual === 'preparar') {
                  const prepararButton = prepararButtonRefs.current[pedidoId];
                  if (prepararButton) {
                    prepararButton.click();
                  }
                }
              } else {
                // Primera vez que presionamos Enter, enfocar el select
                setEnModoNavegacionBotonesRegistro(true);
              const equipoSelect = equipoSelectRefs.current[pedidoId];
              if (equipoSelect) {
                  setBotonSeleccionadoEnRegistro({ ...botonSeleccionadoEnRegistro, [pedidoId]: 'select' });
                equipoSelect.focus();
                }
              }
              return;
            }
          }
        }
      }

      // Si estamos en En Preparación
      if (filtroEstado === 'EN_PREPARACION') {
        // PRIMERO: Si estamos en un botón, manejar navegación entre botones y Enter
        // Verificar si el elemento enfocado es un botón de estos pedidos
        const buttonPedidoId = focusedElement?.getAttribute('data-pedido-id');
        const esBotonDePedido = buttonPedidoId && (focusedElement.tagName === 'BUTTON') && 
          (volverPendienteButtonRefs.current[buttonPedidoId] || finalizarButtonRefs.current[buttonPedidoId]);
        
        if (esBotonDePedido) {
          // Enter en un botón: activarlo
          if (event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            focusedElement.click();
            return;
          }

          // Flechas izquierda/derecha en un botón: navegar entre botones
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            event.stopPropagation();
            // Determinar qué botón está enfocado actualmente
            const esVolverButton = focusedElement === volverPendienteButtonRefs.current[buttonPedidoId];
            
            if (esVolverButton) {
              // Cambiar al botón Finalizar
              const finalizarButton = finalizarButtonRefs.current[buttonPedidoId];
              if (finalizarButton) {
                setBotonSeleccionadoEnPreparacion(prev => ({ ...prev, [buttonPedidoId]: 'finalizar' }));
                finalizarButton.focus();
              }
            } else {
              // Cambiar al botón Volver a Pendiente
              const volverButton = volverPendienteButtonRefs.current[buttonPedidoId];
              if (volverButton) {
                setBotonSeleccionadoEnPreparacion(prev => ({ ...prev, [buttonPedidoId]: 'volver' }));
                volverButton.focus();
              }
            }
            return;
          }

          // Si estamos en un botón y presionamos flechas arriba/abajo, volver al registro
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            event.stopPropagation();
            const pedidoCard = document.querySelector(`[data-pedido-id="${buttonPedidoId}"]`);
            if (pedidoCard) {
              const pedidosFiltrados = pedidosEnPreparacion;
              const pedidoIdNum = parseInt(buttonPedidoId);
              const indexEnFiltrados = pedidosFiltrados.findIndex(p => p.id === pedidoIdNum);
              if (indexEnFiltrados >= 0) {
                setPedidoSeleccionadoIndex(indexEnFiltrados);
                setBotonSeleccionadoEnPreparacion(prev => {
                  const nuevo = { ...prev };
                  delete nuevo[buttonPedidoId];
                  return nuevo;
                });
                pedidoCard.focus();
              }
            }
            return;
          }

          // Para cualquier otra tecla cuando estamos en un botón, no hacer nada más
          return;
        }

        // Si no estamos en un input/select/button, manejar navegación entre pedidos
        if (!isInputFocused) {
          // Si estamos en modo navegación de sub-pestañas
          if (enModoNavegacionSubPestanas) {
            const subPestanas = ['TODOS', 'SIN_CONTROL', 'CONTROL', 'PENDIENTE_CARGA'];
            const currentSubIndex = subPestanas.indexOf(filtroEtapaPreparacion);
            
            // Navegación izquierda/derecha entre sub-pestañas
            if (event.key === 'ArrowLeft' && currentSubIndex > 0) {
              event.preventDefault();
              const nuevaSubPestana = subPestanas[currentSubIndex - 1];
              setFiltroEtapaPreparacion(nuevaSubPestana);
              setSubPestanaSeleccionadaIndex(currentSubIndex - 1);
              // Enfocar el botón de la sub-pestaña
              const subPestanaButton = subPestanaButtonRefs.current[currentSubIndex - 1];
              if (subPestanaButton) {
                subPestanaButton.focus();
              }
              return;
            }
            
            if (event.key === 'ArrowRight' && currentSubIndex < subPestanas.length - 1) {
              event.preventDefault();
              const nuevaSubPestana = subPestanas[currentSubIndex + 1];
              setFiltroEtapaPreparacion(nuevaSubPestana);
              setSubPestanaSeleccionadaIndex(currentSubIndex + 1);
              // Enfocar el botón de la sub-pestaña
              const subPestanaButton = subPestanaButtonRefs.current[currentSubIndex + 1];
              if (subPestanaButton) {
                subPestanaButton.focus();
              }
              return;
            }
            
            // Con flecha abajo desde sub-pestañas, entrar a los registros
            if (event.key === 'ArrowDown' && pedidosEnPreparacion.length > 0) {
              event.preventDefault();
              setEnModoNavegacionSubPestanas(false);
              const nuevoIndex = 0;
              setPedidoSeleccionadoIndex(nuevoIndex);
              setEnModoNavegacionRegistros(true);
              
              // Enfocar el card del pedido
              const pedidoId = pedidosEnPreparacion[nuevoIndex]?.id;
              if (pedidoId) {
                const pedidoCard = document.querySelector(`[data-pedido-id="${pedidoId}"]`);
                if (pedidoCard) {
                  pedidoCard.focus();
                }
              }
              return;
            }
            
            // Con flecha arriba desde sub-pestañas, volver a la pestaña principal
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setEnModoNavegacionSubPestanas(false);
              setSubPestanaSeleccionadaIndex(-1);
              // Enfocar el botón de la pestaña principal
              const tabButton = document.querySelector('.filtros-buttons button.active');
              if (tabButton) {
                tabButton.focus();
              }
              return;
            }
          }
          
          // Si no estamos en modo navegación de sub-pestañas ni de registros, y presionamos flecha abajo
          if (!enModoNavegacionSubPestanas && !enModoNavegacionRegistros) {
            // Si estamos en EN_PREPARACION, entrar a las sub-pestañas primero
            if (event.key === 'ArrowDown' && filtroEstado === 'EN_PREPARACION') {
              event.preventDefault();
              setEnModoNavegacionSubPestanas(true);
              const subPestanas = ['TODOS', 'SIN_CONTROL', 'CONTROL', 'PENDIENTE_CARGA'];
              const currentSubIndex = subPestanas.indexOf(filtroEtapaPreparacion);
              setSubPestanaSeleccionadaIndex(currentSubIndex >= 0 ? currentSubIndex : 0);
              // Enfocar el botón de sub-pestaña actual
              const subPestanaButton = subPestanaButtonRefs.current[currentSubIndex >= 0 ? currentSubIndex : 0];
              if (subPestanaButton) {
                subPestanaButton.focus();
              }
              return;
            }
            
            // Para otras pestañas o si no hay sub-pestañas, entrar directamente a los registros
            if (event.key === 'ArrowDown' && pedidosEnPreparacion.length > 0) {
            event.preventDefault();
            const nuevoIndex = enModoNavegacionRegistros 
                ? (pedidoSeleccionadoIndex < pedidosEnPreparacion.length - 1 ? pedidoSeleccionadoIndex + 1 : 0)
              : 0;
            setPedidoSeleccionadoIndex(nuevoIndex);
            setEnModoNavegacionRegistros(true);
            
            // Enfocar el card del pedido
              const pedidoId = pedidosEnPreparacion[nuevoIndex].id;
            const pedidoCard = document.querySelector(`[data-pedido-id="${pedidoId}"]`);
            if (pedidoCard) {
              pedidoCard.focus();
            }
            return;
            }
          }

          // Si estamos en modo navegación de registros
          if (enModoNavegacionRegistros && pedidoSeleccionadoIndex >= 0) {
            // Salir del modo navegación si estamos en el primer registro y presionamos flecha arriba
            if (event.key === 'ArrowUp' && pedidoSeleccionadoIndex === 0 && !enModoNavegacionBotonesRegistro) {
              event.preventDefault();
              setEnModoNavegacionRegistros(false);
              setPedidoSeleccionadoIndex(-1);
              setEnModoNavegacionBotonesRegistro(false);
              setBotonSeleccionadoEnPreparacion({});
              
              // Si estamos en EN_PREPARACION, volver a las sub-pestañas
              if (filtroEstado === 'EN_PREPARACION') {
                setEnModoNavegacionSubPestanas(true);
                const subPestanas = ['TODOS', 'SIN_CONTROL', 'CONTROL', 'PENDIENTE_CARGA'];
                const currentSubIndex = subPestanas.indexOf(filtroEtapaPreparacion);
                setSubPestanaSeleccionadaIndex(currentSubIndex >= 0 ? currentSubIndex : 0);
                const subPestanaButton = subPestanaButtonRefs.current[currentSubIndex >= 0 ? currentSubIndex : 0];
                if (subPestanaButton) {
                  subPestanaButton.focus();
                }
              } else {
              // Enfocar el botón de la pestaña para que las flechas izquierda/derecha funcionen
              const tabButton = document.querySelector('.filtros-buttons button.active');
              if (tabButton) {
                tabButton.focus();
                }
              }
              return;
            }

            // Si estamos navegando botones y presionamos flecha arriba, salir del modo navegación de botones
            if (event.key === 'ArrowUp' && enModoNavegacionBotonesRegistro) {
              event.preventDefault();
              setEnModoNavegacionBotonesRegistro(false);
              setBotonSeleccionadoEnPreparacion({});
              // Enfocar el card del pedido
              const pedidoId = pedidosEnPreparacion[pedidoSeleccionadoIndex].id;
              const pedidoCard = document.querySelector(`[data-pedido-id="${pedidoId}"]`);
              if (pedidoCard) {
                pedidoCard.focus();
              }
              return;
            }

            // Navegación entre registros con todas las flechas (solo si NO estamos navegando botones)
            if (!enModoNavegacionBotonesRegistro) {
              if (event.key === 'ArrowUp' && pedidosEnPreparacion.length > 0) {
              event.preventDefault();
              const nuevoIndex = pedidoSeleccionadoIndex > 0 
                ? pedidoSeleccionadoIndex - 1 
                  : pedidosEnPreparacion.length - 1;
              setPedidoSeleccionadoIndex(nuevoIndex);
                setBotonSeleccionadoEnPreparacion({});
              
                const pedidoId = pedidosEnPreparacion[nuevoIndex].id;
              const pedidoCard = document.querySelector(`[data-pedido-id="${pedidoId}"]`);
              if (pedidoCard) {
                pedidoCard.focus();
              }
              return;
            }

              if (event.key === 'ArrowDown' && pedidosEnPreparacion.length > 0) {
              event.preventDefault();
                const nuevoIndex = pedidoSeleccionadoIndex < pedidosEnPreparacion.length - 1 
                ? pedidoSeleccionadoIndex + 1 
                : 0;
              setPedidoSeleccionadoIndex(nuevoIndex);
                setBotonSeleccionadoEnPreparacion({});
              
                const pedidoId = pedidosEnPreparacion[nuevoIndex].id;
              const pedidoCard = document.querySelector(`[data-pedido-id="${pedidoId}"]`);
              if (pedidoCard) {
                pedidoCard.focus();
              }
              return;
              }
            }

            // Navegación izquierda/derecha entre registros (si hay más de uno) - solo si NO estamos en un botón ni navegando botones
            const buttonPedidoIdCheck = focusedElement?.getAttribute('data-pedido-id');
            const esBotonDePedidoCheck = buttonPedidoIdCheck && (focusedElement.tagName === 'BUTTON') && 
              (volverPendienteButtonRefs.current[buttonPedidoIdCheck] || finalizarButtonRefs.current[buttonPedidoIdCheck]);
            
            if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && pedidosEnPreparacion.length > 1 && !esBotonDePedidoCheck && !enModoNavegacionBotonesRegistro) {
              event.preventDefault();
              const nuevoIndex = event.key === 'ArrowLeft'
                ? (pedidoSeleccionadoIndex > 0 ? pedidoSeleccionadoIndex - 1 : pedidosEnPreparacion.length - 1)
                : (pedidoSeleccionadoIndex < pedidosEnPreparacion.length - 1 ? pedidoSeleccionadoIndex + 1 : 0);
              setPedidoSeleccionadoIndex(nuevoIndex);
              setBotonSeleccionadoEnPreparacion({});
              setEnModoNavegacionBotonesRegistro(false);
              
              const pedidoId = pedidosEnPreparacion[nuevoIndex].id;
              const pedidoCard = document.querySelector(`[data-pedido-id="${pedidoId}"]`);
              if (pedidoCard) {
                pedidoCard.focus();
              }
              return;
            }

            // Si estamos navegando botones, flechas izquierda/derecha para navegar entre botones
            if (enModoNavegacionBotonesRegistro && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
              event.preventDefault();
              const pedidoId = pedidosEnPreparacion[pedidoSeleccionadoIndex].id;
              const pedido = pedidosEnPreparacion[pedidoSeleccionadoIndex];
              const botonActual = botonSeleccionadoEnPreparacion[pedidoId];
              
              // Si el pedido no está en PENDIENTE_CARGA, hay dos botones
              if (pedido.etapaPreparacion !== 'PENDIENTE_CARGA') {
                if (botonActual === 'volver') {
                  // Navegar al botón finalizar
                  const finalizarButton = finalizarButtonRefs.current[pedidoId];
                  if (finalizarButton) {
                    setBotonSeleccionadoEnPreparacion(prev => ({ ...prev, [pedidoId]: 'finalizar' }));
                    finalizarButton.focus();
                  }
                } else if (botonActual === 'finalizar') {
                  // Volver al botón volver
              const volverButton = volverPendienteButtonRefs.current[pedidoId];
              if (volverButton) {
                    setBotonSeleccionadoEnPreparacion(prev => ({ ...prev, [pedidoId]: 'volver' }));
                  volverButton.focus();
                  }
                }
              }
              return;
            }

            // Enter para navegar entre botones del registro
            if (event.key === 'Enter' && pedidosEnPreparacion.length > 0) {
              event.preventDefault();
              const pedidoId = pedidosEnPreparacion[pedidoSeleccionadoIndex].id;
              const pedido = pedidosEnPreparacion[pedidoSeleccionadoIndex];
              
              // Si ya estamos navegando botones, activar el botón seleccionado o navegar al siguiente
              if (enModoNavegacionBotonesRegistro && botonSeleccionadoEnPreparacion[pedidoId]) {
                const botonActual = botonSeleccionadoEnPreparacion[pedidoId];
                
                // Si estamos en "volver", activarlo o navegar a "finalizar"
                if (botonActual === 'volver') {
                  // Si el pedido no está en PENDIENTE_CARGA, navegar al botón finalizar
                  if (pedido.etapaPreparacion !== 'PENDIENTE_CARGA') {
                    const finalizarButton = finalizarButtonRefs.current[pedidoId];
                    if (finalizarButton) {
                      setBotonSeleccionadoEnPreparacion(prev => ({ ...prev, [pedidoId]: 'finalizar' }));
                      finalizarButton.focus();
                    }
                  } else {
                    // Si está en PENDIENTE_CARGA, solo hay un botón, activarlo
                    const finalizarButton = finalizarButtonRefs.current[pedidoId];
                    if (finalizarButton) {
                      finalizarButton.click();
                    }
                  }
                } 
                // Si estamos en "finalizar", activarlo
                else if (botonActual === 'finalizar') {
                  const finalizarButton = finalizarButtonRefs.current[pedidoId];
                  if (finalizarButton) {
                    finalizarButton.click();
                  }
                }
              } else {
                // Primera vez que presionamos Enter, enfocar el primer botón disponible
                setEnModoNavegacionBotonesRegistro(true);
                
                // Si el pedido no está en PENDIENTE_CARGA, empezar con "volver"
                if (pedido.etapaPreparacion !== 'PENDIENTE_CARGA') {
              const volverButton = volverPendienteButtonRefs.current[pedidoId];
              if (volverButton) {
                    setBotonSeleccionadoEnPreparacion(prev => ({ ...prev, [pedidoId]: 'volver' }));
                  volverButton.focus();
                  }
                } else {
                  // Si está en PENDIENTE_CARGA, solo hay un botón (finalizar)
                  const finalizarButton = finalizarButtonRefs.current[pedidoId];
                  if (finalizarButton) {
                    setBotonSeleccionadoEnPreparacion(prev => ({ ...prev, [pedidoId]: 'finalizar' }));
                    finalizarButton.focus();
                  }
                }
              }
              return;
            }
          }
        }
      }

      // Navegación normal con flechas izquierda/derecha entre pestañas (solo si NO estamos en modo navegación de registros ni de sub-pestañas)
      if (!enModoNavegacionRegistros && !enModoNavegacionSubPestanas && !isInputFocused) {
        const tabs = ['PENDIENTE', 'EN_PREPARACION', 'REALIZADO', 'EQUIPOS', 'TRANSPORTISTAS'];
        const currentIndex = tabs.indexOf(filtroEstado);

        if (event.key === 'ArrowLeft' && currentIndex > 0) {
          event.preventDefault();
          setFiltroEstado(tabs[currentIndex - 1]);
          setPedidoSeleccionadoIndex(-1);
          setEnModoNavegacionRegistros(false);
          setEnModoNavegacionSubPestanas(false);
        } else if (event.key === 'ArrowRight' && currentIndex < tabs.length - 1) {
          event.preventDefault();
          setFiltroEstado(tabs[currentIndex + 1]);
          setPedidoSeleccionadoIndex(-1);
          setEnModoNavegacionRegistros(false);
          setEnModoNavegacionSubPestanas(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [filtroEstado, filtroEtapaPreparacion, showGrupoModal, showResumenModal, pedidos, pedidoSeleccionadoIndex, enModoNavegacionRegistros, enModoNavegacionSubPestanas, subPestanaSeleccionadaIndex, enModoNavegacionBotonesRegistro, botonSeleccionadoEnPreparacion, botonSeleccionadoEnRegistro]);

  // Navegación con teclado para la sección "Realizados"
  useEffect(() => {
    if (filtroEstado !== 'REALIZADO') {
      return;
    }

    const handleKeyDown = (event) => {
      // No navegar si hay un modal abierto
      if (showGrupoModal || showResumenModal) {
        return;
      }

      const focusedElement = document.activeElement;
      const isInputFocused = focusedElement && (
        focusedElement.tagName === 'INPUT' || 
        focusedElement.tagName === 'TEXTAREA' || 
        focusedElement.tagName === 'SELECT' ||
        focusedElement.isContentEditable
      );

      // Si estamos escribiendo en un input, no navegar
      if (isInputFocused) {
        return;
      }

      const pedidosAgrupados = getPedidosAgrupadosPorDia();
      if (!pedidosAgrupados || pedidosAgrupados.length === 0) {
        return;
      }

      // Si estamos en la pestaña principal y presionamos flecha abajo, entrar en modo navegación de días
      if (!enModoNavegacionDias && !enModoNavegacionRegistrosRealizados && event.key === 'ArrowDown') {
        event.preventDefault();
        setEnModoNavegacionDias(true);
        setDiaSeleccionadoIndex(0);
        const firstDiaButton = diaButtonRefs.current[0];
        if (firstDiaButton) {
          firstDiaButton.focus();
        }
        return;
      }

      // Si estamos navegando días
      if (enModoNavegacionDias && !enModoNavegacionRegistrosRealizados) {
        // Navegación arriba/abajo entre días
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault();
          const nuevoIndex = event.key === 'ArrowUp'
            ? (diaSeleccionadoIndex > 0 ? diaSeleccionadoIndex - 1 : pedidosAgrupados.length - 1)
            : (diaSeleccionadoIndex < pedidosAgrupados.length - 1 ? diaSeleccionadoIndex + 1 : 0);
          setDiaSeleccionadoIndex(nuevoIndex);
          const diaButton = diaButtonRefs.current[nuevoIndex];
          if (diaButton) {
            diaButton.focus();
          }
          return;
        }

        // Enter para expandir/colapsar el día seleccionado
        if (event.key === 'Enter') {
          event.preventDefault();
          const dia = pedidosAgrupados[diaSeleccionadoIndex];
          if (dia) {
            toggleDia(dia.fecha);
            // Si el día se expande y tiene pedidos, entrar en modo navegación de registros
            if (!diasExpandidos.has(dia.fecha) && dia.pedidos.length > 0) {
              setEnModoNavegacionRegistrosRealizados(true);
              setPedidoSeleccionadoIndexRealizados(0);
              setEnModoNavegacionDias(false);
              // Enfocar el primer registro del día expandido
              setTimeout(() => {
                const firstPedido = dia.pedidos[0];
                if (firstPedido) {
                  const pedidoCard = document.querySelector(`[data-pedido-id-realizado="${firstPedido.id}"]`);
                  if (pedidoCard) {
                    pedidoCard.focus();
                  }
                }
              }, 100);
            }
          }
          return;
        }

        // Si presionamos flecha arriba desde el primer día, salir del modo navegación
        if (event.key === 'ArrowUp' && diaSeleccionadoIndex === 0) {
          event.preventDefault();
          setEnModoNavegacionDias(false);
          setDiaSeleccionadoIndex(-1);
          const tabButton = document.querySelector('.filtros-buttons button.active');
          if (tabButton) {
            tabButton.focus();
          }
          return;
        }
      }

      // Si estamos navegando registros de un día expandido
      if (enModoNavegacionRegistrosRealizados && pedidoSeleccionadoIndexRealizados >= 0) {
        const dia = pedidosAgrupados[diaSeleccionadoIndex];
        if (!dia || !diasExpandidos.has(dia.fecha)) {
          return;
        }

        const pedidosDelDia = dia.pedidos;

        // Si estamos en el primer registro y presionamos flecha arriba, volver a días
        if (event.key === 'ArrowUp' && pedidoSeleccionadoIndexRealizados === 0) {
          event.preventDefault();
          setEnModoNavegacionRegistrosRealizados(false);
          setPedidoSeleccionadoIndexRealizados(-1);
          setEnModoNavegacionDias(true);
          const diaButton = diaButtonRefs.current[diaSeleccionadoIndex];
          if (diaButton) {
            diaButton.focus();
          }
          return;
        }

        // Navegación arriba/abajo entre registros
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault();
          const nuevoIndex = event.key === 'ArrowUp'
            ? (pedidoSeleccionadoIndexRealizados > 0 ? pedidoSeleccionadoIndexRealizados - 1 : pedidosDelDia.length - 1)
            : (pedidoSeleccionadoIndexRealizados < pedidosDelDia.length - 1 ? pedidoSeleccionadoIndexRealizados + 1 : 0);
          setPedidoSeleccionadoIndexRealizados(nuevoIndex);
          
          const pedido = pedidosDelDia[nuevoIndex];
          if (pedido) {
            const pedidoCard = document.querySelector(`[data-pedido-id-realizado="${pedido.id}"]`);
            if (pedidoCard) {
              pedidoCard.focus();
            }
          }
          return;
        }

        // Navegación izquierda/derecha entre registros (si hay más de uno)
        if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && pedidosDelDia.length > 1) {
          event.preventDefault();
          const nuevoIndex = event.key === 'ArrowLeft'
            ? (pedidoSeleccionadoIndexRealizados > 0 ? pedidoSeleccionadoIndexRealizados - 1 : pedidosDelDia.length - 1)
            : (pedidoSeleccionadoIndexRealizados < pedidosDelDia.length - 1 ? pedidoSeleccionadoIndexRealizados + 1 : 0);
          setPedidoSeleccionadoIndexRealizados(nuevoIndex);
          
          const pedido = pedidosDelDia[nuevoIndex];
          if (pedido) {
            const pedidoCard = document.querySelector(`[data-pedido-id-realizado="${pedido.id}"]`);
            if (pedidoCard) {
              pedidoCard.focus();
            }
          }
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [filtroEstado, enModoNavegacionDias, diaSeleccionadoIndex, enModoNavegacionRegistrosRealizados, pedidoSeleccionadoIndexRealizados, diasExpandidos, textoBusqueda, showGrupoModal, showResumenModal]);

  // Agregar listener para abrir modal de crear equipo con Enter cuando esté en la sección de equipos
  useEffect(() => {
    const handleKeyPress = (event) => {
      // Solo abrir el modal si no se está escribiendo en un input, textarea o select
      const target = event.target;
      const isInputFocused = target.tagName === 'INPUT' || 
                           target.tagName === 'TEXTAREA' || 
                           target.tagName === 'SELECT' ||
                           target.isContentEditable;
      
      if (event.key === 'Enter' && !isInputFocused) {
        if (filtroEstado === 'EQUIPOS' && !showGrupoModal) {
          event.preventDefault();
          setShowGrupoModal(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [filtroEstado, showGrupoModal]);

  // Enfocar el campo cuando se abre el modal de crear equipo
  useEffect(() => {
    if (showGrupoModal && grupoNombreRef.current) {
      // Pequeño delay para asegurar que el modal esté completamente renderizado
      setTimeout(() => {
        grupoNombreRef.current?.focus();
      }, 100);
    }
  }, [showGrupoModal]);

  // Cerrar modal con ESC
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && showGrupoModal) {
        setShowGrupoModal(false);
        setGrupoForm({ nombre: '' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showGrupoModal]);

  // Función para cargar todos los pedidos para calcular notificaciones
  const cargarTodosLosPedidosParaNotificaciones = async () => {
    try {
      const [pendientes, enPreparacion] = await Promise.all([
        pedidoService.obtenerPorEstado('PENDIENTE'),
        pedidoService.obtenerPorEstado('EN_PREPARACION'),
      ]);
      setTodosLosPedidos({
        PENDIENTE: pendientes.data || [],
        EN_PREPARACION: enPreparacion.data || [],
      });
    } catch (error) {
      console.error('Error al cargar todos los pedidos:', error);
    }
  };

  // Cargar todos los pedidos para calcular notificaciones
  // Usar un ref para rastrear si ya se configuró el intervalo
  const notificationIntervalSet = useRef(false);
  
  useEffect(() => {
    if (!user || loading) return;
    
    // Solo configurar el intervalo una vez
    if (!notificationIntervalSet.current) {
      notificationIntervalSet.current = true;
      cargarTodosLosPedidosParaNotificaciones();
      // Recargar cada 10 segundos para actualizar notificaciones
      const interval = setInterval(cargarTodosLosPedidosParaNotificaciones, 10000);
      return () => {
        clearInterval(interval);
        notificationIntervalSet.current = false;
      };
    }
  }, [loading, user]);

  // Rastrear el último estado para detectar cambios de pestaña
  const prevFiltroEstado = useRef(filtroEstado);

  // Función helper para guardar pedidos vistos en localStorage
  const guardarPedidosVistos = (nuevosVistos) => {
    try {
      localStorage.setItem('pedidosVistosDeposito', JSON.stringify({
        PENDIENTE: Array.from(nuevosVistos.PENDIENTE),
          EN_PREPARACION: Array.from(nuevosVistos.EN_PREPARACION || []),
      }));
    } catch (e) {
      console.error('Error al guardar pedidos vistos:', e);
    }
  };

  // Marcar pedidos como vistos cuando cambias de pestaña
  useEffect(() => {
    // Solo marcar como vistos si realmente cambiaste de pestaña
    if (prevFiltroEstado.current !== filtroEstado) {
      prevFiltroEstado.current = filtroEstado;
      
      if ((filtroEstado === 'PENDIENTE' || filtroEstado === 'EN_PREPARACION') && pedidos.length > 0) {
        setPedidosVistos(prev => {
          const nuevosVistos = new Set(prev[filtroEstado]);
          pedidos.forEach(pedido => {
            nuevosVistos.add(pedido.id);
          });
          const nuevoEstado = {
            ...prev,
            [filtroEstado]: nuevosVistos,
          };
          guardarPedidosVistos(nuevoEstado);
          return nuevoEstado;
        });
      }
    }
  }, [filtroEstado, pedidos]);

  // NO marcar automáticamente como vistos al cargar
  // Los pedidos solo se marcarán como vistos cuando el usuario cambie a esa pestaña
  // (esto se maneja en el otro useEffect que detecta cambios de pestaña)

  // Función para obtener el valor numérico de la prioridad (mayor = más urgente)
  const getPrioridadValue = (prioridad) => {
    const prioridades = {
      'URGENTE': 4,
      'ALTA': 3,
      'NORMAL': 2,
      'BAJA': 1
    };
    return prioridades[prioridad] || 0;
  };

  const cargarPedidos = async () => {
    try {
      const response = await pedidoService.obtenerPorEstado(filtroEstado);
      const pedidosData = response.data || [];
      
      // Ordenar pedidos: primero por prioridad (URGENTE > ALTA > NORMAL > BAJA)
      // y luego por fecha de creación (más antiguos primero)
      const pedidosOrdenados = pedidosData.sort((a, b) => {
        // Primero comparar por prioridad
        const prioridadA = getPrioridadValue(a.prioridad);
        const prioridadB = getPrioridadValue(b.prioridad);
        
        if (prioridadA !== prioridadB) {
          return prioridadB - prioridadA; // Mayor prioridad primero
        }
        
        // Si tienen la misma prioridad, ordenar por fecha de creación (más antiguos primero)
        const fechaA = new Date(a.fechaCreacion || a.fechaActualizacion || 0);
        const fechaB = new Date(b.fechaCreacion || b.fechaActualizacion || 0);
        return fechaA - fechaB;
      });
      
      setPedidos(pedidosOrdenados);
    } catch (error) {
      console.error('Error al cargar pedidos:', error);
      setPedidos([]);
      throw error;
    }
  };

  const cargarGrupos = async () => {
    try {
      // Para la pestaña de Equipos, necesitamos todos los equipos, no solo los activos
      const response = await grupoService.obtenerTodos();
      setGrupos(response.data || []);
    } catch (error) {
      console.error('Error al cargar equipos:', error);
      setGrupos([]);
      // No lanzamos error aquí porque equipos no es crítico
    }
  };

  const cargarGruposActivos = async () => {
    try {
      const response = await grupoService.obtenerActivos();
      return response.data || [];
    } catch (error) {
      console.error('Error al cargar equipos activos:', error);
      return [];
    }
  };

  const cargarTransportistas = async () => {
    try {
      const response = await transportistaService.obtenerTodos();
      setTransportistas(response.data || []);
    } catch (error) {
      console.error('Error al cargar transportistas:', error);
      setTransportistas([]);
      // No lanzar error, solo mostrar array vacío
      if (error.response?.status === 403) {
        console.warn('Error 403 al cargar transportistas. Verifica que tengas sesión activa.');
      }
    }
  };

  const handleAsignarGrupo = async (pedidoId, grupoId) => {
    try {
      await pedidoService.asignarGrupo(pedidoId, grupoId);
      cargarPedidos();
      // Actualizar equipos activos para los selectores
      const gruposActivos = await cargarGruposActivos();
      setGrupos(gruposActivos);
    } catch (error) {
      alert(error.response?.data || 'Error al asignar equipo');
    }
  };

  const handleQuitarGrupo = async (pedidoId) => {
    try {
      await pedidoService.quitarGrupo(pedidoId);
      cargarPedidos();
    } catch (error) {
      alert(error.response?.data || 'Error al quitar equipo');
    }
  };

  const handleAvanzarEtapa = async (pedidoId) => {
    try {
      await pedidoService.avanzarEtapaPreparacion(pedidoId);
      await cargarPedidos();
      // Actualizar cache
      const [pendientes, enPreparacion] = await Promise.all([
        pedidoService.obtenerPorEstado('PENDIENTE'),
        pedidoService.obtenerPorEstado('EN_PREPARACION'),
      ]);
      setTodosLosPedidos({
        PENDIENTE: pendientes.data || [],
        EN_PREPARACION: enPreparacion.data || [],
      });
    } catch (error) {
      console.error('Error al avanzar etapa:', error);
      alert(error.response?.data || 'Error al avanzar etapa');
    }
  };

  const handleCambiarEstado = async (pedidoId, nuevoEstado) => {
    try {
      const pedidoActual = pedidos.find(p => p.id === pedidoId);
      const estadoAnterior = pedidoActual?.estado;
      
      await pedidoService.actualizarEstado(pedidoId, nuevoEstado);
      
      // Si el pedido cambia de PENDIENTE a EN_PREPARACION, actualizar el cache inmediatamente
      if (estadoAnterior === 'PENDIENTE' && nuevoEstado === 'EN_PREPARACION') {
        // Removerlo de los vistos de PENDIENTE
        setPedidosVistos(prev => {
          const nuevosVistosPendiente = new Set(prev.PENDIENTE);
          nuevosVistosPendiente.delete(pedidoId);
          const nuevoEstado = {
            ...prev,
            PENDIENTE: nuevosVistosPendiente,
            // No agregar a EN_PREPARACION para que aparezca como nuevo
          };
          guardarPedidosVistos(nuevoEstado);
          return nuevoEstado;
        });
        
        // Actualizar el cache manualmente: remover de PENDIENTE y agregar a EN_PREPARACION
        setTodosLosPedidos(prev => {
          const nuevoPendiente = prev.PENDIENTE.filter(p => p.id !== pedidoId);
          const nuevoEnPreparacion = [...prev.EN_PREPARACION];
          // Agregar el pedido actualizado a EN_PREPARACION si no está ya
          if (!nuevoEnPreparacion.find(p => p.id !== pedidoId)) {
            const pedidoActualizado = { ...pedidoActual, estado: nuevoEstado, etapaPreparacion: null };
            nuevoEnPreparacion.push(pedidoActualizado);
          }
          return {
            PENDIENTE: nuevoPendiente,
            EN_PREPARACION: nuevoEnPreparacion,
          };
        });
      }
      
      // Si el pedido cambia de EN_PREPARACION a PENDIENTE, actualizar el cache para resetear etapaPreparacion
      if (estadoAnterior === 'EN_PREPARACION' && nuevoEstado === 'PENDIENTE') {
        // Removerlo de los vistos de EN_PREPARACION
        setPedidosVistos(prev => {
          const nuevosVistosEnPreparacion = new Set(prev.EN_PREPARACION);
          nuevosVistosEnPreparacion.delete(pedidoId);
          const nuevoEstado = {
            ...prev,
            EN_PREPARACION: nuevosVistosEnPreparacion,
          };
          guardarPedidosVistos(nuevoEstado);
          return nuevoEstado;
        });
        
        // Actualizar el cache manualmente: remover de EN_PREPARACION y agregar a PENDIENTE con etapaPreparacion null
        setTodosLosPedidos(prev => {
          const nuevoEnPreparacion = prev.EN_PREPARACION.filter(p => p.id !== pedidoId);
          const nuevoPendiente = [...prev.PENDIENTE];
          // Actualizar el pedido en PENDIENTE para asegurar que etapaPreparacion sea null
          const pedidoIndex = nuevoPendiente.findIndex(p => p.id === pedidoId);
          if (pedidoIndex >= 0) {
            nuevoPendiente[pedidoIndex] = { ...nuevoPendiente[pedidoIndex], estado: nuevoEstado, etapaPreparacion: null };
          } else {
            const pedidoActualizado = { ...pedidoActual, estado: nuevoEstado, etapaPreparacion: null };
            nuevoPendiente.push(pedidoActualizado);
          }
          return {
            PENDIENTE: nuevoPendiente,
            EN_PREPARACION: nuevoEnPreparacion,
          };
        });
      }
      
      // Recargar pedidos de la pestaña actual
      await cargarPedidos();
      
      // Actualizar el cache desde el backend después de un delay para asegurar consistencia
      // Para cambios de PENDIENTE a EN_PREPARACION o viceversa, esperar más tiempo para que el backend procese
      const delay = (estadoAnterior === 'PENDIENTE' && nuevoEstado === 'EN_PREPARACION') || 
                    (estadoAnterior === 'EN_PREPARACION' && nuevoEstado === 'PENDIENTE') ? 1000 : 300;
      setTimeout(async () => {
        try {
          const [pendientes, enPreparacion] = await Promise.all([
            pedidoService.obtenerPorEstado('PENDIENTE'),
            pedidoService.obtenerPorEstado('EN_PREPARACION'),
          ]);
          
          // Para cambios de PENDIENTE a EN_PREPARACION, solo actualizar si el pedido está en EN_PREPARACION en el backend
          if (estadoAnterior === 'PENDIENTE' && nuevoEstado === 'EN_PREPARACION') {
            const pedidoEnBackend = enPreparacion.data?.find(p => p.id === pedidoId);
            if (pedidoEnBackend) {
              // El backend ya procesó el cambio, actualizar el cache
              setTodosLosPedidos({
                PENDIENTE: pendientes.data || [],
                EN_PREPARACION: enPreparacion.data || [],
              });
            } else {
              // Si el pedido no está en el backend aún, intentar de nuevo después de un delay más largo
              setTimeout(async () => {
                try {
                  const [pendientes2, enPreparacion2] = await Promise.all([
                    pedidoService.obtenerPorEstado('PENDIENTE'),
                    pedidoService.obtenerPorEstado('EN_PREPARACION'),
                  ]);
                  const pedidoEnBackend2 = enPreparacion2.data?.find(p => p.id === pedidoId);
                  if (pedidoEnBackend2) {
                    setTodosLosPedidos({
                      PENDIENTE: pendientes2.data || [],
                      EN_PREPARACION: enPreparacion2.data || [],
                    });
                  }
                } catch (err) {
                  console.error('Error en segundo intento de actualizar cache:', err);
                }
              }, 1000);
            }
          } else {
            // Para otros cambios, actualizar normalmente
            setTodosLosPedidos({
              PENDIENTE: pendientes.data || [],
              EN_PREPARACION: enPreparacion.data || [],
            });
          }
        } catch (err) {
          console.error('Error al actualizar cache después de cambiar estado:', err);
        }
      }, delay);
    } catch (error) {
      alert(error.response?.data || 'Error al actualizar estado');
    }
  };

  const handleCrearGrupo = async (e) => {
    e.preventDefault();
    try {
      await grupoService.crear(grupoForm.nombre);
      setShowGrupoModal(false);
      setGrupoForm({ nombre: '' });
      // Si estamos en la pestaña de Equipos, recargar todos los equipos
      if (filtroEstado === 'EQUIPOS') {
        await cargarGrupos();
      } else {
        // Si no, solo recargar equipos activos para los selectores
        const gruposActivos = await cargarGruposActivos();
        setGrupos(gruposActivos);
      }
      alert('Equipo creado exitosamente');
    } catch (error) {
      alert(error.response?.data || 'Error al crear equipo');
    }
  };

  const handleEliminarGrupo = async (grupoId) => {
    if (!window.confirm('¿Estás seguro de que deseas desactivar este equipo?\n\nEl equipo se desactivará y no aparecerá como opción al asignar pedidos, pero se mantendrá en el sistema para conservar los registros históricos.')) {
      return;
    }
    try {
      await grupoService.eliminar(grupoId);
      // Solo recargar si estamos en la pestaña de Equipos
      if (filtroEstado === 'EQUIPOS') {
        await cargarGrupos();
      } else {
        // Si no, solo recargar equipos activos para los selectores
        const gruposActivos = await cargarGruposActivos();
        setGrupos(gruposActivos);
      }
      alert('Equipo desactivado exitosamente');
    } catch (error) {
      console.error('Error al desactivar equipo:', error);
      const errorMessage = error.response?.data || error.message || 'Error al desactivar equipo';
      alert(errorMessage);
    }
  };

  const handleActivarGrupo = async (grupoId) => {
    if (!window.confirm('¿Estás seguro de que deseas activar este equipo?\n\nEl equipo volverá a aparecer como opción al asignar pedidos.')) {
      return;
    }
    try {
      await grupoService.actualizar(grupoId, { activo: true });
      // Solo recargar si estamos en la pestaña de Equipos
      if (filtroEstado === 'EQUIPOS') {
        await cargarGrupos();
      } else {
        // Si no, solo recargar equipos activos para los selectores
        const gruposActivos = await cargarGruposActivos();
        setGrupos(gruposActivos);
      }
      alert('Equipo activado exitosamente');
    } catch (error) {
      console.error('Error al activar equipo:', error);
      const errorMessage = error.response?.data || error.message || 'Error al activar equipo';
      alert(errorMessage);
    }
  };

  const getPrioridadColor = (prioridad) => {
    const colors = {
      BAJA: '#4CAF50',
      NORMAL: '#2196F3',
      ALTA: '#FF9800',
      URGENTE: '#F44336',
    };
    return colors[prioridad] || '#666';
  };

  const getEstadoTexto = (pedido) => {
    if (pedido.estado === 'REALIZADO') {
      return 'Finalizado';
    } else if (pedido.estado === 'EN_PREPARACION') {
      if (!pedido.etapaPreparacion) {
        return 'En Preparación'; // Cuando recién pasa a EN_PREPARACION sin etapa
      } else if (pedido.etapaPreparacion === 'CONTROL') {
        return 'Controlado';
      } else if (pedido.etapaPreparacion === 'PENDIENTE_CARGA') {
        return 'Pendiente de Carga';
      }
      return 'En Preparación';
    } else if (pedido.estado === 'PENDIENTE') {
      return 'Pendiente';
    }
    return pedido.estado.replace('_', ' ');
  };

  const getEstadoColor = (pedido) => {
    if (pedido.estado === 'REALIZADO') {
      return '#4CAF50';
    } else if (pedido.estado === 'EN_PREPARACION') {
      if (!pedido.etapaPreparacion) {
        return '#2196F3'; // Azul para "En Preparación" (sin etapa aún)
      } else if (pedido.etapaPreparacion === 'CONTROL') {
        return '#2196F3'; // Azul para Controlado
      } else if (pedido.etapaPreparacion === 'PENDIENTE_CARGA') {
        return '#FF9800'; // Naranja para Pendiente de Carga
      }
      return '#2196F3';
    } else if (pedido.estado === 'PENDIENTE') {
      return '#9E9E9E'; // Gris para Pendiente (diferente de Pendiente de Carga)
    }
    return '#666';
  };

  // Calcular cantidad de pedidos nuevos por estado
  const getCantidadNuevos = useCallback((estado) => {
    if (estado === 'REALIZADO') return 0;
    const pedidosEstado = todosLosPedidos[estado] || [];
    const vistos = pedidosVistos[estado] || new Set();
    const cantidad = pedidosEstado.filter(p => !vistos.has(p.id)).length;
    return cantidad;
  }, [todosLosPedidos, pedidosVistos]);

  // Calcular cantidad total de pedidos por estado (para mostrar en el indicador)
  const getCantidadTotal = useCallback((estado) => {
    if (estado === 'REALIZADO') return 0;
    const pedidosEstado = todosLosPedidos[estado] || [];
    return pedidosEstado.length;
  }, [todosLosPedidos]);

  const getCantidadPorEtapa = useCallback((etapa) => {
    const pedidosEnPreparacion = todosLosPedidos.EN_PREPARACION || [];
    if (etapa === 'TODOS') return pedidosEnPreparacion.length;
    if (etapa === 'SIN_CONTROL') return pedidosEnPreparacion.filter(p => !p.etapaPreparacion).length;
    if (etapa === 'CONTROL') return pedidosEnPreparacion.filter(p => p.etapaPreparacion === 'CONTROL').length;
    if (etapa === 'PENDIENTE_CARGA') return pedidosEnPreparacion.filter(p => p.etapaPreparacion === 'PENDIENTE_CARGA').length;
    return 0;
  }, [todosLosPedidos]);

  // Calcular pedidos realizados por día y agruparlos
  const getPedidosAgrupadosPorDia = () => {
    if (filtroEstado !== 'REALIZADO') return null;
    
    const pedidosPorDia = {};
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    pedidos.forEach(pedido => {
      if (pedido.estado === 'REALIZADO' && pedido.fechaActualizacion) {
        // Aplicar filtro de búsqueda si existe
        if (textoBusqueda.trim()) {
          const busqueda = textoBusqueda.toLowerCase().trim();
          const matchPlanilla = pedido.numeroPlanilla?.toLowerCase().includes(busqueda);
          const matchTransporte = (pedido.transportistaNombre || pedido.transportista || '').toLowerCase().includes(busqueda);
          const matchZona = (pedido.zonaNombre || '').toLowerCase().includes(busqueda);
          const matchVuelta = (pedido.vueltaNombre || '').toLowerCase().includes(busqueda);
          if (!matchPlanilla && !matchTransporte && !matchZona && !matchVuelta) {
            return; // Saltar este pedido si no coincide con la búsqueda
          }
        }
        
        const fechaPedido = new Date(pedido.fechaActualizacion);
        fechaPedido.setHours(0, 0, 0, 0);
        
        const fechaKey = fechaPedido.toLocaleDateString('es-AR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });

        if (!pedidosPorDia[fechaKey]) {
          pedidosPorDia[fechaKey] = {
            fecha: fechaKey,
            fechaDate: fechaPedido,
            cantidad: 0,
            esHoy: fechaPedido.getTime() === hoy.getTime(),
            pedidos: []
          };
        }
        pedidosPorDia[fechaKey].cantidad++;
        pedidosPorDia[fechaKey].pedidos.push(pedido);
      }
    });

    // Ordenar pedidos dentro de cada día por fecha de actualización descendente
    Object.values(pedidosPorDia).forEach(dia => {
      dia.pedidos.sort((a, b) => {
        return new Date(b.fechaActualizacion) - new Date(a.fechaActualizacion);
      });
    });

    return Object.values(pedidosPorDia).sort((a, b) => {
      return b.fechaDate - a.fechaDate; // Más recientes primero
    });
  };

  // Mantener la función anterior para las estadísticas
  const getPedidosPorDia = () => {
    const agrupados = getPedidosAgrupadosPorDia();
    if (!agrupados) return null;
    
    return agrupados.map(dia => ({
      fecha: dia.fecha,
      cantidad: dia.cantidad,
      esHoy: dia.esHoy
    }));
  };

  // Contar pedidos realizados hoy
  const getCantidadRealizadosHoy = () => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    return pedidos.filter(pedido => {
      if (pedido.estado !== 'REALIZADO' || !pedido.fechaActualizacion) return false;
      const fechaPedido = new Date(pedido.fechaActualizacion);
      fechaPedido.setHours(0, 0, 0, 0);
      return fechaPedido.getTime() === hoy.getTime();
    }).length;
  };

  const pedidosAgrupadosPorDia = useMemo(() => getPedidosAgrupadosPorDia(), [pedidos, filtroEstado, textoBusqueda]);
  const pedidosPorDia = getPedidosPorDia();
  const cantidadHoy = getCantidadRealizadosHoy();

  // Expandir el día de hoy por defecto cuando se carga la sección de realizados
  useEffect(() => {
    if (filtroEstado === 'REALIZADO' && pedidosAgrupadosPorDia && pedidosAgrupadosPorDia.length > 0) {
      if (textoBusqueda.trim()) {
        // Si hay búsqueda activa, expandir todos los días que tienen resultados
        setDiasExpandidos(new Set(pedidosAgrupadosPorDia.map(dia => dia.fecha)));
      } else {
        // Si no hay búsqueda, solo expandir el día de hoy
      const hoy = pedidosAgrupadosPorDia.find(dia => dia.esHoy);
      if (hoy) {
        setDiasExpandidos(prev => {
          if (!prev.has(hoy.fecha)) {
            return new Set([...prev, hoy.fecha]);
          }
          return prev;
        });
        }
      }
    } else if (filtroEstado !== 'REALIZADO') {
      // Limpiar días expandidos cuando se cambia de pestaña
      setDiasExpandidos(new Set());
    }
  }, [filtroEstado, pedidosAgrupadosPorDia, textoBusqueda]);

  const toggleDia = (fecha) => {
    setDiasExpandidos(prev => {
      const nuevo = new Set(prev);
      if (nuevo.has(fecha)) {
        nuevo.delete(fecha);
      } else {
        nuevo.add(fecha);
      }
      return nuevo;
    });
  };

  if (!user) {
    return (
      <div className="deposito-panel">
        <div style={{ padding: '50px', textAlign: 'center' }}>
          <h2>No hay usuario autenticado</h2>
          <button onClick={logout} style={{ marginTop: '20px', padding: '10px 20px' }}>
            Ir al Login
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="deposito-panel">
        <div style={{ 
          padding: '50px', 
          textAlign: 'center',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <h2>Cargando datos...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="deposito-panel">
        <div style={{ 
          padding: '50px', 
          textAlign: 'center',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <h2 style={{ color: 'red' }}>Error</h2>
          <p>{error}</p>
          <div style={{ marginTop: '20px' }}>
            <button 
              onClick={() => window.location.reload()} 
              style={{ padding: '10px 20px', marginRight: '10px', cursor: 'pointer' }}
            >
              Recargar Página
            </button>
            <button 
              onClick={logout} 
              style={{ padding: '10px 20px', cursor: 'pointer' }}
            >
              Salir
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="deposito-panel">
      <header className="deposito-header">
        <h1>
          <img 
            src="/logo-empresa.png" 
            alt="Logo Empresa" 
            style={{ 
              height: '40px',
              marginRight: '12px',
              verticalAlign: 'middle',
              display: 'inline-block'
            }}
          />
          Panel de Depósito
        </h1>
        <div className="user-info">
          <span>
            <span style={{ marginRight: '8px', fontSize: '1.1rem', verticalAlign: 'middle' }}>👤</span>
            {user?.nombreCompleto || user?.username || 'Usuario'}
          </span>
          <button 
            onClick={() => setShowChat(!showChat)} 
            className="btn-chat"
            style={{ position: 'relative' }}
          >
            💬
            {cantidadMensajesNoLeidos > 0 && (
              <span 
                style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '-8px',
                  backgroundColor: '#F44336',
                  color: 'white',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}
              >
                {cantidadMensajesNoLeidos > 99 ? '99+' : cantidadMensajesNoLeidos}
              </span>
            )}
          </button>
          <button onClick={logout} className="btn-logout">
            Salir
          </button>
        </div>
      </header>

      <div className="filtros">
        <div className="filtros-buttons">
          <button
            className={filtroEstado === 'PENDIENTE' ? 'active' : ''}
            onClick={() => setFiltroEstado('PENDIENTE')}
            style={{ position: 'relative' }}
          >
            Pendientes
            {getCantidadTotal('PENDIENTE') > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '-8px',
                  backgroundColor: '#F44336',
                  color: 'white',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}
              >
                {getCantidadTotal('PENDIENTE')}
              </span>
            )}
          </button>
          <button
            className={filtroEstado === 'EN_PREPARACION' ? 'active' : ''}
            onClick={() => setFiltroEstado('EN_PREPARACION')}
            style={{ position: 'relative' }}
          >
            En Preparación
            {getCantidadTotal('EN_PREPARACION') > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '-8px',
                  backgroundColor: '#F44336',
                  color: 'white',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}
              >
                {getCantidadTotal('EN_PREPARACION')}
              </span>
            )}
          </button>
          <button
            className={filtroEstado === 'REALIZADO' ? 'active' : ''}
            onClick={() => setFiltroEstado('REALIZADO')}
          >
            Realizados
          </button>
          <button
            className={filtroEstado === 'EQUIPOS' ? 'active' : ''}
            onClick={() => setFiltroEstado('EQUIPOS')}
          >
            Equipos
          </button>
          <button
            className={filtroEstado === 'TRANSPORTISTAS' ? 'active' : ''}
            onClick={() => setFiltroEstado('TRANSPORTISTAS')}
          >
            Transportes
          </button>
        </div>
      </div>

      <div className="content-section">
        {/* Tab de Equipos */}
        {filtroEstado === 'EQUIPOS' && (
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h2 style={{ margin: 0, color: '#333' }}>Equipos</h2>
              <button
                onClick={() => setShowGrupoModal(true)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#1976D2'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#2196F3'}
              >
                + Nuevo Equipo
              </button>
            </div>
            {grupos.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
                No hay equipos registrados
              </p>
            ) : (
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                marginTop: '10px'
              }}>
                <thead>
                  <tr style={{ 
                    backgroundColor: '#f5f5f5',
                    borderBottom: '2px solid #ddd'
                  }}>
                    <th style={{ 
                      padding: '12px', 
                      textAlign: 'left',
                      fontWeight: 'bold',
                      color: '#333'
                    }}>
                      ID
                    </th>
                    <th style={{ 
                      padding: '12px', 
                      textAlign: 'left',
                      fontWeight: 'bold',
                      color: '#333'
                    }}>
                      Nombre
                    </th>
                    <th style={{ 
                      padding: '12px', 
                      textAlign: 'left',
                      fontWeight: 'bold',
                      color: '#333'
                    }}>
                      Estado
                    </th>
                    <th style={{ 
                      padding: '12px', 
                      textAlign: 'left',
                      fontWeight: 'bold',
                      color: '#333'
                    }}>
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((grupo) => (
                    <tr 
                      key={grupo.id}
                      style={{
                        borderBottom: '1px solid #eee',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '12px', color: '#333' }}>
                        {grupo.id}
                      </td>
                      <td style={{ padding: '12px', color: '#333', fontWeight: '500' }}>
                        {grupo.nombre}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '0.85em',
                          fontWeight: 'bold',
                          backgroundColor: grupo.activo !== false ? '#E8F5E9' : '#FFEBEE',
                          color: grupo.activo !== false ? '#2E7D32' : '#C62828'
                        }}>
                          {grupo.activo !== false ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        {grupo.activo !== false ? (
                          <button
                            onClick={() => handleEliminarGrupo(grupo.id)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#F44336',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.85em',
                              fontWeight: 'bold',
                              transition: 'background-color 0.2s',
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = '#D32F2F'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = '#F44336'}
                          >
                            Desactivar
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivarGrupo(grupo.id)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#0f766e',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.85em',
                              fontWeight: 'bold',
                              transition: 'background-color 0.2s',
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = '#0d9488'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = '#0f766e'}
                          >
                            Activar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab de Transportes - Solo lectura */}
        {filtroEstado === 'TRANSPORTISTAS' && (
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          }}>
            <h2 style={{ marginBottom: '20px', color: '#333' }}>Transportes</h2>
            {transportistas.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
                No hay transportistas registrados
              </p>
            ) : (
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                marginTop: '10px'
              }}>
                <thead>
                  <tr style={{ 
                    backgroundColor: '#f5f5f5',
                    borderBottom: '2px solid #ddd'
                  }}>
                    <th style={{ 
                      padding: '12px', 
                      textAlign: 'left',
                      fontWeight: 'bold',
                      color: '#333'
                    }}>
                      Nombre
                    </th>
                    <th style={{ 
                      padding: '12px', 
                      textAlign: 'left',
                      fontWeight: 'bold',
                      color: '#333'
                    }}>
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transportistas.map((transportista) => (
                    <tr 
                      key={transportista.id}
                      style={{
                        borderBottom: '1px solid #eee',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '12px', color: '#333' }}>
                        {transportista.nombre}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '0.85em',
                          fontWeight: 'bold',
                          backgroundColor: transportista.activo ? '#E8F5E9' : '#FFEBEE',
                          color: transportista.activo ? '#2E7D32' : '#C62828'
                        }}>
                          {transportista.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Buscador para sección REALIZADO */}
        {filtroEstado === 'REALIZADO' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '20px',
            padding: '20px 40px',
            margin: '0 20px 25px 20px',
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span style={{ fontSize: '1.8rem' }}>✅</span>
              <h2 style={{
                margin: 0,
                fontSize: '1.5rem',
                fontWeight: '700',
                color: '#1e293b',
                letterSpacing: '-0.02em'
              }}>
                Planillas Realizadas
              </h2>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flex: '0 0 400px',
              position: 'relative'
            }}>
              <span style={{ fontSize: '1.2rem' }}>🔍</span>
              <input
                type="text"
                placeholder="Buscar por planilla, transporte, zona, vuelta..."
                value={textoBusqueda}
                onChange={(e) => setTextoBusqueda(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 15px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '0.95rem',
                  outline: 'none',
                  transition: 'all 0.2s',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#0f766e';
                  e.target.style.boxShadow = '0 0 0 3px rgba(15, 118, 110, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e0e0e0';
                  e.target.style.boxShadow = 'none';
                }}
              />
              {textoBusqueda && (
                <button
                  onClick={() => setTextoBusqueda('')}
                  style={{
                    padding: '8px 12px',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: '#f3f4f6',
                    color: '#666',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#e5e7eb';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = '#f3f4f6';
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {filtroEstado === 'REALIZADO' && pedidosAgrupadosPorDia && pedidosAgrupadosPorDia.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {pedidosAgrupadosPorDia.map((dia, index) => (
              <div
                key={dia.fecha}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
                  overflow: 'hidden',
                  border: '1px solid #E0E0E0',
                }}
              >
                {/* Encabezado del día - clickeable para expandir/colapsar */}
                <div
                  style={{
                    padding: '15px 20px',
                    backgroundColor: dia.esHoy ? '#E0F2F1' : '#FFFFFF',
                    border: dia.esHoy ? '2px solid #0f766e' : '2px solid #E0E0E0',
                    borderBottom: dia.esHoy ? '2px solid #0f766e' : '2px solid #BDBDBD',
                    borderRadius: '8px 8px 0 0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.2s ease',
                    boxShadow: dia.esHoy ? '0 2px 4px rgba(15, 118, 110, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <div
                    onClick={() => toggleDia(dia.fecha)}
                    style={{
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '15px',
                      flex: 1,
                    }}
                    onMouseEnter={(e) => {
                      const parent = e.currentTarget.parentElement;
                      if (dia.esHoy) {
                        parent.style.backgroundColor = '#B2DFDB';
                        parent.style.borderColor = '#0d9488';
                      } else {
                        parent.style.backgroundColor = '#F5F5F5';
                        parent.style.borderColor = '#9E9E9E';
                      }
                    }}
                    onMouseLeave={(e) => {
                      const parent = e.currentTarget.parentElement;
                      if (dia.esHoy) {
                        parent.style.backgroundColor = '#E0F2F1';
                        parent.style.borderColor = '#0f766e';
                      } else {
                        parent.style.backgroundColor = '#FFFFFF';
                        parent.style.borderColor = '#E0E0E0';
                      }
                    }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>
                      {diasExpandidos.has(dia.fecha) ? '▼' : '▶'}
                    </span>
                    <div>
                      <div style={{
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        color: '#333',
                      }}>
                        {dia.esHoy ? '📅 Hoy' : dia.fecha}
                      </div>
                      <div style={{
                        fontSize: '0.9rem',
                        color: '#666',
                      }}>
                        {dia.cantidad} {dia.cantidad === 1 ? 'planilla' : 'planillas'}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPedidosResumen(dia.pedidos);
                      setFechaResumen(dia.esHoy ? 'Hoy' : dia.fecha);
                      setShowResumenModal(true);
                    }}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#0f766e',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: 'bold',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      marginLeft: '15px',
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#0d9488'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#0f766e'}
                  >
                    Resumen
                  </button>
                </div>

                {/* Pedidos del día - solo se muestran si está expandido */}
                {diasExpandidos.has(dia.fecha) && (
                  <div className="pedidos-grid" style={{ padding: '20px', gap: '15px' }}>
                    {dia.pedidos.filter(pedido => {
                      // Aplicar filtro de búsqueda si existe
                      if (textoBusqueda.trim()) {
                        const busqueda = textoBusqueda.toLowerCase().trim();
                        const matchPlanilla = pedido.numeroPlanilla?.toLowerCase().includes(busqueda);
                        const matchTransporte = (pedido.transportistaNombre || pedido.transportista || '').toLowerCase().includes(busqueda);
                        const matchZona = (pedido.zonaNombre || '').toLowerCase().includes(busqueda);
                        const matchVuelta = (pedido.vueltaNombre || '').toLowerCase().includes(busqueda);
                        return matchPlanilla || matchTransporte || matchZona || matchVuelta;
                      }
                      return true;
                    }).map((pedido, pedidoIndex) => (
                      <div 
                        key={pedido.id} 
                        className="pedido-card deposito-pedido-card"
                        data-pedido-id-realizado={pedido.id}
                        tabIndex={0}
                        style={{
                          outline: (diaSeleccionadoIndex === index && enModoNavegacionRegistrosRealizados && pedidoSeleccionadoIndexRealizados === pedidoIndex) ? '3px solid #0f766e' : 'none',
                          outlineOffset: '-2px',
                        }}
                        onFocus={(e) => {
                          if (diaSeleccionadoIndex === index && enModoNavegacionRegistrosRealizados) {
                            setPedidoSeleccionadoIndexRealizados(pedidoIndex);
                          }
                        }}
                      >
                        <div className="pedido-header">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '48px',
                              height: '48px',
                              borderRadius: '12px',
                              background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.5rem',
                              color: 'white',
                              fontWeight: '700',
                              boxShadow: '0 4px 12px rgba(15, 118, 110, 0.3)'
                            }}>
                              📋
                            </div>
                            <div>
                              <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '700', color: '#1e293b' }}>
                                {pedido.numeroPlanilla}
                              </h3>
                              <div style={{ 
                                fontSize: '0.85rem', 
                                color: '#64748b', 
                                marginTop: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}>
                                <span>🕐 {pedido.fechaCreacion && new Date(pedido.fechaCreacion).toLocaleTimeString('es-AR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false,
                                })}</span>
                              </div>
                            </div>
                          </div>
                          <span
                            className="prioridad-badge"
                            style={{ backgroundColor: getPrioridadColor(pedido.prioridad) }}
                          >
                            {pedido.prioridad}
                          </span>
                        </div>
                        
                        <div className="pedido-info">
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '16px',
                            marginBottom: '16px'
                          }}>
                            <div className="info-item">
                              <div className="info-label">🚚 Transporte</div>
                              <div className="info-value">
                                {pedido.transportistaNombre || pedido.transportista || 'Sin transporte'}
                              </div>
                            </div>
                            {pedido.cantidad && (
                              <div className="info-item">
                                <div className="info-label">📊 Cantidad</div>
                                <div className="info-value">{pedido.cantidad}</div>
                              </div>
                            )}
                              </div>
                          
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '16px',
                            marginBottom: '16px'
                          }}>
                            {pedido.zonaNombre && (
                              <div className="info-item">
                                <div className="info-label">📍 Zona</div>
                                <div className="info-value">{pedido.zonaNombre}</div>
                              </div>
                            )}
                            {pedido.vueltaNombre && (
                              <div className="info-item">
                                <div className="info-label">🔄 Vuelta</div>
                                <div className="info-value">{pedido.vueltaNombre}</div>
                          </div>
                            )}
                          </div>
                          
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '16px',
                            marginBottom: '16px'
                          }}>
                            <div className="info-item">
                              <div className="info-label">👥 Equipo</div>
                              <div className="info-value">{pedido.grupoNombre || 'Sin asignar'}</div>
                            </div>
                            <div className="info-item">
                              <div className="info-label">📋 Estado</div>
                              <span
                                className="estado-badge"
                                style={{ backgroundColor: getEstadoColor(pedido) }}
                              >
                                {getEstadoTexto(pedido)}
                              </span>
                            </div>
                          </div>
                          
                          {pedido.etapaPreparacion === 'PENDIENTE_CARGA' && pedido.fechaActualizacion && (
                            <div style={{
                              padding: '12px',
                              background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
                              borderRadius: '8px',
                              border: '1px solid #ffb74d',
                              marginTop: '8px',
                              marginBottom: '8px'
                            }}>
                              <div style={{ 
                                fontSize: '0.85rem', 
                                fontWeight: '600', 
                                color: '#E65100',
                                marginBottom: '4px'
                              }}>
                                📦 Pendiente de Carga
                              </div>
                              <div style={{ 
                                fontSize: '0.9rem', 
                                color: '#F57C00',
                                fontWeight: '500'
                              }}>
                                {new Date(pedido.fechaActualizacion).toLocaleString('es-AR', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false,
                                })}
                              </div>
                            </div>
                          )}
                          
                          {pedido.estado === 'REALIZADO' && pedido.fechaActualizacion && (
                            <div style={{
                              display: 'flex',
                              gap: '12px',
                              marginTop: '8px'
                            }}>
                              {pedido.fechaPendienteCarga && (
                                <div style={{
                                  flex: 1,
                                  padding: '12px',
                                  background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
                                  borderRadius: '8px',
                                  border: '1px solid #ffb74d'
                                }}>
                                  <div style={{ 
                                    fontSize: '0.85rem', 
                                    fontWeight: '600', 
                                    color: '#E65100',
                                    marginBottom: '4px'
                                  }}>
                                    📦 Pend. de Carga
                                  </div>
                                  <div style={{ 
                                    fontSize: '0.9rem', 
                                    color: '#F57C00',
                                    fontWeight: '500'
                                  }}>
                                    {new Date(pedido.fechaPendienteCarga).toLocaleString('es-AR', {
                                      year: 'numeric',
                                      month: '2-digit',
                                      day: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: false,
                                    })}
                                  </div>
                                </div>
                              )}
                              <div style={{
                                flex: 1,
                                padding: '12px',
                                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                                borderRadius: '8px',
                                border: '1px solid #86efac'
                              }}>
                                <div style={{ 
                                  fontSize: '0.85rem', 
                                  fontWeight: '600', 
                                  color: '#166534',
                                  marginBottom: '4px'
                                }}>
                                  ✅ Finalizado
                                </div>
                                <div style={{ 
                                  fontSize: '0.9rem', 
                                  color: '#15803d',
                                  fontWeight: '500'
                                }}>
                                {new Date(pedido.fechaActualizacion).toLocaleString('es-AR', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false,
                                })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {pedidosAgrupadosPorDia.length === 0 && (
              <div className="no-pedidos" style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                textAlign: 'center',
                minHeight: '300px',
              }}>
                <div style={{
                  fontSize: '4rem',
                  marginBottom: '20px',
                  opacity: 0.3,
                }}>
                  ✅
                </div>
                <h3 style={{
                  fontSize: '1.5rem',
                  fontWeight: '600',
                  color: '#333',
                  margin: '0 0 10px 0',
                }}>
                  No hay pedidos realizados
                </h3>
                <p style={{
                  fontSize: '1rem',
                  color: '#666',
                  margin: '0',
                  maxWidth: '400px',
                }}>
                  Los pedidos completados aparecerán aquí organizados por fecha.
                </p>
              </div>
            )}
          </div>
        )}

        {filtroEstado !== 'TRANSPORTISTAS' && filtroEstado !== 'EQUIPOS' && filtroEstado !== 'REALIZADO' && (
          <div>
            {/* Buscador para pestañas sin sub-pestañas (PENDIENTE) */}
            {filtroEstado !== 'EN_PREPARACION' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '20px',
                padding: '20px 40px',
                margin: '0 20px 25px 20px',
                background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <span style={{ fontSize: '1.8rem' }}>📋</span>
                  <h2 style={{
                    margin: 0,
                    fontSize: '1.5rem',
                    fontWeight: '700',
                    color: '#1e293b',
                    letterSpacing: '-0.02em'
                  }}>
                    Planillas Pendientes
                  </h2>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flex: '0 0 400px',
                  position: 'relative'
                }}>
                  <span style={{ fontSize: '1.2rem' }}>🔍</span>
                  <input
                    type="text"
                    placeholder="Buscar por planilla, transporte, zona, vuelta..."
                    value={textoBusqueda}
                    onChange={(e) => setTextoBusqueda(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '10px 15px',
                      border: '2px solid #e0e0e0',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      outline: 'none',
                      transition: 'all 0.2s',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#0f766e';
                      e.target.style.boxShadow = '0 0 0 3px rgba(15, 118, 110, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e0e0e0';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  {textoBusqueda && (
                    <button
                      onClick={() => setTextoBusqueda('')}
                      style={{
                        padding: '8px 12px',
                        border: 'none',
                        borderRadius: '6px',
                        backgroundColor: '#f3f4f6',
                        color: '#666',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#e5e7eb';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = '#f3f4f6';
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}
            {/* Filtros de etapa para EN_PREPARACION */}
            {filtroEstado === 'EN_PREPARACION' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                padding: '20px 40px',
                margin: '0 20px 25px 20px',
                background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)'
              }}>
                <div style={{ display: 'flex', gap: '10px', flex: 1 }}>
                <button
                  ref={(el) => { if (el) subPestanaButtonRefs.current[0] = el; }}
                  onClick={() => setFiltroEtapaPreparacion('TODOS')}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: filtroEtapaPreparacion === 'TODOS' ? '600' : '500',
                    backgroundColor: filtroEtapaPreparacion === 'TODOS' ? '#0f766e' : '#f3f4f6',
                    color: filtroEtapaPreparacion === 'TODOS' ? 'white' : '#666',
                    transition: 'all 0.2s',
                    position: 'relative',
                    outline: enModoNavegacionSubPestanas && subPestanaSeleccionadaIndex === 0 ? '3px solid #2196F3' : 'none',
                    outlineOffset: enModoNavegacionSubPestanas && subPestanaSeleccionadaIndex === 0 ? '2px' : '0',
                  }}
                >
                  Todos
                  {getCantidadPorEtapa('TODOS') > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '-8px',
                        backgroundColor: '#F44336',
                        color: 'white',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      }}
                    >
                      {getCantidadPorEtapa('TODOS')}
                    </span>
                  )}
                </button>
                <button
                  ref={(el) => { if (el) subPestanaButtonRefs.current[1] = el; }}
                  onClick={() => setFiltroEtapaPreparacion('SIN_CONTROL')}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: filtroEtapaPreparacion === 'SIN_CONTROL' ? '600' : '500',
                    backgroundColor: filtroEtapaPreparacion === 'SIN_CONTROL' ? '#0f766e' : '#f3f4f6',
                    color: filtroEtapaPreparacion === 'SIN_CONTROL' ? 'white' : '#666',
                    transition: 'all 0.2s',
                    position: 'relative',
                    outline: enModoNavegacionSubPestanas && subPestanaSeleccionadaIndex === 1 ? '3px solid #2196F3' : 'none',
                    outlineOffset: enModoNavegacionSubPestanas && subPestanaSeleccionadaIndex === 1 ? '2px' : '0',
                  }}
                >
                  Sin Control
                  {getCantidadPorEtapa('SIN_CONTROL') > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '-8px',
                        backgroundColor: '#F44336',
                        color: 'white',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      }}
                    >
                      {getCantidadPorEtapa('SIN_CONTROL')}
                    </span>
                  )}
                </button>
                <button
                  ref={(el) => { if (el) subPestanaButtonRefs.current[2] = el; }}
                  onClick={() => setFiltroEtapaPreparacion('CONTROL')}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: filtroEtapaPreparacion === 'CONTROL' ? '600' : '500',
                    backgroundColor: filtroEtapaPreparacion === 'CONTROL' ? '#0f766e' : '#f3f4f6',
                    color: filtroEtapaPreparacion === 'CONTROL' ? 'white' : '#666',
                    transition: 'all 0.2s',
                    position: 'relative',
                    outline: enModoNavegacionSubPestanas && subPestanaSeleccionadaIndex === 2 ? '3px solid #2196F3' : 'none',
                    outlineOffset: enModoNavegacionSubPestanas && subPestanaSeleccionadaIndex === 2 ? '2px' : '0',
                  }}
                >
                  Control
                  {getCantidadPorEtapa('CONTROL') > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '-8px',
                        backgroundColor: '#F44336',
                        color: 'white',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      }}
                    >
                      {getCantidadPorEtapa('CONTROL')}
                    </span>
                  )}
                </button>
                <button
                  ref={(el) => { if (el) subPestanaButtonRefs.current[3] = el; }}
                  onClick={() => setFiltroEtapaPreparacion('PENDIENTE_CARGA')}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: filtroEtapaPreparacion === 'PENDIENTE_CARGA' ? '600' : '500',
                    backgroundColor: filtroEtapaPreparacion === 'PENDIENTE_CARGA' ? '#0f766e' : '#f3f4f6',
                    color: filtroEtapaPreparacion === 'PENDIENTE_CARGA' ? 'white' : '#666',
                    transition: 'all 0.2s',
                    position: 'relative',
                    outline: enModoNavegacionSubPestanas && subPestanaSeleccionadaIndex === 3 ? '3px solid #2196F3' : 'none',
                    outlineOffset: enModoNavegacionSubPestanas && subPestanaSeleccionadaIndex === 3 ? '2px' : '0',
                  }}
                >
                  Pendiente de Carga
                  {getCantidadPorEtapa('PENDIENTE_CARGA') > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '-8px',
                        backgroundColor: '#F44336',
                        color: 'white',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      }}
                    >
                      {getCantidadPorEtapa('PENDIENTE_CARGA')}
                    </span>
                  )}
                </button>
                </div>
                {/* Buscador avanzado */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flex: '0 0 400px',
                  position: 'relative'
                }}>
                  <span style={{ fontSize: '1.2rem' }}>🔍</span>
                  <input
                    type="text"
                    placeholder="Buscar por planilla, transporte, zona, vuelta..."
                    value={textoBusqueda}
                    onChange={(e) => setTextoBusqueda(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '10px 15px',
                      border: '2px solid #e0e0e0',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      outline: 'none',
                      transition: 'all 0.2s',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#0f766e';
                      e.target.style.boxShadow = '0 0 0 3px rgba(15, 118, 110, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e0e0e0';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  {textoBusqueda && (
                    <button
                      onClick={() => setTextoBusqueda('')}
                      style={{
                        padding: '8px 12px',
                        border: 'none',
                        borderRadius: '6px',
                        backgroundColor: '#f3f4f6',
                        color: '#666',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#e5e7eb';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = '#f3f4f6';
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}
          <div className="pedidos-grid">
            {pedidos.filter(pedido => {
              if (pedido.estado !== filtroEstado) return false;
              // Si estamos en EN_PREPARACION, aplicar filtro de etapa
              if (filtroEstado === 'EN_PREPARACION') {
                if (filtroEtapaPreparacion === 'TODOS') {
                  // Aplicar búsqueda
                  if (textoBusqueda.trim()) {
                    const busqueda = textoBusqueda.toLowerCase().trim();
                    const matchPlanilla = pedido.numeroPlanilla?.toLowerCase().includes(busqueda);
                    const matchTransporte = (pedido.transportistaNombre || pedido.transportista || '').toLowerCase().includes(busqueda);
                    const matchZona = (pedido.zonaNombre || '').toLowerCase().includes(busqueda);
                    const matchVuelta = (pedido.vueltaNombre || '').toLowerCase().includes(busqueda);
                    return matchPlanilla || matchTransporte || matchZona || matchVuelta;
                  }
                  return true;
                }
                if (filtroEtapaPreparacion === 'SIN_CONTROL') {
                  if (!pedido.etapaPreparacion) {
                    // Aplicar búsqueda
                    if (textoBusqueda.trim()) {
                      const busqueda = textoBusqueda.toLowerCase().trim();
                      const matchPlanilla = pedido.numeroPlanilla?.toLowerCase().includes(busqueda);
                      const matchTransporte = (pedido.transportistaNombre || pedido.transportista || '').toLowerCase().includes(busqueda);
                      const matchZona = (pedido.zonaNombre || '').toLowerCase().includes(busqueda);
                      const matchVuelta = (pedido.vueltaNombre || '').toLowerCase().includes(busqueda);
                      return matchPlanilla || matchTransporte || matchZona || matchVuelta;
                    }
                    return true;
                  }
                  return false;
                }
                if (filtroEtapaPreparacion === 'CONTROL') {
                  if (pedido.etapaPreparacion === 'CONTROL') {
                    // Aplicar búsqueda
                    if (textoBusqueda.trim()) {
                      const busqueda = textoBusqueda.toLowerCase().trim();
                      const matchPlanilla = pedido.numeroPlanilla?.toLowerCase().includes(busqueda);
                      const matchTransporte = (pedido.transportistaNombre || pedido.transportista || '').toLowerCase().includes(busqueda);
                      const matchZona = (pedido.zonaNombre || '').toLowerCase().includes(busqueda);
                      const matchVuelta = (pedido.vueltaNombre || '').toLowerCase().includes(busqueda);
                      return matchPlanilla || matchTransporte || matchZona || matchVuelta;
                    }
                    return true;
                  }
                  return false;
                }
                if (filtroEtapaPreparacion === 'PENDIENTE_CARGA') {
                  if (pedido.etapaPreparacion === 'PENDIENTE_CARGA') {
                    // Aplicar búsqueda
                    if (textoBusqueda.trim()) {
                      const busqueda = textoBusqueda.toLowerCase().trim();
                      const matchPlanilla = pedido.numeroPlanilla?.toLowerCase().includes(busqueda);
                      const matchTransporte = (pedido.transportistaNombre || pedido.transportista || '').toLowerCase().includes(busqueda);
                      const matchZona = (pedido.zonaNombre || '').toLowerCase().includes(busqueda);
                      const matchVuelta = (pedido.vueltaNombre || '').toLowerCase().includes(busqueda);
                      return matchPlanilla || matchTransporte || matchZona || matchVuelta;
                    }
                    return true;
                  }
                  return false;
                }
              }
              // Para otras pestañas, también aplicar búsqueda si existe
              if (textoBusqueda.trim()) {
                const busqueda = textoBusqueda.toLowerCase().trim();
                const matchPlanilla = pedido.numeroPlanilla?.toLowerCase().includes(busqueda);
                const matchTransporte = (pedido.transportistaNombre || pedido.transportista || '').toLowerCase().includes(busqueda);
                const matchZona = (pedido.zonaNombre || '').toLowerCase().includes(busqueda);
                const matchVuelta = (pedido.vueltaNombre || '').toLowerCase().includes(busqueda);
                return matchPlanilla || matchTransporte || matchZona || matchVuelta;
              }
              return true;
            }).map((pedido, index) => (
            <div 
              key={pedido.id} 
              className="pedido-card deposito-pedido-card"
              data-pedido-id={pedido.id}
              tabIndex={(filtroEstado === 'PENDIENTE' || filtroEstado === 'EN_PREPARACION') ? 0 : -1}
              style={{
                outline: (filtroEstado === 'PENDIENTE' || filtroEstado === 'EN_PREPARACION') && pedidoSeleccionadoIndex === index 
                  ? '3px solid #2196F3' 
                  : 'none',
                outlineOffset: (filtroEstado === 'PENDIENTE' || filtroEstado === 'EN_PREPARACION') && pedidoSeleccionadoIndex === index 
                  ? '2px' 
                  : '0',
              }}
              onFocus={() => {
                if (filtroEstado === 'PENDIENTE' || filtroEstado === 'EN_PREPARACION') {
                  setPedidoSeleccionadoIndex(index);
                }
              }}
            >
              <div className="pedido-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    color: 'white',
                    fontWeight: '700',
                    boxShadow: '0 4px 12px rgba(15, 118, 110, 0.3)'
                  }}>
                    📋
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '700', color: '#1e293b' }}>
                      {pedido.numeroPlanilla}
                    </h3>
                    <div style={{ 
                      fontSize: '0.85rem', 
                      color: '#64748b', 
                      marginTop: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span>🕐 {pedido.fechaCreacion && new Date(pedido.fechaCreacion).toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}</span>
                    </div>
                  </div>
                </div>
                <span
                  className="prioridad-badge"
                  style={{ backgroundColor: getPrioridadColor(pedido.prioridad) }}
                >
                  {pedido.prioridad}
                </span>
              </div>
              
              <div className="pedido-info">
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                  marginBottom: '16px'
                }}>
                  <div className="info-item">
                    <div className="info-label">🚚 Transporte</div>
                    <div className="info-value">
                      {pedido.transportistaNombre || pedido.transportista || 'Sin transporte'}
                    </div>
                  </div>
                  {pedido.cantidad && (
                    <div className="info-item">
                      <div className="info-label">📊 Cantidad</div>
                      <div className="info-value">{pedido.cantidad}</div>
                    </div>
                  )}
                    </div>
                
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                  marginBottom: '16px'
                }}>
                  {pedido.zonaNombre && (
                    <div className="info-item">
                      <div className="info-label">📍 Zona</div>
                      <div className="info-value">{pedido.zonaNombre}</div>
                    </div>
                  )}
                  {pedido.vueltaNombre && (
                    <div className="info-item">
                      <div className="info-label">🔄 Vuelta</div>
                      <div className="info-value">{pedido.vueltaNombre}</div>
                </div>
                  )}
                </div>
                
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                  marginBottom: '16px'
                }}>
                  <div className="info-item">
                    <div className="info-label">👥 Equipo</div>
                    <div className="info-value">{pedido.grupoNombre || 'Sin asignar'}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">📋 Estado</div>
                  <span
                    className="estado-badge"
                    style={{ backgroundColor: getEstadoColor(pedido) }}
                  >
                    {getEstadoTexto(pedido)}
                  </span>
                  </div>
                </div>
                
                {pedido.estado === 'REALIZADO' && pedido.fechaActualizacion && (
                  <div style={{
                    padding: '12px',
                    background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                    borderRadius: '8px',
                    border: '1px solid #86efac',
                    marginTop: '8px'
                  }}>
                    <div style={{ 
                      fontSize: '0.85rem', 
                      fontWeight: '600', 
                      color: '#166534',
                      marginBottom: '4px'
                    }}>
                      ✅ Finalizado
                    </div>
                    <div style={{ 
                      fontSize: '0.9rem', 
                      color: '#15803d',
                      fontWeight: '500'
                    }}>
                      {new Date(pedido.fechaActualizacion).toLocaleString('es-AR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}
                    </div>
                  </div>
                )}
              </div>
              {pedido.estado !== 'REALIZADO' && (
                <div className="pedido-actions">
                  {/* Asignar Equipo disponible en todas las etapas hasta finalizar */}
                    <div className="action-group" style={{ position: 'relative' }}>
                      <label>Asignar Equipo:</label>
                      <select
                        ref={(el) => {
                          if (el) equipoSelectRefs.current[pedido.id] = el;
                        }}
                        data-pedido-id={pedido.id}
                        value={pedido.grupoId || ''}
                        onChange={(e) => {
                          if (e.target.value === 'sin-asignar') {
                            handleQuitarGrupo(pedido.id);
                          } else if (e.target.value) {
                            handleAsignarGrupo(pedido.id, parseInt(e.target.value));
                          }
                          setShowEquipoTooltip(false);
                        }}
                        onMouseDown={(e) => {
                          const equiposActivos = grupos.filter(g => g.activo !== false);
                          if (equiposActivos.length === 0) {
                            e.preventDefault();
                            setEquipoTooltipPedidoId(pedido.id);
                            setShowEquipoTooltip(true);
                            // Cerrar el tooltip después de 5 segundos
                            setTimeout(() => setShowEquipoTooltip(false), 5000);
                          }
                        }}
                        onFocus={(e) => {
                          const equiposActivos = grupos.filter(g => g.activo !== false);
                          if (equiposActivos.length === 0) {
                            e.target.blur();
                            setEquipoTooltipPedidoId(pedido.id);
                            setShowEquipoTooltip(true);
                            // Cerrar el tooltip después de 5 segundos
                            setTimeout(() => setShowEquipoTooltip(false), 5000);
                          }
                        }}
                        onBlur={() => {
                          // Cerrar el tooltip después de un pequeño delay para permitir que se vea
                          setTimeout(() => setShowEquipoTooltip(false), 200);
                        }}
                      >
                        <option value="">Seleccionar...</option>
                        {grupos.map((grupo) => (
                          <option key={grupo.id} value={grupo.id}>
                            {grupo.nombre}
                          </option>
                        ))}
                        <option value="sin-asignar">Sin asignar</option>
                      </select>
                      {showEquipoTooltip && equipoTooltipPedidoId === pedido.id && grupos.filter(g => g.activo !== false).length === 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          marginTop: '8px',
                          padding: '12px 16px',
                          backgroundColor: '#0f766e',
                          color: 'white',
                          borderRadius: '8px',
                          fontSize: '0.9rem',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                          zIndex: 1000,
                          maxWidth: '300px',
                          lineHeight: '1.5',
                          animation: 'fadeIn 0.3s ease-in'
                        }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                            ℹ️ No hay equipos registrados
                          </div>
                          <div>
                            Para asignar un equipo, primero debes ir a la sección <strong>"Equipos"</strong> y crear al menos un equipo.
                          </div>
                          <div style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: '20px',
                            width: 0,
                            height: 0,
                            borderLeft: '8px solid transparent',
                            borderRight: '8px solid transparent',
                            borderBottom: '8px solid #0f766e'
                          }}></div>
                        </div>
                      )}
                    </div>
                  <div className="action-group">
                    {pedido.estado === 'PENDIENTE' && (
                      <button
                        ref={(el) => {
                          if (el) prepararButtonRefs.current[pedido.id] = el;
                        }}
                        className="btn-primary"
                        onClick={() => handleCambiarEstado(pedido.id, 'EN_PREPARACION')}
                        style={{
                          background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
                          color: 'white',
                          border: 'none',
                          padding: '12px 24px',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '600',
                          letterSpacing: '0.3px',
                          width: '100%',
                          boxShadow: '0 4px 12px rgba(15, 118, 110, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1)',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 6px 16px rgba(15, 118, 110, 0.4), 0 4px 6px rgba(0, 0, 0, 0.15)';
                          e.target.style.background = 'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = '0 4px 12px rgba(15, 118, 110, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1)';
                          e.target.style.background = 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)';
                        }}
                      >
                        <span style={{ marginRight: '6px' }}>⚙️</span>
                        Preparar
                      </button>
                    )}
                    {pedido.estado === 'EN_PREPARACION' && (
                      <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                        {pedido.etapaPreparacion !== 'PENDIENTE_CARGA' && (
                        <button
                          ref={(el) => {
                            if (el) volverPendienteButtonRefs.current[pedido.id] = el;
                          }}
                          data-pedido-id={pedido.id}
                          className="btn-secondary"
                          onClick={() => handleCambiarEstado(pedido.id, 'PENDIENTE')}
                          style={{
                            flex: 1,
                            background: 'linear-gradient(135deg, #6B7280 0%, #4B5563 100%)',
                            color: 'white',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '600',
                            letterSpacing: '0.3px',
                            boxShadow: '0 4px 12px rgba(107, 114, 128, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1)',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            position: 'relative',
                            overflow: 'hidden',
                            outline: botonSeleccionadoEnPreparacion[pedido.id] === 'volver' ? '3px solid #2196F3' : 'none',
                            outlineOffset: botonSeleccionadoEnPreparacion[pedido.id] === 'volver' ? '2px' : '0',
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.transform = 'translateY(-2px)';
                            e.target.style.boxShadow = '0 6px 16px rgba(107, 114, 128, 0.4), 0 4px 6px rgba(0, 0, 0, 0.15)';
                            e.target.style.background = 'linear-gradient(135deg, #9CA3AF 0%, #6B7280 100%)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = '0 4px 12px rgba(107, 114, 128, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1)';
                            e.target.style.background = 'linear-gradient(135deg, #6B7280 0%, #4B5563 100%)';
                          }}
                          onFocus={() => {
                              setBotonSeleccionadoEnPreparacion({ ...botonSeleccionadoEnPreparacion, [pedido.id]: 'volver' });
                          }}
                        >
                          <span style={{ marginRight: '6px' }}>↩️</span>
                          Volver a Pendiente
                        </button>
                        )}
                        <button
                          ref={(el) => {
                            if (el) finalizarButtonRefs.current[pedido.id] = el;
                          }}
                          data-pedido-id={pedido.id}
                          className="btn-success"
                          onClick={() => handleAvanzarEtapa(pedido.id)}
                          style={{
                            flex: pedido.etapaPreparacion === 'PENDIENTE_CARGA' ? 1 : 1,
                            width: pedido.etapaPreparacion === 'PENDIENTE_CARGA' ? '100%' : 'auto',
                            background: !pedido.etapaPreparacion 
                              ? 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)' // Azul para "Control"
                              : pedido.etapaPreparacion === 'CONTROL' 
                              ? 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)' // Naranja para "Pendiente de Carga"
                              : 'linear-gradient(135deg, #4CAF50 0%, #388E3C 100%)', // Verde para "Finalizar"
                            color: 'white',
                            border: 'none',
                            padding: '12px 28px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '600',
                            letterSpacing: '0.3px',
                            boxShadow: !pedido.etapaPreparacion 
                              ? '0 4px 12px rgba(33, 150, 243, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1)'
                              : pedido.etapaPreparacion === 'CONTROL'
                              ? '0 4px 12px rgba(255, 152, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1)'
                              : '0 4px 12px rgba(76, 175, 80, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1)',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            position: 'relative',
                            overflow: 'hidden',
                            outline: botonSeleccionadoEnPreparacion[pedido.id] === 'finalizar' ? '3px solid #2196F3' : 'none',
                            outlineOffset: botonSeleccionadoEnPreparacion[pedido.id] === 'finalizar' ? '2px' : '0',
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.transform = 'translateY(-2px)';
                            if (!pedido.etapaPreparacion) {
                              e.target.style.background = 'linear-gradient(135deg, #42A5F5 0%, #1E88E5 100%)';
                              e.target.style.boxShadow = '0 6px 16px rgba(33, 150, 243, 0.4), 0 4px 6px rgba(0, 0, 0, 0.15)';
                            } else if (pedido.etapaPreparacion === 'CONTROL') {
                              e.target.style.background = 'linear-gradient(135deg, #FFA726 0%, #FB8C00 100%)';
                              e.target.style.boxShadow = '0 6px 16px rgba(255, 152, 0, 0.4), 0 4px 6px rgba(0, 0, 0, 0.15)';
                            } else {
                              e.target.style.background = 'linear-gradient(135deg, #66BB6A 0%, #43A047 100%)';
                              e.target.style.boxShadow = '0 6px 16px rgba(76, 175, 80, 0.4), 0 4px 6px rgba(0, 0, 0, 0.15)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = 'translateY(0)';
                            if (!pedido.etapaPreparacion) {
                              e.target.style.background = 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)';
                              e.target.style.boxShadow = '0 4px 12px rgba(33, 150, 243, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1)';
                            } else if (pedido.etapaPreparacion === 'CONTROL') {
                              e.target.style.background = 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)';
                              e.target.style.boxShadow = '0 4px 12px rgba(255, 152, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1)';
                            } else {
                              e.target.style.background = 'linear-gradient(135deg, #4CAF50 0%, #388E3C 100%)';
                              e.target.style.boxShadow = '0 4px 12px rgba(76, 175, 80, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1)';
                            }
                          }}
                          onFocus={() => {
                            setBotonSeleccionadoEnPreparacion({ ...botonSeleccionadoEnPreparacion, [pedido.id]: 'finalizar' });
                          }}
                        >
                          {!pedido.etapaPreparacion ? (
                            <>
                              <span style={{ marginRight: '6px' }}>✓</span>
                              Control
                            </>
                          ) : pedido.etapaPreparacion === 'CONTROL' ? (
                            <>
                              <span style={{ marginRight: '6px' }}>📦</span>
                              Pendiente de Carga
                            </>
                          ) : (
                            <>
                              <span style={{ marginRight: '6px' }}>✅</span>
                          Finalizar
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          {pedidos.filter(pedido => {
            if (pedido.estado !== filtroEstado) return false;
            if (filtroEstado === 'EN_PREPARACION') {
              if (filtroEtapaPreparacion === 'TODOS') return true;
              if (filtroEtapaPreparacion === 'SIN_CONTROL') return !pedido.etapaPreparacion;
              if (filtroEtapaPreparacion === 'CONTROL') return pedido.etapaPreparacion === 'CONTROL';
              if (filtroEtapaPreparacion === 'PENDIENTE_CARGA') return pedido.etapaPreparacion === 'PENDIENTE_CARGA';
            }
            return true;
          }).length === 0 && !loading && (
              <div className="no-pedidos" style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                textAlign: 'center',
                minHeight: '300px',
              }}>
                <div style={{
                  fontSize: '4rem',
                  marginBottom: '20px',
                  opacity: 0.3,
                }}>
                  {filtroEstado === 'PENDIENTE' ? '📋' : filtroEstado === 'EN_PREPARACION' ? '⚙️' : '✅'}
                </div>
                <h3 style={{
                  fontSize: '1.5rem',
                  fontWeight: '600',
                  color: '#333',
                  margin: '0 0 10px 0',
                }}>
                  {filtroEstado === 'PENDIENTE' 
                    ? 'No hay pedidos pendientes' 
                    : filtroEstado === 'EN_PREPARACION' 
                    ? filtroEtapaPreparacion === 'TODOS' 
                      ? 'No hay pedidos en preparación'
                      : filtroEtapaPreparacion === 'SIN_CONTROL'
                      ? 'No hay pedidos sin control'
                      : filtroEtapaPreparacion === 'CONTROL'
                      ? 'No hay pedidos en control'
                      : 'No hay pedidos pendientes de carga'
                    : 'No hay pedidos'}
                </h3>
                <p style={{
                  fontSize: '1rem',
                  color: '#666',
                  margin: '0',
                  maxWidth: '400px',
                }}>
                  {filtroEstado === 'PENDIENTE' 
                    ? 'Los nuevos pedidos aparecerán aquí cuando sean creados desde el panel de administración.'
                    : filtroEstado === 'EN_PREPARACION' 
                    ? 'Los pedidos que estén siendo preparados aparecerán en esta sección.'
                    : 'No hay pedidos para mostrar en este momento.'}
                </p>
              </div>
            )}
          </div>
          </div>
        )}
      </div>

      {showGrupoModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowGrupoModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '10px',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Nuevo Equipo</h2>
            <form onSubmit={handleCrearGrupo}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Nombre del Equipo
                </label>
                <input
                  ref={grupoNombreRef}
                  type="text"
                  value={grupoForm.nombre}
                  onChange={(e) => setGrupoForm({ nombre: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      // Buscar el botón de submit y hacer click
                      const submitButton = e.currentTarget.closest('form')?.querySelector('button[type="submit"]');
                      if (submitButton) {
                        submitButton.click();
                      }
                    }
                  }}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    fontSize: '14px',
                  }}
                  placeholder="Ej: Equipo A, Equipo B..."
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowGrupoModal(false);
                    setGrupoForm({ nombre: '' });
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#ccc',
                    color: 'black',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Resumen */}
      {showResumenModal && (() => {
        // Agrupar pedidos por vuelta
        const pedidosAgrupadosPorVuelta = pedidosResumen.reduce((acc, pedido) => {
          const vueltaNombre = pedido.vueltaNombre || 'Sin vuelta';
          if (!acc[vueltaNombre]) {
            acc[vueltaNombre] = [];
          }
          acc[vueltaNombre].push(pedido);
          return acc;
        }, {});

        // Ordenar las vueltas (Sin vuelta al final)
        const vueltasOrdenadas = Object.keys(pedidosAgrupadosPorVuelta).sort((a, b) => {
          if (a === 'Sin vuelta') return 1;
          if (b === 'Sin vuelta') return -1;
          return a.localeCompare(b);
        });

        return (
        <div className="modal-overlay" onClick={() => setShowResumenModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '80vh', overflow: 'auto' }}>
            <h3>Resumen - {fechaResumen}</h3>
            <div style={{ marginBottom: '20px', color: '#666', fontSize: '0.9rem' }}>
              Total: {pedidosResumen.length} {pedidosResumen.length === 1 ? 'planilla' : 'planillas'}
            </div>
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {vueltasOrdenadas.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                    No hay planillas para este día
                  </div>
                ) : (
                  vueltasOrdenadas.map((vueltaNombre, vueltaIndex) => (
                    <div key={vueltaNombre} style={{ marginBottom: vueltaIndex < vueltasOrdenadas.length - 1 ? '30px' : '0' }}>
                      {/* Encabezado de la vuelta */}
                      <h4 style={{
                        margin: '0 0 12px 0',
                        padding: '12px 16px',
                        backgroundColor: '#0f766e',
                        color: 'white',
                        borderRadius: '8px 8px 0 0',
                        fontSize: '1.1rem',
                        fontWeight: '600',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}>
                        {vueltaNombre}
                      </h4>
                      {/* Tabla de pedidos de esta vuelta */}
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd', fontSize: '0.9rem' }}>N° Planilla</th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd', fontSize: '0.9rem' }}>Cantidad</th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd', fontSize: '0.9rem' }}>Zona</th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd', fontSize: '0.9rem' }}>Transporte</th>
                  </tr>
                </thead>
                <tbody>
                          {pedidosAgrupadosPorVuelta[vueltaNombre].map((pedido) => (
                      <tr key={pedido.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '12px', fontWeight: 'bold', color: '#333' }}>
                          {pedido.numeroPlanilla}
                        </td>
                        <td style={{ padding: '12px', color: '#666' }}>
                                {pedido.cantidad || <span style={{ color: '#999', fontStyle: 'italic' }}>-</span>}
                              </td>
                              <td style={{ padding: '12px', color: '#666' }}>
                                {pedido.zonaNombre || <span style={{ color: '#999', fontStyle: 'italic' }}>Sin zona</span>}
                              </td>
                              <td style={{ padding: '12px', color: '#666' }}>
                                {pedido.transportistaNombre || pedido.transportista || <span style={{ color: '#999', fontStyle: 'italic' }}>Sin transporte</span>}
                        </td>
                      </tr>
                          ))}
                </tbody>
              </table>
                    </div>
                  ))
                )}
            </div>
            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setShowResumenModal(false)}
                className="btn-secondary"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
        );
      })()}
      {/* Componente Chat */}
      {showChat && (
        <Chat 
          onClose={() => {
            setShowChat(false);
            actualizarCantidadMensajesNoLeidos();
          }}
          rolDestinatario={user?.rol === 'ADMIN' ? 'DEPOSITO' : 'ADMIN'}
        />
      )}

    </div>
  );
};

export default DepositoPanel;

