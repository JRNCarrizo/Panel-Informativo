import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { pedidoService } from '../services/pedidoService';
import { usuarioService } from '../services/usuarioService';
import { transportistaService } from '../services/transportistaService';
import { grupoService } from '../services/grupoService';
import { connectWebSocket, disconnectWebSocket } from '../services/websocketService';
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
  const [formData, setFormData] = useState({
    numeroPlanilla: '',
    transportistaId: '',
    prioridad: 'NORMAL',
  });
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
        
        // Actualizar todos los pedidos para el contador
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

  // Calcular cantidad de nuevos pedidos realizados
  const getCantidadNuevosRealizados = () => {
    const pedidosRealizados = todosLosPedidos.filter(p => p.estado === 'REALIZADO');
    return pedidosRealizados.filter(p => !pedidosRealizadosVistos.has(p.id)).length;
  };

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

  const pedidosAgrupadosPorDia = getPedidosAgrupadosPorDia();
  const pedidosPorDia = getPedidosPorDia();

  // Expandir el día de hoy por defecto cuando se carga la sección de realizados
  // Y marcar los pedidos de hoy como vistos cuando se expande automáticamente
  useEffect(() => {
    if (activeTab === 'realizados' && pedidosAgrupadosPorDia && pedidosAgrupadosPorDia.length > 0) {
      const hoy = pedidosAgrupadosPorDia.find(dia => dia.esHoy);
      if (hoy && !hoyColapsadoManualmente.current) {
        setDiasExpandidos(prev => {
          if (!prev.has(hoy.fecha)) {
            // Cuando se expande automáticamente el día de hoy, marcar sus pedidos como vistos
            if (hoy.pedidos && hoy.pedidos.length > 0) {
              setPedidosRealizadosVistos(prevVistos => {
                const nuevoSet = new Set(prevVistos);
                hoy.pedidos.forEach(pedido => {
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
        // Cuando se expande un día, marcar todos los pedidos de ese día como vistos
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
        <h1>Panel de Administración</h1>
        <div className="user-info">
          <span>{user?.nombreCompleto}</span>
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
          {getCantidadNuevosRealizados() > 0 && (
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
              {getCantidadNuevosRealizados()}
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
          <div className="section-header">
            <h2>Gestión de Pedidos</h2>
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
                    <strong>Fecha de Carga:</strong>{' '}
                    <span style={{ color: '#666' }}>
                      {pedido.fechaCreacion && new Date(pedido.fechaCreacion).toLocaleString('es-AR', {
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
              <div className="no-pedidos">
                <p>No hay pedidos registrados</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'realizados' && (
        <div className="content-section">
          <div className="section-header">
            <h2>Pedidos Realizados</h2>
          </div>
          
          {pedidosAgrupadosPorDia && pedidosAgrupadosPorDia.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {pedidosAgrupadosPorDia.map((dia) => (
                <div
                  key={dia.fecha}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Encabezado del día - clickeable para expandir/colapsar */}
                  <div
                    style={{
                      padding: '15px 20px',
                      backgroundColor: dia.esHoy ? '#E8F5E9' : '#F5F5F5',
                      borderBottom: '2px solid #e0e0e0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'background-color 0.2s',
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
                      onMouseEnter={(e) => e.currentTarget.parentElement.style.backgroundColor = dia.esHoy ? '#C8E6C9' : '#E0E0E0'}
                      onMouseLeave={(e) => e.currentTarget.parentElement.style.backgroundColor = dia.esHoy ? '#E8F5E9' : '#F5F5F5'}
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
                        backgroundColor: '#667eea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: 'bold',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        marginLeft: '15px',
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#5568d3'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = '#667eea'}
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
                              <strong>Fecha de Carga:</strong>{' '}
                              <span style={{ color: '#666' }}>
                                {pedido.fechaCreacion && new Date(pedido.fechaCreacion).toLocaleString('es-AR', {
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
                                    second: '2-digit',
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
            <div className="no-pedidos">
              <p>No hay pedidos realizados</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'transportistas' && (
        <div className="content-section">
          <div className="section-header">
            <h2>Gestión de Transportistas</h2>
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
          <div className="table-container">
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
          <div className="section-header">
            <h2>Equipos</h2>
          </div>
          <div className="table-container">
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
          <div className="section-header">
            <h2>Gestión de Usuarios</h2>
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
          <div className="table-container">
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
                            backgroundColor: '#667eea',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 'bold',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#5568d3'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = '#667eea'}
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
                  type="text"
                  value={formData.numeroPlanilla}
                  onChange={(e) =>
                    setFormData({ ...formData, numeroPlanilla: e.target.value })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label>Transportista</label>
                <select
                  value={formData.transportistaId || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, transportistaId: e.target.value })
                  }
                  required
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
              </div>
              <div className="form-group">
                <label>Prioridad</label>
                <select
                  value={formData.prioridad}
                  onChange={(e) => setFormData({ ...formData, prioridad: e.target.value })}
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
                  type="text"
                  value={usuarioForm.username}
                  onChange={(e) =>
                    setUsuarioForm({ ...usuarioForm, username: e.target.value })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label>Nombre Completo</label>
                <input
                  type="text"
                  value={usuarioForm.nombreCompleto}
                  onChange={(e) =>
                    setUsuarioForm({ ...usuarioForm, nombreCompleto: e.target.value })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label>Contraseña</label>
                <input
                  type="password"
                  value={usuarioForm.password}
                  onChange={(e) =>
                    setUsuarioForm({ ...usuarioForm, password: e.target.value })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label>Rol</label>
                <select
                  value={usuarioForm.rol}
                  onChange={(e) =>
                    setUsuarioForm({ ...usuarioForm, rol: e.target.value })
                  }
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
                  type="text"
                  value={transportistaForm.codigoInterno}
                  onChange={(e) =>
                    setTransportistaForm({ ...transportistaForm, codigoInterno: e.target.value })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label>Chofer</label>
                <input
                  type="text"
                  value={transportistaForm.chofer}
                  onChange={(e) =>
                    setTransportistaForm({ ...transportistaForm, chofer: e.target.value })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label>Vehículo</label>
                <input
                  type="text"
                  value={transportistaForm.vehiculo}
                  onChange={(e) =>
                    setTransportistaForm({ ...transportistaForm, vehiculo: e.target.value })
                  }
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

    </div>
  );
};

export default AdminPanel;

