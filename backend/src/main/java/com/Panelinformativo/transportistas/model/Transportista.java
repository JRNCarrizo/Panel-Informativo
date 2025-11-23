package com.Panelinformativo.transportistas.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.DynamicUpdate;

@Entity
@Table(name = "transportistas")
@Data
@NoArgsConstructor
@AllArgsConstructor
@DynamicUpdate
public class Transportista {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String codigoInterno;

    @Column(nullable = false)
    private String chofer;

    @Column(nullable = false)
    private String vehiculo;

    @Column(nullable = false)
    private Boolean activo = true;
}

