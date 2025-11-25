package com.Panelinformativo.mensajes.model;

import com.Panelinformativo.usuarios.model.Usuario;
import com.Panelinformativo.usuarios.model.Rol;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "mensajes")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Mensaje {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 1000)
    private String contenido;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "remitente_id", nullable = false)
    private Usuario remitente;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Rol.TipoRol rolDestinatario; // ADMIN o DEPOSITO

    @Column(nullable = false)
    private Boolean leido = false;

    @Column(nullable = false, updatable = false)
    private LocalDateTime fechaCreacion = LocalDateTime.now();

    @Column(nullable = false)
    private LocalDate fechaDia; // Fecha del día (sin hora) para identificar mensajes del mismo día

    @PrePersist
    protected void onPrePersist() {
        if (fechaDia == null) {
            fechaDia = LocalDate.now();
        }
    }
}

