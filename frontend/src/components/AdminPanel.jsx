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
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import Chat from './Chat';
import './AdminPanel.css';

const AdminPanel = () => {
  const { user, logout } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [usuariosRolesAsignados, setUsuariosRolesAsignados] = useState([]); // Para PLANILLERO y CONTROL
  const [transportistas, setTransportistas] = useState([]);
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
    fechaEntrega: '', // Fecha de entrega (opcional, por defecto hoy)
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
  const fechaEntregaRef = useRef(null);
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
    rol: 'ADMIN_PRINCIPAL', // Valor por defecto
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
  // Estados para navegación en "Realizados"
  const [diaSeleccionadoIndex, setDiaSeleccionadoIndex] = useState(-1);
  const [enModoNavegacionDias, setEnModoNavegacionDias] = useState(false);
  const [enModoNavegacionRegistrosRealizados, setEnModoNavegacionRegistrosRealizados] = useState(false);
  const [pedidoSeleccionadoIndexRealizados, setPedidoSeleccionadoIndexRealizados] = useState(-1);
  // Refs para los botones de días en "Realizados"
  const diaButtonRefs = useRef([]);
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
  // Estados para la nueva vista de Planillas agrupadas por día
  const [todasLasPlanillas, setTodasLasPlanillas] = useState([]);
  const [diasExpandidosPlanillas, setDiasExpandidosPlanillas] = useState(new Set());
  const [showModalTransportistasVueltas, setShowModalTransportistasVueltas] = useState(false);
  const [transportistasVueltas, setTransportistasVueltas] = useState([]);
  const [loadingTransportistasVueltas, setLoadingTransportistasVueltas] = useState(false);
  const [fechasExpandidas, setFechasExpandidas] = useState(new Set());
  const [vistaPlanillas, setVistaPlanillas] = useState('hoy'); // 'hoy', 'todos', 'resumen'
  const [showModalDetalle, setShowModalDetalle] = useState(false);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  const [filtroEstadoPorDia, setFiltroEstadoPorDia] = useState(new Map()); // Mapa: fecha -> filtro seleccionado

  useEffect(() => {
    // Solo cargar datos si el usuario está autenticado
    if (!user) {
      return;
    }

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
          // Cargar todas las planillas para agruparlas por día
          Promise.all([
            pedidoService.obtenerTodos(),
            pedidoService.obtenerPlanillasDelDia()
          ]).then(([todasResponse, diaResponse]) => {
            setTodasLasPlanillas(todasResponse.data || []);
            setPedidos(diaResponse.data || []);
          }).catch(err => console.error('Error al recargar pedidos:', err));
        }
        
        // Actualizar todos los pedidos para el contador (IMPORTANTE: esto actualiza el indicador)
        // Hacer esto siempre, independientemente de la pestaña activa
        pedidoService.obtenerTodos().then(response => {
          setTodosLosPedidos(response.data || []);
          // Si estamos en la pestaña de pedidos, también actualizar todasLasPlanillas
          if (activeTab === 'pedidos') {
            setTodasLasPlanillas(response.data || []);
          }
        }).catch(err => console.error('Error al actualizar todos los pedidos:', err));
      }
    });

    return () => {
      disconnectWebSocket();
    };
  }, [activeTab, user]);

  // Cargar todos los pedidos para el contador, independiente de la pestaña activa
  useEffect(() => {
    // Solo cargar si el usuario está autenticado
    if (!user) {
      return;
    }

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
  }, [user]);

  const cargarDatos = async () => {
    // Cargar transportistas de forma independiente para no bloquear la carga de otros datos
    await Promise.all([cargarPedidos(), cargarUsuarios()]);
    // Cargar transportistas en paralelo pero no esperar si falla
    cargarTransportistas().catch(err => {
      console.warn('Error al cargar transportistas (puede ser normal si el backend no se reinició):', err);
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
        // Para "pedidos", cargar todas las planillas (del día y anteriores)
        // Usaremos el endpoint de planillas del día para el día actual
        const response = await pedidoService.obtenerPlanillasDelDia();
        const planillasDelDia = response.data || [];
        
        // También cargar todas las planillas para poder agruparlas por día
        const responseTodas = await pedidoService.obtenerTodos();
        setTodasLasPlanillas(responseTodas.data || []);
        
        // Para mantener compatibilidad, establecer los pedidos del día
        setPedidos(planillasDelDia);
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
          // Cargar todas las planillas para agruparlas por día
          const responseTodas = await pedidoService.obtenerTodos();
          setTodasLasPlanillas(responseTodas.data || []);
          // También cargar planillas del día para mantener compatibilidad
          const response = await pedidoService.obtenerPlanillasDelDia();
          setPedidos(response.data || []);
        }
      } catch (error) {
        console.error('Error al cargar pedidos:', error);
      }
    };

    // Limpiar pedidos inmediatamente al cambiar de pestaña para evitar mostrar datos incorrectos
    if (activeTab === 'pedidos' || activeTab === 'realizados') {
      setPedidos([]);
      setTextoBusqueda(''); // Limpiar búsqueda al cambiar de pestaña
      cargarSegunPestaña();
    } else if (activeTab === 'roles-asignados') {
      cargarUsuariosRolesAsignados();
    } else if (activeTab === 'zonas') {
      cargarZonas();
    } else if (activeTab === 'vueltas') {
      cargarVueltas();
    }
  }, [activeTab]);

  // Agregar listener para abrir modales con Enter cuando esté en la sección correspondiente
  useEffect(() => {
    const handleKeyPress = (event) => {
      // No navegar si hay un modal abierto
      if (showModal || showTransportistaModal || showUsuarioModal || showZonaModal || showVueltaModal) {
        return;
      }

      const focusedElement = document.activeElement;
      const isInputFocused = focusedElement && (
        focusedElement.tagName === 'INPUT' || 
        focusedElement.tagName === 'TEXTAREA' || 
        focusedElement.tagName === 'SELECT' ||
        focusedElement.isContentEditable
      );
      
      // Si estamos escribiendo en un input, NO hacer nada (permitir que el input maneje TODAS las teclas)
      if (isInputFocused) {
        return; // NO hacer preventDefault ni nada, solo retornar
      }
      
      // Solo procesar Enter si NO estamos en un input
      if (event.key === 'Enter') {
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

    window.addEventListener('keydown', handleKeyPress, false); // Usar bubble phase, no capture

    return () => {
      window.removeEventListener('keydown', handleKeyPress, false);
    };
  }, [activeTab, showModal, showTransportistaModal, showUsuarioModal, showZonaModal, showVueltaModal]);

  // Enfocar el primer campo cuando se abre el modal de pedidos y establecer fecha por defecto
  useEffect(() => {
    if (showModal) {
      // Establecer fecha de hoy por defecto si no hay fecha seleccionada
      if (!formData.fechaEntrega) {
        const hoy = new Date();
        const fechaHoy = hoy.toISOString().split('T')[0];
        setFormData(prev => ({ ...prev, fechaEntrega: fechaHoy }));
      }
      
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

  // Función para reproducir sonido de notificación
  const reproducirSonidoNotificacion = () => {
    try {
      // Crear un contexto de audio
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Crear un oscilador para generar el sonido
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      // Conectar el oscilador al nodo de ganancia y al destino
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Configurar el sonido (tono de notificación)
      oscillator.frequency.value = 800; // Frecuencia en Hz (tono medio-agudo)
      oscillator.type = 'sine'; // Tipo de onda (sinusoidal, suave)
      
      // Configurar el volumen (envelope)
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01); // Subir rápido
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2); // Bajar suavemente
      
      // Reproducir el sonido
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2); // Duración de 200ms
      
      // Limpiar después de que termine
      oscillator.onended = () => {
        audioContext.close();
      };
    } catch (error) {
      // Si hay algún error (por ejemplo, el usuario no ha interactuado con la página),
      // simplemente no reproducir el sonido
      console.warn('No se pudo reproducir el sonido de notificación:', error);
    }
  };

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
        // AdminPanel solo para ADMIN_PRINCIPAL
        const rolUsuario = user.rol.toLowerCase(); // Debería ser 'admin_principal'
        const topicNuevo = '/topic/mensajes/nuevo';
        const topicLeido = `/topic/mensajes/leido/${rolUsuario}`;
        const topicTodosLeidos = `/topic/mensajes/todos-leidos/${rolUsuario}`;

        // Suscribirse a mensajes nuevos
        client.subscribe(topicNuevo, (message) => {
          const nuevoMensaje = JSON.parse(message.body);
          // Solo actualizar si el mensaje es para nuestro rol (ADMIN_PRINCIPAL)
          if (nuevoMensaje.rolDestinatario === user.rol) {
            // Reproducir sonido solo si el chat está cerrado y el mensaje no es del propio usuario
            if (!showChat && String(nuevoMensaje.remitenteId) !== String(user?.id)) {
              reproducirSonidoNotificacion();
            }
            
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
  }, [user?.rol, showChat]);

  // Cerrar modal con ESC
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (showModal) {
          setShowModal(false);
          setFormData({ numeroPlanilla: '', transportistaNombre: '', zonaNombre: '', cantidad: '', vueltaNombre: '', fechaEntrega: '' });
        } else if (showTransportistaModal) {
          setShowTransportistaModal(false);
          setTransportistaForm({ codigoInterno: '', chofer: '', vehiculo: '' });
        } else if (showUsuarioModal) {
          setShowUsuarioModal(false);
          setUsuarioForm({ username: '', password: '', nombreCompleto: '', rol: 'ADMIN_PRINCIPAL' });
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
        } else if (showModalDetalle) {
          cerrarModalDetalle();
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
  }, [showModal, showTransportistaModal, showUsuarioModal, showZonaModal, showVueltaModal, showChat, showModalDetalle]);

  // Navegación con flechas izquierda/derecha entre pestañas
  useEffect(() => {
    const handleKeyDown = (event) => {
      // No navegar si hay un modal abierto o si estamos en un input/textarea/select
      if (showModal || showTransportistaModal || showUsuarioModal || showZonaModal || showVueltaModal || showChat || showModalDetalle || showResumenModal) {
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

      // Navegación con flechas izquierda/derecha entre pestañas
      const tabs = ['pedidos', 'transportistas', 'zonas', 'vueltas', 'usuarios', 'roles-asignados'];
      const currentIndex = tabs.indexOf(activeTab);

      if (event.key === 'ArrowLeft' && currentIndex > 0) {
        event.preventDefault();
        setActiveTab(tabs[currentIndex - 1]);
        // Enfocar el botón de la pestaña activa
        setTimeout(() => {
          const tabButton = document.querySelector(`.tabs button[class*="active"]`);
          if (tabButton) {
            tabButton.focus();
          }
        }, 100);
      } else if (event.key === 'ArrowRight' && currentIndex < tabs.length - 1) {
        event.preventDefault();
        setActiveTab(tabs[currentIndex + 1]);
        // Enfocar el botón de la pestaña activa
        setTimeout(() => {
          const tabButton = document.querySelector(`.tabs button[class*="active"]`);
          if (tabButton) {
            tabButton.focus();
          }
        }, 100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTab, showModal, showTransportistaModal, showUsuarioModal, showZonaModal, showVueltaModal, showChat, showModalDetalle, showResumenModal]);

  // Manejar flechas arriba/abajo en el campo de fecha de entrega
  useEffect(() => {
    if (!showModal) {
        return;
      }

    const handleKeyDown = (e) => {
      // Solo manejar si estamos en el modal y el input de fecha está enfocado
      if (!fechaEntregaRef.current || document.activeElement !== fechaEntregaRef.current) {
        return;
      }

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const fechaActual = formData.fechaEntrega || hoy.toISOString().split('T')[0];
        
        // Crear la fecha de forma más segura
        const fechaParts = fechaActual.split('-');
        const fecha = new Date(parseInt(fechaParts[0]), parseInt(fechaParts[1]) - 1, parseInt(fechaParts[2]));
        
        if (e.key === 'ArrowUp') {
          fecha.setDate(fecha.getDate() + 1);
        } else if (e.key === 'ArrowDown') {
          fecha.setDate(fecha.getDate() - 1);
          // Si la fecha resultante es anterior a hoy, usar hoy como mínimo
          if (fecha < hoy) {
            fecha.setTime(hoy.getTime());
          }
        }
        
        const year = fecha.getFullYear();
        const month = String(fecha.getMonth() + 1).padStart(2, '0');
        const day = String(fecha.getDate()).padStart(2, '0');
        const nuevaFecha = `${year}-${month}-${day}`;
        
        // Actualizar el estado
        setFormData(prev => ({ ...prev, fechaEntrega: nuevaFecha }));
        
        // También actualizar el valor del input directamente
        if (fechaEntregaRef.current) {
          fechaEntregaRef.current.value = nuevaFecha;
        }
        
        return false;
      }
    };

    // Usar capture: true para interceptar antes que el navegador procese el evento
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [showModal, formData.fechaEntrega]);

  // Navegación con flechas entre pestañas principales (solo si no estamos en modo navegación de sub-pestañas)
  useEffect(() => {
    const handleKeyDown = (event) => {
      // No navegar si hay un modal abierto
      if (showModal || showUsuarioModal || showTransportistaModal || showZonaModal || showVueltaModal || showResumenModal || showModalDetalle) {
        return;
      }

      const focusedElement = document.activeElement;
      const isInputFocused = focusedElement && (
        focusedElement.tagName === 'INPUT' || 
        focusedElement.tagName === 'TEXTAREA' || 
        focusedElement.tagName === 'SELECT' ||
        focusedElement.isContentEditable
      );

      // Si estamos escribiendo en un input, NO hacer nada (permitir que el input maneje TODAS las teclas)
      if (isInputFocused) {
        return; // NO hacer preventDefault ni nada, solo retornar
      }

      // No navegar si estamos en modo navegación de sub-pestañas o registros en "En Preparación"
      if (activeTab === 'en-preparacion' && (enModoNavegacionSubPestanas || enModoNavegacionRegistros)) {
        return;
      }
      // No navegar si estamos en modo navegación de días o registros en "Realizados"
      if (activeTab === 'realizados' && (enModoNavegacionDias || enModoNavegacionRegistrosRealizados)) {
          return;
        }

      const tabs = ['pedidos', 'realizados', 'transportistas', 'zonas', 'vueltas', 'usuarios', 'roles-asignados'];
      const currentIndex = tabs.indexOf(activeTab);

      // Navegación normal con flechas izquierda/derecha entre pestañas (solo si NO estamos en modo navegación de registros ni de sub-pestañas)
      if (!enModoNavegacionSubPestanas && !enModoNavegacionRegistros && !enModoNavegacionDias && !enModoNavegacionRegistrosRealizados && !isInputFocused) {
      if (event.key === 'ArrowLeft' && currentIndex > 0) {
          event.preventDefault();
        setActiveTab(tabs[currentIndex - 1]);
      } else if (event.key === 'ArrowRight' && currentIndex < tabs.length - 1) {
          event.preventDefault();
        setActiveTab(tabs[currentIndex + 1]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTab, showModal, showUsuarioModal, showTransportistaModal, showZonaModal, showVueltaModal, showResumenModal, showModalDetalle, enModoNavegacionDias, enModoNavegacionRegistrosRealizados]);

  const cargarUsuarios = async () => {
    try {
      const response = await usuarioService.obtenerTodos();
      // Filtrar solo ADMIN_PRINCIPAL y ADMIN_DEPOSITO para la pestaña Administradores
      const usuariosFiltrados = response.data.filter(u => 
        u.rol?.nombre === 'ADMIN_PRINCIPAL' || u.rol?.nombre === 'ADMIN_DEPOSITO'
      );
      setUsuarios(usuariosFiltrados);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
    }
  };

  const cargarUsuariosRolesAsignados = async () => {
    try {
      // Cargar usuarios PLANILLERO y CONTROL
      const [planillerosResponse, controlResponse] = await Promise.all([
        usuarioService.obtenerPorRol('PLANILLERO'),
        usuarioService.obtenerPorRol('CONTROL')
      ]);
      const planilleros = planillerosResponse.data || [];
      const control = controlResponse.data || [];
      setUsuariosRolesAsignados([...planilleros, ...control]);
    } catch (error) {
      console.error('Error al cargar usuarios de roles asignados:', error);
      setUsuariosRolesAsignados([]);
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
      // Si no hay fecha seleccionada, usar la fecha de hoy
      const fechaEntrega = formData.fechaEntrega || new Date().toISOString().split('T')[0];
      
      const dataToSend = {
        numeroPlanilla: formData.numeroPlanilla,
        transportistaNombre: formData.transportistaNombre.trim(),
        zonaNombre: formData.zonaNombre && formData.zonaNombre.trim() !== '' ? formData.zonaNombre.trim() : null,
        cantidad: parseInt(formData.cantidad),
        vueltaNombre: formData.vueltaNombre.trim(),
        fechaEntrega: fechaEntrega, // Siempre enviar una fecha (hoy por defecto)
      };
      console.log('Datos a enviar:', dataToSend);
      await pedidoService.crear(dataToSend);
      setShowModal(false);
      setFormData({ numeroPlanilla: '', transportistaNombre: '', zonaNombre: '', cantidad: '', vueltaNombre: '', fechaEntrega: '' });
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
      setUsuarioForm({ username: '', password: '', nombreCompleto: '', rol: 'ADMIN_PRINCIPAL' });
      cargarUsuarios();
      alert('Usuario creado exitosamente');
    } catch (error) {
      alert(error.response?.data || 'Error al crear usuario');
    }
  };

  // Función para formatear el nombre del rol para mostrar
  const formatearNombreRol = (rolNombre) => {
    const nombresRoles = {
      'ADMIN_PRINCIPAL': 'Administrador Principal',
      'ADMIN_DEPOSITO': 'Administrador Depósito',
      'PLANILLERO': 'Planillero',
      'CONTROL': 'Control'
    };
    return nombresRoles[rolNombre] || rolNombre;
  };


  const getEstadoTexto = (pedido) => {
    if (pedido.estado === 'REALIZADO') {
      return 'Finalizado';
    } else if (pedido.estado === 'EN_PREPARACION') {
      if (!pedido.etapaPreparacion) {
        return 'En Preparación'; // Cuando recién pasa a EN_PREPARACION sin etapa
      } else if (pedido.etapaPreparacion === 'CONTROL') {
        // Mostrar estado según si está controlado o no
        return pedido.controlado ? 'Controlado' : 'Sin Controlar';
      } else if (pedido.etapaPreparacion === 'PENDIENTE_CARGA') {
        return 'Controlado';
      }
      return 'En Preparación';
    } else if (pedido.estado === 'PENDIENTE') {
      return 'Pendiente';
    }
    return pedido.estado?.replace('_', ' ') || 'Desconocido';
  };

  // Función para obtener cantidad de pedidos por etapa de preparación

  const getEstadoColor = (pedido) => {
    if (pedido.estado === 'REALIZADO') {
      return '#4CAF50';
    } else if (pedido.estado === 'EN_PREPARACION') {
      if (!pedido.etapaPreparacion) {
        return '#2196F3'; // Azul para "En Preparación" (sin etapa aún)
      } else if (pedido.etapaPreparacion === 'CONTROL') {
        // Rojo para Sin Controlar, Verde para Controlado
        return pedido.controlado ? '#4CAF50' : '#F44336';
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

  // Agrupar TODAS las planillas por día (para la pestaña Planillas)
  const getPlanillasAgrupadasPorDia = () => {
    if (activeTab !== 'pedidos') return null;
    
    const planillasPorDia = {};
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    todasLasPlanillas.forEach(planilla => {
      // Aplicar filtro de búsqueda si existe
      if (textoBusqueda.trim()) {
        const busqueda = textoBusqueda.toLowerCase().trim();
        const matchPlanilla = planilla.numeroPlanilla?.toLowerCase().includes(busqueda);
        const matchTransporte = (planilla.transportistaNombre || planilla.transportista || '').toLowerCase().includes(busqueda);
        const matchZona = (planilla.zonaNombre || '').toLowerCase().includes(busqueda);
        const matchVuelta = (planilla.vueltaNombre || '').toLowerCase().includes(busqueda);
        if (!matchPlanilla && !matchTransporte && !matchZona && !matchVuelta) {
          return; // Saltar esta planilla si no coincide con la búsqueda
        }
      }
      
      const fechaPlanilla = new Date(planilla.fechaCreacion);
      fechaPlanilla.setHours(0, 0, 0, 0);
      
      const fechaKey = fechaPlanilla.toLocaleDateString('es-AR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });

      if (!planillasPorDia[fechaKey]) {
        planillasPorDia[fechaKey] = {
          fecha: fechaKey,
          fechaDate: fechaPlanilla,
          cantidad: 0,
          esHoy: fechaPlanilla.getTime() === hoy.getTime(),
          planillas: []
        };
      }
      planillasPorDia[fechaKey].cantidad++;
      planillasPorDia[fechaKey].planillas.push(planilla);
    });

    // Ordenar planillas dentro de cada día por fecha de creación descendente
    Object.values(planillasPorDia).forEach(dia => {
      dia.planillas.sort((a, b) => {
        return new Date(b.fechaCreacion) - new Date(a.fechaCreacion);
      });
    });

    return Object.values(planillasPorDia).sort((a, b) => {
      return b.fechaDate - a.fechaDate; // Más recientes primero
    });
  };

  // Función para abrir modal de Transportistas y Vueltas
  const abrirModalTransportistasVueltas = async () => {
    setShowModalTransportistasVueltas(true);
    setLoadingTransportistasVueltas(true);
    try {
      const response = await pedidoService.obtenerTransportistasVueltasDelDia();
      setTransportistasVueltas(response.data || []);
      
      // Expandir automáticamente la fecha actual
      const hoy = new Date().toISOString().split('T')[0];
      setFechasExpandidas(new Set([hoy]));
    } catch (err) {
      console.error('Error al cargar transportistas y vueltas:', err);
    } finally {
      setLoadingTransportistasVueltas(false);
    }
  };

  const toggleFechaExpandida = (fecha) => {
    setFechasExpandidas(prev => {
      const nuevo = new Set(prev);
      if (nuevo.has(fecha)) {
        nuevo.delete(fecha);
      } else {
        nuevo.add(fecha);
      }
      return nuevo;
    });
  };

  const cerrarModalTransportistasVueltas = () => {
    setShowModalTransportistasVueltas(false);
    setTransportistasVueltas([]);
    setFechasExpandidas(new Set());
  };

  // Usar useMemo para estabilizar pedidosAgrupadosPorDia
  const pedidosAgrupadosPorDia = useMemo(() => getPedidosAgrupadosPorDia(), [activeTab, pedidos, textoBusqueda]);
  const pedidosPorDia = useMemo(() => getPedidosPorDia(), [activeTab, pedidos]);
  
  // Usar useMemo para estabilizar planillas agrupadas por día
  const planillasAgrupadasPorDia = useMemo(() => getPlanillasAgrupadasPorDia(), [activeTab, todasLasPlanillas, textoBusqueda]);
  
  // Expandir "Hoy" por defecto cuando se carga la pestaña de Planillas
  useEffect(() => {
    if (activeTab === 'pedidos' && planillasAgrupadasPorDia && planillasAgrupadasPorDia.length > 0) {
      const hoy = planillasAgrupadasPorDia.find(dia => dia.esHoy);
      if (hoy && !diasExpandidosPlanillas.has(hoy.fecha)) {
        setDiasExpandidosPlanillas(prev => new Set([...prev, hoy.fecha]));
      }
    } else if (activeTab !== 'pedidos') {
      setDiasExpandidosPlanillas(new Set());
    }
  }, [activeTab, planillasAgrupadasPorDia]);

  // Estabilizar la longitud para evitar cambios en el array de dependencias
  const pedidosAgrupadosPorDiaLength = pedidosAgrupadosPorDia?.length ?? 0;

  // Expandir automáticamente los días con resultados cuando hay búsqueda activa en "Realizados"
  useEffect(() => {
    if (activeTab === 'realizados' && pedidosAgrupadosPorDia && pedidosAgrupadosPorDia.length > 0) {
      if (textoBusqueda.trim()) {
        // Si hay búsqueda activa, expandir todos los días que tienen resultados
        setDiasExpandidos(new Set(pedidosAgrupadosPorDia.map(dia => dia.fecha)));
      }
      // Si no hay búsqueda, mantener el comportamiento original (no hacer nada)
    }
  }, [activeTab, pedidosAgrupadosPorDia, textoBusqueda]);

  // Limpiar estados cuando se cambia de pestaña (solo cuando cambia activeTab, NO cuando cambia textoBusqueda)
  useEffect(() => {
    if (activeTab !== 'realizados') {
      // Limpiar días expandidos cuando se cambia de pestaña
      setDiasExpandidos(new Set());
      // Resetear el flag cuando se cambia de pestaña
      hoyColapsadoManualmente.current = false;
      // Limpiar búsqueda al cambiar de pestaña
      setTextoBusqueda('');
      // Resetear navegación de "Realizados"
      setEnModoNavegacionDias(false);
      setDiaSeleccionadoIndex(-1);
      setEnModoNavegacionRegistrosRealizados(false);
      setPedidoSeleccionadoIndexRealizados(-1);
    }
  }, [activeTab]);

  // Navegación con teclado para la pestaña "Realizados"
  useEffect(() => {
    if (activeTab !== 'realizados') {
      return;
    }

    const handleKeyDown = (event) => {
      // No navegar si hay un modal abierto
      if (showModal || showUsuarioModal || showTransportistaModal || showZonaModal || showVueltaModal || showResumenModal || showModalDetalle) {
        return;
      }

      const focusedElement = document.activeElement;
      const isInputFocused = focusedElement && (
        focusedElement.tagName === 'INPUT' || 
        focusedElement.tagName === 'TEXTAREA' || 
        focusedElement.tagName === 'SELECT' ||
        focusedElement.isContentEditable
      );

      // Si estamos escribiendo en un input, NO hacer nada (permitir que el input maneje TODAS las teclas)
      if (isInputFocused) {
        return; // NO hacer preventDefault ni nada, solo retornar
      }

      const pedidosAgrupados = pedidosAgrupadosPorDia;
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
          const tabButton = document.querySelector('.tabs button.active');
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
  }, [activeTab, enModoNavegacionDias, diaSeleccionadoIndex, enModoNavegacionRegistrosRealizados, pedidoSeleccionadoIndexRealizados, diasExpandidos, pedidosAgrupadosPorDiaLength, showModal, showUsuarioModal, showTransportistaModal, showZonaModal, showVueltaModal, showResumenModal, showModalDetalle]);

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

  const toggleDiaPlanillas = (fecha) => {
    setDiasExpandidosPlanillas(prev => {
      const nuevo = new Set(prev);
      if (nuevo.has(fecha)) {
        nuevo.delete(fecha);
      } else {
        nuevo.add(fecha);
      }
      return nuevo;
    });
  };

  const abrirModalDetalle = (planilla) => {
    setPedidoSeleccionado(planilla);
    setShowModalDetalle(true);
  };

  const cerrarModalDetalle = () => {
    setShowModalDetalle(false);
    setPedidoSeleccionado(null);
  };

  // Función para determinar si una planilla coincide con el filtro de estado
  const coincideConFiltro = (planilla, filtro) => {
    if (!filtro) return true; // Sin filtro = mostrar todas
    
    switch (filtro) {
      case 'PENDIENTE':
        return planilla.estado === 'PENDIENTE';
      case 'EN_PREPARACION':
        return planilla.estado === 'EN_PREPARACION' && !planilla.etapaPreparacion;
      case 'CONTROL':
        return planilla.estado === 'EN_PREPARACION' && 
               planilla.etapaPreparacion === 'CONTROL';
      case 'PENDIENTE_CARGA':
        return planilla.estado === 'EN_PREPARACION' && 
               planilla.etapaPreparacion === 'PENDIENTE_CARGA';
      case 'FINALIZADO':
        return planilla.estado === 'REALIZADO';
      default:
        return true;
    }
  };

  // Función para cambiar el filtro de estado para un día específico
  const cambiarFiltroEstado = (fecha, filtro) => {
    setFiltroEstadoPorDia(prev => {
      const nuevo = new Map(prev);
      // Si el filtro es el mismo que el activo, desactivarlo (mostrar todas)
      const filtroActual = nuevo.get(fecha);
      if (filtroActual === filtro) {
        nuevo.delete(fecha);
      } else {
        nuevo.set(fecha, filtro);
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
          Planillas
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
          Administradores
        </button>
        <button
          className={activeTab === 'roles-asignados' ? 'active' : ''}
          onClick={() => setActiveTab('roles-asignados')}
        >
          Roles Asignados
        </button>
      </div>

      {activeTab === 'pedidos' && (
        <div className="content-section">
          {/* Buscador avanzado para Pedidos */}
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
                Planillas
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                  data-search-input="true"
                  placeholder="Buscar por planilla, transporte, zona, vuelta..."
                  value={textoBusqueda}
                  onChange={(e) => setTextoBusqueda(e.target.value)}
                  onKeyDown={(e) => {
                    // Detener la propagación para que los listeners globales no interfieran
                    e.stopPropagation();
                  }}
                  onKeyPress={(e) => {
                    // Detener la propagación para que los listeners globales no interfieran
                    e.stopPropagation();
                  }}
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
              onClick={abrirModalTransportistasVueltas}
              style={{
                padding: '10px 20px',
                backgroundColor: '#10b981',
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
                e.target.style.backgroundColor = '#059669';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#10b981';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              🚚 Transportes y Vueltas
            </button>
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
          {planillasAgrupadasPorDia && planillasAgrupadasPorDia.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {planillasAgrupadasPorDia.map((dia, index) => (
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
                    tabIndex={0}
                    onClick={() => toggleDiaPlanillas(dia.fecha)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleDiaPlanillas(dia.fecha);
                      }
                    }}
                    style={{
                      cursor: 'pointer',
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
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '15px',
                        flex: 1,
                      }}
                    >
                      <span style={{ fontSize: '1.2rem' }}>
                        {diasExpandidosPlanillas.has(dia.fecha) ? '▼' : '▶'}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      {/* Botones de filtro por estado */}
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {[
                          { key: 'PENDIENTE', label: 'Pendiente' },
                          { key: 'EN_PREPARACION', label: 'En Preparación' },
                          { key: 'CONTROL', label: 'Control' },
                          { key: 'PENDIENTE_CARGA', label: 'Pendiente de Carga' },
                          { key: 'FINALIZADO', label: 'Finalizado' }
                        ].map(({ key, label }) => {
                          const filtroActivo = filtroEstadoPorDia.get(dia.fecha);
                          const estaActivo = filtroActivo === key;
                          const cantidadFiltrada = dia.planillas.filter(p => coincideConFiltro(p, key)).length;
                          
                          return (
                <button
                              key={key}
                              onClick={(e) => {
                                e.stopPropagation();
                                cambiarFiltroEstado(dia.fecha, key);
                              }}
                  style={{
                                padding: '6px 12px',
                                backgroundColor: estaActivo ? '#1e40af' : '#f3f4f6',
                                color: estaActivo ? 'white' : '#6b7280',
                                border: estaActivo ? 'none' : '1px solid #e5e7eb',
                                borderRadius: '6px',
                    cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: estaActivo ? '600' : '500',
                    transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                  }}
                  onMouseEnter={(e) => {
                                if (!estaActivo) {
                      e.target.style.backgroundColor = '#e5e7eb';
                    }
                  }}
                  onMouseLeave={(e) => {
                                if (!estaActivo) {
                      e.target.style.backgroundColor = '#f3f4f6';
                    }
                  }}
                            >
                              {label}
                              {cantidadFiltrada > 0 && (
                                <span style={{
                                  backgroundColor: estaActivo ? 'rgba(255,255,255,0.3)' : '#d1d5db',
                                  color: estaActivo ? 'white' : '#6b7280',
                                  borderRadius: '10px',
                                  padding: '2px 6px',
                                  fontSize: '0.7rem',
                                  fontWeight: '600',
                                  minWidth: '18px',
                                  textAlign: 'center',
                                }}>
                                  {cantidadFiltrada}
                                </span>
                              )}
                            </button>
                          );
                        })}
                  </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPedidosResumen(dia.planillas);
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
                      }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#1e3a8a'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#1e40af'}
                    >
                        📊 Resumen
                </button>
            </div>
                  </div>
                  
                  {/* Planillas del día - solo se muestran si está expandido */}
                  {diasExpandidosPlanillas.has(dia.fecha) && (() => {
                    const filtroActivo = filtroEstadoPorDia.get(dia.fecha);
                    const planillasFiltradas = filtroActivo 
                      ? dia.planillas.filter(p => coincideConFiltro(p, filtroActivo))
                      : dia.planillas;
                    
                    return (
            <div style={{
                        padding: '20px',
                        backgroundColor: '#f8fafc',
                        backgroundImage: 'linear-gradient(to bottom, #ffffff 0%, #f8fafc 100%)',
                    display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '16px'
                      }}>
                        {planillasFiltradas.length === 0 ? (
                          <div style={{
                            gridColumn: '1 / -1',
                            textAlign: 'center',
                            padding: '40px 20px',
                            color: '#6b7280',
                  fontSize: '0.95rem',
                          }}>
                            No hay planillas con el filtro seleccionado
                    </div>
                        ) : (
                          planillasFiltradas.map((planilla) => {
                        return (
                          <div 
                            key={planilla.id} 
                  style={{
                              backgroundColor: 'white',
                              borderRadius: '10px',
                              border: '1px solid #e2e8f0',
                              overflow: 'hidden',
                              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06)',
                              transition: 'all 0.3s ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.08)';
                              e.currentTarget.style.borderColor = '#cbd5e1';
                  }}
                  onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06)';
                              e.currentTarget.style.borderColor = '#e2e8f0';
                            }}
                          >
                            {/* Vista compacta */}
                            <div
                style={{
                                padding: '12px 16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '12px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <div style={{
                                  width: '40px',
                                  height: '40px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                                  fontSize: '1.2rem',
                      color: 'white',
                      fontWeight: '700',
                                  flexShrink: 0,
                    }}>
                      📋
                    </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ 
                                    fontSize: '1.1rem', 
                                    fontWeight: '700', 
                                    color: '#1e293b',
                        marginBottom: '4px'
                      }}>
                                    {planilla.numeroPlanilla}
                      </div>
                      <div style={{ 
                        fontSize: '0.85rem', 
                        color: '#64748b', 
                        display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '6px'
                                  }}>
                                    <span>🚚 {planilla.transportistaNombre || planilla.transportista || 'Sin transporte'}</span>
                                    {planilla.vueltaNombre && <span>• {planilla.vueltaNombre}</span>}
                                    {planilla.cantidad && <span>• {planilla.cantidad} total</span>}
                      </div>
                    </div>
                  </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span
                                  style={{
                                    backgroundColor: getEstadoColor(planilla),
                                    color: 'white',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '0.8rem',
                                    fontWeight: '600',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {getEstadoTexto(planilla)}
                  </span>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button
                                    onClick={() => abrirModalDetalle(planilla)}
                                    style={{
                                      padding: '6px 12px',
                                      backgroundColor: '#2196F3',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                        fontSize: '0.85rem', 
                        fontWeight: '600', 
                                      width: '100%',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = '#1976D2';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = '#2196F3';
                                    }}
                                  >
                                    👁️ Ver
                                  </button>
                                  {planilla.estado === 'PENDIENTE' && (
                                    <button
                                      onClick={() => handleEliminarPedido(planilla.id)}
                                      style={{
                                        padding: '6px 12px',
                                        backgroundColor: '#f3f4f6',
                                        color: '#6b7280',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                        fontSize: '0.85rem', 
                        fontWeight: '600', 
                                        width: '100%',
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = '#e5e7eb';
                                        e.currentTarget.style.color = '#dc2626';
                                        e.currentTarget.style.borderColor = '#dc2626';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                                        e.currentTarget.style.color = '#6b7280';
                                        e.currentTarget.style.borderColor = '#e5e7eb';
                                      }}
                    >
                      🗑️ Eliminar
                    </button>
                                  )}
                      </div>
                      </div>
                    </div>
                </div>
                        );
                      }))}
                      </div>
                    );
                  })()}
              </div>
            ))}
            </div>
          )}

          {(!planillasAgrupadasPorDia || planillasAgrupadasPorDia.length === 0) && (
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
                No hay planillas registradas
                </h3>
                <p style={{
                  fontSize: '1rem',
                  color: '#666',
                  margin: '0',
                  maxWidth: '400px',
                }}>
                Crea tu primera planilla usando el botón "Nuevo Pedido" para comenzar.
                </p>
              </div>
            )}
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
                data-search-input="true"
                placeholder="Buscar por planilla, transporte, zona, vuelta..."
                value={textoBusqueda}
                onChange={(e) => setTextoBusqueda(e.target.value)}
                onKeyDown={(e) => {
                  // Detener la propagación para que los listeners globales no interfieran
                  e.stopPropagation();
                }}
                onKeyPress={(e) => {
                  // Detener la propagación para que los listeners globales no interfieran
                  e.stopPropagation();
                }}
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
                    ref={(el) => {
                      if (el) {
                        diaButtonRefs.current[index] = el;
                      }
                    }}
                    tabIndex={0}
                    onClick={() => toggleDia(dia.fecha)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleDia(dia.fecha);
                      }
                    }}
                    style={{
                      cursor: 'pointer',
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
                      outline: diaSeleccionadoIndex === index ? '3px solid #2196F3' : 'none',
                      outlineOffset: '-2px',
                    }}
                    onFocus={(e) => {
                      if (diaSeleccionadoIndex === index) {
                        e.currentTarget.style.outline = '3px solid #2196F3';
                      }
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.outline = 'none';
                    }}
                  >
                    <div
                      style={{
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
                      }).map((pedido, pedidoIndex) => (
                        <div 
                          key={pedido.id} 
                          className="pedido-card admin-pedido-card"
                          data-pedido-id-realizado={pedido.id}
                          tabIndex={0}
                          style={{
                            outline: (diaSeleccionadoIndex === index && enModoNavegacionRegistrosRealizados && pedidoSeleccionadoIndexRealizados === pedidoIndex) ? '3px solid #2196F3' : 'none',
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
                                background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.5rem',
                                color: 'white',
                                fontWeight: '700',
                                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
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
                                      ✅ Controlado
                                    </div>
                                    <div style={{ 
                                      fontSize: '0.9rem', 
                                      color: '#F57C00',
                                      fontWeight: '500',
                                      marginBottom: '4px'
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
                                    {pedido.controladoPor && (
                                      <div style={{ 
                                        fontSize: '0.85rem', 
                                        color: '#E65100',
                                        fontWeight: '500',
                                        marginTop: '4px',
                                        paddingTop: '4px',
                                        borderTop: '1px solid rgba(230, 81, 0, 0.2)'
                                      }}>
                                        <strong>Controlado por:</strong> {pedido.controladoPor}
                                      </div>
                                    )}
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
                                    fontWeight: '500',
                                    marginBottom: '4px'
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
                                  {pedido.finalizadoPor && (
                                    <div style={{ 
                                      fontSize: '0.85rem', 
                                      color: '#15803d',
                                      fontWeight: '500',
                                      marginTop: '4px',
                                      paddingTop: '4px',
                                      borderTop: '1px solid rgba(21, 128, 61, 0.2)'
                                    }}>
                                      <strong>Finalizado por:</strong> {pedido.finalizadoPor}
                                    </div>
                                  )}
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
                            setTransportistaEditando(transportista);
                            setTransportistaForm({ nombre: transportista.nombre });
                            setShowTransportistaModal(true);
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#1976D2'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = '#2196F3'}
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'roles-asignados' && (
        <div className="content-section">
          <div className="table-container">
            <div className="section-header" style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #e0e0e0' }}>
              <h2 style={{ margin: 0, color: '#333' }}>Roles Asignados</h2>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Nombre</th>
                  <th>Rol</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {usuariosRolesAsignados.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>
                      No hay usuarios asignados
                    </td>
                  </tr>
                ) : (
                  usuariosRolesAsignados.map((usuario) => (
                    <tr key={usuario.id}>
                      <td>{usuario.username}</td>
                      <td>{usuario.nombreCompleto}</td>
                      <td>{formatearNombreRol(usuario.rol.nombre)}</td>
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
              <h2 style={{ margin: 0, color: '#333' }}>Administradores</h2>
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
                    <td>{formatearNombreRol(usuario.rol.nombre)}</td>
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
          setFormData({ numeroPlanilla: '', transportistaNombre: '', zonaNombre: '', cantidad: '', vueltaNombre: '', fechaEntrega: '' });
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
            <form onSubmit={handleCrearPedido} onKeyDown={(e) => {
              // NO prevenir aquí - dejar que el handler del input maneje el Enter
              // Solo prevenir submit si es un botón de submit
              if (e.key === 'Enter' && e.target.type === 'submit') {
                // Permitir submit normal
                return;
              }
            }}>
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
                  onKeyDown={async (e) => {
                    // Manejar Enter
                    if (e.key === 'Enter') {
                      // Si hay sugerencias en la lista, seleccionar una
                      if (mostrarSugerenciasTransportista && transportistaSugerencias.length > 0) {
                      e.preventDefault();
                        e.stopPropagation();
                        if (indiceTransportistaSeleccionada >= 0 && indiceTransportistaSeleccionada < transportistaSugerencias.length) {
                          seleccionarTransportista(transportistaSugerencias[indiceTransportistaSeleccionada]);
                        } else if (transportistaSugerencias.length > 0) {
                          seleccionarTransportista(transportistaSugerencias[0]);
                        }
                        setTimeout(() => {
                          zonaRef.current?.focus();
                        }, 100);
                        return false;
                      } else {
                        // Si NO hay sugerencias o la lista está vacía, crear transporte nuevo y saltar a zona
                        e.preventDefault();
                        e.stopPropagation();
                        
                        const nombreTransporte = formData.transportistaNombre?.trim();
                        if (nombreTransporte) {
                          // Crear el transporte si no existe
                          try {
                            // Verificar si el transporte ya existe en la lista
                            const transporteExiste = transportistas.some(t => 
                              t.nombre.toLowerCase() === nombreTransporte.toLowerCase()
                            );
                            
                            // Si no existe, crearlo
                            if (!transporteExiste) {
                              await transportistaService.crear(nombreTransporte);
                              // Recargar la lista de transportistas
                              await cargarTransportistas();
                            }
                          } catch (error) {
                            console.error('Error al crear transporte:', error);
                            alert('Error al crear el transporte. Intente nuevamente.');
                            return;
                          }
                          
                          // Saltar a zona después de crear el transporte
                          setTimeout(() => {
                            if (zonaRef.current) {
                              zonaRef.current.focus();
                              zonaRef.current.select();
                            }
                          }, 300);
                        }
                        return false;
                      }
                    }
                    
                    // Manejar navegación con flechas cuando hay sugerencias
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
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setMostrarSugerenciasTransportista(false);
                        setIndiceTransportistaSeleccionada(-1);
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
                    onKeyDown={async (e) => {
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
                        e.stopPropagation();
                        
                        const nombreZona = formData.zonaNombre?.trim();
                        if (nombreZona) {
                          // Crear la zona si no existe (similar a transporte)
                          try {
                            // Verificar si la zona ya existe en la lista
                            const zonaExiste = zonas.some(z => 
                              z.nombre.toLowerCase() === nombreZona.toLowerCase()
                            );
                            
                            // Si no existe, crearla
                            if (!zonaExiste) {
                              await zonaService.crearObtener(nombreZona);
                              // Recargar la lista de zonas
                              await cargarZonas();
                            }
                          } catch (error) {
                            console.error('Error al crear zona:', error);
                            // Continuar de todas formas para no bloquear la navegación
                          }
                        }
                        
                        // Saltar a vuelta después de crear la zona (si se creó)
                        setTimeout(() => {
                          if (vueltaRef.current) {
                            vueltaRef.current.focus();
                          }
                        }, 200);
                        return false;
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
                          // Ir al campo de fecha de entrega en lugar de enviar el formulario
                          setTimeout(() => {
                            if (fechaEntregaRef.current) {
                              fechaEntregaRef.current.focus();
                            }
                          }, 100);
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
                      Fecha de Entrega
                      <span style={{ 
                        fontSize: '0.85rem', 
                        color: '#666', 
                        fontWeight: '400',
                        marginLeft: '6px'
                      }}>
                        (opcional, por defecto hoy)
                      </span>
                    </label>
                    <input
                      ref={fechaEntregaRef}
                      type="date"
                      value={formData.fechaEntrega || ''}
                      onChange={(e) => setFormData({ ...formData, fechaEntrega: e.target.value })}
                      min={new Date().toISOString().split('T')[0]} // No permitir fechas pasadas
                  onKeyDown={(e) => {
                        // Solo manejar Enter aquí, las flechas las maneja el useEffect
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
                    />
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
                    setFormData({ numeroPlanilla: '', transportistaNombre: '', zonaNombre: '', cantidad: '', vueltaNombre: '', fechaEntrega: '' });
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
                  <option value="ADMIN_PRINCIPAL">Administrador Principal</option>
                  <option value="ADMIN_DEPOSITO">Administrador Depósito</option>
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
                        backgroundColor: '#2196F3',
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
          rolDestinatario={user?.rol === 'ADMIN_PRINCIPAL' ? 'ADMIN_DEPOSITO' : 'ADMIN_PRINCIPAL'}
        />
      )}

      {/* Modal de Detalles de Planilla */}
      {showModalDetalle && pedidoSeleccionado && (
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
          onClick={cerrarModalDetalle}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>
                Detalles de la Planilla
              </h2>
              <button
                onClick={cerrarModalDetalle}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666',
                  padding: '0',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>

            <div className="pedido-card" style={{ marginBottom: '0' }}>
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
                    📋
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '700', color: '#1e293b' }}>
                      {pedidoSeleccionado.numeroPlanilla}
                    </h3>
                    <div style={{
                      fontSize: '0.85rem',
                      color: '#64748b',
                      marginTop: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span>🕐 {pedidoSeleccionado.fechaCreacion && new Date(pedidoSeleccionado.fechaCreacion).toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}</span>
                    </div>
                  </div>
                </div>
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
                      {pedidoSeleccionado.transportistaNombre || pedidoSeleccionado.transportista || 'Sin transporte'}
                    </div>
                  </div>
                  {pedidoSeleccionado.cantidad && (
                    <div className="info-item">
                      <div className="info-label">📊 Cantidad</div>
                      <div className="info-value">{pedidoSeleccionado.cantidad}</div>
                    </div>
                  )}
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                  marginBottom: '16px'
                }}>
                  {pedidoSeleccionado.zonaNombre && (
                    <div className="info-item">
                      <div className="info-label">📍 Zona</div>
                      <div className="info-value">{pedidoSeleccionado.zonaNombre}</div>
                    </div>
                  )}
                  {pedidoSeleccionado.vueltaNombre && (
                    <div className="info-item">
                      <div className="info-label">🔄 Vuelta</div>
                      <div className="info-value">{pedidoSeleccionado.vueltaNombre}</div>
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
                    <div className="info-value">{pedidoSeleccionado.grupoNombre || 'Sin asignar'}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">📋 Estado</div>
                    <span
                      className="estado-badge"
                      style={{ backgroundColor: getEstadoColor(pedidoSeleccionado) }}
                    >
                      {getEstadoTexto(pedidoSeleccionado)}
                    </span>
                  </div>
                </div>

                {pedidoSeleccionado.fechaEntrega && (
                  <div className="info-item" style={{ marginBottom: '16px' }}>
                    <div className="info-label">📅 Fecha de Despacho</div>
                    <div className="info-value">
                      {(() => {
                        // Función auxiliar para parsear fecha sin problemas de zona horaria
                        const parseFechaLocal = (fechaString) => {
                          if (!fechaString) return null;
                          if (fechaString instanceof Date) return fechaString;
                          const parts = fechaString.split('-');
                          if (parts.length !== 3) return new Date(fechaString);
                          const year = parseInt(parts[0], 10);
                          const month = parseInt(parts[1], 10) - 1;
                          const day = parseInt(parts[2], 10);
                          return new Date(year, month, day);
                        };

                        const hoy = new Date();
                        hoy.setHours(0, 0, 0, 0);
                        const fechaEntrega = parseFechaLocal(pedidoSeleccionado.fechaEntrega);
                        if (!fechaEntrega) return 'Fecha inválida';
                        fechaEntrega.setHours(0, 0, 0, 0);
                        const diffTime = fechaEntrega - hoy;
                        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                        
                        if (diffDays === 0) {
                          return 'Hoy';
                        } else if (diffDays === 1) {
                          return 'Mañana';
                        } else {
                          return fechaEntrega.toLocaleDateString('es-AR', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          });
                        }
                      })()}
                    </div>
                  </div>
                )}

                {/* Mostrar timestamps según el estado */}
                {pedidoSeleccionado.estado === 'EN_PREPARACION' && pedidoSeleccionado.etapaPreparacion === 'PENDIENTE_CARGA' && pedidoSeleccionado.fechaPendienteCarga && (
                  <div style={{
                    padding: '12px',
                    background: 'linear-gradient(135deg, #e0f7fa 0%, #b2ebf2 100%)',
                    borderRadius: '8px',
                    border: '1px solid #80deea',
                    marginTop: '8px'
                  }}>
                    <div style={{ 
                      fontSize: '0.85rem', 
                      fontWeight: '600', 
                      color: '#00838f',
                      marginBottom: '4px'
                    }}>
                      ✅ Controlado
                    </div>
                    <div style={{ 
                      fontSize: '0.9rem', 
                      color: '#0097a7',
                      fontWeight: '500'
                    }}>
                      {new Date(pedidoSeleccionado.fechaPendienteCarga).toLocaleString('es-AR', {
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

                {pedidoSeleccionado.estado === 'REALIZADO' && pedidoSeleccionado.fechaActualizacion && (
                  <div style={{
                    display: 'flex',
                    gap: '12px',
                    marginTop: '8px'
                  }}>
                    {pedidoSeleccionado.fechaPendienteCarga && (
                      <div style={{
                        flex: 1,
                        padding: '12px',
                        background: 'linear-gradient(135deg, #e0f7fa 0%, #b2ebf2 100%)',
                        borderRadius: '8px',
                        border: '1px solid #80deea'
                      }}>
                        <div style={{ 
                          fontSize: '0.85rem', 
                          fontWeight: '600', 
                          color: '#00838f',
                          marginBottom: '4px'
                        }}>
                          ✅ Controlado
                        </div>
                        <div style={{ 
                          fontSize: '0.9rem', 
                          color: '#0097a7',
                          fontWeight: '500',
                          marginBottom: '4px'
                        }}>
                          {new Date(pedidoSeleccionado.fechaPendienteCarga).toLocaleString('es-AR', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                          })}
                        </div>
                        {pedidoSeleccionado.controladoPor && (
                          <div style={{ 
                            fontSize: '0.85rem', 
                            color: '#00838f',
                            fontWeight: '500',
                            marginTop: '4px',
                            paddingTop: '4px',
                            borderTop: '1px solid rgba(0, 131, 143, 0.2)'
                          }}>
                            <strong>Controlado por:</strong> {pedidoSeleccionado.controladoPor}
                          </div>
                        )}
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
                        🏁 Finalizado
                      </div>
                      <div style={{ 
                        fontSize: '0.9rem', 
                        color: '#15803d',
                        fontWeight: '500',
                        marginBottom: '4px'
                      }}>
                        {new Date(pedidoSeleccionado.fechaActualizacion).toLocaleString('es-AR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })}
                      </div>
                      {pedidoSeleccionado.finalizadoPor && (
                        <div style={{ 
                          fontSize: '0.85rem', 
                          color: '#15803d',
                          fontWeight: '500',
                          marginTop: '4px',
                          paddingTop: '4px',
                          borderTop: '1px solid rgba(21, 128, 61, 0.2)'
                        }}>
                          <strong>Finalizado por:</strong> {pedidoSeleccionado.finalizadoPor}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              {pedidoSeleccionado.estado === 'PENDIENTE' && (
                <button
                  onClick={() => {
                    handleEliminarPedido(pedidoSeleccionado.id);
                    cerrarModalDetalle();
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                  }}
                >
                  🗑️ Eliminar
                </button>
              )}
              <button
                onClick={cerrarModalDetalle}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6B7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Transportistas y Vueltas del Día */}
      {showModalTransportistasVueltas && (
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
          onClick={cerrarModalTransportistasVueltas}
        >
          <div
            style={{
              backgroundColor: '#e5e7eb',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '900px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>
                🚚 Transportes y Vueltas del Día
              </h2>
              <button
                onClick={cerrarModalTransportistasVueltas}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666',
                  padding: '0',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>

            {loadingTransportistasVueltas ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <p>Cargando transportes...</p>
              </div>
            ) : transportistasVueltas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                <p>No hay transportes activos</p>
              </div>
            ) : (() => {
              // Agrupar transportistas por fecha de entrega
              const hoy = new Date().toISOString().split('T')[0];
              const fechasConDatos = new Set();
              
              // Recopilar todas las fechas que tienen vueltas asignadas
              transportistasVueltas.forEach(item => {
                if (item.vueltasPorFecha) {
                  Object.keys(item.vueltasPorFecha).forEach(fecha => {
                    if (item.vueltasPorFecha[fecha] && item.vueltasPorFecha[fecha].length > 0) {
                      fechasConDatos.add(fecha);
                    }
                  });
                }
              });
              
              // Agregar también la fecha de hoy si no tiene vueltas pero queremos mostrarla
              fechasConDatos.add(hoy);
              
              // Ordenar fechas: hoy primero, luego por fecha descendente (más recientes primero)
              const fechasOrdenadas = Array.from(fechasConDatos).sort((a, b) => {
                if (a === hoy) return -1;
                if (b === hoy) return 1;
                return b.localeCompare(a); // Descendente: más recientes primero
              });
              
              const estaExpandida = (fecha) => fechasExpandidas.has(fecha);
              
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {fechasOrdenadas.map((fecha) => {
                    const esHoy = fecha === hoy;
                    const expandida = estaExpandida(fecha);
                    const fechaFormateada = esHoy 
                      ? 'Hoy' 
                      : new Date(fecha + 'T00:00:00').toLocaleDateString('es-AR', { 
                          weekday: 'long', 
                          day: 'numeric', 
                          month: 'long',
                          year: 'numeric'
                        });
                    
                    // Separar transportistas: con vueltas en esta fecha y sin vueltas en esta fecha
                    const transportistasConVueltasEnFecha = transportistasVueltas.filter(item => 
                      item.vueltasPorFecha && 
                      item.vueltasPorFecha[fecha] && 
                      item.vueltasPorFecha[fecha].length > 0
                    );
                    
                    // Transportistas sin vueltas en esta fecha específica
                    const transportistasSinVueltasEnFecha = transportistasVueltas.filter(item => 
                      !item.vueltasPorFecha || 
                      !item.vueltasPorFecha[fecha] || 
                      item.vueltasPorFecha[fecha].length === 0
                    );
                    
                    return (
                      <div key={fecha} style={{ 
                        border: '2px solid #d1d5db', 
                        borderRadius: '8px', 
                        overflow: 'hidden',
                        backgroundColor: 'white',
                        boxShadow: esHoy && expandida ? '0 2px 8px rgba(33, 150, 243, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.1)'
                      }}>
                        {/* Encabezado de fecha (clic para expandir/colapsar) */}
                        <div 
                          onClick={() => toggleFechaExpandida(fecha)}
                          style={{
                            padding: '12px 16px',
                            backgroundColor: esHoy ? '#E3F2FD' : '#f9fafb',
                            borderBottom: expandida ? `2px solid ${esHoy ? '#2196F3' : '#e5e7eb'}` : 'none',
                            fontWeight: '700',
                            fontSize: '1rem',
                            color: esHoy ? '#1976D2' : '#1e293b',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'background-color 0.2s',
                            userSelect: 'none'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = esHoy ? '#BBDEFB' : '#f3f4f6';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = esHoy ? '#E3F2FD' : '#f9fafb';
                          }}
                        >
                          <span>
                            {esHoy ? '📅 ' : '📆 '}{fechaFormateada}
                            <span style={{ 
                              marginLeft: '12px', 
                              fontSize: '0.85rem', 
                              fontWeight: '500',
                              color: '#6b7280' 
                            }}>
                              ({transportistasConVueltasEnFecha.length} con vueltas, {transportistasSinVueltasEnFecha.length} sin vueltas)
                            </span>
                          </span>
                          <span style={{ fontSize: '1.2rem', transition: 'transform 0.2s', transform: expandida ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                            ▼
                          </span>
                        </div>
                        
                        {/* Contenido expandible */}
                        {expandida && (
                          <div>
                            {/* Transportistas SIN vueltas asignadas */}
                            {transportistasSinVueltasEnFecha.length > 0 && (
                              <div style={{ marginBottom: '16px' }}>
                                <div style={{
                                  padding: '10px 16px',
                                  backgroundColor: '#fef2f2',
                                  borderBottom: '1px solid #fecaca',
                                  fontWeight: '600',
                                  fontSize: '0.9rem',
                                  color: '#991b1b'
                                }}>
                                  ⚠️ Transportes sin Vueltas Asignadas ({transportistasSinVueltasEnFecha.length})
                                </div>
                                <div style={{ padding: '12px 16px' }}>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {transportistasSinVueltasEnFecha.map((item) => (
                                      <span
                                        key={item.transportistaId}
                                        style={{
                                          padding: '6px 12px',
                                          backgroundColor: '#f3f4f6',
                                          color: '#6b7280',
                                          borderRadius: '4px',
                                          fontSize: '0.85rem',
                                          fontWeight: '500',
                                        }}
                                      >
                                        {item.transportistaNombre}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* Transportistas CON vueltas asignadas */}
                            {transportistasConVueltasEnFecha.length > 0 && (
                              <div>
                                <div style={{
                                  padding: '10px 16px',
                                  backgroundColor: '#f0fdf4',
                                  borderBottom: '1px solid #d1fae5',
                                  fontWeight: '600',
                                  fontSize: '0.9rem',
                                  color: '#166534'
                                }}>
                                  ✅ Transportes con Vueltas Asignadas ({transportistasConVueltasEnFecha.length})
                                </div>
                                <div style={{ overflowX: 'auto' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                    <thead>
                                      <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', color: '#1e293b' }}>
                                          Transporte
                                        </th>
                                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', color: '#1e293b' }}>
                                          Vuelta Asignada
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {transportistasConVueltasEnFecha.map((item, index) => (
                                        <tr
                                          key={item.transportistaId}
                                          style={{
                                            borderBottom: '1px solid #e5e7eb',
                                            backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb',
                                          }}
                                        >
                                          <td style={{ padding: '12px', fontWeight: '600', color: '#1e293b' }}>
                                            {item.transportistaNombre}
                                          </td>
                                          <td style={{ padding: '12px' }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                              {item.vueltasPorFecha[fecha].map((vuelta, idx) => (
                                                <span
                                                  key={idx}
                                                  style={{
                                                    backgroundColor: esHoy ? '#10b981' : '#6b7280',
                                                    color: 'white',
                                                    padding: '4px 10px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.85rem',
                                                    fontWeight: '600',
                                                  }}
                                                >
                                                  {vuelta}
                                                </span>
                                              ))}
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminPanel;

