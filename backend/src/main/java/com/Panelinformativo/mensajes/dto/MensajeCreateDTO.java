package com.Panelinformativo.mensajes.dto;

import com.Panelinformativo.usuarios.model.Rol;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MensajeCreateDTO {
    @NotBlank(message = "El contenido del mensaje es obligatorio")
    private String contenido;

    @NotNull(message = "El rol destinatario es obligatorio")
    private Rol.TipoRol rolDestinatario; // ADMIN o DEPOSITO
}

