import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { pedidoService } from '../services/pedidoService';
import { grupoService } from '../services/grupoService';
import { transportistaService } from '../services/transportistaService';
import { mensajeService } from '../services/mensajeService';
import { connectWebSocket, disconnectWebSocket } from '../services/websocketService';
import Chat from './Chat';
import './DepositoPanel.css';

const DepositoPanel = () => {
  const { user, logout } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [transportistas, setTransportistas] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('PENDIENTE'); // 'PENDIENTE', 'EN_PROCESO', 'REALIZADO', 'TRANSPORTISTAS', o 'EQUIPOS'
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
          EN_PROCESO: new Set(data.EN_PROCESO || []),
        };
      }
    } catch (e) {
      console.error('Error al cargar pedidos vistos:', e);
    }
    return {
      PENDIENTE: new Set(),
      EN_PROCESO: new Set(),
    };
  });
  // Cache de todos los pedidos para calcular notificaciones
  const [todosLosPedidos, setTodosLosPedidos] = useState({
    PENDIENTE: [],
    EN_PROCESO: [],
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
  // Refs para los selects de "Asignar Equipo" y botones "Procesar"
  const equipoSelectRefs = useRef({});
  const procesarButtonRefs = useRef({});
  // Refs para los botones de "En Proceso" (Volver a Pendiente y Finalizar)
  const volverPendienteButtonRefs = useRef({});
  const finalizarButtonRefs = useRef({});
  // Estado para rastrear qué botón está seleccionado en un pedido de "En Proceso"
  const [botonSeleccionadoEnProceso, setBotonSeleccionadoEnProceso] = useState({});

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
          // Para PENDIENTE, EN_PROCESO, REALIZADO
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
          EN_PROCESO: prev.EN_PROCESO.filter(p => p.id !== message.id),
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
          // Para PENDIENTE, EN_PROCESO, REALIZADO
          cargarPedidos().catch(err => {
            console.error('Error al recargar pedidos desde WebSocket:', err);
          });
        }
        // Recargar cache para notificaciones
        Promise.all([
          pedidoService.obtenerPorEstado('PENDIENTE'),
          pedidoService.obtenerPorEstado('EN_PROCESO'),
        ]).then(([pendientes, enProceso]) => {
          setTodosLosPedidos({
            PENDIENTE: pendientes.data || [],
            EN_PROCESO: enProceso.data || [],
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

  // Resetear el índice del pedido seleccionado y el modo navegación al cambiar de pestaña
  useEffect(() => {
    setPedidoSeleccionadoIndex(-1);
    setEnModoNavegacionRegistros(false);
    setBotonSeleccionadoEnProceso({});
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
      const pedidosEnProceso = pedidos.filter(p => p.estado === 'EN_PROCESO');

      // Si estamos en Pendientes
      if (filtroEstado === 'PENDIENTE') {
        // Si estamos en un select de "Asignar Equipo" y presionamos Enter
        if (isInputFocused && focusedElement.tagName === 'SELECT') {
          const selectPedidoId = focusedElement.getAttribute('data-pedido-id');
          if (event.key === 'Enter' && selectPedidoId) {
            event.preventDefault();
            // Hacer click en el botón "Procesar" de ese pedido
            const procesarButton = procesarButtonRefs.current[selectPedidoId];
            if (procesarButton) {
              procesarButton.click();
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
            if (event.key === 'ArrowUp' && pedidoSeleccionadoIndex === 0) {
              event.preventDefault();
              setEnModoNavegacionRegistros(false);
              setPedidoSeleccionadoIndex(-1);
              // Enfocar el botón de la pestaña para que las flechas izquierda/derecha funcionen
              const tabButton = document.querySelector('.filtros-buttons button.active');
              if (tabButton) {
                tabButton.focus();
              }
              return;
            }

            // Navegación entre registros con todas las flechas
            if (event.key === 'ArrowUp' && pedidosPendientes.length > 0) {
              event.preventDefault();
              const nuevoIndex = pedidoSeleccionadoIndex > 0 
                ? pedidoSeleccionadoIndex - 1 
                : pedidosPendientes.length - 1;
              setPedidoSeleccionadoIndex(nuevoIndex);
              
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
              
              const pedidoId = pedidosPendientes[nuevoIndex].id;
              const pedidoCard = document.querySelector(`[data-pedido-id="${pedidoId}"]`);
              if (pedidoCard) {
                pedidoCard.focus();
              }
              return;
            }

            // Navegación izquierda/derecha entre registros (si hay más de uno)
            if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && pedidosPendientes.length > 1) {
              event.preventDefault();
              const nuevoIndex = event.key === 'ArrowLeft'
                ? (pedidoSeleccionadoIndex > 0 ? pedidoSeleccionadoIndex - 1 : pedidosPendientes.length - 1)
                : (pedidoSeleccionadoIndex < pedidosPendientes.length - 1 ? pedidoSeleccionadoIndex + 1 : 0);
              setPedidoSeleccionadoIndex(nuevoIndex);
              
              const pedidoId = pedidosPendientes[nuevoIndex].id;
              const pedidoCard = document.querySelector(`[data-pedido-id="${pedidoId}"]`);
              if (pedidoCard) {
                pedidoCard.focus();
              }
              return;
            }

            // Enter para enfocar el select de "Asignar Equipo"
            if (event.key === 'Enter' && pedidosPendientes.length > 0) {
              event.preventDefault();
              const pedidoId = pedidosPendientes[pedidoSeleccionadoIndex].id;
              const equipoSelect = equipoSelectRefs.current[pedidoId];
              if (equipoSelect) {
                equipoSelect.focus();
              }
              return;
            }
          }
        }
      }

      // Si estamos en En Proceso
      if (filtroEstado === 'EN_PROCESO') {
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
                setBotonSeleccionadoEnProceso(prev => ({ ...prev, [buttonPedidoId]: 'finalizar' }));
                finalizarButton.focus();
              }
            } else {
              // Cambiar al botón Volver a Pendiente
              const volverButton = volverPendienteButtonRefs.current[buttonPedidoId];
              if (volverButton) {
                setBotonSeleccionadoEnProceso(prev => ({ ...prev, [buttonPedidoId]: 'volver' }));
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
              const pedidosFiltrados = pedidosEnProceso;
              const pedidoIdNum = parseInt(buttonPedidoId);
              const indexEnFiltrados = pedidosFiltrados.findIndex(p => p.id === pedidoIdNum);
              if (indexEnFiltrados >= 0) {
                setPedidoSeleccionadoIndex(indexEnFiltrados);
                setBotonSeleccionadoEnProceso(prev => {
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
          // Entrar en modo navegación de registros con flecha abajo
          if (event.key === 'ArrowDown' && pedidosEnProceso.length > 0) {
            event.preventDefault();
            const nuevoIndex = enModoNavegacionRegistros 
              ? (pedidoSeleccionadoIndex < pedidosEnProceso.length - 1 ? pedidoSeleccionadoIndex + 1 : 0)
              : 0;
            setPedidoSeleccionadoIndex(nuevoIndex);
            setEnModoNavegacionRegistros(true);
            
            // Enfocar el card del pedido
            const pedidoId = pedidosEnProceso[nuevoIndex].id;
            const pedidoCard = document.querySelector(`[data-pedido-id="${pedidoId}"]`);
            if (pedidoCard) {
              pedidoCard.focus();
            }
            return;
          }

          // Si estamos en modo navegación de registros
          if (enModoNavegacionRegistros && pedidoSeleccionadoIndex >= 0) {
            // Salir del modo navegación si estamos en el primer registro y presionamos flecha arriba
            if (event.key === 'ArrowUp' && pedidoSeleccionadoIndex === 0) {
              event.preventDefault();
              setEnModoNavegacionRegistros(false);
              setPedidoSeleccionadoIndex(-1);
              setBotonSeleccionadoEnProceso({});
              // Enfocar el botón de la pestaña para que las flechas izquierda/derecha funcionen
              const tabButton = document.querySelector('.filtros-buttons button.active');
              if (tabButton) {
                tabButton.focus();
              }
              return;
            }

            // Navegación entre registros con todas las flechas
            if (event.key === 'ArrowUp' && pedidosEnProceso.length > 0) {
              event.preventDefault();
              const nuevoIndex = pedidoSeleccionadoIndex > 0 
                ? pedidoSeleccionadoIndex - 1 
                : pedidosEnProceso.length - 1;
              setPedidoSeleccionadoIndex(nuevoIndex);
              setBotonSeleccionadoEnProceso({});
              
              const pedidoId = pedidosEnProceso[nuevoIndex].id;
              const pedidoCard = document.querySelector(`[data-pedido-id="${pedidoId}"]`);
              if (pedidoCard) {
                pedidoCard.focus();
              }
              return;
            }

            if (event.key === 'ArrowDown' && pedidosEnProceso.length > 0) {
              event.preventDefault();
              const nuevoIndex = pedidoSeleccionadoIndex < pedidosEnProceso.length - 1 
                ? pedidoSeleccionadoIndex + 1 
                : 0;
              setPedidoSeleccionadoIndex(nuevoIndex);
              setBotonSeleccionadoEnProceso({});
              
              const pedidoId = pedidosEnProceso[nuevoIndex].id;
              const pedidoCard = document.querySelector(`[data-pedido-id="${pedidoId}"]`);
              if (pedidoCard) {
                pedidoCard.focus();
              }
              return;
            }

            // Navegación izquierda/derecha entre registros (si hay más de uno) - solo si NO estamos en un botón
            const buttonPedidoIdCheck = focusedElement?.getAttribute('data-pedido-id');
            const esBotonDePedidoCheck = buttonPedidoIdCheck && (focusedElement.tagName === 'BUTTON') && 
              (volverPendienteButtonRefs.current[buttonPedidoIdCheck] || finalizarButtonRefs.current[buttonPedidoIdCheck]);
            
            if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && pedidosEnProceso.length > 1 && !esBotonDePedidoCheck) {
              event.preventDefault();
              const nuevoIndex = event.key === 'ArrowLeft'
                ? (pedidoSeleccionadoIndex > 0 ? pedidoSeleccionadoIndex - 1 : pedidosEnProceso.length - 1)
                : (pedidoSeleccionadoIndex < pedidosEnProceso.length - 1 ? pedidoSeleccionadoIndex + 1 : 0);
              setPedidoSeleccionadoIndex(nuevoIndex);
              setBotonSeleccionadoEnProceso({});
              
              const pedidoId = pedidosEnProceso[nuevoIndex].id;
              const pedidoCard = document.querySelector(`[data-pedido-id="${pedidoId}"]`);
              if (pedidoCard) {
                pedidoCard.focus();
              }
              return;
            }

            // Enter para enfocar el primer botón del pedido
            if (event.key === 'Enter' && pedidosEnProceso.length > 0) {
              event.preventDefault();
              const pedidoId = pedidosEnProceso[pedidoSeleccionadoIndex].id;
              const volverButton = volverPendienteButtonRefs.current[pedidoId];
              if (volverButton) {
                // Actualizar el estado antes de enfocar
                setBotonSeleccionadoEnProceso(prev => ({ ...prev, [pedidoId]: 'volver' }));
                // Pequeño delay para asegurar que el estado se actualice
                setTimeout(() => {
                  volverButton.focus();
                }, 0);
              }
              return;
            }
          }
        }
      }

      // Navegación normal con flechas izquierda/derecha entre pestañas (solo si NO estamos en modo navegación de registros)
      if (!enModoNavegacionRegistros && !isInputFocused) {
        const tabs = ['PENDIENTE', 'EN_PROCESO', 'REALIZADO', 'EQUIPOS', 'TRANSPORTISTAS'];
        const currentIndex = tabs.indexOf(filtroEstado);

        if (event.key === 'ArrowLeft' && currentIndex > 0) {
          event.preventDefault();
          setFiltroEstado(tabs[currentIndex - 1]);
          setPedidoSeleccionadoIndex(-1);
          setEnModoNavegacionRegistros(false);
        } else if (event.key === 'ArrowRight' && currentIndex < tabs.length - 1) {
          event.preventDefault();
          setFiltroEstado(tabs[currentIndex + 1]);
          setPedidoSeleccionadoIndex(-1);
          setEnModoNavegacionRegistros(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [filtroEstado, showGrupoModal, showResumenModal, pedidos, pedidoSeleccionadoIndex, enModoNavegacionRegistros]);

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
      const [pendientes, enProceso] = await Promise.all([
        pedidoService.obtenerPorEstado('PENDIENTE'),
        pedidoService.obtenerPorEstado('EN_PROCESO'),
      ]);
      setTodosLosPedidos({
        PENDIENTE: pendientes.data || [],
        EN_PROCESO: enProceso.data || [],
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
        EN_PROCESO: Array.from(nuevosVistos.EN_PROCESO),
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
      
      if ((filtroEstado === 'PENDIENTE' || filtroEstado === 'EN_PROCESO') && pedidos.length > 0) {
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

  const handleCambiarEstado = async (pedidoId, nuevoEstado) => {
    try {
      const pedidoActual = pedidos.find(p => p.id === pedidoId);
      const estadoAnterior = pedidoActual?.estado;
      
      await pedidoService.actualizarEstado(pedidoId, nuevoEstado);
      
      // Si el pedido cambia de PENDIENTE a EN_PROCESO, actualizar el cache inmediatamente
      if (estadoAnterior === 'PENDIENTE' && nuevoEstado === 'EN_PROCESO') {
        // Removerlo de los vistos de PENDIENTE
        setPedidosVistos(prev => {
          const nuevosVistosPendiente = new Set(prev.PENDIENTE);
          nuevosVistosPendiente.delete(pedidoId);
          const nuevoEstado = {
            ...prev,
            PENDIENTE: nuevosVistosPendiente,
            // No agregar a EN_PROCESO para que aparezca como nuevo
          };
          guardarPedidosVistos(nuevoEstado);
          return nuevoEstado;
        });
        
        // Actualizar el cache manualmente: remover de PENDIENTE y agregar a EN_PROCESO
        setTodosLosPedidos(prev => {
          const nuevoPendiente = prev.PENDIENTE.filter(p => p.id !== pedidoId);
          const nuevoEnProceso = [...prev.EN_PROCESO];
          // Agregar el pedido actualizado a EN_PROCESO si no está ya
          if (!nuevoEnProceso.find(p => p.id === pedidoId)) {
            const pedidoActualizado = { ...pedidoActual, estado: nuevoEstado };
            nuevoEnProceso.push(pedidoActualizado);
          }
          return {
            PENDIENTE: nuevoPendiente,
            EN_PROCESO: nuevoEnProceso,
          };
        });
      }
      
      // Recargar pedidos de la pestaña actual
      await cargarPedidos();
      
      // Actualizar el cache desde el backend después de un delay para asegurar consistencia
      // Para cambios de PENDIENTE a EN_PROCESO, esperar más tiempo para que el backend procese
      const delay = (estadoAnterior === 'PENDIENTE' && nuevoEstado === 'EN_PROCESO') ? 1000 : 300;
      setTimeout(async () => {
        try {
          const [pendientes, enProceso] = await Promise.all([
            pedidoService.obtenerPorEstado('PENDIENTE'),
            pedidoService.obtenerPorEstado('EN_PROCESO'),
          ]);
          
          // Para cambios de PENDIENTE a EN_PROCESO, solo actualizar si el pedido está en EN_PROCESO en el backend
          if (estadoAnterior === 'PENDIENTE' && nuevoEstado === 'EN_PROCESO') {
            const pedidoEnBackend = enProceso.data?.find(p => p.id === pedidoId);
            if (pedidoEnBackend) {
              // El backend ya procesó el cambio, actualizar el cache
              setTodosLosPedidos({
                PENDIENTE: pendientes.data || [],
                EN_PROCESO: enProceso.data || [],
              });
            } else {
              // Si el pedido no está en el backend aún, intentar de nuevo después de un delay más largo
              setTimeout(async () => {
                try {
                  const [pendientes2, enProceso2] = await Promise.all([
                    pedidoService.obtenerPorEstado('PENDIENTE'),
                    pedidoService.obtenerPorEstado('EN_PROCESO'),
                  ]);
                  const pedidoEnBackend2 = enProceso2.data?.find(p => p.id === pedidoId);
                  if (pedidoEnBackend2) {
                    setTodosLosPedidos({
                      PENDIENTE: pendientes2.data || [],
                      EN_PROCESO: enProceso2.data || [],
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
              EN_PROCESO: enProceso.data || [],
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

  const getEstadoColor = (estado) => {
    const colors = {
      PENDIENTE: '#FF9800',
      EN_PROCESO: '#2196F3',
      REALIZADO: '#4CAF50',
    };
    return colors[estado] || '#666';
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

  // Calcular pedidos realizados por día y agruparlos
  const getPedidosAgrupadosPorDia = () => {
    if (filtroEstado !== 'REALIZADO') return null;
    
    const pedidosPorDia = {};
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    pedidos.forEach(pedido => {
      if (pedido.estado === 'REALIZADO' && pedido.fechaActualizacion) {
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

  const pedidosAgrupadosPorDia = getPedidosAgrupadosPorDia();
  const pedidosPorDia = getPedidosPorDia();
  const cantidadHoy = getCantidadRealizadosHoy();

  // Expandir el día de hoy por defecto cuando se carga la sección de realizados
  useEffect(() => {
    if (filtroEstado === 'REALIZADO' && pedidosAgrupadosPorDia && pedidosAgrupadosPorDia.length > 0) {
      const hoy = pedidosAgrupadosPorDia.find(dia => dia.esHoy);
      if (hoy) {
        setDiasExpandidos(prev => {
          if (!prev.has(hoy.fecha)) {
            return new Set([...prev, hoy.fecha]);
          }
          return prev;
        });
      }
    } else if (filtroEstado !== 'REALIZADO') {
      // Limpiar días expandidos cuando se cambia de pestaña
      setDiasExpandidos(new Set());
    }
  }, [filtroEstado]);

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
            className={filtroEstado === 'EN_PROCESO' ? 'active' : ''}
            onClick={() => setFiltroEstado('EN_PROCESO')}
            style={{ position: 'relative' }}
          >
            En Proceso
            {getCantidadTotal('EN_PROCESO') > 0 && (
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
                {getCantidadTotal('EN_PROCESO')}
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
            Transportistas
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

        {/* Tab de Transportistas - Solo lectura */}
        {filtroEstado === 'TRANSPORTISTAS' && (
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          }}>
            <h2 style={{ marginBottom: '20px', color: '#333' }}>Transportistas</h2>
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
                      Código Interno
                    </th>
                    <th style={{ 
                      padding: '12px', 
                      textAlign: 'left',
                      fontWeight: 'bold',
                      color: '#333'
                    }}>
                      Chofer
                    </th>
                    <th style={{ 
                      padding: '12px', 
                      textAlign: 'left',
                      fontWeight: 'bold',
                      color: '#333'
                    }}>
                      Vehículo
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
                        {transportista.codigoInterno}
                      </td>
                      <td style={{ padding: '12px', color: '#333' }}>
                        {transportista.chofer}
                      </td>
                      <td style={{ padding: '12px', color: '#333' }}>
                        {transportista.vehiculo}
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

        {filtroEstado === 'REALIZADO' && pedidosAgrupadosPorDia && pedidosAgrupadosPorDia.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {pedidosAgrupadosPorDia.map((dia) => (
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
                    {dia.pedidos.map((pedido) => (
                      <div key={pedido.id} className="pedido-card deposito-pedido-card">
                        <div className="pedido-header">
                          <h3>Planilla: {pedido.numeroPlanilla}</h3>
                          <span
                            className="prioridad-badge"
                            style={{ backgroundColor: getPrioridadColor(pedido.prioridad) }}
                          >
                            {pedido.prioridad}
                          </span>
                        </div>
                        <div className="pedido-info">
                          <div style={{ marginBottom: '10px' }}>
                            <strong style={{ display: 'block', marginBottom: '5px', color: '#333' }}>Transportista:</strong>
                            {pedido.transportistaChofer && pedido.transportistaVehiculo ? (
                              <div style={{ marginLeft: '0', color: '#666' }}>
                                {pedido.transportistaCodigoInterno && (
                                  <span style={{ color: '#999', fontSize: '0.9em' }}>
                                    {pedido.transportistaCodigoInterno} -{' '}
                                  </span>
                                )}
                                {pedido.transportistaChofer} - {pedido.transportistaVehiculo}
                              </div>
                            ) : (
                              <div style={{ marginLeft: '0', color: '#666' }}>
                                {pedido.transportista || 'Sin transportista'}
                              </div>
                            )}
                          </div>
                          {pedido.zonaNombre && (
                            <p>
                              <strong>Zona:</strong> {pedido.zonaNombre}
                            </p>
                          )}
                          <p>
                            <strong>Equipo Asignado:</strong>{' '}
                            {pedido.grupoNombre || 'Sin asignar'}
                          </p>
                          {pedido.fechaCreacion && (
                            <p>
                              <strong>Hora de Carga:</strong>{' '}
                              <span style={{ color: '#666' }}>
                                {new Date(pedido.fechaCreacion).toLocaleTimeString('es-AR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false,
                                })}
                              </span>
                            </p>
                          )}
                          {pedido.fechaActualizacion && (
                            <p>
                              <strong>Fecha de Finalización:</strong>{' '}
                              <span style={{ color: '#4CAF50', fontWeight: '600' }}>
                                {new Date(pedido.fechaActualizacion).toLocaleString('es-AR', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false,
                                })}
                              </span>
                            </p>
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
          <div className="pedidos-grid">
            {pedidos.filter(pedido => pedido.estado === filtroEstado).map((pedido, index) => (
            <div 
              key={pedido.id} 
              className="pedido-card deposito-pedido-card"
              data-pedido-id={pedido.id}
              tabIndex={(filtroEstado === 'PENDIENTE' || filtroEstado === 'EN_PROCESO') ? 0 : -1}
              style={{
                outline: (filtroEstado === 'PENDIENTE' || filtroEstado === 'EN_PROCESO') && pedidoSeleccionadoIndex === index 
                  ? '3px solid #2196F3' 
                  : 'none',
                outlineOffset: (filtroEstado === 'PENDIENTE' || filtroEstado === 'EN_PROCESO') && pedidoSeleccionadoIndex === index 
                  ? '2px' 
                  : '0',
              }}
              onFocus={() => {
                if (filtroEstado === 'PENDIENTE' || filtroEstado === 'EN_PROCESO') {
                  setPedidoSeleccionadoIndex(index);
                }
              }}
            >
              <div className="pedido-header">
                <h3>Planilla: {pedido.numeroPlanilla}</h3>
                <span
                  className="prioridad-badge"
                  style={{ backgroundColor: getPrioridadColor(pedido.prioridad) }}
                >
                  {pedido.prioridad}
                </span>
              </div>
              <div className="pedido-info">
                <div style={{ marginBottom: '10px' }}>
                  <strong style={{ display: 'block', marginBottom: '5px', color: '#333' }}>Transportista:</strong>
                  {pedido.transportistaChofer && pedido.transportistaVehiculo ? (
                    <div style={{ marginLeft: '0', color: '#666' }}>
                      {pedido.transportistaCodigoInterno && (
                        <span style={{ color: '#999', fontSize: '0.9em' }}>
                          {pedido.transportistaCodigoInterno} -{' '}
                        </span>
                      )}
                      {pedido.transportistaChofer} - {pedido.transportistaVehiculo}
                    </div>
                  ) : (
                    <div style={{ marginLeft: '0', color: '#666' }}>
                      {pedido.transportista || 'Sin transportista'}
                    </div>
                  )}
                </div>
                {pedido.zonaNombre && (
                  <p>
                    <strong>Zona:</strong> {pedido.zonaNombre}
                  </p>
                )}
                <p>
                  <strong>Estado:</strong>{' '}
                  <span
                    className="estado-badge"
                    style={{ backgroundColor: getEstadoColor(pedido.estado) }}
                  >
                    {pedido.estado.replace('_', ' ')}
                  </span>
                </p>
                <p>
                  <strong>Equipo Asignado:</strong>{' '}
                  {pedido.grupoNombre || 'Sin asignar'}
                </p>
                {pedido.fechaCreacion && (
                  <p>
                    <strong>Hora de Carga:</strong>{' '}
                    <span style={{ color: '#666' }}>
                      {new Date(pedido.fechaCreacion).toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}
                    </span>
                  </p>
                )}
                {pedido.estado === 'REALIZADO' && pedido.fechaActualizacion && (
                  <p>
                    <strong>Fecha de Finalización:</strong>{' '}
                    <span style={{ color: '#4CAF50', fontWeight: '600' }}>
                      {new Date(pedido.fechaActualizacion).toLocaleString('es-AR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false,
                      })}
                    </span>
                  </p>
                )}
              </div>
              {pedido.estado !== 'REALIZADO' && (
                <div className="pedido-actions">
                  {pedido.estado === 'PENDIENTE' && (
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
                  )}
                  <div className="action-group">
                    {pedido.estado === 'PENDIENTE' && (
                      <button
                        ref={(el) => {
                          if (el) procesarButtonRefs.current[pedido.id] = el;
                        }}
                        className="btn-primary"
                        onClick={() => handleCambiarEstado(pedido.id, 'EN_PROCESO')}
                        style={{
                          backgroundColor: '#2196F3',
                          color: 'white',
                          border: 'none',
                          padding: '10px 20px',
                          borderRadius: '5px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 'bold',
                          width: '100%',
                        }}
                      >
                        Procesar
                      </button>
                    )}
                    {pedido.estado === 'EN_PROCESO' && (
                      <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                        <button
                          ref={(el) => {
                            if (el) volverPendienteButtonRefs.current[pedido.id] = el;
                          }}
                          data-pedido-id={pedido.id}
                          className="btn-secondary"
                          onClick={() => handleCambiarEstado(pedido.id, 'PENDIENTE')}
                          style={{
                            flex: 1,
                            backgroundColor: '#FF9800',
                            color: 'white',
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            outline: botonSeleccionadoEnProceso[pedido.id] === 'volver' ? '3px solid #2196F3' : 'none',
                            outlineOffset: botonSeleccionadoEnProceso[pedido.id] === 'volver' ? '2px' : '0',
                          }}
                          onFocus={() => {
                            setBotonSeleccionadoEnProceso({ ...botonSeleccionadoEnProceso, [pedido.id]: 'volver' });
                          }}
                        >
                          Volver a Pendiente
                        </button>
                        <button
                          ref={(el) => {
                            if (el) finalizarButtonRefs.current[pedido.id] = el;
                          }}
                          data-pedido-id={pedido.id}
                          className="btn-success"
                          onClick={() => handleCambiarEstado(pedido.id, 'REALIZADO')}
                          style={{
                            flex: 1,
                            backgroundColor: '#0f766e',
                            color: 'white',
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            outline: botonSeleccionadoEnProceso[pedido.id] === 'finalizar' ? '3px solid #2196F3' : 'none',
                            outlineOffset: botonSeleccionadoEnProceso[pedido.id] === 'finalizar' ? '2px' : '0',
                          }}
                          onFocus={() => {
                            setBotonSeleccionadoEnProceso({ ...botonSeleccionadoEnProceso, [pedido.id]: 'finalizar' });
                          }}
                        >
                          Finalizar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
            {pedidos.length === 0 && !loading && (
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
                  {filtroEstado === 'PENDIENTE' ? '📋' : filtroEstado === 'EN_PROCESO' ? '⚙️' : '✅'}
                </div>
                <h3 style={{
                  fontSize: '1.5rem',
                  fontWeight: '600',
                  color: '#333',
                  margin: '0 0 10px 0',
                }}>
                  {filtroEstado === 'PENDIENTE' 
                    ? 'No hay pedidos pendientes' 
                    : filtroEstado === 'EN_PROCESO' 
                    ? 'No hay pedidos en proceso'
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
                    : filtroEstado === 'EN_PROCESO' 
                    ? 'Los pedidos que estén siendo procesados aparecerán en esta sección.'
                    : 'No hay pedidos para mostrar en este momento.'}
                </p>
              </div>
            )}
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
      {showResumenModal && (
        <div className="modal-overlay" onClick={() => setShowResumenModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '80vh', overflow: 'auto' }}>
            <h3>Resumen - {fechaResumen}</h3>
            <div style={{ marginBottom: '20px', color: '#666', fontSize: '0.9rem' }}>
              Total: {pedidosResumen.length} {pedidosResumen.length === 1 ? 'planilla' : 'planillas'}
            </div>
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Número de Planilla</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Transportista</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Zona</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidosResumen.length === 0 ? (
                    <tr>
                      <td colSpan="3" style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                        No hay planillas para este día
                      </td>
                    </tr>
                  ) : (
                    pedidosResumen.map((pedido) => (
                      <tr key={pedido.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '12px', fontWeight: 'bold', color: '#333' }}>
                          {pedido.numeroPlanilla}
                        </td>
                        <td style={{ padding: '12px', color: '#666' }}>
                          {pedido.transportistaChofer && pedido.transportistaVehiculo ? (
                            <div>
                              {pedido.transportistaCodigoInterno && (
                                <span style={{ color: '#999', fontSize: '0.9em' }}>
                                  {pedido.transportistaCodigoInterno} -{' '}
                                </span>
                              )}
                              {pedido.transportistaChofer} - {pedido.transportistaVehiculo}
                            </div>
                          ) : (
                            <span style={{ color: '#999', fontStyle: 'italic' }}>
                              {pedido.transportista || 'Sin transportista'}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px', color: '#666' }}>
                          {pedido.zonaNombre || <span style={{ color: '#999', fontStyle: 'italic' }}>Sin zona</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
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
      )}
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

