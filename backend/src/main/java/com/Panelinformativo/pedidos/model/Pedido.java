package com.Panelinformativo.pedidos.model;

import com.Panelinformativo.grupos.model.Grupo;
import com.Panelinformativo.transportistas.model.Transportista;
import com.Panelinformativo.usuarios.model.Usuario;
import com.Panelinformativo.zonas.model.Zona;
import com.Panelinformativo.vueltas.model.Vuelta;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "pedidos")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Pedido {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String numeroPlanilla;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "transportista_id")
    private Transportista transportista;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EstadoPedido estado = EstadoPedido.PENDIENTE;

    @Enumerated(EnumType.STRING)
    @Column(nullable = true)
    private EtapaPreparacion etapaPreparacion;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "grupo_id")
    private Grupo grupoAsignado;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "zona_id")
    private Zona zona;

    @Column(nullable = true)
    private Integer cantidad; // Cantidad de bultos

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "vuelta_id")
    private Vuelta vuelta;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "usuario_creador_id", nullable = false)
    private Usuario usuarioCreador;

    @Column(nullable = false, updatable = false)
    private LocalDateTime fechaCreacion = LocalDateTime.now();

    private LocalDateTime fechaActualizacion;
    
    @Column(nullable = true)
    private LocalDateTime fechaPreparacion; // Fecha cuando pasó a EN_PREPARACION
    
    @Column(nullable = true)
    private LocalDateTime fechaControl; // Fecha cuando pasó a etapa CONTROL
    
    @Column(nullable = true)
    private LocalDateTime fechaPendienteCarga; // Fecha cuando pasó a PENDIENTE_CARGA
    
    @Column(nullable = true)
    private LocalDateTime fechaFinalizado; // Fecha cuando se finalizó el pedido

    @Column(nullable = false)
    private LocalDate fechaEntrega = LocalDate.now(); // Fecha en que se ejecutará la vuelta (por defecto la fecha de creación)

    @Column(nullable = true)
    private Integer ordenPrioridadCarga; // Orden manual definido en Panel Depósito para la cola de prioridad de carga
    
    @Column(nullable = true)
    private LocalDateTime fechaEntradaColaPrioridad; // Fecha cuando ingresó a la cola de prioridad de carga

    @Column(nullable = false)
    private Boolean controlado = false; // Indica si el pedido ha sido controlado cuando está en etapa CONTROL

    @Column(nullable = true)
    private String controladoPor; // Nombre del usuario que hizo el control

    @Column(nullable = true)
    private String finalizadoPor; // Nombre del usuario que finalizó el pedido

    @PreUpdate
    protected void onUpdate() {
        fechaActualizacion = LocalDateTime.now();
    }

    public enum EstadoPedido {
        PENDIENTE,
        EN_PREPARACION,
        REALIZADO
    }

    public enum EtapaPreparacion {
        CONTROL,
        PENDIENTE_CARGA
    }
}

