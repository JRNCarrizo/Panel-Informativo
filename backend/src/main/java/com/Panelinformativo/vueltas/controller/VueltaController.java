package com.Panelinformativo.vueltas.controller;

import com.Panelinformativo.vueltas.dto.VueltaDTO;
import com.Panelinformativo.vueltas.service.VueltaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/vueltas")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class VueltaController {
    private final VueltaService vueltaService;

    @PostMapping("/crear-o-obtener")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<VueltaDTO> crearObtenerVuelta(@RequestBody Map<String, String> body) {
        String nombre = body.get("nombre");
        if (nombre == null || nombre.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(vueltaService.crearObtenerVuelta(nombre));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'DEPOSITO')")
    public ResponseEntity<List<VueltaDTO>> obtenerTodasLasVueltas() {
        return ResponseEntity.ok(vueltaService.obtenerTodasLasVueltas());
    }

    @GetMapping("/activas")
    @PreAuthorize("hasAnyRole('ADMIN', 'DEPOSITO')")
    public ResponseEntity<List<VueltaDTO>> obtenerVueltasActivas() {
        return ResponseEntity.ok(vueltaService.obtenerVueltasActivas());
    }

    @GetMapping("/buscar")
    @PreAuthorize("hasAnyRole('ADMIN', 'DEPOSITO')")
    public ResponseEntity<List<VueltaDTO>> buscarVueltas(@RequestParam String q) {
        return ResponseEntity.ok(vueltaService.buscarVueltas(q));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'DEPOSITO')")
    public ResponseEntity<VueltaDTO> obtenerVueltaPorId(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(vueltaService.obtenerVueltaPorId(id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> actualizarVuelta(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        try {
            String nombre = body.get("nombre") != null ? (String) body.get("nombre") : null;
            Boolean activo = body.get("activo") != null ? (Boolean) body.get("activo") : null;
            return ResponseEntity.ok(vueltaService.actualizarVuelta(id, nombre, activo));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> eliminarVuelta(@PathVariable Long id) {
        try {
            vueltaService.eliminarVuelta(id);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}

