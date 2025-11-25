package com.Panelinformativo.auth.controller;

import com.Panelinformativo.auth.dto.JwtResponse;
import com.Panelinformativo.auth.dto.LoginRequest;
import com.Panelinformativo.auth.dto.RegistroRequest;
import com.Panelinformativo.usuarios.model.Usuario;
import com.Panelinformativo.usuarios.service.UsuarioService;
import com.Panelinformativo.common.util.JwtUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AuthController {
    private final AuthenticationManager authenticationManager;
    private final UsuarioService usuarioService;
    private final JwtUtil jwtUtil;

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
            );
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Credenciales inválidas");
        }

        UserDetails userDetails = usuarioService.loadUserByUsername(request.getUsername());
        Usuario usuario = (Usuario) userDetails;
        String token = jwtUtil.generateToken(userDetails);

        JwtResponse response = new JwtResponse();
        response.setToken(token);
        response.setId(usuario.getId());
        response.setUsername(usuario.getUsername());
        response.setNombreCompleto(usuario.getNombreCompleto());
        response.setRol(usuario.getRol().getNombre().name());

        return ResponseEntity.ok(response);
    }

    @PostMapping("/registro-primer-admin")
    public ResponseEntity<?> registroPrimerAdmin(@Valid @RequestBody RegistroRequest request) {
        try {
            Usuario admin = usuarioService.crearPrimerAdmin(
                    request.getUsername(),
                    request.getPassword(),
                    request.getNombreCompleto()
            );

            UserDetails userDetails = usuarioService.loadUserByUsername(admin.getUsername());
            String token = jwtUtil.generateToken(userDetails);

            JwtResponse response = new JwtResponse();
            response.setToken(token);
            response.setUsername(admin.getUsername());
            response.setNombreCompleto(admin.getNombreCompleto());
            response.setRol(admin.getRol().getNombre().name());

            return ResponseEntity.ok(response);
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/registro")
    public ResponseEntity<?> registro(@Valid @RequestBody RegistroRequest request) {
        try {
            Usuario usuario = usuarioService.crearUsuario(
                    request.getUsername(),
                    request.getPassword(),
                    request.getNombreCompleto()
            );

            UserDetails userDetails = usuarioService.loadUserByUsername(usuario.getUsername());
            String token = jwtUtil.generateToken(userDetails);

            JwtResponse response = new JwtResponse();
            response.setToken(token);
            response.setUsername(usuario.getUsername());
            response.setNombreCompleto(usuario.getNombreCompleto());
            response.setRol(usuario.getRol().getNombre().name());

            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/existe-admin")
    public ResponseEntity<Map<String, Boolean>> existeAdmin() {
        boolean existe = usuarioService.existeUsuario();
        Map<String, Boolean> response = new HashMap<>();
        response.put("existe", existe);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@RequestHeader("Authorization") String authHeader) {
        try {
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                return ResponseEntity.badRequest().body("Token no proporcionado");
            }

            String token = authHeader.substring(7);
            
            String username;
            try {
                // Intentar extraer el username del token (incluso si está expirado)
                username = jwtUtil.extractUsername(token);
            } catch (Exception e) {
                // Si no se puede extraer el username, el token es completamente inválido
                return ResponseEntity.badRequest().body("Token inválido");
            }
            
            // Cargar usuario y generar nuevo token (permitir renovación incluso si el token expiró recientemente)
            UserDetails userDetails = usuarioService.loadUserByUsername(username);
            Usuario usuario = (Usuario) userDetails;
            String newToken = jwtUtil.generateToken(userDetails);

            JwtResponse response = new JwtResponse();
            response.setToken(newToken);
            response.setUsername(usuario.getUsername());
            response.setNombreCompleto(usuario.getNombreCompleto());
            response.setRol(usuario.getRol().getNombre().name());

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error al renovar token: " + e.getMessage());
        }
    }
}

