import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { pedidoService } from '../services/pedidoService';
import { usuarioService } from '../services/usuarioService';
import { transportistaService } from '../services/transportistaService';
import { grupoService } from '../services/grupoService';
import { mensajeService } from '../services/mensajeService';
import { zonaService } from '../services/zonaService';
import { vueltaService } from '../services/vueltaService';
import { connectWebSocket, disconnectWebSocket } from '../services/websocketService';
import Chat from './Chat';
import './AdminPanel.css';

const AdminPanel = () => {
  const { user, logout } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [transportistas, setTransportistas] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [vueltas, setVueltas] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showUsuarioModal, setShowUsuarioModal] = useState(false);
  const [showTransportistaModal, setShowTransportistaModal] = useState(false);
  const [transportistaEditando, setTransportistaEditando] = useState(null);
  const [showZonaModal, setShowZonaModal] = useState(false);
  const [zonaEditando, setZonaEditando] = useState(null);
  const [showVueltaModal, setShowVueltaModal] = useState(false);
  const [vueltaEditando, setVueltaEditando] = useState(null);
  const [showTransportistaTooltip, setShowTransportistaTooltip] = useState(false);
  const [formData, setFormData] = useState({
    numeroPlanilla: '',
    transportistaNombre: '', // Para el buscador avanzado
    zonaNombre: '',
    cantidad: '',
    vueltaNombre: '',
    prioridad: 'NORMAL',
  });
  const [zonaSugerencias, setZonaSugerencias] = useState([]);
  const [mostrarSugerenciasZona, setMostrarSugerenciasZona] = useState(false);
  const [indiceZonaSeleccionada, setIndiceZonaSeleccionada] = useState(-1);
  const zonaInputRef = useRef(null);
  const zonaSugerenciasRef = useRef(null);
  const [transportistaSugerencias, setTransportistaSugerencias] = useState([]);
  const [mostrarSugerenciasTransportista, setMostrarSugerenciasTransportista] = useState(false);
  const [indiceTransportistaSeleccionada, setIndiceTransportistaSeleccionada] = useState(-1);
  const transportistaSugerenciasRef = useRef(null);
  const [vueltaSugerencias, setVueltaSugerencias] = useState([]);
  const [mostrarSugerenciasVuelta, setMostrarSugerenciasVuelta] = useState(false);
  const [indiceVueltaSeleccionada, setIndiceVueltaSeleccionada] = useState(-1);
  const vueltaInputRef = useRef(null);
  const vueltaSugerenciasRef = useRef(null);
  // Refs para los campos del formulario de pedidos
  const numeroPlanillaRef = useRef(null);
  const transportistaRef = useRef(null);
  const zonaRef = useRef(null);
  const cantidadRef = useRef(null);
  const vueltaRef = useRef(null);
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
    nombre: '',
    codigoInterno: '',
    chofer: '',
    vehiculo: '',
  });
  const [zonaForm, setZonaForm] = useState({
    nombre: '',
  });
  const zonaNombreRef = useRef(null);
  const [vueltaForm, setVueltaForm] = useState({
    nombre: '',
  });
  const vueltaNombreRef = useRef(null);
  const [activeTab, setActiveTab] = useState('pedidos');
  // Estado para el modal de resumen
  const [showResumenModal, setShowResumenModal] = useState(false);
  const [pedidosResumen, setPedidosResumen] = useState([]);
  const [fechaResumen, setFechaResumen] = useState('');
  // Estado para el chat
  const [showChat, setShowChat] = useState(false);
  const [cantidadMensajesNoLeidos, setCantidadMensajesNoLeidos] = useState(0);
  // Estado para el buscador avanzado
  const [textoBusqueda, setTextoBusqueda] = useState('');
  // Estado para el filtro de pedidos
  const [filtroPedidos, setFiltroPedidos] = useState('TODOS'); // 'TODOS', 'PENDIENTE', 'EN_PREPARACION', 'CONTROLADO', 'PENDIENTE_CARGA'
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
    // Cargar zonas en paralelo pero no esperar si falla
    cargarZonas().catch(err => {
      console.warn('Error al cargar zonas (puede ser normal si el backend no se reinició):', err);
    });
    // Cargar vueltas en paralelo pero no esperar si falla
    cargarVueltas().catch(err => {
      console.warn('Error al cargar vueltas (puede ser normal si el backend no se reinició):', err);
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

  const cargarZonas = async () => {
    try {
      const response = await zonaService.obtenerTodas();
      setZonas(response.data || []);
    } catch (error) {
      console.error('Error al cargar zonas:', error);
      if (error.response?.status === 403) {
        console.warn('Error 403 al cargar zonas. Verifica que el backend esté corriendo y que tengas sesión activa.');
      }
      setZonas([]);
    }
  };

  const cargarVueltas = async () => {
    try {
      const response = await vueltaService.obtenerTodas();
      setVueltas(response.data || []);
    } catch (error) {
      console.error('Error al cargar vueltas:', error);
      if (error.response?.status === 403) {
        console.warn('Error 403 al cargar vueltas. Verifica que el backend esté corriendo y que tengas sesión activa.');
      }
      setVueltas([]);
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
    } else if (activeTab === 'zonas') {
      cargarZonas();
    } else if (activeTab === 'vueltas') {
      cargarVueltas();
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
        } else if (activeTab === 'zonas' && !showZonaModal) {
          event.preventDefault();
          setShowZonaModal(true);
        } else if (activeTab === 'vueltas' && !showVueltaModal) {
          event.preventDefault();
          setVueltaForm({ nombre: '' });
          setVueltaEditando(null);
          setShowVueltaModal(true);
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

  // Enfocar el primer campo cuando se abre el modal de zonas
  useEffect(() => {
    if (showZonaModal && zonaNombreRef.current) {
      // Pequeño delay para asegurar que el modal esté completamente renderizado
      setTimeout(() => {
        zonaNombreRef.current?.focus();
        // Seleccionar todo el texto si está editando
        if (zonaEditando) {
          zonaNombreRef.current?.select();
        }
      }, 100);
    }
  }, [showZonaModal, zonaEditando]);

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
          setFormData({ numeroPlanilla: '', transportistaNombre: '', prioridad: 'NORMAL' });
        } else if (showTransportistaModal) {
          setShowTransportistaModal(false);
          setTransportistaForm({ codigoInterno: '', chofer: '', vehiculo: '' });
        } else if (showUsuarioModal) {
          setShowUsuarioModal(false);
          setUsuarioForm({ username: '', password: '', nombreCompleto: '', rol: 'DEPOSITO' });
        } else if (showZonaModal) {
          setShowZonaModal(false);
          setZonaForm({ nombre: '' });
          setZonaEditando(null);
        } else if (showVueltaModal) {
          setShowVueltaModal(false);
          setVueltaForm({ nombre: '' });
          setVueltaEditando(null);
        } else if (showChat) {
          setShowChat(false);
        } else if (mostrarSugerenciasZona) {
          setMostrarSugerenciasZona(false);
        } else if (mostrarSugerenciasVuelta) {
          setMostrarSugerenciasVuelta(false);
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
      if (showModal || showUsuarioModal || showTransportistaModal || showZonaModal || showVueltaModal) {
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

      const tabs = ['pedidos', 'realizados', 'transportistas', 'zonas', 'vueltas', 'usuarios', 'equipos'];
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

  const buscarTransportistas = async (busqueda) => {
    if (busqueda.trim().length === 0) {
      setTransportistaSugerencias([]);
      setMostrarSugerenciasTransportista(false);
      setIndiceTransportistaSeleccionada(-1);
      return;
    }
    try {
      const response = await transportistaService.buscar(busqueda);
      setTransportistaSugerencias(response.data || []);
      setMostrarSugerenciasTransportista(true);
      setIndiceTransportistaSeleccionada(-1);
    } catch (error) {
      console.error('Error al buscar transportes:', error);
      setTransportistaSugerencias([]);
      setIndiceTransportistaSeleccionada(-1);
    }
  };

  const handleTransportistaInputChange = (e) => {
    const valor = e.target.value;
    setFormData({ ...formData, transportistaNombre: valor });
    buscarTransportistas(valor);
    setIndiceTransportistaSeleccionada(-1);
  };

  const seleccionarTransportista = (transportista) => {
    setFormData({ 
      ...formData, 
      transportistaNombre: transportista.nombre
    });
    setTransportistaSugerencias([]);
    setMostrarSugerenciasTransportista(false);
    setIndiceTransportistaSeleccionada(-1);
  };

  const buscarZonas = async (busqueda) => {
    if (busqueda.trim().length === 0) {
      setZonaSugerencias([]);
      setMostrarSugerenciasZona(false);
      setIndiceZonaSeleccionada(-1);
      return;
    }
    try {
      const response = await zonaService.buscar(busqueda);
      setZonaSugerencias(response.data || []);
      setMostrarSugerenciasZona(true);
      setIndiceZonaSeleccionada(-1); // Resetear índice al buscar
    } catch (error) {
      console.error('Error al buscar zonas:', error);
      setZonaSugerencias([]);
      setIndiceZonaSeleccionada(-1);
    }
  };

  const handleZonaInputChange = (e) => {
    const valor = e.target.value;
    setFormData({ ...formData, zonaNombre: valor });
    buscarZonas(valor);
    setIndiceZonaSeleccionada(-1); // Resetear índice al escribir
  };

  const seleccionarZona = (zonaNombre) => {
    setFormData({ ...formData, zonaNombre });
    setZonaSugerencias([]);
    setMostrarSugerenciasZona(false);
    setIndiceZonaSeleccionada(-1);
  };

  const buscarVueltas = async (busqueda) => {
    if (busqueda.trim().length === 0) {
      setVueltaSugerencias([]);
      setMostrarSugerenciasVuelta(false);
      setIndiceVueltaSeleccionada(-1);
      return;
    }
    try {
      const response = await vueltaService.buscar(busqueda);
      setVueltaSugerencias(response.data || []);
      setMostrarSugerenciasVuelta(true);
      setIndiceVueltaSeleccionada(-1); // Resetear índice al buscar
    } catch (error) {
      console.error('Error al buscar vueltas:', error);
      setVueltaSugerencias([]);
      setIndiceVueltaSeleccionada(-1);
    }
  };

  const handleVueltaInputChange = (e) => {
    const valor = e.target.value;
    setFormData({ ...formData, vueltaNombre: valor });
    buscarVueltas(valor);
    setIndiceVueltaSeleccionada(-1); // Resetear índice al escribir
  };

  const seleccionarVuelta = (vueltaNombre) => {
    setFormData({ ...formData, vueltaNombre });
    setVueltaSugerencias([]);
    setMostrarSugerenciasVuelta(false);
    setIndiceVueltaSeleccionada(-1);
  };

  const handleCrearPedido = async (e) => {
    e.preventDefault();
    try {
      // Validar que la cantidad esté presente
      if (!formData.cantidad || formData.cantidad.trim() === '' || parseInt(formData.cantidad) <= 0) {
        alert('La cantidad es obligatoria y debe ser mayor a 0');
        cantidadRef.current?.focus();
        return;
      }

      // Validar que la vuelta esté presente
      if (!formData.vueltaNombre || formData.vueltaNombre.trim() === '') {
        alert('La vuelta es obligatoria');
        vueltaRef.current?.focus();
        return;
      }

      // Validar que el transporte esté presente
      if (!formData.transportistaNombre || formData.transportistaNombre.trim() === '') {
        alert('El transporte es obligatorio');
        transportistaRef.current?.focus();
        return;
      }

      // Convertir cantidad a número si existe y limpiar vueltaNombre
      const dataToSend = {
        numeroPlanilla: formData.numeroPlanilla,
        transportistaNombre: formData.transportistaNombre.trim(),
        zonaNombre: formData.zonaNombre && formData.zonaNombre.trim() !== '' ? formData.zonaNombre.trim() : null,
        cantidad: parseInt(formData.cantidad),
        vueltaNombre: formData.vueltaNombre.trim(),
        prioridad: formData.prioridad
      };
      console.log('Datos a enviar:', dataToSend);
      await pedidoService.crear(dataToSend);
      setShowModal(false);
      setFormData({ numeroPlanilla: '', transportistaNombre: '', zonaNombre: '', cantidad: '', vueltaNombre: '', prioridad: 'NORMAL' });
      setZonaSugerencias([]);
      setMostrarSugerenciasZona(false);
      setTransportistaSugerencias([]);
      setMostrarSugerenciasTransportista(false);
      cargarPedidos();
      // Recargar zonas y vueltas por si se crearon nuevas
      cargarZonas();
      cargarVueltas();
    } catch (error) {
      alert(error.response?.data || 'Error al crear pedido');
    }
  };

  const handleCrearTransportista = async (e) => {
    e.preventDefault();
    try {
      if (transportistaEditando) {
        await transportistaService.actualizar(transportistaEditando.id, transportistaForm.nombre, null);
        alert('Transporte actualizado exitosamente');
      } else {
        await transportistaService.crear(transportistaForm.nombre);
        alert('Transporte creado exitosamente');
      }
      setShowTransportistaModal(false);
      setTransportistaForm({ nombre: '' });
      setTransportistaEditando(null);
      cargarTransportistas();
    } catch (error) {
      alert(error.response?.data || 'Error al guardar transporte');
    }
  };

  const handleCrearZona = async (e) => {
    e.preventDefault();
    try {
      await zonaService.crearObtener(zonaForm.nombre.trim());
      setShowZonaModal(false);
      setZonaForm({ nombre: '' });
      setZonaEditando(null);
      cargarZonas();
      alert('Zona creada exitosamente');
    } catch (error) {
      alert(error.response?.data || 'Error al crear zona');
    }
  };

  const handleEditarZona = async (e) => {
    e.preventDefault();
    try {
      await zonaService.actualizar(zonaEditando.id, zonaForm.nombre.trim(), null);
      setShowZonaModal(false);
      setZonaForm({ nombre: '' });
      setZonaEditando(null);
      cargarZonas();
      alert('Zona actualizada exitosamente');
    } catch (error) {
      alert(error.response?.data || 'Error al actualizar zona');
    }
  };

  const handleCrearVuelta = async (e) => {
    e.preventDefault();
    try {
      await vueltaService.crearObtener(vueltaForm.nombre.trim());
      setShowVueltaModal(false);
      setVueltaForm({ nombre: '' });
      setVueltaEditando(null);
      cargarVueltas();
      alert('Vuelta creada exitosamente');
    } catch (error) {
      alert(error.response?.data || 'Error al crear vuelta');
    }
  };

  const handleEditarVuelta = async (e) => {
    e.preventDefault();
    try {
      await vueltaService.actualizar(vueltaEditando.id, vueltaForm.nombre.trim(), null);
      setShowVueltaModal(false);
      setVueltaForm({ nombre: '' });
      setVueltaEditando(null);
      cargarVueltas();
      alert('Vuelta actualizada exitosamente');
    } catch (error) {
      alert(error.response?.data || 'Error al actualizar vuelta');
    }
  };

  const abrirModalEditarZona = (zona) => {
    setZonaEditando(zona);
    setZonaForm({ nombre: zona.nombre });
    setShowZonaModal(true);
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
        return '#2196F3'; // Azul para Control
      } else if (pedido.etapaPreparacion === 'PENDIENTE_CARGA') {
        return '#FF9800'; // Naranja para Pendiente de Carga
      }
      return '#2196F3';
    } else if (pedido.estado === 'PENDIENTE') {
      return '#9E9E9E'; // Gris para Pendiente (diferente de Pendiente de Carga)
    }
    return '#666';
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

  // Usar useMemo para estabilizar pedidosAgrupadosPorDia
  const pedidosAgrupadosPorDia = useMemo(() => getPedidosAgrupadosPorDia(), [activeTab, pedidos, textoBusqueda]);
  const pedidosPorDia = useMemo(() => getPedidosPorDia(), [activeTab, pedidos]);

  // Limpiar días expandidos cuando se cambia de pestaña (todos los días cerrados por defecto)
  // O expandir automáticamente cuando hay búsqueda activa
  useEffect(() => {
    if (activeTab === 'realizados' && pedidosAgrupadosPorDia && pedidosAgrupadosPorDia.length > 0) {
      if (textoBusqueda.trim()) {
        // Si hay búsqueda activa, expandir todos los días que tienen resultados
        setDiasExpandidos(new Set(pedidosAgrupadosPorDia.map(dia => dia.fecha)));
      } else {
        // Si no hay búsqueda, mantener el comportamiento original
        // (no expandir automáticamente, solo si el usuario lo hace manualmente)
      }
    } else if (activeTab !== 'realizados') {
      // Limpiar días expandidos cuando se cambia de pestaña
      setDiasExpandidos(new Set());
      // Resetear el flag cuando se cambia de pestaña
      hoyColapsadoManualmente.current = false;
      // Limpiar búsqueda al cambiar de pestaña
      setTextoBusqueda('');
    }
  }, [activeTab, pedidosAgrupadosPorDia, textoBusqueda]);

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
          Transportes
        </button>
        <button
          className={activeTab === 'zonas' ? 'active' : ''}
          onClick={() => setActiveTab('zonas')}
        >
          Zonas
        </button>
        <button
          className={activeTab === 'vueltas' ? 'active' : ''}
          onClick={() => setActiveTab('vueltas')}
        >
          Vueltas
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
          {/* Buscador avanzado y filtros para Pedidos */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '15px',
            padding: '20px 40px',
            margin: '0 20px 25px 20px',
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)'
          }}>
            {/* Botones de filtro */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap'
            }}>
              {['TODOS', 'PENDIENTE', 'EN_PREPARACION', 'CONTROLADO', 'PENDIENTE_CARGA'].map((filtro) => (
                <button
                  key={filtro}
                  onClick={() => setFiltroPedidos(filtro)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: filtroPedidos === filtro ? '#2196F3' : '#f3f4f6',
                    color: filtroPedidos === filtro ? 'white' : '#666',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: filtroPedidos === filtro ? '600' : '500',
                    transition: 'all 0.2s',
                    boxShadow: filtroPedidos === filtro ? '0 2px 4px rgba(33, 150, 243, 0.3)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (filtroPedidos !== filtro) {
                      e.target.style.backgroundColor = '#e5e7eb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (filtroPedidos !== filtro) {
                      e.target.style.backgroundColor = '#f3f4f6';
                    }
                  }}
                >
                  {filtro === 'TODOS' ? 'Todos' :
                   filtro === 'PENDIENTE' ? 'Pendientes' :
                   filtro === 'EN_PREPARACION' ? 'En Preparación' :
                   filtro === 'CONTROLADO' ? 'Controlados' :
                   'Pendiente de Carga'}
                </button>
              ))}
            </div>
            {/* Buscador y botón Nuevo Pedido */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '20px'
            }}>
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
                    e.target.style.borderColor = '#2196F3';
                    e.target.style.boxShadow = '0 0 0 3px rgba(33, 150, 243, 0.1)';
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
            <button
              onClick={() => setShowModal(true)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                  borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                  fontWeight: '600',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#1976D2';
                  e.target.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#2196F3';
                  e.target.style.transform = 'translateY(0)';
                }}
            >
              + Nuevo Pedido
            </button>
            </div>
          </div>
          <div className="pedidos-grid">
            {pedidos.filter(pedido => {
              if (pedido.estado === 'REALIZADO') return false;
              
              // Aplicar filtro de estado
              if (filtroPedidos !== 'TODOS') {
                if (filtroPedidos === 'PENDIENTE' && pedido.estado !== 'PENDIENTE') {
                  return false;
                } else if (filtroPedidos === 'EN_PREPARACION') {
                  if (pedido.estado !== 'EN_PREPARACION' || pedido.etapaPreparacion) {
                    return false;
                  }
                } else if (filtroPedidos === 'CONTROLADO') {
                  if (pedido.estado !== 'EN_PREPARACION' || pedido.etapaPreparacion !== 'CONTROL') {
                    return false;
                  }
                } else if (filtroPedidos === 'PENDIENTE_CARGA') {
                  if (pedido.estado !== 'EN_PREPARACION' || pedido.etapaPreparacion !== 'PENDIENTE_CARGA') {
                    return false;
                  }
                }
              }
              
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
            }).map((pedido) => (
              <div key={pedido.id} className="pedido-card admin-pedido-card">
                <div className="pedido-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.5rem',
                      color: 'white',
                      fontWeight: '700',
                      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                    }}>
                      📦
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '700', color: '#1e293b' }}>
                        Planilla #{pedido.numeroPlanilla}
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
                
                {pedido.estado === 'PENDIENTE' && (
                  <div className="pedido-actions">
                    <button
                      className="btn-danger"
                      onClick={() => handleEliminarPedido(pedido.id)}
                    >
                      🗑️ Eliminar
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
          {/* Buscador avanzado para Realizados */}
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
                  e.target.style.borderColor = '#2196F3';
                  e.target.style.boxShadow = '0 0 0 3px rgba(33, 150, 243, 0.1)';
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
                      {dia.pedidos.filter(pedido => {
                        // Aplicar filtro de búsqueda si existe (aunque ya está filtrado en getPedidosAgrupadosPorDia, 
                        // lo aplicamos aquí también para asegurar consistencia)
                        if (textoBusqueda.trim()) {
                          const busqueda = textoBusqueda.toLowerCase().trim();
                          const matchPlanilla = pedido.numeroPlanilla?.toLowerCase().includes(busqueda);
                          const matchTransporte = (pedido.transportistaNombre || pedido.transportista || '').toLowerCase().includes(busqueda);
                          const matchZona = (pedido.zonaNombre || '').toLowerCase().includes(busqueda);
                          const matchVuelta = (pedido.vueltaNombre || '').toLowerCase().includes(busqueda);
                          return matchPlanilla || matchTransporte || matchZona || matchVuelta;
                        }
                        return true;
                      }).map((pedido) => (
                        <div key={pedido.id} className="pedido-card admin-pedido-card">
                          <div className="pedido-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '12px',
                                background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.5rem',
                                color: 'white',
                                fontWeight: '700',
                                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                              }}>
                                📦
                              </div>
                              <div>
                                <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '700', color: '#1e293b' }}>
                                  Planilla #{pedido.numeroPlanilla}
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
                            
                            {pedido.fechaActualizacion && (
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
              <h2 style={{ margin: 0, color: '#333' }}>Transportes</h2>
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
                  <th>Transporte</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {transportistas.map((transportista) => (
                  <tr key={transportista.id}>
                    <td>{transportista.nombre}</td>
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
                      <button
                        className="btn-secondary"
                        style={{ marginRight: '8px', backgroundColor: '#4CAF50', color: 'white' }}
                        onClick={() => {
                          setTransportistaEditando(transportista);
                          setTransportistaForm({ nombre: transportista.nombre });
                          setShowTransportistaModal(true);
                        }}
                      >
                        Editar
                      </button>
                      {transportista.activo ? (
                        <button
                          className="btn-danger"
                          onClick={async () => {
                            if (window.confirm('¿Estás seguro de que deseas desactivar este transporte?\n\nEl transporte se desactivará y no aparecerá como opción al crear pedidos, pero se mantendrá en el sistema para conservar los registros históricos.')) {
                              try {
                                await transportistaService.actualizar(transportista.id, null, false);
                                cargarTransportistas();
                                alert('Transporte desactivado exitosamente');
                              } catch (error) {
                                alert(error.response?.data || 'Error al desactivar transporte');
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
                            if (window.confirm('¿Estás seguro de que deseas activar este transporte?\n\nEl transporte volverá a aparecer como opción al crear pedidos.')) {
                              try {
                                await transportistaService.actualizar(transportista.id, null, true);
                                cargarTransportistas();
                                alert('Transporte activado exitosamente');
                              } catch (error) {
                                alert(error.response?.data || 'Error al activar transporte');
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

      {activeTab === 'zonas' && (
        <div className="content-section">
          <div className="table-container">
            <div className="section-header" style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #e0e0e0' }}>
              <h2 style={{ margin: 0, color: '#333' }}>Zonas</h2>
              <button
                onClick={() => setShowZonaModal(true)}
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
                + Nueva Zona
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {zonas.length === 0 ? (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', padding: '20px' }}>
                      No hay zonas registradas
                    </td>
                  </tr>
                ) : (
                  zonas.map((zona) => (
                    <tr key={zona.id}>
                      <td>{zona.nombre}</td>
                      <td>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '0.85em',
                          fontWeight: 'bold',
                          backgroundColor: zona.activo ? '#E8F5E9' : '#FFEBEE',
                          color: zona.activo ? '#2E7D32' : '#C62828'
                        }}>
                          {zona.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            className="btn-secondary"
                            style={{ 
                              backgroundColor: '#2196F3', 
                              color: 'white',
                              padding: '6px 12px',
                              fontSize: '13px',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: 'bold'
                            }}
                            onClick={() => abrirModalEditarZona(zona)}
                            onMouseEnter={(e) => e.target.style.backgroundColor = '#1976D2'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = '#2196F3'}
                          >
                            Editar
                          </button>
                          {zona.activo ? (
                            <button
                              className="btn-danger"
                              onClick={async () => {
                                if (window.confirm('¿Estás seguro de que deseas desactivar esta zona?\n\nLa zona se desactivará y no aparecerá como opción al crear pedidos, pero se mantendrá en el sistema para conservar los registros históricos.')) {
                                  try {
                                    await zonaService.actualizar(zona.id, null, false);
                                    cargarZonas();
                                    alert('Zona desactivada exitosamente');
                                  } catch (error) {
                                    alert(error.response?.data || 'Error al desactivar zona');
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
                                if (window.confirm('¿Estás seguro de que deseas activar esta zona?\n\nLa zona volverá a aparecer como opción al crear pedidos.')) {
                                  try {
                                    await zonaService.actualizar(zona.id, null, true);
                                    cargarZonas();
                                    alert('Zona activada exitosamente');
                                  } catch (error) {
                                    alert(error.response?.data || 'Error al activar zona');
                                  }
                                }
                              }}
                            >
                              Activar
                            </button>
                          )}
                        </div>
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

      {activeTab === 'vueltas' && (
        <div className="content-section">
          <div className="table-container">
            <div className="section-header" style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #e0e0e0' }}>
              <h2 style={{ margin: 0, color: '#333' }}>Vueltas</h2>
              <button
                onClick={() => {
                  setVueltaForm({ nombre: '' });
                  setVueltaEditando(null);
                  setShowVueltaModal(true);
                }}
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
                + Nueva Vuelta
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {vueltas.length === 0 ? (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', padding: '20px' }}>
                      No hay vueltas registradas
                    </td>
                  </tr>
                ) : (
                  vueltas.map((vuelta) => (
                    <tr key={vuelta.id}>
                      <td>{vuelta.nombre}</td>
                      <td>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '0.85em',
                          fontWeight: 'bold',
                          backgroundColor: vuelta.activo ? '#E8F5E9' : '#FFEBEE',
                          color: vuelta.activo ? '#2E7D32' : '#C62828'
                        }}>
                          {vuelta.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            className="btn-secondary"
                            style={{ 
                              backgroundColor: '#2196F3', 
                              color: 'white',
                              padding: '6px 12px',
                              fontSize: '13px',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: 'bold'
                            }}
                            onClick={() => {
                              setVueltaEditando(vuelta);
                              setVueltaForm({ nombre: vuelta.nombre });
                              setShowVueltaModal(true);
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = '#1976D2'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = '#2196F3'}
                          >
                            Editar
                          </button>
                          {vuelta.activo ? (
                            <button
                              className="btn-danger"
                              onClick={async () => {
                                if (window.confirm('¿Estás seguro de que deseas desactivar esta vuelta?\n\nLa vuelta se desactivará y no aparecerá como opción al crear pedidos, pero se mantendrá en el sistema para conservar los registros históricos.')) {
                                  try {
                                    await vueltaService.actualizar(vuelta.id, null, false);
                                    cargarVueltas();
                                    alert('Vuelta desactivada exitosamente');
                                  } catch (error) {
                                    alert(error.response?.data || 'Error al desactivar vuelta');
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
                                if (window.confirm('¿Estás seguro de que deseas activar esta vuelta?\n\nLa vuelta volverá a aparecer como opción al crear pedidos.')) {
                                  try {
                                    await vueltaService.actualizar(vuelta.id, null, true);
                                    cargarVueltas();
                                    alert('Vuelta activada exitosamente');
                                  } catch (error) {
                                    alert(error.response?.data || 'Error al activar vuelta');
                                  }
                                }
                              }}
                            >
                              Activar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => {
          setShowModal(false);
          setFormData({ numeroPlanilla: '', transportistaNombre: '', zonaNombre: '', cantidad: '', vueltaNombre: '', prioridad: 'NORMAL' });
          setZonaSugerencias([]);
          setMostrarSugerenciasZona(false);
          setTransportistaSugerencias([]);
          setMostrarSugerenciasTransportista(false);
        }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ 
            maxWidth: '700px', 
            maxHeight: '90vh', 
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
              color: 'white',
              padding: '24px 30px',
              borderRadius: '10px 10px 0 0',
              margin: '-30px -30px 25px -30px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px'
              }}>
                📦
              </div>
              <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600', flex: 1 }}>Nuevo Pedido</h3>
            </div>
            <div style={{ 
              overflowY: 'auto', 
              overflowX: 'hidden',
              flex: 1,
              paddingRight: '10px',
              marginRight: '-10px'
            }}>
            <form onSubmit={handleCrearPedido}>
              {/* Sección: Información Básica */}
              <div style={{
                marginBottom: '24px',
                paddingBottom: '20px',
                borderBottom: '2px solid #f0f0f0'
              }}>
                <div style={{
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  color: '#666',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ width: '3px', height: '16px', background: '#2563eb', borderRadius: '2px' }}></span>
                  Información Básica
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ 
                      display: 'block',
                      marginBottom: '8px',
                      color: '#333',
                      fontWeight: '600',
                      fontSize: '0.95rem'
                    }}>
                      Número de Planilla <span style={{ color: '#ef4444' }}>*</span>
                    </label>
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
                          cantidadRef.current?.focus();
                        }
                      }}
                      required
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '1rem',
                        boxSizing: 'border-box',
                        transition: 'all 0.2s',
                        background: '#fff'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#2563eb';
                        e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ 
                      display: 'block',
                      marginBottom: '8px',
                      color: '#333',
                      fontWeight: '600',
                      fontSize: '0.95rem'
                    }}>
                      Cantidad <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      ref={cantidadRef}
                      type="number"
                      min="1"
                      value={formData.cantidad}
                      onChange={(e) => setFormData({ ...formData, cantidad: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      transportistaRef.current?.focus();
                    }
                  }}
                      placeholder="Ej: 10, 25..."
                  required
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '1rem',
                        boxSizing: 'border-box',
                        transition: 'all 0.2s',
                        background: '#fff'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#2563eb';
                        e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                />
              </div>
                </div>
              </div>
              {/* Sección: Información de Envío */}
              <div style={{
                marginBottom: '24px',
                paddingBottom: '20px',
                borderBottom: '2px solid #f0f0f0'
              }}>
                <div style={{
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  color: '#666',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ width: '3px', height: '16px', background: '#2563eb', borderRadius: '2px' }}></span>
                  Información de Envío
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group" style={{ position: 'relative', marginBottom: 0 }}>
                    <label style={{ 
                      display: 'block',
                      marginBottom: '8px',
                      color: '#333',
                      fontWeight: '600',
                      fontSize: '0.95rem'
                    }}>
                      Transporte <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                  <input
                  ref={transportistaRef}
                    type="text"
                    value={formData.transportistaNombre || ''}
                    onChange={handleTransportistaInputChange}
                  onKeyDown={(e) => {
                    if (mostrarSugerenciasTransportista && transportistaSugerencias.length > 0) {
                      if (e.key === 'ArrowDown') {
                      e.preventDefault();
                        const nuevoIndice = indiceTransportistaSeleccionada < transportistaSugerencias.length - 1 
                          ? indiceTransportistaSeleccionada + 1 
                          : 0;
                        setIndiceTransportistaSeleccionada(nuevoIndice);
                        setTimeout(() => {
                          const elemento = document.querySelector(`[data-transportista-index="${nuevoIndice}"]`);
                          if (elemento && transportistaSugerenciasRef.current) {
                            elemento.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                          }
                        }, 0);
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        const nuevoIndice = indiceTransportistaSeleccionada > 0 
                          ? indiceTransportistaSeleccionada - 1 
                          : transportistaSugerencias.length - 1;
                        setIndiceTransportistaSeleccionada(nuevoIndice);
                        setTimeout(() => {
                          const elemento = document.querySelector(`[data-transportista-index="${nuevoIndice}"]`);
                          if (elemento && transportistaSugerenciasRef.current) {
                            elemento.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                          }
                        }, 0);
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (indiceTransportistaSeleccionada >= 0 && indiceTransportistaSeleccionada < transportistaSugerencias.length) {
                          seleccionarTransportista(transportistaSugerencias[indiceTransportistaSeleccionada]);
                        } else if (transportistaSugerencias.length > 0) {
                          seleccionarTransportista(transportistaSugerencias[0]);
                        }
                        zonaRef.current?.focus();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setMostrarSugerenciasTransportista(false);
                        setIndiceTransportistaSeleccionada(-1);
                      }
                    } else if (e.key === 'Enter' && !mostrarSugerenciasTransportista) {
                      e.preventDefault();
                      if (formData.transportistaNombre && formData.transportistaNombre.trim() !== '') {
                        zonaRef.current?.focus();
                      }
                    }
                  }}
                  onFocus={() => {
                    if (formData.transportistaNombre) {
                      buscarTransportistas(formData.transportistaNombre);
                    } else if (transportistas.filter(t => t.activo).length === 0) {
                      setShowTransportistaTooltip(true);
                    }
                    setIndiceTransportistaSeleccionada(-1);
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      setMostrarSugerenciasTransportista(false);
                      setIndiceTransportistaSeleccionada(-1);
                      setShowTransportistaTooltip(false);
                    }, 200);
                  }}
                  onMouseEnter={() => {
                    const transportistasActivos = transportistas.filter(t => t.activo);
                    if (transportistasActivos.length === 0) {
                      setShowTransportistaTooltip(true);
                    }
                  }}
                  onMouseLeave={() => setShowTransportistaTooltip(false)}
                    placeholder="Escribir transporte (se guardará automáticamente)"
                  required
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                      transition: 'all 0.2s',
                      background: '#fff'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#2563eb';
                      e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                {mostrarSugerenciasTransportista && transportistaSugerencias.length > 0 && (
                  <div 
                    ref={transportistaSugerenciasRef}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: 'white',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 1000,
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                      marginTop: '6px'
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {transportistaSugerencias.map((transportista, index) => (
                      <div
                        key={transportista.id}
                        data-transportista-index={index}
                        onClick={() => seleccionarTransportista(transportista)}
                        onMouseEnter={() => setIndiceTransportistaSeleccionada(index)}
                        style={{
                          padding: '12px 16px',
                          cursor: 'pointer',
                          borderBottom: index === transportistaSugerencias.length - 1 ? 'none' : '1px solid #f3f4f6',
                          transition: 'all 0.15s ease',
                          backgroundColor: index === indiceTransportistaSeleccionada ? '#2563eb' : 'white',
                          color: index === indiceTransportistaSeleccionada ? 'white' : '#333',
                          fontWeight: index === indiceTransportistaSeleccionada ? '600' : '500',
                          borderRadius: index === 0 ? '6px 6px 0 0' : index === transportistaSugerencias.length - 1 ? '0 0 6px 6px' : '0'
                        }}
                      >
                        {transportista.nombre}
                      </div>
                    ))}
                  </div>
                )}
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
                    zIndex: 1001,
                    maxWidth: '300px',
                    lineHeight: '1.5',
                    animation: 'fadeIn 0.3s ease-in'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                      ℹ️ No hay transportes registrados
                    </div>
                    <div>
                      Para crear un pedido, primero debes ir a la sección <strong>"Transportistas"</strong> y crear al menos un transporte.
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
                  <div className="form-group" style={{ marginBottom: 0, position: 'relative' }}>
                    <label style={{ 
                      display: 'block',
                      marginBottom: '8px',
                      color: '#333',
                      fontWeight: '600',
                      fontSize: '0.95rem'
                    }}>
                      Zona
                    </label>
                    <input
                      ref={zonaRef}
                      type="text"
                      value={formData.zonaNombre}
                      onChange={handleZonaInputChange}
                    onKeyDown={(e) => {
                      if (mostrarSugerenciasZona && zonaSugerencias.length > 0) {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          const nuevoIndice = indiceZonaSeleccionada < zonaSugerencias.length - 1 
                            ? indiceZonaSeleccionada + 1 
                            : 0;
                          setIndiceZonaSeleccionada(nuevoIndice);
                          // Scroll automático para mantener visible la opción seleccionada
                          setTimeout(() => {
                            const elemento = document.querySelector(`[data-zona-index="${nuevoIndice}"]`);
                            if (elemento && zonaSugerenciasRef.current) {
                              elemento.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                            }
                          }, 0);
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          const nuevoIndice = indiceZonaSeleccionada > 0 
                            ? indiceZonaSeleccionada - 1 
                            : zonaSugerencias.length - 1;
                          setIndiceZonaSeleccionada(nuevoIndice);
                          // Scroll automático para mantener visible la opción seleccionada
                          setTimeout(() => {
                            const elemento = document.querySelector(`[data-zona-index="${nuevoIndice}"]`);
                            if (elemento && zonaSugerenciasRef.current) {
                              elemento.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                            }
                          }, 0);
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          if (indiceZonaSeleccionada >= 0 && indiceZonaSeleccionada < zonaSugerencias.length) {
                            seleccionarZona(zonaSugerencias[indiceZonaSeleccionada].nombre);
                          } else if (zonaSugerencias.length > 0) {
                            seleccionarZona(zonaSugerencias[0].nombre);
                          }
                          setTimeout(() => {
                            vueltaRef.current?.focus();
                          }, 100);
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          setMostrarSugerenciasZona(false);
                          setIndiceZonaSeleccionada(-1);
                        }
                      } else if (e.key === 'Enter' && !mostrarSugerenciasZona) {
                        e.preventDefault();
                        vueltaRef.current?.focus();
                      }
                    }}
                    onFocus={() => {
                      if (formData.zonaNombre) {
                        buscarZonas(formData.zonaNombre);
                      }
                      setIndiceZonaSeleccionada(-1); // Resetear índice al enfocar
                    }}
                    onBlur={() => {
                      // Delay para permitir click en sugerencias
                      setTimeout(() => {
                        setMostrarSugerenciasZona(false);
                        setIndiceZonaSeleccionada(-1);
                      }, 200);
                    }}
                      placeholder="Escribir zona (se guardará automáticamente)"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '1rem',
                        boxSizing: 'border-box',
                        transition: 'all 0.2s',
                        background: '#fff'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#2563eb';
                        e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                    {mostrarSugerenciasZona && zonaSugerencias.length > 0 && (
                      <div 
                        ref={zonaSugerenciasRef}
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          backgroundColor: 'white',
                          border: '2px solid #e5e7eb',
                          borderRadius: '8px',
                          maxHeight: '200px',
                          overflowY: 'auto',
                          zIndex: 1000,
                          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                          marginTop: '6px'
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        {zonaSugerencias.map((zona, index) => (
                          <div
                            key={zona.id}
                            data-zona-index={index}
                            onClick={() => seleccionarZona(zona.nombre)}
                            onMouseEnter={() => setIndiceZonaSeleccionada(index)}
                            style={{
                              padding: '12px 16px',
                              cursor: 'pointer',
                              borderBottom: index === zonaSugerencias.length - 1 ? 'none' : '1px solid #f3f4f6',
                              transition: 'all 0.15s ease',
                              backgroundColor: index === indiceZonaSeleccionada ? '#2563eb' : 'white',
                              color: index === indiceZonaSeleccionada ? 'white' : '#333',
                              fontWeight: index === indiceZonaSeleccionada ? '600' : '500',
                              borderRadius: index === 0 ? '6px 6px 0 0' : index === zonaSugerencias.length - 1 ? '0 0 6px 6px' : '0'
                            }}
                            onMouseLeave={() => {
                              // No resetear el índice al salir del mouse si hay una selección activa
                            }}
                          >
                            {zona.nombre}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0, position: 'relative' }}>
                    <label style={{ 
                      display: 'block',
                      marginBottom: '8px',
                      color: '#333',
                      fontWeight: '600',
                      fontSize: '0.95rem'
                    }}>
                      Vuelta <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      ref={vueltaRef}
                      value={formData.vueltaNombre || ''}
                      onChange={(e) => {
                        const vueltaSeleccionada = vueltas.find(v => v.nombre === e.target.value);
                        setFormData({ ...formData, vueltaNombre: e.target.value || '' });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          prioridadRef.current?.focus();
                        }
                      }}
                      required
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '1rem',
                        boxSizing: 'border-box',
                        transition: 'all 0.2s',
                        background: '#fff',
                        cursor: 'pointer'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#2563eb';
                        e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                    >
                    <option value="">Seleccionar vuelta...</option>
                    {vueltas
                      .filter(v => v.activo)
                      .map((vuelta) => (
                        <option key={vuelta.id} value={vuelta.nombre}>
                          {vuelta.nombre}
                        </option>
                        ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ 
                      display: 'block',
                      marginBottom: '8px',
                      color: '#333',
                      fontWeight: '600',
                      fontSize: '0.95rem'
                    }}>
                      Prioridad
                    </label>
                <select
                  ref={prioridadRef}
                  value={formData.prioridad}
                  onChange={(e) => setFormData({ ...formData, prioridad: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const submitButton = e.currentTarget.closest('form')?.querySelector('button[type="submit"]');
                      if (submitButton) {
                        submitButton.click();
                      }
                    }
                  }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                      transition: 'all 0.2s',
                      background: '#fff',
                      cursor: 'pointer'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#2563eb';
                      e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    <option value="BAJA">🟢 Baja</option>
                    <option value="NORMAL">🟡 Normal</option>
                    <option value="ALTA">🟠 Alta</option>
                    <option value="URGENTE">🔴 Urgente</option>
                </select>
              </div>
                </div>
              </div>
              
              <div className="modal-actions" style={{
                flexShrink: 0,
                marginTop: '28px',
                paddingTop: '24px',
                borderTop: '2px solid #f0f0f0',
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end'
              }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setFormData({ numeroPlanilla: '', transportistaNombre: '', zonaNombre: '', cantidad: '', vueltaNombre: '', prioridad: 'NORMAL' });
                    setZonaSugerencias([]);
                    setMostrarSugerenciasZona(false);
                    setTransportistaSugerencias([]);
                    setMostrarSugerenciasTransportista(false);
                  }}
                  style={{
                    padding: '12px 24px',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.95rem',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#e5e7eb';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#f3f4f6';
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '12px 24px',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.95rem',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.3)';
                  }}
                >
                  ✓ Crear Pedido
                </button>
              </div>
            </form>
            </div>
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
        <div className="modal-overlay" onClick={() => {
          setShowTransportistaModal(false);
          setTransportistaForm({ nombre: '' });
          setTransportistaEditando(null);
        }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{transportistaEditando ? 'Editar Transporte' : 'Nuevo Transporte'}</h3>
            <form onSubmit={handleCrearTransportista}>
              <div className="form-group">
                <label>Nombre del Transporte</label>
                <input
                  ref={codigoInternoRef}
                  type="text"
                  value={transportistaForm.nombre}
                  onChange={(e) =>
                    setTransportistaForm({ ...transportistaForm, nombre: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
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
                  {transportistaEditando ? 'Actualizar' : 'Crear'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowTransportistaModal(false);
                    setTransportistaForm({ nombre: '' });
                    setTransportistaEditando(null);
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

      {showZonaModal && (
        <div className="modal-overlay" onClick={() => {
          setShowZonaModal(false);
          setZonaForm({ nombre: '' });
          setZonaEditando(null);
        }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{zonaEditando ? 'Editar Zona' : 'Nueva Zona'}</h3>
            <form onSubmit={zonaEditando ? handleEditarZona : handleCrearZona}>
              <div className="form-group">
                <label>Nombre de la Zona</label>
                <input
                  ref={zonaNombreRef}
                  type="text"
                  value={zonaForm.nombre}
                  onChange={(e) => setZonaForm({ nombre: e.target.value })}
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
                  placeholder="Ej: Zona Norte, Zona Sur..."
                />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn-primary">
                  {zonaEditando ? 'Guardar' : 'Crear'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowZonaModal(false);
                    setZonaForm({ nombre: '' });
                    setZonaEditando(null);
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

      {showVueltaModal && (
        <div className="modal-overlay" onClick={() => {
          setShowVueltaModal(false);
          setVueltaForm({ nombre: '' });
          setVueltaEditando(null);
        }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{vueltaEditando ? 'Editar Vuelta' : 'Nueva Vuelta'}</h3>
            <form onSubmit={vueltaEditando ? handleEditarVuelta : handleCrearVuelta}>
              <div className="form-group">
                <label>Nombre de la Vuelta</label>
                <input
                  ref={vueltaNombreRef}
                  type="text"
                  value={vueltaForm.nombre}
                  onChange={(e) => setVueltaForm({ nombre: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const submitButton = e.currentTarget.closest('form')?.querySelector('button[type="submit"]');
                      if (submitButton) {
                        submitButton.click();
                      }
                    }
                  }}
                  required
                  placeholder="Ej: Primera vuelta, Segunda vuelta, Sale sábado..."
                />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn-primary">
                  {vueltaEditando ? 'Guardar' : 'Crear'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowVueltaModal(false);
                    setVueltaForm({ nombre: '' });
                    setVueltaEditando(null);
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
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Transporte</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Zona</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Cantidad</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Vuelta</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidosResumen.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
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
                          {pedido.transportistaNombre || pedido.transportista || 'Sin transporte'}
                        </td>
                        <td style={{ padding: '12px', color: '#666' }}>
                          {pedido.zonaNombre || <span style={{ color: '#999', fontStyle: 'italic' }}>Sin zona</span>}
                        </td>
                        <td style={{ padding: '12px', color: '#666' }}>
                          {pedido.cantidad || <span style={{ color: '#999', fontStyle: 'italic' }}>-</span>}
                        </td>
                        <td style={{ padding: '12px', color: '#666' }}>
                          {pedido.vueltaNombre || <span style={{ color: '#999', fontStyle: 'italic' }}>Sin vuelta</span>}
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

