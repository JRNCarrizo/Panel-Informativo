package com.Panelinformativo.zonas.service;

import com.Panelinformativo.zonas.dto.ZonaDTO;
import com.Panelinformativo.zonas.model.Zona;
import com.Panelinformativo.zonas.repository.ZonaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ZonaService {
    private final ZonaRepository zonaRepository;

    @Transactional
    public ZonaDTO crearObtenerZona(String nombre) {
        Zona zona = crearObtenerZonaEntity(nombre);
        return convertirADTO(zona);
    }

    @Transactional
    public Zona crearObtenerZonaEntity(String nombre) {
        // Buscar si existe (case insensitive)
        Optional<Zona> zonaExistente = zonaRepository.findByNombreIgnoreCase(nombre.trim());
        
        if (zonaExistente.isPresent()) {
            // Si existe, devolverla (aunque esté desactivada, la activamos)
            Zona zona = zonaExistente.get();
            if (!zona.getActivo()) {
                zona.setActivo(true);
                zona = zonaRepository.save(zona);
            }
            return zona;
        }
        
        // Si no existe, crear nueva
        Zona zona = new Zona();
        zona.setNombre(nombre.trim());
        zona.setActivo(true);
        return zonaRepository.save(zona);
    }

    public List<ZonaDTO> obtenerTodasLasZonas() {
        return zonaRepository.findAllByOrderByNombreAsc().stream()
                .map(this::convertirADTO)
                .collect(Collectors.toList());
    }

    public List<ZonaDTO> obtenerZonasActivas() {
        return zonaRepository.findByActivoTrueOrderByNombreAsc().stream()
                .map(this::convertirADTO)
                .collect(Collectors.toList());
    }

    public List<ZonaDTO> buscarZonas(String busqueda) {
        return zonaRepository.findByNombreContainingIgnoreCaseAndActivoTrueOrderByNombreAsc(busqueda).stream()
                .map(this::convertirADTO)
                .collect(Collectors.toList());
    }

    public ZonaDTO obtenerZonaPorId(Long id) {
        Zona zona = zonaRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Zona no encontrada"));
        return convertirADTO(zona);
    }

    @Transactional
    public ZonaDTO actualizarZona(Long id, String nombre, Boolean activo) {
        Zona zona = zonaRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Zona no encontrada"));

        if (nombre != null && !nombre.trim().isEmpty()) {
            // Verificar si el nuevo nombre ya existe (excepto la zona actual)
            Optional<Zona> zonaConMismoNombre = zonaRepository.findByNombreIgnoreCase(nombre.trim());
            if (zonaConMismoNombre.isPresent() && !zonaConMismoNombre.get().getId().equals(id)) {
                throw new IllegalArgumentException("Ya existe una zona con ese nombre");
            }
            zona.setNombre(nombre.trim());
        }

        if (activo != null) {
            zona.setActivo(activo);
        }

        zona = zonaRepository.save(zona);
        return convertirADTO(zona);
    }

    @Transactional
    public void eliminarZona(Long id) {
        Zona zona = zonaRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Zona no encontrada"));
        
        // En lugar de eliminar físicamente, desactivar la zona
        zona.setActivo(false);
        zonaRepository.save(zona);
    }

    private ZonaDTO convertirADTO(Zona zona) {
        ZonaDTO dto = new ZonaDTO();
        dto.setId(zona.getId());
        dto.setNombre(zona.getNombre());
        dto.setActivo(zona.getActivo());
        return dto;
    }
}

