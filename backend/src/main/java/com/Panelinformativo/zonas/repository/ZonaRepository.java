package com.Panelinformativo.zonas.repository;

import com.Panelinformativo.zonas.model.Zona;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ZonaRepository extends JpaRepository<Zona, Long> {
    Optional<Zona> findByNombreIgnoreCase(String nombre);
    List<Zona> findByActivoTrueOrderByNombreAsc();
    List<Zona> findAllByOrderByNombreAsc();
    List<Zona> findByNombreContainingIgnoreCaseAndActivoTrueOrderByNombreAsc(String nombre);
}

