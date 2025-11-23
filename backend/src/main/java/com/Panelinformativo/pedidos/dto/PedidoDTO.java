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
    private String transportistaCodigoInterno;
    private String transportistaChofer;
    private String transportistaVehiculo;
    private String transportista; // Mantener para compatibilidad con frontend
    private Pedido.Prioridad prioridad;
    private Pedido.EstadoPedido estado;
    private Long grupoId;
    private String grupoNombre;
    private String usuarioCreadorNombre;
    private LocalDateTime fechaCreacion;
    private LocalDateTime fechaActualizacion;
}

