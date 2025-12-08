package com.Panelinformativo.usuarios.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "roles")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Rol {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, unique = true)
    private TipoRol nombre;

    public enum TipoRol {
        ADMIN_PRINCIPAL,    // Panel Admin - Crea y elimina planillas
        ADMIN_DEPOSITO,     // Panel Depósito - Gestiona Prioridad de Carga
        PLANILLERO,         // Panel Depósito - Selecciona y prepara planillas
        CONTROL             // Panel Depósito - Controla y finaliza planillas
    }
}

