package com.Panelinformativo.pedidos.repository;

import com.Panelinformativo.pedidos.model.Pedido;
import com.Panelinformativo.pedidos.model.Pedido.EstadoPedido;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.Panelinformativo.transportistas.model.Transportista;
import com.Panelinformativo.vueltas.model.Vuelta;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface PedidoRepository extends JpaRepository<Pedido, Long> {
    Optional<Pedido> findByNumeroPlanilla(String numeroPlanilla);
    List<Pedido> findByEstado(EstadoPedido estado);
    
    @Query("SELECT p FROM Pedido p WHERE p.estado = :estado ORDER BY p.fechaCreacion ASC")
    List<Pedido> findByEstadoOrderByFechaCreacionAsc(@Param("estado") EstadoPedido estado);
    
    @Query("SELECT p FROM Pedido p WHERE p.estado = :estado ORDER BY p.fechaActualizacion DESC, p.fechaCreacion DESC")
    List<Pedido> findByEstadoOrderByFechaActualizacionDesc(@Param("estado") EstadoPedido estado);
    
    List<Pedido> findAllByOrderByFechaCreacionDesc();
    
    // Obtener pedidos pendientes sin orden de prioridad de carga asignado
    @Query("SELECT p FROM Pedido p WHERE p.estado = 'PENDIENTE' AND p.ordenPrioridadCarga IS NULL ORDER BY p.fechaCreacion ASC")
    List<Pedido> findPendientesSinOrdenPrioridadCarga();
    
    // Obtener pedidos pendientes con orden de prioridad de carga asignado, ordenados por ese orden
    @Query("SELECT p FROM Pedido p WHERE p.estado = 'PENDIENTE' AND p.ordenPrioridadCarga IS NOT NULL ORDER BY p.ordenPrioridadCarga ASC")
    List<Pedido> findPendientesConOrdenPrioridadCarga();
    
    // Obtener el máximo orden de prioridad de carga
    @Query("SELECT COALESCE(MAX(p.ordenPrioridadCarga), 0) FROM Pedido p WHERE p.ordenPrioridadCarga IS NOT NULL")
    Integer findMaxOrdenPrioridadCarga();
    
    // Validar si un transporte ya tiene una vuelta asignada en la fecha de entrega
    @Query("SELECT p FROM Pedido p WHERE p.transportista = :transportista AND p.vuelta = :vuelta AND p.fechaEntrega = :fechaEntrega")
    List<Pedido> findByTransportistaAndVueltaAndFechaEntrega(
        @Param("transportista") Transportista transportista,
        @Param("vuelta") Vuelta vuelta,
        @Param("fechaEntrega") LocalDate fechaEntrega
    );
    
    // Obtener pedidos creados en el día actual
    @Query("SELECT p FROM Pedido p WHERE p.fechaCreacion >= :inicioDia AND p.fechaCreacion < :finDia ORDER BY p.fechaCreacion DESC")
    List<Pedido> findByFechaCreacionBetween(
        @Param("inicioDia") LocalDateTime inicioDia,
        @Param("finDia") LocalDateTime finDia
    );
    
    // Obtener pedidos de un transporte en el día actual
    @Query("SELECT p FROM Pedido p WHERE p.transportista = :transportista AND p.fechaCreacion >= :inicioDia AND p.fechaCreacion < :finDia ORDER BY p.fechaCreacion DESC")
    List<Pedido> findByTransportistaAndFechaCreacionBetween(
        @Param("transportista") Transportista transportista,
        @Param("inicioDia") LocalDateTime inicioDia,
        @Param("finDia") LocalDateTime finDia
    );
}

