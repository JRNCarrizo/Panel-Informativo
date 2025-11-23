package com.Panelinformativo.pedidos.repository;

import com.Panelinformativo.pedidos.model.Pedido;
import com.Panelinformativo.pedidos.model.Pedido.EstadoPedido;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PedidoRepository extends JpaRepository<Pedido, Long> {
    Optional<Pedido> findByNumeroPlanilla(String numeroPlanilla);
    List<Pedido> findByEstado(EstadoPedido estado);
    List<Pedido> findByEstadoOrderByPrioridadDescFechaCreacionAsc(EstadoPedido estado);
    
    @Query("SELECT p FROM Pedido p WHERE p.estado = :estado ORDER BY p.fechaActualizacion DESC, p.fechaCreacion DESC")
    List<Pedido> findByEstadoOrderByFechaActualizacionDesc(@Param("estado") EstadoPedido estado);
    
    List<Pedido> findAllByOrderByFechaCreacionDesc();
}

