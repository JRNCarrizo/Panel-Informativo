package com.Panelinformativo.pedidos.controller;

import com.Panelinformativo.common.websocket.WebSocketService;
import com.Panelinformativo.pedidos.dto.PedidoCreateDTO;
import com.Panelinformativo.pedidos.dto.PedidoDTO;
import com.Panelinformativo.pedidos.dto.TransportistaVueltasDTO;
import com.Panelinformativo.pedidos.model.Pedido;
import com.Panelinformativo.pedidos.service.PedidoService;
import com.Panelinformativo.usuarios.model.Usuario;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/pedidos")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class PedidoController {
    private final PedidoService pedidoService;
    private final WebSocketService webSocketService;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN_PRINCIPAL')")
    public ResponseEntity<?> crearPedido(@Valid @RequestBody PedidoCreateDTO dto, Authentication authentication) {
        try {
            Usuario usuario = (Usuario) authentication.getPrincipal();
            PedidoDTO pedido = pedidoService.crearPedido(dto, usuario);
            webSocketService.notificarNuevoPedido(pedido);
            return ResponseEntity.ok(pedido);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN_PRINCIPAL', 'ADMIN_DEPOSITO', 'PLANILLERO', 'CONTROL')")
    public ResponseEntity<List<PedidoDTO>> obtenerTodosLosPedidos() {
        return ResponseEntity.ok(pedidoService.obtenerTodosLosPedidos());
    }

    @GetMapping("/estado/{estado}")
    public ResponseEntity<List<PedidoDTO>> obtenerPedidosPorEstado(@PathVariable String estado) {
        try {
            Pedido.EstadoPedido estadoPedido = Pedido.EstadoPedido.valueOf(estado.toUpperCase());
            return ResponseEntity.ok(pedidoService.obtenerPedidosPorEstado(estadoPedido));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<PedidoDTO> obtenerPedidoPorId(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(pedidoService.obtenerPedidoPorId(id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PutMapping("/{id}/estado")
    @PreAuthorize("hasAnyRole('PLANILLERO', 'CONTROL')")
    public ResponseEntity<?> actualizarEstado(@PathVariable Long id, @RequestBody String nuevoEstado, Authentication authentication) {
        try {
            // Limpiar el string: remover comillas JSON si están presentes
            String estadoLimpio = nuevoEstado.trim();
            if (estadoLimpio.startsWith("\"") && estadoLimpio.endsWith("\"")) {
                estadoLimpio = estadoLimpio.substring(1, estadoLimpio.length() - 1);
            }
            
            Pedido.EstadoPedido estado = Pedido.EstadoPedido.valueOf(estadoLimpio.toUpperCase());
            Usuario usuario = (Usuario) authentication.getPrincipal();
            PedidoDTO pedido = pedidoService.actualizarEstadoPedido(id, estado, usuario);
            webSocketService.notificarActualizacionPedido(pedido);
            return ResponseEntity.ok(pedido);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body("Estado inválido: " + nuevoEstado);
        }
    }

    @PutMapping("/{id}/avanzar-etapa")
    @PreAuthorize("hasAnyRole('PLANILLERO', 'CONTROL')")
    public ResponseEntity<?> avanzarEtapaPreparacion(@PathVariable Long id, Authentication authentication) {
        try {
            Usuario usuario = (Usuario) authentication.getPrincipal();
            PedidoDTO pedido = pedidoService.avanzarEtapaPreparacion(id, usuario);
            webSocketService.notificarActualizacionPedido(pedido);
            return ResponseEntity.ok(pedido);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/{id}/grupo")
    @PreAuthorize("hasRole('ADMIN_DEPOSITO')")
    public ResponseEntity<?> asignarGrupo(@PathVariable Long id, @RequestBody Long grupoId) {
        try {
            PedidoDTO pedido = pedidoService.asignarGrupo(id, grupoId);
            webSocketService.notificarActualizacionPedido(pedido);
            return ResponseEntity.ok(pedido);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/{id}/grupo")
    @PreAuthorize("hasRole('ADMIN_DEPOSITO')")
    public ResponseEntity<?> quitarGrupo(@PathVariable Long id) {
        try {
            PedidoDTO pedido = pedidoService.quitarGrupo(id);
            webSocketService.notificarActualizacionPedido(pedido);
            return ResponseEntity.ok(pedido);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN_PRINCIPAL')")
    public ResponseEntity<?> actualizarPedido(@PathVariable Long id, @Valid @RequestBody PedidoCreateDTO dto) {
        try {
            PedidoDTO pedido = pedidoService.actualizarPedido(id, dto);
            webSocketService.notificarActualizacionPedido(pedido);
            return ResponseEntity.ok(pedido);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN_PRINCIPAL')")
    public ResponseEntity<?> eliminarPedido(@PathVariable Long id) {
        try {
            pedidoService.eliminarPedido(id);
            webSocketService.notificarEliminacionPedido(id);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // Obtener pedidos pendientes sin orden de prioridad de carga (para Panel Depósito)
    @GetMapping("/pendientes/sin-orden")
    @PreAuthorize("hasRole('ADMIN_DEPOSITO')")
    public ResponseEntity<List<PedidoDTO>> obtenerPedidosPendientesSinOrden() {
        return ResponseEntity.ok(pedidoService.obtenerPedidosPendientesSinOrden());
    }

    // Obtener pedidos pendientes con orden de prioridad de carga (para Pantalla Pública)
    @GetMapping("/pendientes/con-orden")
    public ResponseEntity<List<PedidoDTO>> obtenerPedidosConOrdenPrioridadCarga() {
        return ResponseEntity.ok(pedidoService.obtenerPedidosConOrdenPrioridadCarga());
    }

    // Actualizar el orden de prioridad de carga de múltiples pedidos
    @PutMapping("/prioridad-carga/orden")
    @PreAuthorize("hasRole('ADMIN_DEPOSITO')")
    public ResponseEntity<?> actualizarOrdenPrioridadCarga(@RequestBody List<Long> pedidoIds) {
        try {
            List<PedidoDTO> pedidos = pedidoService.actualizarOrdenPrioridadCarga(pedidoIds);
            // Notificar a todos los clientes sobre el cambio de orden
            pedidos.forEach(pedido -> webSocketService.notificarActualizacionPedido(pedido));
            return ResponseEntity.ok(pedidos);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // Remover un pedido de la cola de prioridad de carga
    @PutMapping("/{id}/prioridad-carga/remover")
    @PreAuthorize("hasRole('ADMIN_DEPOSITO')")
    public ResponseEntity<?> removerDeColaPrioridadCarga(@PathVariable Long id) {
        try {
            PedidoDTO pedido = pedidoService.removerDeColaPrioridadCarga(id);
            webSocketService.notificarActualizacionPedido(pedido);
            return ResponseEntity.ok(pedido);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // Agregar un pedido a la cola de prioridad de carga (al final)
    @PutMapping("/{id}/prioridad-carga/agregar")
    @PreAuthorize("hasRole('ADMIN_DEPOSITO')")
    public ResponseEntity<?> agregarAColaPrioridadCarga(@PathVariable Long id) {
        try {
            PedidoDTO pedido = pedidoService.agregarAColaPrioridadCarga(id);
            webSocketService.notificarActualizacionPedido(pedido);
            return ResponseEntity.ok(pedido);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // Obtener planillas recibidas en el día actual
    @GetMapping("/del-dia")
    @PreAuthorize("hasAnyRole('ADMIN_PRINCIPAL', 'ADMIN_DEPOSITO')")
    public ResponseEntity<List<PedidoDTO>> obtenerPlanillasRecibidasDelDia() {
        return ResponseEntity.ok(pedidoService.obtenerPlanillasRecibidasDelDia());
    }

    // Obtener resumen de transportistas con vueltas asignadas en el día
    @GetMapping("/transportistas-vueltas/del-dia")
    @PreAuthorize("hasAnyRole('ADMIN_PRINCIPAL', 'ADMIN_DEPOSITO')")
    public ResponseEntity<List<TransportistaVueltasDTO>> obtenerResumenTransportistasVueltasDelDia() {
        return ResponseEntity.ok(pedidoService.obtenerResumenTransportistasVueltasDelDia());
    }
}

