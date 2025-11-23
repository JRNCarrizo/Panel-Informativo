package com.Panelinformativo.transportistas.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TransportistaDTO {
    private Long id;
    private String codigoInterno;
    private String chofer;
    private String vehiculo;
    private Boolean activo;
}

