package com.Panelinformativo.usuarios.controller;

import com.Panelinformativo.usuarios.model.Rol;
import com.Panelinformativo.usuarios.model.Usuario;
import com.Panelinformativo.usuarios.service.UsuarioService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/usuarios")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class UsuarioController {
    private final UsuarioService usuarioService;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN_PRINCIPAL')")
    public ResponseEntity<List<Usuario>> obtenerTodosLosUsuarios() {
        return ResponseEntity.ok(usuarioService.obtenerTodosLosUsuarios());
    }

    @GetMapping("/primer-admin-id")
    @PreAuthorize("hasRole('ADMIN_PRINCIPAL')")
    public ResponseEntity<Map<String, Long>> obtenerIdPrimerAdmin() {
        Long idPrimerAdmin = usuarioService.obtenerIdPrimerAdmin();
        Map<String, Long> response = new HashMap<>();
        response.put("id", idPrimerAdmin);
        return ResponseEntity.ok(response);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN_PRINCIPAL', 'ADMIN_DEPOSITO')")
    public ResponseEntity<?> crearUsuarioConRol(@RequestBody Map<String, String> body, Authentication authentication) {
        try {
            String username = body.get("username");
            String password = body.get("password");
            String nombreCompleto = body.get("nombreCompleto");
            String rolStr = body.get("rol");
            
            if (username == null || password == null || nombreCompleto == null || rolStr == null) {
                return ResponseEntity.badRequest().body("Todos los campos son obligatorios");
            }
            
            Rol.TipoRol tipoRol;
            try {
                tipoRol = Rol.TipoRol.valueOf(rolStr.toUpperCase());
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().body("Rol inválido. Debe ser ADMIN_PRINCIPAL, ADMIN_DEPOSITO, PLANILLERO o CONTROL");
            }
            
            // Verificar permisos según el rol del usuario autenticado
            Usuario usuarioAutenticado = (Usuario) authentication.getPrincipal();
            Rol.TipoRol rolUsuarioAutenticado = usuarioAutenticado.getRol().getNombre();
            
            // ADMIN_PRINCIPAL puede crear ADMIN_PRINCIPAL y ADMIN_DEPOSITO
            // ADMIN_DEPOSITO solo puede crear PLANILLERO y CONTROL
            if (rolUsuarioAutenticado == Rol.TipoRol.ADMIN_DEPOSITO) {
                if (tipoRol != Rol.TipoRol.PLANILLERO && tipoRol != Rol.TipoRol.CONTROL) {
                    return ResponseEntity.badRequest().body("ADMIN_DEPOSITO solo puede crear usuarios con roles PLANILLERO o CONTROL");
                }
            } else if (rolUsuarioAutenticado == Rol.TipoRol.ADMIN_PRINCIPAL) {
                // ADMIN_PRINCIPAL solo puede crear ADMIN_PRINCIPAL y ADMIN_DEPOSITO
                if (tipoRol != Rol.TipoRol.ADMIN_PRINCIPAL && tipoRol != Rol.TipoRol.ADMIN_DEPOSITO) {
                    return ResponseEntity.badRequest().body("ADMIN_PRINCIPAL solo puede crear usuarios con roles ADMIN_PRINCIPAL o ADMIN_DEPOSITO");
                }
            }
            
            Usuario usuario = usuarioService.crearUsuarioConRol(username, password, nombreCompleto, tipoRol);
            return ResponseEntity.ok(usuario);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
    
    // Endpoint para obtener usuarios filtrados por rol (para ADMIN_DEPOSITO)
    @GetMapping("/por-rol/{rol}")
    @PreAuthorize("hasAnyRole('ADMIN_PRINCIPAL', 'ADMIN_DEPOSITO')")
    public ResponseEntity<List<Usuario>> obtenerUsuariosPorRol(@PathVariable String rol) {
        try {
            Rol.TipoRol tipoRol = Rol.TipoRol.valueOf(rol.toUpperCase());
            List<Usuario> usuarios = usuarioService.obtenerUsuariosPorRol(tipoRol);
            return ResponseEntity.ok(usuarios);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}/estado")
    @PreAuthorize("hasRole('ADMIN_PRINCIPAL')")
    public ResponseEntity<?> actualizarEstadoUsuario(@PathVariable Long id, @RequestBody Map<String, Boolean> body) {
        try {
            Boolean activo = body.get("activo");
            Usuario usuario = usuarioService.actualizarEstadoUsuario(id, activo);
            return ResponseEntity.ok(usuario);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN_PRINCIPAL')")
    public ResponseEntity<?> eliminarUsuario(@PathVariable Long id) {
        try {
            usuarioService.eliminarUsuario(id);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}

