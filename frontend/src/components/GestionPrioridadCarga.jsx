import { useState, useEffect, useRef } from 'react';
import { pedidoService } from '../services/pedidoService';
import { connectWebSocket, disconnectWebSocket } from '../services/websocketService';
import './GestionPrioridadCarga.css';

const GestionPrioridadCarga = ({ onContadorCambio, onPedidoAgregadoACola, onPedidoRemovidoDeCola }) => {
  const [pedidosSinOrden, setPedidosSinOrden] = useState([]);
  const [pedidosConOrden, setPedidosConOrden] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [showModalDetalle, setShowModalDetalle] = useState(false);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  const [showModalPlanillasDelDia, setShowModalPlanillasDelDia] = useState(false);
  const [planillasDelDia, setPlanillasDelDia] = useState([]);
  const [loadingPlanillasDelDia, setLoadingPlanillasDelDia] = useState(false);
  const [cantidadPlanillasDelDia, setCantidadPlanillasDelDia] = useState(0);
  const [showModalTransportistas, setShowModalTransportistas] = useState(false);
  const [transportistasVueltas, setTransportistasVueltas] = useState([]);
  const [loadingTransportistas, setLoadingTransportistas] = useState(false);
  const [fechasExpandidas, setFechasExpandidas] = useState(new Set());
  // Ref para evitar recargas cuando el cambio viene de esta misma sesión
  const actualizacionesLocales = useRef(new Set());

  const cargarCantidadPlanillasDelDia = async () => {
    try {
      const response = await pedidoService.obtenerPlanillasDelDia();
      setCantidadPlanillasDelDia((response.data || []).length);
    } catch (err) {
      console.error('Error al cargar cantidad de planillas del día:', err);
    }
  };

  useEffect(() => {
    cargarPedidos(true); // Solo mostrar loading en la carga inicial
    cargarCantidadPlanillasDelDia(); // Cargar cantidad de planillas del día
    
    const stompClient = connectWebSocket((message) => {
      // Verificar si este cambio viene de una actualización local
      if (message.id && actualizacionesLocales.current.has(message.id)) {
        // Es un cambio que hicimos nosotros, ignorar para evitar recarga
        actualizacionesLocales.current.delete(message.id);
        return;
      }
      
      if (message.tipo === 'eliminado') {
        setPedidosSinOrden((prev) => prev.filter((p) => p.id !== message.id));
        setPedidosConOrden((prev) => prev.filter((p) => p.id !== message.id));
      } else if (message.tipo === 'actualizado' && message.pedido) {
        // Actualizar solo el pedido específico sin recargar todo
        const pedidoActualizado = message.pedido;
        
        // Si tiene ordenPrioridadCarga, actualizar en la lista con orden
        if (pedidoActualizado.ordenPrioridadCarga !== null && pedidoActualizado.ordenPrioridadCarga !== undefined) {
          setPedidosConOrden((prev) => {
            const index = prev.findIndex(p => p.id === pedidoActualizado.id);
            if (index >= 0) {
              // Actualizar el pedido existente
              const nuevo = [...prev];
              nuevo[index] = pedidoActualizado;
              // Reordenar según ordenPrioridadCarga
              return nuevo.sort((a, b) => (a.ordenPrioridadCarga || 0) - (b.ordenPrioridadCarga || 0));
            } else {
              // Agregar nuevo pedido a la lista
              const nuevo = [...prev, pedidoActualizado];
              return nuevo.sort((a, b) => (a.ordenPrioridadCarga || 0) - (b.ordenPrioridadCarga || 0));
            }
          });
          
          // Remover de la lista sin orden si está ahí
          setPedidosSinOrden((prev) => prev.filter((p) => p.id !== pedidoActualizado.id));
        } else {
          // No tiene orden, mover a la lista sin orden
          setPedidosConOrden((prev) => prev.filter((p) => p.id !== pedidoActualizado.id));
          setPedidosSinOrden((prev) => {
            const index = prev.findIndex(p => p.id === pedidoActualizado.id);
            if (index >= 0) {
              // Actualizar el pedido existente
              const nuevo = [...prev];
              nuevo[index] = pedidoActualizado;
              return nuevo;
            } else {
              // Agregar nuevo pedido a la lista
              return [...prev, pedidoActualizado];
            }
          });
        }
      } else {
        // Para otros tipos de mensajes, recargar solo si no es una actualización local
        setTimeout(() => {
          if (!actualizacionesLocales.current.size) {
            cargarPedidos();
            cargarCantidadPlanillasDelDia(); // Actualizar contador también
          }
        }, 500);
      }
      
      // Siempre actualizar el contador de planillas del día cuando hay cambios
      cargarCantidadPlanillasDelDia();
    });

    return () => {
      disconnectWebSocket();
    };
  }, []);

  const cargarPedidos = async (mostrarLoading = false) => {
    try {
      if (mostrarLoading) {
        setLoading(true);
      }
      setError(null);
      const [sinOrden, conOrden] = await Promise.all([
        pedidoService.obtenerPendientesSinOrden(),
        pedidoService.obtenerConOrdenPrioridadCarga(),
      ]);
      setPedidosSinOrden(sinOrden.data || []);
      setPedidosConOrden(conOrden.data || []);
    } catch (err) {
      console.error('Error al cargar pedidos:', err);
      setError('Error al cargar los pedidos. Verifica que el backend esté corriendo.');
    } finally {
      if (mostrarLoading) {
        setLoading(false);
      }
    }
  };

  const agregarACola = async (pedidoId) => {
    try {
      // Marcar como actualización local
      actualizacionesLocales.current.add(pedidoId);
      
      // Encontrar el pedido en la lista sin orden
      const pedido = pedidosSinOrden.find(p => p.id === pedidoId);
      if (!pedido) return;
      
      // Actualizar estado local inmediatamente
      setPedidosSinOrden(prev => {
        const nuevo = prev.filter(p => p.id !== pedidoId);
        // Actualizar contador inmediatamente (actualización optimista)
        if (onContadorCambio) {
          onContadorCambio(nuevo.length);
        }
        return nuevo;
      });
      
      // Calcular el nuevo orden (al final de la cola)
      const nuevoOrden = pedidosConOrden.length + 1;
      const pedidoConOrden = {
        ...pedido,
        ordenPrioridadCarga: nuevoOrden,
        estado: pedido.estado || 'PENDIENTE' // Asegurar que tenga estado PENDIENTE
      };
      setPedidosConOrden(prev => [...prev, pedidoConOrden]);
      
      // Notificar que se agregó a la cola para actualizar el contador de Pendientes
      if (onPedidoAgregadoACola) {
        onPedidoAgregadoACola(pedidoConOrden);
      }
      
      // Enviar al backend en segundo plano
      pedidoService.agregarAColaPrioridadCarga(pedidoId)
        .then(() => {
          // Limpiar la marca después de un delay
          setTimeout(() => {
            actualizacionesLocales.current.delete(pedidoId);
          }, 2000);
        })
        .catch((err) => {
          console.error('Error al agregar a la cola:', err);
          // Limpiar la marca
          actualizacionesLocales.current.delete(pedidoId);
          // Si hay error, revertir los cambios locales
          setPedidosSinOrden(prev => {
            const revertido = [...prev, pedido];
            // Revertir contador también
            if (onContadorCambio) {
              onContadorCambio(revertido.length);
            }
            return revertido;
          });
          setPedidosConOrden(prev => prev.filter(p => p.id !== pedidoId));
          
          // Revertir también el contador de Pendientes
          if (onPedidoRemovidoDeCola) {
            onPedidoRemovidoDeCola(pedidoId);
          }
          alert(err.response?.data || 'Error al agregar el pedido a la cola');
        });
    } catch (err) {
      console.error('Error al agregar a la cola:', err);
      alert(err.response?.data || 'Error al agregar el pedido a la cola');
    }
  };

  const removerDeCola = async (pedidoId) => {
    try {
      // Marcar como actualización local
      actualizacionesLocales.current.add(pedidoId);
      
      // Encontrar el pedido en la lista con orden
      const pedido = pedidosConOrden.find(p => p.id === pedidoId);
      if (!pedido) return;
      
      // Guardar el pedido para restaurarlo si hay error
      const pedidoParaRestaurar = { ...pedido };
      
      // Obtener todos los IDs de pedidos con orden para actualizar sus índices
      const todosLosIds = pedidosConOrden.map(p => p.id);
      const idsRestantes = todosLosIds.filter(id => id !== pedidoId);
      
      // Actualizar estado local inmediatamente
      setPedidosConOrden(prev => {
        const nuevo = prev.filter(p => p.id !== pedidoId);
        // Recalcular los índices de orden para los pedidos restantes
        return nuevo.map((p, index) => ({
          ...p,
          ordenPrioridadCarga: index + 1
        }));
      });
      
      // Agregar de vuelta a la lista sin orden
      const pedidoSinOrden = { ...pedido };
      delete pedidoSinOrden.ordenPrioridadCarga;
      setPedidosSinOrden(prev => {
        const nuevo = [...prev, pedidoSinOrden];
        // Actualizar contador inmediatamente (actualización optimista)
        if (onContadorCambio) {
          onContadorCambio(nuevo.length);
        }
        return nuevo;
      });
      
      // Notificar que se removió de la cola para actualizar el contador de Pendientes
      if (onPedidoRemovidoDeCola) {
        onPedidoRemovidoDeCola(pedidoId);
      }
      
      // Actualizar el orden en el backend en segundo plano para todos los pedidos restantes
      if (idsRestantes.length > 0) {
        // Marcar todos los pedidos restantes como actualizaciones locales
        idsRestantes.forEach(id => actualizacionesLocales.current.add(id));
        
        pedidoService.actualizarOrdenPrioridadCarga(idsRestantes)
          .then(() => {
            setTimeout(() => {
              idsRestantes.forEach(id => actualizacionesLocales.current.delete(id));
            }, 2000);
          })
          .catch(err => {
            idsRestantes.forEach(id => actualizacionesLocales.current.delete(id));
            console.error('Error al actualizar orden después de remover:', err);
          });
      }
      
      // Enviar al backend en segundo plano
      pedidoService.removerDeColaPrioridadCarga(pedidoId)
        .then(() => {
          setTimeout(() => {
            actualizacionesLocales.current.delete(pedidoId);
          }, 2000);
        })
        .catch((err) => {
          console.error('Error al remover de la cola:', err);
          // Limpiar la marca
          actualizacionesLocales.current.delete(pedidoId);
          // Si hay error, revertir los cambios locales
          setPedidosConOrden(prev => {
            // Restaurar el pedido en su posición original
            const pedidoRestaurado = { ...pedidoParaRestaurar };
            const todos = [...prev, pedidoRestaurado];
            return todos.sort((a, b) => 
              (a.ordenPrioridadCarga || 0) - (b.ordenPrioridadCarga || 0)
            );
          });
          setPedidosSinOrden(prev => {
            const revertido = prev.filter(p => p.id !== pedidoId);
            // Revertir contador también
            if (onContadorCambio) {
              onContadorCambio(revertido.length);
            }
            return revertido;
          });
          
          // Revertir también el contador de Pendientes
          if (onPedidoAgregadoACola) {
            // Restaurar el pedido en la lista de Pendientes
            const pedidoRestaurado = { ...pedidoParaRestaurar };
            onPedidoAgregadoACola(pedidoRestaurado);
          }
          alert(err.response?.data || 'Error al remover el pedido de la cola');
        });
    } catch (err) {
      console.error('Error al remover de la cola:', err);
      alert(err.response?.data || 'Error al remover el pedido de la cola');
    }
  };

  const actualizarOrden = async (nuevoOrden) => {
    try {
      const pedidoIds = nuevoOrden.map((p) => p.id);
      
      // Marcar estos pedidos como actualizaciones locales para evitar recarga del WebSocket
      pedidoIds.forEach(id => actualizacionesLocales.current.add(id));
      
      // Actualizar el ordenPrioridadCarga localmente en cada pedido
      const nuevoOrdenConIndices = nuevoOrden.map((pedido, index) => ({
        ...pedido,
        ordenPrioridadCarga: index + 1
      }));
      
      // Actualizar el estado local inmediatamente (sin recargar)
      setPedidosConOrden(nuevoOrdenConIndices);
      
      // Enviar al backend en segundo plano (sin bloquear la UI)
      pedidoService.actualizarOrdenPrioridadCarga(pedidoIds)
        .then(() => {
          // Limpiar los IDs de actualizaciones locales después de un delay
          setTimeout(() => {
            pedidoIds.forEach(id => actualizacionesLocales.current.delete(id));
          }, 2000);
        })
        .catch((err) => {
          console.error('Error al actualizar orden en el backend:', err);
          // Limpiar las marcas de actualizaciones locales
          pedidoIds.forEach(id => actualizacionesLocales.current.delete(id));
          // Si hay error, recargar para restaurar el estado correcto
          cargarPedidos();
          alert(err.response?.data || 'Error al actualizar el orden. Se restauró el orden anterior.');
        });
    } catch (err) {
      console.error('Error al actualizar orden:', err);
      // Si hay error, recargar para restaurar el estado anterior
      await cargarPedidos();
      alert(err.response?.data || 'Error al actualizar el orden');
    }
  };

  const handleDragStart = (e, index, pedido) => {
    setDraggedItem({ index, pedido });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    setDragOverIndex(null);

    if (draggedItem === null || draggedItem.index === dropIndex) {
      setDraggedItem(null);
      return;
    }

    const nuevoOrden = [...pedidosConOrden];
    const [removed] = nuevoOrden.splice(draggedItem.index, 1);
    nuevoOrden.splice(dropIndex, 0, removed);

    setPedidosConOrden(nuevoOrden);
    setDraggedItem(null);

    // Guardar el nuevo orden en el backend
    actualizarOrden(nuevoOrden);
  };

  const moverArriba = (index) => {
    if (index === 0) return;
    const nuevoOrden = [...pedidosConOrden];
    [nuevoOrden[index - 1], nuevoOrden[index]] = [nuevoOrden[index], nuevoOrden[index - 1]];
    setPedidosConOrden(nuevoOrden);
    actualizarOrden(nuevoOrden);
  };

  const moverAbajo = (index) => {
    if (index === pedidosConOrden.length - 1) return;
    const nuevoOrden = [...pedidosConOrden];
    [nuevoOrden[index], nuevoOrden[index + 1]] = [nuevoOrden[index + 1], nuevoOrden[index]];
    setPedidosConOrden(nuevoOrden);
    actualizarOrden(nuevoOrden);
  };

  const abrirModalDetalle = (pedido) => {
    setPedidoSeleccionado(pedido);
    setShowModalDetalle(true);
  };

  const cerrarModalDetalle = () => {
    setShowModalDetalle(false);
    setPedidoSeleccionado(null);
  };

  const abrirModalPlanillasDelDia = async () => {
    setShowModalPlanillasDelDia(true);
    setLoadingPlanillasDelDia(true);
    try {
      const response = await pedidoService.obtenerPlanillasDelDia();
      const planillas = response.data || [];
      setPlanillasDelDia(planillas);
      setCantidadPlanillasDelDia(planillas.length); // Actualizar el contador también
    } catch (err) {
      console.error('Error al cargar planillas del día:', err);
      setError('Error al cargar las planillas del día');
    } finally {
      setLoadingPlanillasDelDia(false);
    }
  };

  const cerrarModalPlanillasDelDia = () => {
    setShowModalPlanillasDelDia(false);
    setPlanillasDelDia([]);
  };

  const abrirModalTransportistas = async () => {
    setShowModalTransportistas(true);
    setLoadingTransportistas(true);
    try {
      const response = await pedidoService.obtenerTransportistasVueltasDelDia();
      setTransportistasVueltas(response.data || []);
      
      // Expandir automáticamente la fecha actual
      const hoy = new Date().toISOString().split('T')[0];
      setFechasExpandidas(new Set([hoy]));
    } catch (err) {
      console.error('Error al cargar transportistas y vueltas:', err);
      setError('Error al cargar los transportistas y vueltas');
    } finally {
      setLoadingTransportistas(false);
    }
  };

  const cerrarModalTransportistas = () => {
    setShowModalTransportistas(false);
    setTransportistasVueltas([]);
    setFechasExpandidas(new Set());
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

  const getEstadoTexto = (pedido) => {
    if (pedido.estado === 'REALIZADO') {
      return 'Finalizado';
    } else if (pedido.estado === 'EN_PREPARACION') {
      if (!pedido.etapaPreparacion) {
        return 'En Preparación';
      } else if (pedido.etapaPreparacion === 'CONTROL') {
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

  const getEstadoColor = (pedido) => {
    if (pedido.estado === 'REALIZADO') {
      return '#4CAF50';
    } else if (pedido.estado === 'EN_PREPARACION') {
      if (!pedido.etapaPreparacion) {
        return '#2196F3';
      } else if (pedido.etapaPreparacion === 'CONTROL') {
        return pedido.controlado ? '#4CAF50' : '#F44336';
      } else if (pedido.etapaPreparacion === 'PENDIENTE_CARGA') {
        return '#FF9800';
      }
      return '#2196F3';
    } else if (pedido.estado === 'PENDIENTE') {
      return '#9E9E9E';
    }
    return '#666';
  };

  const getFechaEntregaTexto = (pedido) => {
    if (!pedido.fechaEntrega) return null;
    
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const fechaEntrega = new Date(pedido.fechaEntrega);
    fechaEntrega.setHours(0, 0, 0, 0);
    
    const diffTime = fechaEntrega - hoy;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Sale hoy';
    } else if (diffDays === 1) {
      return 'Sale mañana';
    } else if (diffDays > 1) {
      return fechaEntrega.toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }
    return null;
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div className="gestion-prioridad-carga">
      {error && (
        <div style={{
          background: '#f44336',
          color: 'white',
          padding: '15px',
          marginBottom: '20px',
          borderRadius: '8px',
        }}>
          ⚠️ {error}
        </div>
      )}

      <div className="gestion-container">
        {/* Columna izquierda: Pedidos sin orden */}
        <div className="pedidos-sin-orden">
          <h2 className="seccion-titulo">
            Planillas Recibidas
            <span className="contador-badge">{pedidosSinOrden.length}</span>
          </h2>
          <p className="seccion-descripcion">
            Planillas recibidas que aún no están en la cola de prioridad. 
            Agrega las que quieras mostrar en la pantalla pública.
          </p>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
            <button
              onClick={abrirModalPlanillasDelDia}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6366f1',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                position: 'relative',
              }}
            >
              📋 Ver Planillas del Día
              {cantidadPlanillasDelDia > 0 && (
                <span
                  style={{
                    backgroundColor: '#ffffff',
                    color: '#6366f1',
                    borderRadius: '12px',
                    padding: '2px 8px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    minWidth: '20px',
                    textAlign: 'center',
                  }}
                >
                  {cantidadPlanillasDelDia}
                </span>
              )}
            </button>
            <button
              onClick={abrirModalTransportistas}
              style={{
                padding: '8px 16px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              🚚 Ver Transportes y Vueltas
            </button>
          </div>
          <div className="pedidos-lista">
            {pedidosSinOrden.length === 0 ? (
              <div className="sin-pedidos">No hay planillas recibidas</div>
            ) : (
              pedidosSinOrden.map((pedido) => (
                <div key={pedido.id} className="pedido-item-sin-orden">
                  <div className="pedido-info">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div className="numero-planilla">{pedido.numeroPlanilla}</div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn-ver"
                          onClick={() => abrirModalDetalle(pedido)}
                          title="Ver detalles de la planilla"
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#2196F3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '10px',
                            fontWeight: '600',
                          }}
                        >
                          👁️ Ver
                        </button>
                        <button
                          className="btn-agregar"
                          onClick={() => agregarACola(pedido.id)}
                          title="Agregar a la cola de prioridad"
                        >
                          ➕ Agregar
                        </button>
                      </div>
                    </div>
                    <div className="pedido-detalles">
                      <span>{pedido.transportistaNombre || pedido.transportista}</span>
                      {pedido.vueltaNombre && <span> • {pedido.vueltaNombre}</span>}
                      {pedido.cantidad && <span> • {pedido.cantidad} total</span>}
                      {getFechaEntregaTexto(pedido) && (
                        <span style={{ 
                          fontWeight: '600', 
                          color: '#2563eb',
                          marginLeft: '8px'
                        }}>
                          • 📅 {getFechaEntregaTexto(pedido)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Columna derecha: Cola de prioridad de carga */}
        <div className="cola-prioridad">
          <h2 className="seccion-titulo">
            Cola de Prioridad de Carga
            <span className="contador-badge">{pedidosConOrden.length}</span>
          </h2>
          <p className="seccion-descripcion">
            Ordena las planillas arrastrando o usando los botones. 
            Este orden se muestra en la pantalla pública.
          </p>
          <div className="pedidos-lista-ordenada">
            {pedidosConOrden.length === 0 ? (
              <div className="sin-pedidos">
                No hay planillas en la cola. Agrega algunas desde la columna izquierda.
              </div>
            ) : (
              pedidosConOrden.map((pedido, index) => (
                <div
                  key={pedido.id}
                  className={`pedido-item-orden ${draggedItem?.index === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index, pedido)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                >
                  <div className="orden-indicador">#{index + 1}</div>
                  <div className="pedido-info">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div className="numero-planilla">{pedido.numeroPlanilla}</div>
                      <div className="pedido-acciones">
                        <button
                          className="btn-ver"
                          onClick={() => abrirModalDetalle(pedido)}
                          title="Ver detalles de la planilla"
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#2196F3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '10px',
                            fontWeight: '600',
                            marginRight: '4px',
                          }}
                        >
                          👁️ Ver
                        </button>
                        <button
                          className="btn-mover"
                          onClick={() => moverArriba(index)}
                          disabled={index === 0}
                          title="Mover arriba"
                        >
                          ▲
                        </button>
                        <button
                          className="btn-mover"
                          onClick={() => moverAbajo(index)}
                          disabled={index === pedidosConOrden.length - 1}
                          title="Mover abajo"
                        >
                          ▼
                        </button>
                        <button
                          className="btn-remover"
                          onClick={() => removerDeCola(pedido.id)}
                          title="Remover de la cola"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className="pedido-detalles">
                      <span>{pedido.transportistaNombre || pedido.transportista}</span>
                      {pedido.vueltaNombre && <span> • {pedido.vueltaNombre}</span>}
                      {pedido.cantidad && <span> • {pedido.cantidad} total</span>}
                      {getFechaEntregaTexto(pedido) && (
                        <span style={{ 
                          fontWeight: '600', 
                          color: '#2563eb',
                          marginLeft: '8px'
                        }}>
                          • 📅 {getFechaEntregaTexto(pedido)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal de Detalles */}
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
                      {pedidoSeleccionado.numeroPlanilla}
                    </h3>
                    <div style={{
                      fontSize: '0.85rem',
                      color: '#64748b',
                      marginTop: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flexWrap: 'wrap'
                    }}>
                      <span>🕐 {pedidoSeleccionado.fechaCreacion && new Date(pedidoSeleccionado.fechaCreacion).toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}</span>
                      {getFechaEntregaTexto(pedidoSeleccionado) && (
                        <span style={{ 
                          fontWeight: '600', 
                          color: '#2563eb',
                          backgroundColor: '#eff6ff',
                          padding: '2px 8px',
                          borderRadius: '4px'
                        }}>
                          📅 {getFechaEntregaTexto(pedidoSeleccionado)}
                        </span>
                      )}
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
                        const hoy = new Date();
                        hoy.setHours(0, 0, 0, 0);
                        const fechaEntrega = new Date(pedidoSeleccionado.fechaEntrega);
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

                {pedidoSeleccionado.estado === 'REALIZADO' && pedidoSeleccionado.fechaActualizacion && (
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
                      {new Date(pedidoSeleccionado.fechaActualizacion).toLocaleString('es-AR', {
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

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
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

      {/* Modal de Planillas del Día */}
      {showModalPlanillasDelDia && (
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
          onClick={cerrarModalPlanillasDelDia}
        >
          <div
            style={{
              backgroundColor: 'white',
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
                📋 Planillas Recibidas del Día
              </h2>
              <button
                onClick={cerrarModalPlanillasDelDia}
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

            {loadingPlanillasDelDia ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <p>Cargando planillas del día...</p>
              </div>
            ) : planillasDelDia.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                <p>No hay planillas recibidas hoy</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {planillasDelDia.map((pedido) => (
                  <div
                    key={pedido.id}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '16px',
                      display: 'flex',
                      gap: '16px',
                      alignItems: 'flex-start',
                      position: 'relative',
                    }}
                  >
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '4px' }}>Nro. Planilla</div>
                        <div style={{ fontWeight: '600', color: '#1e293b' }}>{pedido.numeroPlanilla}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '4px' }}>Cantidad</div>
                        <div style={{ fontWeight: '600', color: '#1e293b' }}>{pedido.cantidad || 'N/A'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '4px' }}>Zona</div>
                        <div style={{ fontWeight: '600', color: '#1e293b' }}>{pedido.zonaNombre || 'N/A'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '4px' }}>Transporte</div>
                        <div style={{ fontWeight: '600', color: '#1e293b' }}>
                          {pedido.transportistaNombre || pedido.transportista || 'N/A'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end', minWidth: '120px' }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '4px', textAlign: 'right' }}>Estado</div>
                        <span
                          style={{
                            backgroundColor: getEstadoColor(pedido),
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            display: 'inline-block',
                          }}
                        >
                          {getEstadoTexto(pedido)}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          cerrarModalPlanillasDelDia();
                          abrirModalDetalle(pedido);
                        }}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#2196F3',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        👁️ Ver
                      </button>
                    </div>
                    {pedido.fechaCreacion && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '8px',
                          left: '16px',
                          fontSize: '0.75rem',
                          color: '#9ca3af',
                          fontStyle: 'italic',
                        }}
                      >
                        {new Date(pedido.fechaCreacion).toLocaleTimeString('es-AR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Transportistas y Vueltas */}
      {showModalTransportistas && (
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
          onClick={cerrarModalTransportistas}
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
                onClick={cerrarModalTransportistas}
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

            {loadingTransportistas ? (
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

export default GestionPrioridadCarga;

