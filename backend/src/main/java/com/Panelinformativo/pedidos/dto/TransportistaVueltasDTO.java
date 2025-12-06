package com.Panelinformativo.pedidos.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TransportistaVueltasDTO {
    private Long transportistaId;
    private String transportistaNombre;
    private Map<String, List<String>> vueltasPorFecha; // Mapa: fecha de entrega (String) -> lista de nombres de vueltas
}

