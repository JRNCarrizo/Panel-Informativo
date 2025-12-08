package com.Panelinformativo.usuarios.repository;

import com.Panelinformativo.usuarios.model.Rol;
import com.Panelinformativo.usuarios.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UsuarioRepository extends JpaRepository<Usuario, Long> {
    Optional<Usuario> findByUsername(String username);
    boolean existsByUsername(String username);
    
    @Query("SELECT u FROM Usuario u WHERE u.rol.nombre = :tipoRol")
    List<Usuario> findByRolNombre(@Param("tipoRol") Rol.TipoRol tipoRol);
}

