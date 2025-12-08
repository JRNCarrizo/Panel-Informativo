package com.Panelinformativo.grupos.controller;

import com.Panelinformativo.grupos.dto.GrupoDTO;
import com.Panelinformativo.grupos.service.GrupoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/grupos")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class GrupoController {
    private final GrupoService grupoService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN_PRINCIPAL', 'ADMIN_DEPOSITO')")
    public ResponseEntity<GrupoDTO> crearGrupo(@RequestBody Map<String, String> body) {
        String nombre = body.get("nombre");
        return ResponseEntity.ok(grupoService.crearGrupo(nombre));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN_PRINCIPAL', 'ADMIN_DEPOSITO', 'PLANILLERO', 'CONTROL')")
    public ResponseEntity<List<GrupoDTO>> obtenerTodosLosGrupos() {
        return ResponseEntity.ok(grupoService.obtenerTodosLosGrupos());
    }

    @GetMapping("/activos")
    @PreAuthorize("hasAnyRole('ADMIN_PRINCIPAL', 'ADMIN_DEPOSITO', 'PLANILLERO', 'CONTROL')")
    public ResponseEntity<List<GrupoDTO>> obtenerGruposActivos() {
        return ResponseEntity.ok(grupoService.obtenerGruposActivos());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN_PRINCIPAL', 'ADMIN_DEPOSITO')")
    public ResponseEntity<?> actualizarGrupo(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        try {
            String nombre = body.get("nombre") != null ? (String) body.get("nombre") : null;
            Boolean activo = body.get("activo") != null ? (Boolean) body.get("activo") : null;
            return ResponseEntity.ok(grupoService.actualizarGrupo(id, nombre, activo));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN_PRINCIPAL', 'ADMIN_DEPOSITO')")
    public ResponseEntity<?> eliminarGrupo(@PathVariable Long id) {
        try {
            grupoService.eliminarGrupo(id);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}

