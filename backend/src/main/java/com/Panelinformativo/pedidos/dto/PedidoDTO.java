package com.Panelinformativo.pedidos.dto;

import com.Panelinformativo.pedidos.model.Pedido;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PedidoDTO {
    private Long id;
    private String numeroPlanilla;
    private Long transportistaId;
    private String transportistaNombre;
    private String transportista; // Mantener para compatibilidad con frontend (usar transportistaNombre)
    private Pedido.Prioridad prioridad;
    private Pedido.EstadoPedido estado;
    private Pedido.EtapaPreparacion etapaPreparacion;
    private Long grupoId;
    private String grupoNombre;
    private Long zonaId;
    private String zonaNombre;
    private Integer cantidad;
    private Long vueltaId;
    private String vueltaNombre;
    private String usuarioCreadorNombre;
    private LocalDateTime fechaCreacion;
    private LocalDateTime fechaActualizacion;
}

