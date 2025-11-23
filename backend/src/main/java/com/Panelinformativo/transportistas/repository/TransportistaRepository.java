package com.Panelinformativo.transportistas.repository;

import com.Panelinformativo.transportistas.model.Transportista;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TransportistaRepository extends JpaRepository<Transportista, Long> {
    Optional<Transportista> findByCodigoInterno(String codigoInterno);
    List<Transportista> findByActivoTrueOrderByCodigoInternoAsc();
    List<Transportista> findAllByOrderByCodigoInternoAsc();
}

