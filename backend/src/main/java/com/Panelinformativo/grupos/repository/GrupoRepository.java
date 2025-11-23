package com.Panelinformativo.grupos.repository;

import com.Panelinformativo.grupos.model.Grupo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GrupoRepository extends JpaRepository<Grupo, Long> {
    List<Grupo> findByActivoTrue();
}

