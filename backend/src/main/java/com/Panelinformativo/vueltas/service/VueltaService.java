package com.Panelinformativo.vueltas.service;

import com.Panelinformativo.vueltas.dto.VueltaDTO;
import com.Panelinformativo.vueltas.model.Vuelta;
import com.Panelinformativo.vueltas.repository.VueltaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class VueltaService {
    private final VueltaRepository vueltaRepository;

    @Transactional
    public VueltaDTO crearObtenerVuelta(String nombre) {
        Vuelta vuelta = crearObtenerVueltaEntity(nombre);
        return convertirADTO(vuelta);
    }

    @Transactional
    public Vuelta crearObtenerVueltaEntity(String nombre) {
        // Buscar si existe (case insensitive)
        Optional<Vuelta> vueltaExistente = vueltaRepository.findByNombreIgnoreCase(nombre.trim());
        
        if (vueltaExistente.isPresent()) {
            // Si existe, devolverla (aunque esté desactivada, la activamos)
            Vuelta vuelta = vueltaExistente.get();
            if (!vuelta.getActivo()) {
                vuelta.setActivo(true);
                vuelta = vueltaRepository.save(vuelta);
            }
            return vuelta;
        }
        
        // Si no existe, crear nueva
        Vuelta vuelta = new Vuelta();
        vuelta.setNombre(nombre.trim());
        vuelta.setActivo(true);
        return vueltaRepository.save(vuelta);
    }

    public List<VueltaDTO> obtenerTodasLasVueltas() {
        return vueltaRepository.findAllByOrderByNombreAsc().stream()
                .map(this::convertirADTO)
                .collect(Collectors.toList());
    }

    public List<VueltaDTO> obtenerVueltasActivas() {
        return vueltaRepository.findByActivoTrueOrderByNombreAsc().stream()
                .map(this::convertirADTO)
                .collect(Collectors.toList());
    }

    public List<VueltaDTO> buscarVueltas(String busqueda) {
        return vueltaRepository.findByNombreContainingIgnoreCaseAndActivoTrueOrderByNombreAsc(busqueda).stream()
                .map(this::convertirADTO)
                .collect(Collectors.toList());
    }

    public VueltaDTO obtenerVueltaPorId(Long id) {
        Vuelta vuelta = vueltaRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Vuelta no encontrada"));
        return convertirADTO(vuelta);
    }

    @Transactional
    public VueltaDTO actualizarVuelta(Long id, String nombre, Boolean activo) {
        Vuelta vuelta = vueltaRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Vuelta no encontrada"));

        if (nombre != null && !nombre.trim().isEmpty()) {
            // Verificar si el nuevo nombre ya existe (excepto la vuelta actual)
            Optional<Vuelta> vueltaConMismoNombre = vueltaRepository.findByNombreIgnoreCase(nombre.trim());
            if (vueltaConMismoNombre.isPresent() && !vueltaConMismoNombre.get().getId().equals(id)) {
                throw new IllegalArgumentException("Ya existe una vuelta con ese nombre");
            }
            vuelta.setNombre(nombre.trim());
        }

        if (activo != null) {
            vuelta.setActivo(activo);
        }

        vuelta = vueltaRepository.save(vuelta);
        return convertirADTO(vuelta);
    }

    @Transactional
    public void eliminarVuelta(Long id) {
        Vuelta vuelta = vueltaRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Vuelta no encontrada"));
        
        // En lugar de eliminar físicamente, desactivar la vuelta
        vuelta.setActivo(false);
        vueltaRepository.save(vuelta);
    }

    private VueltaDTO convertirADTO(Vuelta vuelta) {
        VueltaDTO dto = new VueltaDTO();
        dto.setId(vuelta.getId());
        dto.setNombre(vuelta.getNombre());
        dto.setActivo(vuelta.getActivo());
        return dto;
    }
}

