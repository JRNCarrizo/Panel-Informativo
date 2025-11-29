package com.Panelinformativo.zonas.controller;

import com.Panelinformativo.zonas.dto.ZonaDTO;
import com.Panelinformativo.zonas.service.ZonaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/zonas")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ZonaController {
    private final ZonaService zonaService;

    @PostMapping("/crear-o-obtener")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ZonaDTO> crearObtenerZona(@RequestBody Map<String, String> body) {
        String nombre = body.get("nombre");
        if (nombre == null || nombre.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(zonaService.crearObtenerZona(nombre));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'DEPOSITO')")
    public ResponseEntity<List<ZonaDTO>> obtenerTodasLasZonas() {
        return ResponseEntity.ok(zonaService.obtenerTodasLasZonas());
    }

    @GetMapping("/activas")
    @PreAuthorize("hasAnyRole('ADMIN', 'DEPOSITO')")
    public ResponseEntity<List<ZonaDTO>> obtenerZonasActivas() {
        return ResponseEntity.ok(zonaService.obtenerZonasActivas());
    }

    @GetMapping("/buscar")
    @PreAuthorize("hasAnyRole('ADMIN', 'DEPOSITO')")
    public ResponseEntity<List<ZonaDTO>> buscarZonas(@RequestParam String q) {
        return ResponseEntity.ok(zonaService.buscarZonas(q));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'DEPOSITO')")
    public ResponseEntity<ZonaDTO> obtenerZonaPorId(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(zonaService.obtenerZonaPorId(id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> actualizarZona(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        try {
            String nombre = body.get("nombre") != null ? (String) body.get("nombre") : null;
            Boolean activo = body.get("activo") != null ? (Boolean) body.get("activo") : null;
            return ResponseEntity.ok(zonaService.actualizarZona(id, nombre, activo));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> eliminarZona(@PathVariable Long id) {
        try {
            zonaService.eliminarZona(id);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}

