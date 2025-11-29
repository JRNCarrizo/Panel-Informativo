package com.Panelinformativo.zonas.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ZonaDTO {
    private Long id;
    private String nombre;
    private Boolean activo;
}

