package com.Panelinformativo.pedidos.dto;

import com.Panelinformativo.pedidos.model.Pedido;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
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
    private LocalDateTime fechaPreparacion; // Fecha cuando pasó a EN_PREPARACION
    private LocalDateTime fechaControl; // Fecha cuando pasó a etapa CONTROL
    private LocalDateTime fechaPendienteCarga; // Fecha cuando pasó a PENDIENTE_CARGA
    private LocalDateTime fechaFinalizado; // Fecha cuando se finalizó el pedido
    private LocalDate fechaEntrega; // Fecha en que se ejecutará la vuelta
    private Integer ordenPrioridadCarga; // Orden en la cola de prioridad de carga
    private LocalDateTime fechaEntradaColaPrioridad; // Fecha cuando ingresó a la cola de prioridad de carga
    private Boolean controlado; // Indica si el pedido ha sido controlado cuando está en etapa CONTROL
    private String controladoPor; // Nombre del usuario que hizo el control
    private String finalizadoPor; // Nombre del usuario que finalizó el pedido
}

