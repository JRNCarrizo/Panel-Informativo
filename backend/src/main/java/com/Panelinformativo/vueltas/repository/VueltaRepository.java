package com.Panelinformativo.vueltas.repository;

import com.Panelinformativo.vueltas.model.Vuelta;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface VueltaRepository extends JpaRepository<Vuelta, Long> {
    Optional<Vuelta> findByNombreIgnoreCase(String nombre);
    List<Vuelta> findByActivoTrueOrderByNombreAsc();
    List<Vuelta> findAllByOrderByNombreAsc();
    List<Vuelta> findByNombreContainingIgnoreCaseAndActivoTrueOrderByNombreAsc(String nombre);
}

