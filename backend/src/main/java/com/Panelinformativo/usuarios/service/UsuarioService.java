package com.Panelinformativo.usuarios.service;

import com.Panelinformativo.usuarios.model.Rol;
import com.Panelinformativo.usuarios.model.Usuario;
import com.Panelinformativo.usuarios.repository.RolRepository;
import com.Panelinformativo.usuarios.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UsuarioService implements UserDetailsService {
    private final UsuarioRepository usuarioRepository;
    private final RolRepository rolRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        Usuario usuario = usuarioRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("Usuario no encontrado: " + username));
        return usuario;
    }

    @Transactional
    public Usuario crearPrimerAdmin(String username, String password, String nombreCompleto) {
        if (usuarioRepository.count() > 0) {
            throw new IllegalStateException("Ya existe un usuario en el sistema");
        }

        Rol rolAdmin = rolRepository.findByNombre(Rol.TipoRol.ADMIN)
                .orElseGet(() -> {
                    Rol nuevoRol = new Rol();
                    nuevoRol.setNombre(Rol.TipoRol.ADMIN);
                    return rolRepository.save(nuevoRol);
                });

        Usuario admin = new Usuario();
        admin.setUsername(username);
        admin.setPassword(passwordEncoder.encode(password));
        admin.setNombreCompleto(nombreCompleto);
        admin.setRol(rolAdmin);
        admin.setActivo(true);

        return usuarioRepository.save(admin);
    }

    @Transactional
    public Usuario crearUsuario(String username, String password, String nombreCompleto) {
        if (usuarioRepository.existsByUsername(username)) {
            throw new IllegalArgumentException("El username ya existe");
        }

        Rol rolDeposito = rolRepository.findByNombre(Rol.TipoRol.DEPOSITO)
                .orElseGet(() -> {
                    Rol nuevoRol = new Rol();
                    nuevoRol.setNombre(Rol.TipoRol.DEPOSITO);
                    return rolRepository.save(nuevoRol);
                });

        Usuario usuario = new Usuario();
        usuario.setUsername(username);
        usuario.setPassword(passwordEncoder.encode(password));
        usuario.setNombreCompleto(nombreCompleto);
        usuario.setRol(rolDeposito);
        usuario.setActivo(true);

        return usuarioRepository.save(usuario);
    }

    @Transactional
    public Usuario crearUsuarioConRol(String username, String password, String nombreCompleto, Rol.TipoRol tipoRol) {
        if (usuarioRepository.existsByUsername(username)) {
            throw new IllegalArgumentException("El username ya existe");
        }

        Rol rol = rolRepository.findByNombre(tipoRol)
                .orElseGet(() -> {
                    Rol nuevoRol = new Rol();
                    nuevoRol.setNombre(tipoRol);
                    return rolRepository.save(nuevoRol);
                });

        Usuario usuario = new Usuario();
        usuario.setUsername(username);
        usuario.setPassword(passwordEncoder.encode(password));
        usuario.setNombreCompleto(nombreCompleto);
        usuario.setRol(rol);
        usuario.setActivo(true);

        return usuarioRepository.save(usuario);
    }

    public Long obtenerIdPrimerAdmin() {
        // Obtener el admin más antiguo (menor ID) con rol ADMIN
        return usuarioRepository.findAll().stream()
                .filter(u -> u.getRol().getNombre() == Rol.TipoRol.ADMIN)
                .min((u1, u2) -> Long.compare(u1.getId(), u2.getId()))
                .map(Usuario::getId)
                .orElse(null);
    }

    public boolean existeUsuario() {
        return usuarioRepository.count() > 0;
    }

    public List<Usuario> obtenerTodosLosUsuarios() {
        return usuarioRepository.findAll();
    }

    @Transactional
    public Usuario actualizarEstadoUsuario(Long id, Boolean activo) {
        Usuario usuario = usuarioRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));
        
        // Prevenir desactivar al admin principal
        Long idPrimerAdmin = obtenerIdPrimerAdmin();
        if (idPrimerAdmin != null && id.equals(idPrimerAdmin) && !activo) {
            throw new IllegalArgumentException("No se puede desactivar al administrador principal");
        }
        
        usuario.setActivo(activo);
        return usuarioRepository.save(usuario);
    }

    @Transactional
    public void eliminarUsuario(Long id) {
        if (!usuarioRepository.existsById(id)) {
            throw new IllegalArgumentException("Usuario no encontrado");
        }
        usuarioRepository.deleteById(id);
    }
}

