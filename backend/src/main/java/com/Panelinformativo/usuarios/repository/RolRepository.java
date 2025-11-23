package com.Panelinformativo.usuarios.repository;

import com.Panelinformativo.usuarios.model.Rol;
import com.Panelinformativo.usuarios.model.Rol.TipoRol;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RolRepository extends JpaRepository<Rol, Long> {
    Optional<Rol> findByNombre(TipoRol nombre);
}

