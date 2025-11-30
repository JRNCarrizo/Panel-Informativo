package com.Panelinformativo.pedidos.controller;

import com.Panelinformativo.common.websocket.WebSocketService;
import com.Panelinformativo.pedidos.dto.PedidoCreateDTO;
import com.Panelinformativo.pedidos.dto.PedidoDTO;
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
    @PreAuthorize("hasRole('ADMIN')")
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
    @PreAuthorize("hasAnyRole('ADMIN', 'DEPOSITO')")
    public ResponseEntity<?> actualizarEstado(@PathVariable Long id, @RequestBody String nuevoEstado) {
        try {
            // Limpiar el string: remover comillas JSON si están presentes
            String estadoLimpio = nuevoEstado.trim();
            if (estadoLimpio.startsWith("\"") && estadoLimpio.endsWith("\"")) {
                estadoLimpio = estadoLimpio.substring(1, estadoLimpio.length() - 1);
            }
            
            Pedido.EstadoPedido estado = Pedido.EstadoPedido.valueOf(estadoLimpio.toUpperCase());
            PedidoDTO pedido = pedidoService.actualizarEstadoPedido(id, estado);
            webSocketService.notificarActualizacionPedido(pedido);
            return ResponseEntity.ok(pedido);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body("Estado inválido: " + nuevoEstado);
        }
    }

    @PutMapping("/{id}/avanzar-etapa")
    @PreAuthorize("hasRole('DEPOSITO')")
    public ResponseEntity<?> avanzarEtapaPreparacion(@PathVariable Long id) {
        try {
            PedidoDTO pedido = pedidoService.avanzarEtapaPreparacion(id);
            webSocketService.notificarActualizacionPedido(pedido);
            return ResponseEntity.ok(pedido);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/{id}/grupo")
    @PreAuthorize("hasRole('DEPOSITO')")
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
    @PreAuthorize("hasRole('DEPOSITO')")
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
    @PreAuthorize("hasRole('ADMIN')")
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
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> eliminarPedido(@PathVariable Long id) {
        try {
            pedidoService.eliminarPedido(id);
            webSocketService.notificarEliminacionPedido(id);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}

