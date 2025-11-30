package com.Panelinformativo.pedidos.dto;

import com.Panelinformativo.pedidos.model.Pedido;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Min;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PedidoCreateDTO {
    @NotBlank(message = "El número de planilla es obligatorio")
    private String numeroPlanilla;

    private String transportistaNombre; // Nombre del transporte (se creará/obtendrá automáticamente)

    private String zonaNombre; // Nombre de la zona (se creará/obtendrá automáticamente)

    @NotNull(message = "La cantidad es obligatoria")
    @Min(value = 1, message = "La cantidad debe ser mayor a 0")
    private Integer cantidad; // Cantidad de bultos

    @NotBlank(message = "La vuelta es obligatoria")
    private String vueltaNombre; // Nombre de la vuelta (se creará/obtendrá automáticamente)

    private Pedido.Prioridad prioridad = Pedido.Prioridad.NORMAL;
}

