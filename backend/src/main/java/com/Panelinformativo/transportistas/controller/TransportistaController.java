package com.Panelinformativo.transportistas.controller;

import com.Panelinformativo.transportistas.dto.TransportistaDTO;
import com.Panelinformativo.transportistas.service.TransportistaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/transportistas")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class TransportistaController {
    private final TransportistaService transportistaService;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> crearTransportista(@RequestBody Map<String, String> body) {
        try {
            String nombre = body.get("nombre");
            if (nombre == null || nombre.trim().isEmpty()) {
                return ResponseEntity.badRequest().body("El nombre es obligatorio");
            }
            return ResponseEntity.ok(transportistaService.crearTransportista(nombre));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/buscar")
    @PreAuthorize("hasAnyRole('ADMIN', 'DEPOSITO')")
    public ResponseEntity<List<TransportistaDTO>> buscarTransportistas(@RequestParam String busqueda) {
        return ResponseEntity.ok(transportistaService.buscarTransportistas(busqueda));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'DEPOSITO')")
    public ResponseEntity<List<TransportistaDTO>> obtenerTodosLosTransportistas() {
        return ResponseEntity.ok(transportistaService.obtenerTodosLosTransportistas());
    }

    @GetMapping("/activos")
    @PreAuthorize("hasAnyRole('ADMIN', 'DEPOSITO')")
    public ResponseEntity<List<TransportistaDTO>> obtenerTransportistasActivos() {
        return ResponseEntity.ok(transportistaService.obtenerTransportistasActivos());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'DEPOSITO')")
    public ResponseEntity<TransportistaDTO> obtenerTransportistaPorId(@PathVariable Long id) {
        return ResponseEntity.ok(transportistaService.obtenerTransportistaPorId(id));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> actualizarTransportista(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        try {
            String nombre = body.get("nombre") != null ? (String) body.get("nombre") : null;
            Boolean activo = body.get("activo") != null ? (Boolean) body.get("activo") : null;
            return ResponseEntity.ok(transportistaService.actualizarTransportista(id, nombre, activo));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> eliminarTransportista(@PathVariable Long id) {
        try {
            transportistaService.eliminarTransportista(id);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}

