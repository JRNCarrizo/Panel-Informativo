package com.Panelinformativo.grupos.service;

import com.Panelinformativo.grupos.dto.GrupoDTO;
import com.Panelinformativo.grupos.model.Grupo;
import com.Panelinformativo.grupos.repository.GrupoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GrupoService {
    private final GrupoRepository grupoRepository;

    @Transactional
    public GrupoDTO crearGrupo(String nombre) {
        Grupo grupo = new Grupo();
        grupo.setNombre(nombre);
        grupo.setActivo(true);
        grupo = grupoRepository.save(grupo);
        return convertirADTO(grupo);
    }

    public List<GrupoDTO> obtenerTodosLosGrupos() {
        return grupoRepository.findAll().stream()
                .map(this::convertirADTO)
                .collect(Collectors.toList());
    }

    public List<GrupoDTO> obtenerGruposActivos() {
        return grupoRepository.findByActivoTrue().stream()
                .map(this::convertirADTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public GrupoDTO actualizarGrupo(Long id, String nombre, Boolean activo) {
        Grupo grupo = grupoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Grupo no encontrado"));
        if (nombre != null) {
            grupo.setNombre(nombre);
        }
        if (activo != null) {
            grupo.setActivo(activo);
        }
        grupo = grupoRepository.save(grupo);
        return convertirADTO(grupo);
    }

    @Transactional
    public void eliminarGrupo(Long id) {
        Grupo grupo = grupoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Grupo no encontrado"));
        
        // En lugar de eliminar físicamente, desactivar el grupo
        // Esto evita problemas de integridad referencial con pedidos asociados
        grupo.setActivo(false);
        grupoRepository.save(grupo);
    }

    private GrupoDTO convertirADTO(Grupo grupo) {
        GrupoDTO dto = new GrupoDTO();
        dto.setId(grupo.getId());
        dto.setNombre(grupo.getNombre());
        dto.setActivo(grupo.getActivo());
        return dto;
    }
}

