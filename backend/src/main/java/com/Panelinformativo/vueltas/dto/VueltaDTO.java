package com.Panelinformativo.vueltas.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VueltaDTO {
    private Long id;
    private String nombre;
    private Boolean activo;
}

