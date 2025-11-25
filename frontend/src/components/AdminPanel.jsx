import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { pedidoService } from '../services/pedidoService';
import { usuarioService } from '../services/usuarioService';
import { transportistaService } from '../services/transportistaService';
import { grupoService } from '../services/grupoService';
import { mensajeService } from '../services/mensajeService';
import { connectWebSocket, disconnectWebSocket } from '../services/websocketService';
import Chat from './Chat';
import './AdminPanel.css';

const AdminPanel = () => {
  const { user, logout } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [transportistas, setTransportistas] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showUsuarioModal, setShowUsuarioModal] = useState(false);
  const [showTransportistaModal, setShowTransportistaModal] = useState(false);
  const [showTransportistaTooltip, setShowTransportistaTooltip] = useState(false);
  const [formData, setFormData] = useState({
    numeroPlanilla: '',
    transportistaId: '',
    prioridad: 'NORMAL',
  });
  // Refs para los campos del formulario de pedidos
  const numeroPlanillaRef = useRef(null);
  const transportistaRef = useRef(null);
  const prioridadRef = useRef(null);
  // Refs para los campos del formulario de transportistas
  const codigoInternoRef = useRef(null);
  const choferRef = useRef(null);
  const vehiculoRef = useRef(null);
  // Refs para los campos del formulario de usuarios
  const usernameRef = useRef(null);
  const nombreCompletoRef = useRef(null);
  const passwordRef = useRef(null);
  const rolRef = useRef(null);
  const [usuarioForm, setUsuarioForm] = useState({
    username: '',
    password: '',
    nombreCompleto: '',
    rol: 'DEPOSITO',
  });
  const [idPrimerAdmin, setIdPrimerAdmin] = useState(null);
  const [transportistaForm, setTransportistaForm] = useState({
    codigoInterno: '',
    chofer: '',
    vehiculo: '',
  });
  const [activeTab, setActiveTab] = useState('pedidos');
  // Estado para el modal de resumen
  const [showResumenModal, setShowResumenModal] = useState(false);
  const [pedidosResumen, setPedidosResumen] = useState([]);
  const [fechaResumen, setFechaResumen] = useState('');
  // Estado para el chat
  const [showChat, setShowChat] = useState(false);
  const [cantidadMensajesNoLeidos, setCantidadMensajesNoLeidos] = useState(0);
  // Cargar pedidos realizados vistos desde localStorage
  const [pedidosRealizadosVistos, setPedidosRealizadosVistos] = useState(() => {
    try {
      const saved = localStorage.getItem('pedidosRealizadosVistos');
      if (saved) {
        const ids = JSON.parse(saved);
        return new Set(ids);
      }
    } catch (e) {
      console.error('Error al cargar pedidos realizados vistos:', e);
    }
    return new Set();
  });
  const [todosLosPedidos, setTodosLosPedidos] = useState([]);
  // Estado para controlar qué días están expandidos en la sección de realizados
  const [diasExpandidos, setDiasExpandidos] = useState(new Set());
  // Ref para rastrear si el usuario ha colapsado manualmente el día de hoy
  const hoyColapsadoManualmente = useRef(false);

  useEffect(() => {
    cargarDatos();
    const stompClient = connectWebSocket((message) => {
      if (message.tipo === 'eliminado') {
        setPedidos((prev) => prev.filter((p) => p.id !== message.id));
        setTodosLosPedidos((prev) => prev.filter((p) => p.id !== message.id));
      } else {
        // Recargar pedidos según la pestaña activa
        if (activeTab === 'realizados') {
          pedidoService.obtenerPorEstado('REALIZADO').then(response => {
            setPedidos(response.data || []);
          }).catch(err => console.error('Error al recargar pedidos realizados:', err));
        } else if (activeTab === 'pedidos') {
          pedidoService.obtenerTodos().then(response => {
            const pedidosFiltrados = (response.data || []).filter(p => p.estado !== 'REALIZADO');
            setPedidos(pedidosFiltrados);
          }).catch(err => console.error('Error al recargar pedidos:', err));
        }
        
        // Actualizar todos los pedidos para el contador (IMPORTANTE: esto actualiza el indicador)
        // Hacer esto siempre, independientemente de la pestaña activa
        pedidoService.obtenerTodos().then(response => {
          setTodosLosPedidos(response.data || []);
        }).catch(err => console.error('Error al actualizar todos los pedidos:', err));
      }
    });

    return () => {
      disconnectWebSocket();
    };
  }, [activeTab]);

  // Cargar todos los pedidos para el contador, independiente de la pestaña activa
  useEffect(() => {
    const cargarTodosLosPedidos = async () => {
      try {
        const response = await pedidoService.obtenerTodos();
        setTodosLosPedidos(response.data || []);
      } catch (error) {
        console.error('Error al cargar todos los pedidos:', error);
      }
    };

    cargarTodosLosPedidos();
    // Recargar periódicamente para mantener el contador actualizado
    const interval = setInterval(cargarTodosLosPedidos, 10000); // Cada 10 segundos
    
    return () => clearInterval(interval);
  }, []);

  const cargarDatos = async () => {
    // Cargar transportistas de forma independiente para no bloquear la carga de otros datos
    await Promise.all([cargarPedidos(), cargarUsuarios()]);
    // Cargar transportistas en paralelo pero no esperar si falla
    cargarTransportistas().catch(err => {
      console.warn('Error al cargar transportistas (puede ser normal si el backend no se reinició):', err);
    });
    // Cargar equipos en paralelo pero no esperar si falla
    cargarEquipos().catch(err => {
      console.warn('Error al cargar equipos (puede ser normal si el backend no se reinició):', err);
    });
    // Cargar ID del primer admin
    cargarIdPrimerAdmin();
  };

  const cargarIdPrimerAdmin = async () => {
    try {
      const api = (await import('../config/axios')).default;
      const response = await api.get('/usuarios/primer-admin-id');
      setIdPrimerAdmin(response.data.id);
    } catch (error) {
      console.error('Error al cargar ID del primer admin:', error);
    }
  };

  const cargarTransportistas = async () => {
    try {
      const response = await transportistaService.obtenerTodos();
      setTransportistas(response.data || []);
    } catch (error) {
      console.error('Error al cargar transportistas:', error);
      // Si es error 403, podría ser que el token expiró o el backend necesita reiniciarse
      if (error.response?.status === 403) {
        console.warn('Error 403 al cargar transportistas. Verifica que el backend esté corriendo y que tengas sesión activa.');
      }
      setTransportistas([]); // Establecer array vacío para evitar errores
    }
  };

  const cargarEquipos = async () => {
    try {
      const response = await grupoService.obtenerTodos();
      setEquipos(response.data || []);
    } catch (error) {
      console.error('Error al cargar equipos:', error);
      // Si es error 403, podría ser que el token expiró o el backend necesita reiniciarse
      if (error.response?.status === 403) {
        console.warn('Error 403 al cargar equipos. Verifica que el backend esté corriendo y que tengas sesión activa.');
      }
      setEquipos([]); // Establecer array vacío para evitar errores
    }
  };

  const cargarPedidos = async () => {
    try {
      if (activeTab === 'realizados') {
        const response = await pedidoService.obtenerPorEstado('REALIZADO');
        setPedidos(response.data || []);
      } else if (activeTab === 'pedidos') {
        // Para "pedidos", excluir los realizados
        const response = await pedidoService.obtenerTodos();
        const pedidosFiltrados = (response.data || []).filter(p => p.estado !== 'REALIZADO');
        setPedidos(pedidosFiltrados);
      }
    } catch (error) {
      console.error('Error al cargar pedidos:', error);
    }
  };

  // Recargar pedidos cuando cambia la pestaña
  useEffect(() => {
    const cargarSegunPestaña = async () => {
      try {
        if (activeTab === 'realizados') {
          const response = await pedidoService.obtenerPorEstado('REALIZADO');
          setPedidos(response.data || []);
        } else if (activeTab === 'pedidos') {
          const response = await pedidoService.obtenerTodos();
          const pedidosFiltrados = (response.data || []).filter(p => p.estado !== 'REALIZADO');
          setPedidos(pedidosFiltrados);
        }
      } catch (error) {
        console.error('Error al cargar pedidos:', error);
      }
    };

    // Limpiar pedidos inmediatamente al cambiar de pestaña para evitar mostrar datos incorrectos
    if (activeTab === 'pedidos' || activeTab === 'realizados') {
      setPedidos([]);
      cargarSegunPestaña();
    } else if (activeTab === 'equipos') {
      cargarEquipos();
    }
  }, [activeTab]);

  // Agregar listener para abrir modales con Enter cuando esté en la sección correspondiente
  useEffect(() => {
    const handleKeyPress = (event) => {
      // Solo abrir el modal si no se está escribiendo en un input, textarea o select
      const target = event.target;
      const isInputFocused = target.tagName === 'INPUT' || 
                           target.tagName === 'TEXTAREA' || 
                           target.tagName === 'SELECT' ||
                           target.isContentEditable;
      
      if (event.key === 'Enter' && !isInputFocused) {
        if (activeTab === 'pedidos' && !showModal) {
          event.preventDefault();
          setShowModal(true);
        } else if (activeTab === 'transportistas' && !showTransportistaModal) {
          event.preventDefault();
          setShowTransportistaModal(true);
        } else if (activeTab === 'usuarios' && !showUsuarioModal) {
          event.preventDefault();
          setShowUsuarioModal(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [activeTab, showModal, showTransportistaModal, showUsuarioModal]);

  // Enfocar el primer campo cuando se abre el modal de pedidos
  useEffect(() => {
    if (showModal && numeroPlanillaRef.current) {
      // Pequeño delay para asegurar que el modal esté completamente renderizado
      setTimeout(() => {
        numeroPlanillaRef.current?.focus();
      }, 100);
    }
  }, [showModal]);

  // Enfocar el primer campo cuando se abre el modal de transportistas
  useEffect(() => {
    if (showTransportistaModal && codigoInternoRef.current) {
      // Pequeño delay para asegurar que el modal esté completamente renderizado
      setTimeout(() => {
        codigoInternoRef.current?.focus();
      }, 100);
    }
  }, [showTransportistaModal]);

  // Enfocar el primer campo cuando se abre el modal de usuarios
  useEffect(() => {
    if (showUsuarioModal && usernameRef.current) {
      // Pequeño delay para asegurar que el modal esté completamente renderizado
      setTimeout(() => {
        usernameRef.current?.focus();
      }, 100);
    }
  }, [showUsuarioModal]);

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

  // Cerrar modal con ESC
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (showModal) {
          setShowModal(false);
          setFormData({ numeroPlanilla: '', transportistaId: '', prioridad: 'NORMAL' });
        } else if (showTransportistaModal) {
          setShowTransportistaModal(false);
          setTransportistaForm({ codigoInterno: '', chofer: '', vehiculo: '' });
        } else if (showUsuarioModal) {
          setShowUsuarioModal(false);
          setUsuarioForm({ username: '', password: '', nombreCompleto: '', rol: 'DEPOSITO' });
        } else if (showChat) {
          setShowChat(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showModal, showTransportistaModal, showUsuarioModal, showChat]);

  // Navegación con flechas entre pestañas
  useEffect(() => {
    const handleKeyDown = (event) => {
      // No navegar si hay un modal abierto o si el usuario está escribiendo
      if (showModal || showUsuarioModal || showTransportistaModal) {
        return;
      }

      // No navegar si el usuario está en un input, textarea o select
      const focusedElement = document.activeElement;
      if (focusedElement && (
        focusedElement.tagName === 'INPUT' || 
        focusedElement.tagName === 'TEXTAREA' || 
        focusedElement.tagName === 'SELECT' ||
        focusedElement.isContentEditable
      )) {
        return;
      }

      const tabs = ['pedidos', 'realizados', 'transportistas', 'usuarios', 'equipos'];
      const currentIndex = tabs.indexOf(activeTab);

      if (event.key === 'ArrowLeft' && currentIndex > 0) {
        event.preventDefault();
        setActiveTab(tabs[currentIndex - 1]);
      } else if (event.key === 'ArrowRight' && currentIndex < tabs.length - 1) {
        event.preventDefault();
        setActiveTab(tabs[currentIndex + 1]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTab, showModal, showUsuarioModal, showTransportistaModal]);

  const cargarUsuarios = async () => {
    try {
      const response = await usuarioService.obtenerTodos();
      setUsuarios(response.data);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
    }
  };

  const handleCrearPedido = async (e) => {
    e.preventDefault();
    try {
      await pedidoService.crear(formData);
      setShowModal(false);
      setFormData({ numeroPlanilla: '', transportistaId: '', prioridad: 'NORMAL' });
      cargarPedidos();
    } catch (error) {
      alert(error.response?.data || 'Error al crear pedido');
    }
  };

  const handleCrearTransportista = async (e) => {
    e.preventDefault();
    try {
      await transportistaService.crear(
        transportistaForm.codigoInterno,
        transportistaForm.chofer,
        transportistaForm.vehiculo
      );
      setShowTransportistaModal(false);
      setTransportistaForm({ codigoInterno: '', chofer: '', vehiculo: '' });
      cargarTransportistas();
    } catch (error) {
      alert(error.response?.data || 'Error al crear transportista');
    }
  };

  const handleEliminarPedido = async (id) => {
    if (window.confirm('¿Está seguro de eliminar este pedido?')) {
      try {
        await pedidoService.eliminar(id);
        cargarPedidos();
      } catch (error) {
        alert(error.response?.data || 'Error al eliminar pedido');
      }
    }
  };

  const handleCrearUsuario = async (e) => {
    e.preventDefault();
    try {
      const api = (await import('../config/axios')).default;
      await api.post('/usuarios', usuarioForm);
      setShowUsuarioModal(false);
      setUsuarioForm({ username: '', password: '', nombreCompleto: '', rol: 'DEPOSITO' });
      cargarUsuarios();
      alert('Usuario creado exitosamente');
    } catch (error) {
      alert(error.response?.data || 'Error al crear usuario');
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

  // Calcular cantidad de nuevos pedidos realizados (no vistos)
  // Usar useMemo para recalcular cuando cambian los pedidos o los vistos
  const cantidadNuevosRealizados = useMemo(() => {
    const pedidosRealizados = todosLosPedidos.filter(p => p.estado === 'REALIZADO');
    const nuevos = pedidosRealizados.filter(p => !pedidosRealizadosVistos.has(p.id));
    // Debug: verificar que se está calculando correctamente
    if (nuevos.length > 0) {
      console.log('AdminPanel - Pedidos realizados nuevos detectados:', nuevos.length, 'IDs:', nuevos.map(p => p.id));
      console.log('AdminPanel - Total pedidos realizados:', pedidosRealizados.length);
      console.log('AdminPanel - Pedidos vistos:', pedidosRealizadosVistos.size);
    }
    return nuevos.length;
  }, [todosLosPedidos, pedidosRealizadosVistos]);

  // Marcar pedidos realizados como vistos cuando se expande un día
  // NO marcar automáticamente al entrar a la pestaña, solo cuando se ven

  // Calcular pedidos realizados por día y agruparlos
  const getPedidosAgrupadosPorDia = () => {
    if (activeTab !== 'realizados') return null;
    
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

  // Usar useMemo para estabilizar pedidosAgrupadosPorDia
  const pedidosAgrupadosPorDia = useMemo(() => getPedidosAgrupadosPorDia(), [activeTab, pedidos]);
  const pedidosPorDia = useMemo(() => getPedidosPorDia(), [activeTab, pedidos]);

  // Expandir el día de hoy por defecto cuando se carga la sección de realizados
  // NO marcar como vistos automáticamente - solo cuando el usuario expande explícitamente
  useEffect(() => {
    if (activeTab === 'realizados' && pedidosAgrupadosPorDia && pedidosAgrupadosPorDia.length > 0) {
      const hoy = pedidosAgrupadosPorDia.find(dia => dia.esHoy);
      if (hoy && !hoyColapsadoManualmente.current) {
        setDiasExpandidos(prev => {
          if (!prev.has(hoy.fecha)) {
            // Solo expandir, NO marcar como vistos automáticamente
            return new Set([...prev, hoy.fecha]);
          }
          return prev;
        });
      }
    } else if (activeTab !== 'realizados') {
      // Limpiar días expandidos cuando se cambia de pestaña
      setDiasExpandidos(new Set());
      // Resetear el flag cuando se cambia de pestaña
      hoyColapsadoManualmente.current = false;
    }
  }, [activeTab, pedidosAgrupadosPorDia]);

  const toggleDia = (fecha) => {
    setDiasExpandidos(prev => {
      const nuevo = new Set(prev);
      const pedidosAgrupados = getPedidosAgrupadosPorDia();
      const dia = pedidosAgrupados?.find(d => d.fecha === fecha);
      
      if (nuevo.has(fecha)) {
        // Si está expandido, colapsarlo
        nuevo.delete(fecha);
        // Si es el día de hoy, marcar que fue colapsado manualmente
        if (dia && dia.esHoy) {
          hoyColapsadoManualmente.current = true;
        }
      } else {
        // Si está colapsado, expandirlo
        nuevo.add(fecha);
        // Si es el día de hoy y se expande manualmente, resetear el flag
        if (dia && dia.esHoy) {
          hoyColapsadoManualmente.current = false;
        }
        // Cuando el usuario expande explícitamente un día, marcar todos los pedidos de ese día como vistos
        if (dia && dia.pedidos) {
          setPedidosRealizadosVistos(prevVistos => {
            const nuevoSet = new Set(prevVistos);
            dia.pedidos.forEach(pedido => {
              nuevoSet.add(pedido.id);
            });
            // Guardar en localStorage
            try {
              localStorage.setItem('pedidosRealizadosVistos', JSON.stringify(Array.from(nuevoSet)));
            } catch (e) {
              console.error('Error al guardar pedidos realizados vistos:', e);
            }
            return nuevoSet;
          });
        }
      }
      return nuevo;
    });
  };

  return (
    <div className="admin-panel">
      <header className="admin-header">
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
          Panel de Administración
        </h1>
        <div className="user-info">
          <span>
            <span>👤</span>
            {user?.nombreCompleto}
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

      <div className="tabs">
        <button
          className={activeTab === 'pedidos' ? 'active' : ''}
          onClick={() => setActiveTab('pedidos')}
        >
          Pedidos
        </button>
        <button
          className={activeTab === 'realizados' ? 'active' : ''}
          onClick={() => setActiveTab('realizados')}
          style={{ position: 'relative' }}
        >
          Realizados
          {cantidadNuevosRealizados > 0 && (
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
              {cantidadNuevosRealizados}
            </span>
          )}
        </button>
        <button
          className={activeTab === 'transportistas' ? 'active' : ''}
          onClick={() => setActiveTab('transportistas')}
        >
          Transportistas
        </button>
        <button
          className={activeTab === 'usuarios' ? 'active' : ''}
          onClick={() => setActiveTab('usuarios')}
        >
          Usuarios
        </button>
        <button
          className={activeTab === 'equipos' ? 'active' : ''}
          onClick={() => setActiveTab('equipos')}
        >
          Equipos
        </button>
      </div>

      {activeTab === 'pedidos' && (
        <div className="content-section">
          <div className="section-header" style={{ justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowModal(true)}
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
              + Nuevo Pedido
            </button>
          </div>
          <div className="pedidos-grid">
            {pedidos.filter(pedido => pedido.estado !== 'REALIZADO').map((pedido) => (
              <div key={pedido.id} className="pedido-card admin-pedido-card">
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
                    <strong>Equipo Asignado:</strong> {pedido.grupoNombre || 'Sin asignar'}
                  </p>
                  <p>
                    <strong>Hora de Carga:</strong>{' '}
                    <span style={{ color: '#666' }}>
                      {pedido.fechaCreacion && new Date(pedido.fechaCreacion).toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}
                    </span>
                  </p>
                  {pedido.estado === 'REALIZADO' && pedido.fechaActualizacion && (
                    <p>
                      <strong>Finalización:</strong>{' '}
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
                {pedido.estado === 'PENDIENTE' && (
                  <div className="pedido-actions">
                    <button
                      className="btn-danger"
                      onClick={() => handleEliminarPedido(pedido.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            ))}
            {pedidos.length === 0 && (
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
                  📦
                </div>
                <h3 style={{
                  fontSize: '1.5rem',
                  fontWeight: '600',
                  color: '#333',
                  margin: '0 0 10px 0',
                }}>
                  No hay pedidos registrados
                </h3>
                <p style={{
                  fontSize: '1rem',
                  color: '#666',
                  margin: '0',
                  maxWidth: '400px',
                }}>
                  Crea tu primer pedido usando el botón "Nuevo Pedido" para comenzar.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'realizados' && (
        <div className="content-section">
          {pedidosAgrupadosPorDia && pedidosAgrupadosPorDia.length > 0 && (
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
                      backgroundColor: dia.esHoy ? '#E3F2FD' : '#FFFFFF',
                      border: dia.esHoy ? '2px solid #2196F3' : '2px solid #E0E0E0',
                      borderBottom: dia.esHoy ? '2px solid #2196F3' : '2px solid #BDBDBD',
                      borderRadius: '8px 8px 0 0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.2s ease',
                      boxShadow: dia.esHoy ? '0 2px 4px rgba(33, 150, 243, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
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
                          parent.style.backgroundColor = '#BBDEFB';
                          parent.style.borderColor = '#1976D2';
                        } else {
                          parent.style.backgroundColor = '#F5F5F5';
                          parent.style.borderColor = '#9E9E9E';
                        }
                      }}
                      onMouseLeave={(e) => {
                        const parent = e.currentTarget.parentElement;
                        if (dia.esHoy) {
                          parent.style.backgroundColor = '#E3F2FD';
                          parent.style.borderColor = '#2196F3';
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
                        backgroundColor: '#1e40af',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: 'bold',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        marginLeft: '15px',
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#1e3a8a'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = '#1e40af'}
                    >
                      Resumen
                    </button>
                  </div>

                  {/* Pedidos del día - solo se muestran si está expandido */}
                  {diasExpandidos.has(dia.fecha) && (
                    <div className="pedidos-grid" style={{ padding: '20px', gap: '15px' }}>
                      {dia.pedidos.map((pedido) => (
                        <div key={pedido.id} className="pedido-card admin-pedido-card">
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
                              <strong>Equipo Asignado:</strong> {pedido.grupoNombre || 'Sin asignar'}
                            </p>
                            <p>
                              <strong>Hora de Carga:</strong>{' '}
                              <span style={{ color: '#666' }}>
                                {pedido.fechaCreacion && new Date(pedido.fechaCreacion).toLocaleTimeString('es-AR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false,
                                })}
                              </span>
                            </p>
                            {pedido.fechaActualizacion && (
                              <p>
                                <strong>Finalización:</strong>{' '}
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
                          {/* No mostrar botón de eliminar en pedidos realizados */}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {(!pedidosAgrupadosPorDia || pedidosAgrupadosPorDia.length === 0) && (
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

      {activeTab === 'transportistas' && (
        <div className="content-section">
          <div className="table-container">
            <div className="section-header" style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #e0e0e0' }}>
              <h2 style={{ margin: 0, color: '#333' }}>Transportistas</h2>
              <button
                onClick={() => setShowTransportistaModal(true)}
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
                + Nuevo Transportista
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Código Interno</th>
                  <th>Chofer</th>
                  <th>Vehículo</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {transportistas.map((transportista) => (
                  <tr key={transportista.id}>
                    <td>{transportista.codigoInterno}</td>
                    <td>{transportista.chofer}</td>
                    <td>{transportista.vehiculo}</td>
                    <td>
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
                    <td>
                      {transportista.activo ? (
                        <button
                          className="btn-danger"
                          onClick={async () => {
                            if (window.confirm('¿Estás seguro de que deseas desactivar este transportista?\n\nEl transportista se desactivará y no aparecerá como opción al crear pedidos, pero se mantendrá en el sistema para conservar los registros históricos.')) {
                              try {
                                await transportistaService.actualizar(transportista.id, null, null, null, false);
                                cargarTransportistas();
                                alert('Transportista desactivado exitosamente');
                              } catch (error) {
                                alert(error.response?.data || 'Error al desactivar transportista');
                              }
                            }
                          }}
                        >
                          Desactivar
                        </button>
                      ) : (
                        <button
                          className="btn-secondary"
                          style={{ backgroundColor: '#667eea', color: 'white' }}
                          onClick={async () => {
                            if (window.confirm('¿Estás seguro de que deseas activar este transportista?\n\nEl transportista volverá a aparecer como opción al crear pedidos.')) {
                              try {
                                await transportistaService.actualizar(transportista.id, null, null, null, true);
                                cargarTransportistas();
                                alert('Transportista activado exitosamente');
                              } catch (error) {
                                alert(error.response?.data || 'Error al activar transportista');
                              }
                            }
                          }}
                        >
                          Activar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'equipos' && (
        <div className="content-section">
          <div className="table-container">
            <div className="section-header" style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #e0e0e0' }}>
              <h2 style={{ margin: 0, color: '#333' }}>Equipos</h2>
            </div>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {equipos.length === 0 ? (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', padding: '20px' }}>
                      No hay equipos registrados
                    </td>
                  </tr>
                ) : (
                  equipos.map((equipo) => (
                    <tr key={equipo.id}>
                      <td>{equipo.id}</td>
                      <td>{equipo.nombre}</td>
                      <td>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '0.85em',
                          fontWeight: 'bold',
                          backgroundColor: equipo.activo !== false ? '#E8F5E9' : '#FFEBEE',
                          color: equipo.activo !== false ? '#2E7D32' : '#C62828'
                        }}>
                          {equipo.activo !== false ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'usuarios' && (
        <div className="content-section">
          <div className="table-container">
            <div className="section-header" style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #e0e0e0' }}>
              <h2 style={{ margin: 0, color: '#333' }}>Usuarios</h2>
              <button
                onClick={() => setShowUsuarioModal(true)}
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
                + Nuevo Usuario
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Nombre</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((usuario) => (
                  <tr key={usuario.id}>
                    <td>{usuario.username}</td>
                    <td>{usuario.nombreCompleto}</td>
                    <td>{usuario.rol.nombre}</td>
                    <td>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '0.85em',
                        fontWeight: 'bold',
                        backgroundColor: usuario.activo ? '#E8F5E9' : '#FFEBEE',
                        color: usuario.activo ? '#2E7D32' : '#C62828'
                      }}>
                        {usuario.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      {usuario.activo && usuario.id !== idPrimerAdmin ? (
                        <button
                          onClick={async () => {
                            if (!window.confirm('¿Estás seguro de que deseas desactivar este usuario?\n\nEl usuario no podrá iniciar sesión, pero se mantendrá en el sistema.')) {
                              return;
                            }
                            try {
                              await usuarioService.actualizarEstado(usuario.id, false);
                              cargarUsuarios();
                              alert('Usuario desactivado exitosamente');
                            } catch (error) {
                              console.error('Error al desactivar usuario:', error);
                              const errorMessage = error.response?.data || error.message || 'Error al desactivar usuario';
                              alert(errorMessage);
                            }
                          }}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#F44336',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 'bold',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#D32F2F'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = '#F44336'}
                        >
                          Desactivar
                        </button>
                      ) : usuario.id === idPrimerAdmin ? (
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: '#666',
                          fontStyle: 'italic',
                        }}>
                          Admin Principal
                        </span>
                      ) : (
                        <button
                          onClick={async () => {
                            if (!window.confirm('¿Estás seguro de que deseas activar este usuario?\n\nEl usuario podrá iniciar sesión nuevamente.')) {
                              return;
                            }
                            try {
                              await usuarioService.actualizarEstado(usuario.id, true);
                              cargarUsuarios();
                              alert('Usuario activado exitosamente');
                            } catch (error) {
                              console.error('Error al activar usuario:', error);
                              const errorMessage = error.response?.data || error.message || 'Error al activar usuario';
                              alert(errorMessage);
                            }
                          }}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#1e40af',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 'bold',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#1e3a8a'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = '#1e40af'}
                        >
                          Activar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Nuevo Pedido</h3>
            <form onSubmit={handleCrearPedido}>
              <div className="form-group">
                <label>Número de Planilla</label>
                <input
                  ref={numeroPlanillaRef}
                  type="text"
                  value={formData.numeroPlanilla}
                  onChange={(e) =>
                    setFormData({ ...formData, numeroPlanilla: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      transportistaRef.current?.focus();
                    }
                  }}
                  required
                />
              </div>
              <div className="form-group" style={{ position: 'relative' }}>
                <label>Transportista</label>
                <select
                  ref={transportistaRef}
                  value={formData.transportistaId || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, transportistaId: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      prioridadRef.current?.focus();
                    }
                  }}
                  onMouseEnter={() => {
                    const transportistasActivos = transportistas.filter(t => t.activo);
                    if (transportistasActivos.length === 0) {
                      setShowTransportistaTooltip(true);
                    }
                  }}
                  onMouseLeave={() => setShowTransportistaTooltip(false)}
                  onFocus={() => {
                    const transportistasActivos = transportistas.filter(t => t.activo);
                    if (transportistasActivos.length === 0) {
                      setShowTransportistaTooltip(true);
                    }
                  }}
                  onBlur={() => setShowTransportistaTooltip(false)}
                  required
                  style={{ position: 'relative' }}
                >
                  <option value="">Seleccionar transportista...</option>
                  {transportistas
                    .filter(t => t.activo)
                    .map((transportista) => (
                      <option key={transportista.id} value={transportista.id}>
                        {transportista.codigoInterno} - {transportista.chofer} ({transportista.vehiculo})
                      </option>
                    ))}
                </select>
                {showTransportistaTooltip && transportistas.filter(t => t.activo).length === 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '8px',
                    padding: '12px 16px',
                    backgroundColor: '#1e40af',
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
                      ℹ️ No hay transportistas registrados
                    </div>
                    <div>
                      Para crear un pedido, primero debes ir a la sección <strong>"Transportistas"</strong> y crear al menos un transportista.
                    </div>
                    <div style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '20px',
                      width: 0,
                      height: 0,
                      borderLeft: '8px solid transparent',
                      borderRight: '8px solid transparent',
                      borderBottom: '8px solid #1e40af'
                    }}></div>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Prioridad</label>
                <select
                  ref={prioridadRef}
                  value={formData.prioridad}
                  onChange={(e) => setFormData({ ...formData, prioridad: e.target.value })}
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
                >
                  <option value="BAJA">Baja</option>
                  <option value="NORMAL">Normal</option>
                  <option value="ALTA">Alta</option>
                  <option value="URGENTE">Urgente</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn-primary">
                  Crear
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUsuarioModal && (
        <div className="modal-overlay" onClick={() => setShowUsuarioModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Nuevo Usuario</h3>
            <form onSubmit={handleCrearUsuario}>
              <div className="form-group">
                <label>Usuario</label>
                <input
                  ref={usernameRef}
                  type="text"
                  value={usuarioForm.username}
                  onChange={(e) =>
                    setUsuarioForm({ ...usuarioForm, username: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      nombreCompletoRef.current?.focus();
                    }
                  }}
                  required
                />
              </div>
              <div className="form-group">
                <label>Nombre Completo</label>
                <input
                  ref={nombreCompletoRef}
                  type="text"
                  value={usuarioForm.nombreCompleto}
                  onChange={(e) =>
                    setUsuarioForm({ ...usuarioForm, nombreCompleto: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      passwordRef.current?.focus();
                    }
                  }}
                  required
                />
              </div>
              <div className="form-group">
                <label>Contraseña</label>
                <input
                  ref={passwordRef}
                  type="password"
                  value={usuarioForm.password}
                  onChange={(e) =>
                    setUsuarioForm({ ...usuarioForm, password: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      rolRef.current?.focus();
                    }
                  }}
                  required
                />
              </div>
              <div className="form-group">
                <label>Rol</label>
                <select
                  ref={rolRef}
                  value={usuarioForm.rol}
                  onChange={(e) =>
                    setUsuarioForm({ ...usuarioForm, rol: e.target.value })
                  }
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
                >
                  <option value="DEPOSITO">Depósito</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn-primary">
                  Crear
                </button>
                <button
                  type="button"
                  onClick={() => setShowUsuarioModal(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTransportistaModal && (
        <div className="modal-overlay" onClick={() => setShowTransportistaModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Nuevo Transportista</h3>
            <form onSubmit={handleCrearTransportista}>
              <div className="form-group">
                <label>Código Interno</label>
                <input
                  ref={codigoInternoRef}
                  type="text"
                  value={transportistaForm.codigoInterno}
                  onChange={(e) =>
                    setTransportistaForm({ ...transportistaForm, codigoInterno: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      choferRef.current?.focus();
                    }
                  }}
                  required
                />
              </div>
              <div className="form-group">
                <label>Chofer</label>
                <input
                  ref={choferRef}
                  type="text"
                  value={transportistaForm.chofer}
                  onChange={(e) =>
                    setTransportistaForm({ ...transportistaForm, chofer: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      vehiculoRef.current?.focus();
                    }
                  }}
                  required
                />
              </div>
              <div className="form-group">
                <label>Vehículo</label>
                <input
                  ref={vehiculoRef}
                  type="text"
                  value={transportistaForm.vehiculo}
                  onChange={(e) =>
                    setTransportistaForm({ ...transportistaForm, vehiculo: e.target.value })
                  }
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
                />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn-primary">
                  Crear
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowTransportistaModal(false);
                    setTransportistaForm({ codigoInterno: '', chofer: '', vehiculo: '' });
                  }}
                  className="btn-secondary"
                >
                  Cancelar
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

export default AdminPanel;

