import { useState, useEffect } from 'react';
import { pedidoService } from '../services/pedidoService';
import { connectWebSocket, disconnectWebSocket } from '../services/websocketService';
import './PantallaPublica.css';

const PantallaPublica = () => {
  const [pedidosPrioridadArmado, setPedidosPrioridadArmado] = useState([]);
  const [pedidosEnPreparacion, setPedidosEnPreparacion] = useState([]);
  const [pedidosControl, setPedidosControl] = useState([]);
  const [pedidosPendienteCarga, setPedidosPendienteCarga] = useState([]);
  const [pedidosRealizados, setPedidosRealizados] = useState([]);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [horaActual, setHoraActual] = useState(new Date());

  useEffect(() => {
    cargarPedidos();
    const stompClient = connectWebSocket((message) => {
      if (message.tipo === 'eliminado') {
        setPedidosPrioridadArmado((prev) => prev.filter((p) => p.id !== message.id));
        setPedidosEnPreparacion((prev) => prev.filter((p) => p.id !== message.id));
        setPedidosControl((prev) => prev.filter((p) => p.id !== message.id));
        setPedidosPendienteCarga((prev) => prev.filter((p) => p.id !== message.id));
      } else {
        cargarPedidos();
      }
    });

    // Actualizar cada 30 segundos
    const interval = setInterval(cargarPedidos, 30000);

    // Escuchar cambios en el estado de pantalla completa
    const handleFullscreenChange = () => {
      setIsFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      disconnectWebSocket();
      clearInterval(interval);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Actualizar hora cada segundo
  useEffect(() => {
    const intervalHora = setInterval(() => {
      setHoraActual(new Date());
    }, 1000);

    return () => clearInterval(intervalHora);
  }, []);

  // Ocultar cursor después de inactividad
  useEffect(() => {
    let cursorTimeout;

    const showCursor = () => {
      setCursorVisible(true);
      clearTimeout(cursorTimeout);
      // Ocultar cursor después de 3 segundos de inactividad
      cursorTimeout = setTimeout(() => {
        setCursorVisible(false);
      }, 3000);
    };

    // Eventos que muestran el cursor
    const handleMouseMove = () => showCursor();
    const handleMouseDown = () => showCursor();
    const handleTouchStart = () => showCursor();

    // Mostrar cursor inicialmente y configurar timeout
    showCursor();

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('touchstart', handleTouchStart);

    return () => {
      clearTimeout(cursorTimeout);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('touchstart', handleTouchStart);
    };
  }, []);

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

  // Función para ordenar pedidos por prioridad y luego por fecha de carga
  const ordenarPedidos = (pedidos) => {
    return pedidos.sort((a, b) => {
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
  };

  const cargarPedidos = async () => {
    try {
      setError(null);
      const [pendientes, enPreparacion, realizados] = await Promise.all([
        pedidoService.obtenerPorEstado('PENDIENTE'),
        pedidoService.obtenerPorEstado('EN_PREPARACION'),
        pedidoService.obtenerPorEstado('REALIZADO'),
      ]);
      
      // Prioridad de armado: PENDIENTE ordenados por prioridad y fecha
      const pendientesOrdenados = ordenarPedidos([...(pendientes.data || [])]);
      
      // Filtrar EN_PREPARACION por etapa
      const enPreparacionData = enPreparacion.data || [];
      const enPreparacionSinEtapa = enPreparacionData.filter(p => !p.etapaPreparacion);
      const enControl = enPreparacionData.filter(p => p.etapaPreparacion === 'CONTROL');
      const enPendienteCarga = enPreparacionData.filter(p => p.etapaPreparacion === 'PENDIENTE_CARGA');
      
      setPedidosPrioridadArmado(pendientesOrdenados);
      setPedidosEnPreparacion(enPreparacionSinEtapa);
      setPedidosControl(enControl);
      setPedidosPendienteCarga(enPendienteCarga);
      setPedidosRealizados(realizados.data || []);
    } catch (error) {
      console.error('Error al cargar pedidos:', error);
      setError(`Error al cargar pedidos: ${error.response?.data?.message || error.message || 'Error desconocido'}`);
    }
  };

  // Calcular pedidos realizados hoy
  const getRealizadosHoy = () => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    return pedidosRealizados.filter(pedido => {
      if (pedido.estado === 'REALIZADO' && pedido.fechaActualizacion) {
        const fechaPedido = new Date(pedido.fechaActualizacion);
        fechaPedido.setHours(0, 0, 0, 0);
        return fechaPedido.getTime() === hoy.getTime();
      }
      return false;
    }).length;
  };

  const realizadosHoy = getRealizadosHoy();
  
  // Calcular total de pedidos activos (suma de las 4 columnas)
  const totalPedidosActivos = pedidosPrioridadArmado.length + 
                               pedidosEnPreparacion.length + 
                               pedidosControl.length + 
                               pedidosPendienteCarga.length;

  const getPrioridadColor = (prioridad) => {
    const colors = {
      BAJA: '#4CAF50',
      NORMAL: '#2196F3',
      ALTA: '#FF9800',
      URGENTE: '#F44336',
    };
    return colors[prioridad] || '#666';
  };

  const toggleFullscreen = async () => {
    try {
      const element = document.documentElement;

      if (!isFullscreen) {
        // Entrar en pantalla completa
        if (element.requestFullscreen) {
          await element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
          await element.webkitRequestFullscreen();
        } else if (element.mozRequestFullScreen) {
          await element.mozRequestFullScreen();
        } else if (element.msRequestFullscreen) {
          await element.msRequestFullscreen();
        }
      } else {
        // Salir de pantalla completa
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          await document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
      }
    } catch (error) {
      console.error('Error al cambiar pantalla completa:', error);
    }
  };

  // Aplicar estilo al body para ocultar cursor
  useEffect(() => {
    if (!cursorVisible) {
      document.body.style.cursor = 'none';
    } else {
      document.body.style.cursor = '';
    }
    return () => {
      document.body.style.cursor = '';
    };
  }, [cursorVisible]);

  return (
    <div 
      className="pantalla-publica" 
      onClick={toggleFullscreen}
      style={{ 
        cursor: cursorVisible ? 'pointer' : 'none'
      }}
      title={cursorVisible ? "Clic para entrar/salir de pantalla completa" : ""}
    >
      <header className="pantalla-header">
        <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'stretch', justifyContent: 'space-between' }}>
          {/* Contenedor del logo a la izquierda */}
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            padding: '18px 25px',
            borderRadius: '12px',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(10px)',
            border: '2px solid rgba(255, 255, 255, 0.2)',
            marginRight: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <img 
              src="/logo-empresa.png" 
              alt="Logo Empresa" 
              style={{ 
                height: 'clamp(50px, 6vw, 80px)',
                maxWidth: '250px',
                objectFit: 'contain',
                filter: 'drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.3))'
              }} 
            />
          </div>
          
          {/* Cuadro de hora */}
          <div style={{
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            padding: '18px 28px',
            borderRadius: '8px',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
            minWidth: '140px',
            textAlign: 'center',
            marginRight: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{
              fontSize: 'clamp(2.5rem, 4vw, 3.5rem)', /* Responsive para hora - aumentado */
              fontWeight: 'bold',
              textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)',
              lineHeight: '1',
              fontFamily: 'monospace',
            }}>
              {horaActual.toLocaleTimeString('es-AR', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              })}
            </div>
          </div>
          
          <div style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <h1 style={{ margin: 0, marginBottom: '8px' }}>PANEL CENTRAL</h1>
            <div className="fecha-hora">
              {horaActual.toLocaleString('es-AR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>
          {/* Contenedor de contadores */}
          <div style={{ display: 'flex', gap: '20px', marginLeft: '15px' }}>
            {/* Contador de total activos */}
            <div style={{
              backgroundColor: 'rgba(76, 175, 80, 0.9)',
              padding: '18px 24px',
              borderRadius: '8px',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
              minWidth: '160px',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: 'clamp(1rem, 1.5vw, 1.3rem)', /* Aumentado */
                opacity: 0.95,
                marginBottom: '10px',
                textTransform: 'uppercase',
                fontWeight: '600',
              }}>
                Total Activos
              </div>
              <div style={{
                fontSize: 'clamp(2.5rem, 4vw, 3.5rem)', /* Aumentado */
                fontWeight: 'bold',
                textShadow: '2px 2px 4px rgba(0, 0, 0, 0.3)',
                lineHeight: '1',
              }}>
                {totalPedidosActivos}
              </div>
            </div>
            
            {/* Contador de finalizados del día */}
            <div style={{
              backgroundColor: 'rgba(33, 150, 243, 0.9)',
              padding: '18px 24px',
              borderRadius: '8px',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
              minWidth: '160px',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: 'clamp(1rem, 1.5vw, 1.3rem)', /* Aumentado */
                opacity: 0.95,
                marginBottom: '10px',
                textTransform: 'uppercase',
                fontWeight: '600',
              }}>
                Finalizados Hoy
              </div>
              <div style={{
                fontSize: 'clamp(2.5rem, 4vw, 3.5rem)', /* Aumentado */
                fontWeight: 'bold',
                textShadow: '2px 2px 4px rgba(0, 0, 0, 0.3)',
                lineHeight: '1',
              }}>
                {realizadosHoy}
              </div>
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div style={{
          background: 'rgba(244, 67, 54, 0.9)',
          color: 'white',
          padding: '15px 30px',
          margin: '20px 40px',
          borderRadius: '10px',
          textAlign: 'center',
          fontSize: '1.1rem',
          fontWeight: 'bold'
        }}>
          ⚠️ {error}
        </div>
      )}

      <div className="pantalla-content">
        {/* Columna 1: Prioridad de Armado */}
        <div className="seccion-pedidos">
          <div className="seccion-header pendiente" style={{ minHeight: '70px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: 'clamp(1.3rem, 2.2vw, 1.8rem)', lineHeight: '1.2', fontWeight: 'bold' }}>PRIORIDAD DE ARMADO</h2>
            <span className="contador">{pedidosPrioridadArmado.length}</span>
          </div>
          <div className="pedidos-lista" style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px',
            maxHeight: 'calc(100vh - 250px)',
            overflowY: 'auto'
          }}>
            {pedidosPrioridadArmado.length > 0 ? (
              pedidosPrioridadArmado.map((pedido, index) => (
                <div
                  key={pedido.id}
                  className="pedido-item"
                  style={{ 
                    animationDelay: `${index * 0.05}s`,
                    padding: '10px 15px',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    border: `4px solid ${getPrioridadColor(pedido.prioridad)}`,
                    textAlign: 'center'
                  }}
                >
                  <div style={{ 
                    fontSize: 'clamp(2.4rem, 3.5vw, 3rem)', 
                    fontWeight: 'bold',
                    color: '#fff',
                    textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)'
                  }}>
                    {pedido.numeroPlanilla}
                  </div>
                </div>
              ))
            ) : (
              <div className="sin-pedidos" style={{ 
                padding: '20px', 
                textAlign: 'center', 
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '1.1rem'
              }}>
                No hay pedidos
              </div>
            )}
          </div>
        </div>

        {/* Columna 2: En Preparación */}
        <div className="seccion-pedidos">
          <div className="seccion-header proceso" style={{ minHeight: '70px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: 'clamp(1.3rem, 2.2vw, 1.8rem)', lineHeight: '1.2', fontWeight: 'bold' }}>EN PREPARACIÓN</h2>
            <span className="contador">{pedidosEnPreparacion.length}</span>
          </div>
          <div className="pedidos-lista" style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px',
            maxHeight: 'calc(100vh - 250px)',
            overflowY: 'auto'
          }}>
            {pedidosEnPreparacion.length > 0 ? (
              pedidosEnPreparacion.map((pedido, index) => (
                <div
                  key={pedido.id}
                  className="pedido-item proceso"
                  style={{ 
                    animationDelay: `${index * 0.05}s`,
                    padding: '10px 15px',
                    backgroundColor: 'rgba(33, 150, 243, 0.2)',
                    borderRadius: '8px',
                    border: '2px solid #2196F3',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ 
                    fontSize: 'clamp(2.4rem, 3.5vw, 3rem)', 
                    fontWeight: 'bold',
                    color: '#fff',
                    textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)'
                  }}>
                    {pedido.numeroPlanilla}
                  </div>
                </div>
              ))
            ) : (
              <div className="sin-pedidos" style={{ 
                padding: '20px', 
                textAlign: 'center', 
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '1.1rem'
              }}>
                No hay pedidos
              </div>
            )}
          </div>
        </div>

        {/* Columna 3: Control */}
        <div className="seccion-pedidos">
          <div className="seccion-header proceso" style={{ minHeight: '70px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: 'clamp(1.3rem, 2.2vw, 1.8rem)', lineHeight: '1.2', fontWeight: 'bold' }}>CONTROL</h2>
            <span className="contador">{pedidosControl.length}</span>
          </div>
          <div className="pedidos-lista" style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px',
            maxHeight: 'calc(100vh - 250px)',
            overflowY: 'auto'
          }}>
            {pedidosControl.length > 0 ? (
              pedidosControl.map((pedido, index) => (
                <div
                  key={pedido.id}
                  className="pedido-item proceso"
                  style={{ 
                    animationDelay: `${index * 0.05}s`,
                    padding: '10px 15px',
                    backgroundColor: 'rgba(33, 150, 243, 0.2)',
                    borderRadius: '8px',
                    border: '2px solid #2196F3',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ 
                    fontSize: 'clamp(2.4rem, 3.5vw, 3rem)', 
                    fontWeight: 'bold',
                    color: '#fff',
                    textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)'
                  }}>
                    {pedido.numeroPlanilla}
                  </div>
                </div>
              ))
            ) : (
              <div className="sin-pedidos" style={{ 
                padding: '20px', 
                textAlign: 'center', 
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '1.1rem'
              }}>
                No hay pedidos
              </div>
            )}
          </div>
        </div>

        {/* Columna 4: Pendiente de Carga */}
        <div className="seccion-pedidos">
          <div className="seccion-header pendiente-carga" style={{ minHeight: '70px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: 'clamp(1.3rem, 2.2vw, 1.8rem)', lineHeight: '1.2', fontWeight: 'bold' }}>PENDIENTE DE CARGA</h2>
            <span className="contador">{pedidosPendienteCarga.length}</span>
          </div>
          <div className="pedidos-lista" style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px',
            maxHeight: 'calc(100vh - 250px)',
            overflowY: 'auto'
          }}>
            {pedidosPendienteCarga.length > 0 ? (
              pedidosPendienteCarga.map((pedido, index) => (
                <div
                  key={pedido.id}
                  className="pedido-item proceso"
                  style={{ 
                    animationDelay: `${index * 0.05}s`,
                    padding: '10px 15px',
                    backgroundColor: 'rgba(255, 152, 0, 0.2)',
                    borderRadius: '8px',
                    border: '2px solid #FF9800',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ 
                    fontSize: 'clamp(2.4rem, 3.5vw, 3rem)', 
                    fontWeight: 'bold',
                    color: '#fff',
                    textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)'
                  }}>
                    {pedido.numeroPlanilla}
                  </div>
                </div>
              ))
            ) : (
              <div className="sin-pedidos" style={{ 
                padding: '20px', 
                textAlign: 'center', 
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '1.1rem'
              }}>
                No hay pedidos
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PantallaPublica;

