package com.Panelinformativo.mensajes.dto;

import com.Panelinformativo.usuarios.model.Rol;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MensajeDTO {
    private Long id;
    private String contenido;
    private Long remitenteId;
    private String remitenteNombre;
    private Rol.TipoRol rolRemitente;
    private Rol.TipoRol rolDestinatario;
    private Boolean leido;
    private LocalDateTime fechaCreacion;
}

