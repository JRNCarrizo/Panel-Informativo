package com.Panelinformativo.transportistas.repository;

import com.Panelinformativo.transportistas.model.Transportista;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TransportistaRepository extends JpaRepository<Transportista, Long> {
    Optional<Transportista> findByNombreIgnoreCase(String nombre);
    List<Transportista> findByActivoTrueOrderByNombreAsc();
    List<Transportista> findAllByOrderByNombreAsc();
    List<Transportista> findByNombreContainingIgnoreCaseAndActivoTrueOrderByNombreAsc(String nombre);
}

