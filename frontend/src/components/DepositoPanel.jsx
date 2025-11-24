import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { pedidoService } from '../services/pedidoService';
import { grupoService } from '../services/grupoService';
import { transportistaService } from '../services/transportistaService';
import { connectWebSocket, disconnectWebSocket } from '../services/websocketService';
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

  // Ref para rastrear si es la primera carga
  const isInitialLoad = useRef(true);

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
          <svg 
            width="32" 
            height="32" 
            viewBox="0 0 100 100" 
            style={{ 
              marginRight: '12px',
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
          Panel de Depósito
        </h1>
        <div className="user-info">
          <span>
            <span style={{ marginRight: '8px', fontSize: '1.1rem', verticalAlign: 'middle' }}>👤</span>
            {user?.nombreCompleto || user?.username || 'Usuario'}
          </span>
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
            {pedidos.filter(pedido => pedido.estado === filtroEstado).map((pedido) => (
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
                          }}
                        >
                          Volver a Pendiente
                        </button>
                        <button
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
                  type="text"
                  value={grupoForm.nombre}
                  onChange={(e) => setGrupoForm({ nombre: e.target.value })}
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
                  </tr>
                </thead>
                <tbody>
                  {pedidosResumen.length === 0 ? (
                    <tr>
                      <td colSpan="2" style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
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
    </div>
  );
};

export default DepositoPanel;

