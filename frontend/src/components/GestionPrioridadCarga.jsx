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
  // Ref para evitar recargas cuando el cambio viene de esta misma sesión
  const actualizacionesLocales = useRef(new Set());

  useEffect(() => {
    cargarPedidos(true); // Solo mostrar loading en la carga inicial
    
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
          }
        }, 500);
      }
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

  const getFechaEntregaTexto = (pedido) => {
    if (!pedido.fechaEntrega) return null;
    
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const fechaEntrega = parseFechaLocal(pedido.fechaEntrega);
    if (!fechaEntrega) return null;
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
            Planillas Creadas
            <span className="contador-badge">{pedidosSinOrden.length}</span>
          </h2>
          <p className="seccion-descripcion">
            Planillas creadas que aún no están en la cola de prioridad. 
            Agrega las que quieras mostrar en la pantalla pública.
          </p>
          <div className="pedidos-lista">
            {pedidosSinOrden.length === 0 ? (
              <div className="sin-pedidos">No hay planillas creadas</div>
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
                      {pedidoSeleccionado.fechaEntradaColaPrioridad && (
                        <span>🕐 {new Date(pedidoSeleccionado.fechaEntradaColaPrioridad).toLocaleTimeString('es-AR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })}</span>
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
                  {pedidoSeleccionado.fechaEntrega && (
                    <div className="info-item">
                      <div className="info-label">📅 Despacho</div>
                      <div className="info-value">
                        {(() => {
                          const hoy = new Date();
                          hoy.setHours(0, 0, 0, 0);
                          const fechaEntrega = parseFechaLocal(pedidoSeleccionado.fechaEntrega);
                          if (!fechaEntrega) return 'Fecha inválida';
                          fechaEntrega.setHours(0, 0, 0, 0);
                          const diffTime = fechaEntrega - hoy;
                          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                          
                          if (diffDays === 0) {
                            return 'Sale hoy';
                          } else if (diffDays === 1) {
                            return 'Sale mañana';
                          } else {
                            const day = String(fechaEntrega.getDate()).padStart(2, '0');
                            const month = String(fechaEntrega.getMonth() + 1).padStart(2, '0');
                            const year = String(fechaEntrega.getFullYear()).slice(-2);
                            return `Sale ${day}/${month}/${year}`;
                          }
                        })()}
                      </div>
                    </div>
                  )}
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

                {/* Timestamps de etapas */}
                {(pedidoSeleccionado.fechaPreparacion || pedidoSeleccionado.fechaControl || pedidoSeleccionado.fechaPendienteCarga || pedidoSeleccionado.fechaFinalizado) && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    marginTop: '8px'
                  }}>
                    {/* Primera fila: Preparación y Control */}
                    {(pedidoSeleccionado.fechaPreparacion || pedidoSeleccionado.fechaControl) && (
                      <div style={{
                        display: 'flex',
                        gap: '12px'
                      }}>
                        {pedidoSeleccionado.fechaPreparacion && (
                          <div style={{
                            flex: 1,
                            padding: '12px',
                            background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
                            borderRadius: '8px',
                            border: '1px solid #90caf9'
                          }}>
                            <div style={{ 
                              fontSize: '0.85rem', 
                              fontWeight: '600', 
                              color: '#1565c0',
                              marginBottom: '4px'
                            }}>
                              ⏰ Preparación
                            </div>
                            <div style={{ 
                              fontSize: '0.9rem', 
                              color: '#1976d2',
                              fontWeight: '500'
                            }}>
                              {new Date(pedidoSeleccionado.fechaPreparacion).toLocaleString('es-AR', {
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
                        {pedidoSeleccionado.fechaControl && (
                          <div style={{
                            flex: 1,
                            padding: '12px',
                            background: 'linear-gradient(135deg, #fff9c4 0%, #fff59d 100%)',
                            borderRadius: '8px',
                            border: '1px solid #fff176'
                          }}>
                            <div style={{ 
                              fontSize: '0.85rem', 
                              fontWeight: '600', 
                              color: '#f57f17',
                              marginBottom: '4px'
                            }}>
                              🔍 Control
                            </div>
                            <div style={{ 
                              fontSize: '0.9rem', 
                              color: '#f9a825',
                              fontWeight: '500'
                            }}>
                              {new Date(pedidoSeleccionado.fechaControl).toLocaleString('es-AR', {
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
                        {!pedidoSeleccionado.fechaPreparacion && pedidoSeleccionado.fechaControl && (
                          <div style={{ flex: 1 }}></div>
                        )}
                      </div>
                    )}
                    {/* Segunda fila: Pendiente de Carga y Finalizado */}
                    {(pedidoSeleccionado.fechaPendienteCarga || pedidoSeleccionado.fechaFinalizado) && (
                      <div style={{
                        display: 'flex',
                        gap: '12px'
                      }}>
                        {pedidoSeleccionado.fechaPendienteCarga && (
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
                              ✅ Pendiente de Carga
                            </div>
                            <div style={{ 
                              fontSize: '0.9rem', 
                              color: '#F57C00',
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
                                color: '#E65100',
                                fontWeight: '500',
                                marginTop: '4px',
                                paddingTop: '4px',
                                borderTop: '1px solid rgba(230, 81, 0, 0.2)'
                              }}>
                                <strong>Controlado por:</strong> {pedidoSeleccionado.controladoPor}
                              </div>
                            )}
                          </div>
                        )}
                        {pedidoSeleccionado.fechaFinalizado && (
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
                              {new Date(pedidoSeleccionado.fechaFinalizado).toLocaleString('es-AR', {
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
                        )}
                        {!pedidoSeleccionado.fechaPendienteCarga && pedidoSeleccionado.fechaFinalizado && (
                          <div style={{ flex: 1 }}></div>
                        )}
                      </div>
                    )}
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
    </div>
  );
};

export default GestionPrioridadCarga;
