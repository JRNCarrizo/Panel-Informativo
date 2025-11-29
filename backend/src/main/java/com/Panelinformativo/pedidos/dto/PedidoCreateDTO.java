package com.Panelinformativo.pedidos.dto;

import com.Panelinformativo.pedidos.model.Pedido;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PedidoCreateDTO {
    @NotBlank(message = "El número de planilla es obligatorio")
    private String numeroPlanilla;

    private Long transportistaId;

    private String zonaNombre; // Nombre de la zona (se creará/obtendrá automáticamente)

    private Pedido.Prioridad prioridad = Pedido.Prioridad.NORMAL;
}

