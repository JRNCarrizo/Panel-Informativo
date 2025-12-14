package com.Panelinformativo.mensajes.controller;

import com.Panelinformativo.mensajes.dto.MensajeCreateDTO;
import com.Panelinformativo.mensajes.dto.MensajeDTO;
import com.Panelinformativo.mensajes.service.MensajeService;
import com.Panelinformativo.usuarios.model.Rol;
import com.Panelinformativo.usuarios.model.Usuario;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/mensajes")
@RequiredArgsConstructor
public class MensajeController {
    private final MensajeService mensajeService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN_PRINCIPAL', 'ADMIN_DEPOSITO')")
    public ResponseEntity<MensajeDTO> crearMensaje(
            @Valid @RequestBody MensajeCreateDTO dto,
            Authentication authentication) {
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        Usuario usuario = (Usuario) userDetails;
        
        MensajeDTO mensaje = mensajeService.crearMensaje(dto, usuario);
        return ResponseEntity.ok(mensaje);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN_PRINCIPAL', 'ADMIN_DEPOSITO')")
    public ResponseEntity<List<MensajeDTO>> obtenerMensajesDelDia(Authentication authentication) {
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        Usuario usuario = (Usuario) userDetails;
        Rol.TipoRol rolUsuario = usuario.getRol().getNombre();
        
        // El rol ya es ADMIN_PRINCIPAL o ADMIN_DEPOSITO, no necesita normalización
        Rol.TipoRol rolParaMensajes = rolUsuario;
        
        // Limpiar mensajes antiguos antes de obtener los del día
        mensajeService.limpiarMensajesAntiguosSiEsNuevoDia();
        
        List<MensajeDTO> mensajes = mensajeService.obtenerMensajesDelDia(rolParaMensajes, rolUsuario);
        return ResponseEntity.ok(mensajes);
    }

    @GetMapping("/no-leidos/count")
    @PreAuthorize("hasAnyRole('ADMIN_PRINCIPAL', 'ADMIN_DEPOSITO')")
    public ResponseEntity<Long> contarMensajesNoLeidos(Authentication authentication) {
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        Usuario usuario = (Usuario) userDetails;
        Rol.TipoRol rolUsuario = usuario.getRol().getNombre();
        
        // El rol ya es ADMIN_PRINCIPAL o ADMIN_DEPOSITO, no necesita normalización
        Rol.TipoRol rolParaMensajes = rolUsuario;
        
        long count = mensajeService.contarMensajesNoLeidos(rolParaMensajes);
        return ResponseEntity.ok(count);
    }

    @PutMapping("/{id}/leido")
    @PreAuthorize("hasAnyRole('ADMIN_PRINCIPAL', 'ADMIN_DEPOSITO')")
    public ResponseEntity<Void> marcarComoLeido(
            @PathVariable Long id,
            Authentication authentication) {
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        Usuario usuario = (Usuario) userDetails;
        Rol.TipoRol rolUsuario = usuario.getRol().getNombre();
        
        // El rol ya es ADMIN_PRINCIPAL o ADMIN_DEPOSITO, no necesita normalización
        Rol.TipoRol rolParaMensajes = rolUsuario;
        
        mensajeService.marcarMensajeComoLeido(id, rolParaMensajes, usuario);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/marcar-todos-leidos")
    @PreAuthorize("hasAnyRole('ADMIN_PRINCIPAL', 'ADMIN_DEPOSITO')")
    public ResponseEntity<Void> marcarTodosComoLeidos(Authentication authentication) {
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        Usuario usuario = (Usuario) userDetails;
        Rol.TipoRol rolUsuario = usuario.getRol().getNombre();
        
        // El rol ya es ADMIN_PRINCIPAL o ADMIN_DEPOSITO, no necesita normalización
        Rol.TipoRol rolParaMensajes = rolUsuario;
        
        mensajeService.marcarTodosComoLeidos(rolParaMensajes, usuario);
        return ResponseEntity.ok().build();
    }
}

