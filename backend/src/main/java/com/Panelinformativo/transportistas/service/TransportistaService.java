package com.Panelinformativo.transportistas.service;

import com.Panelinformativo.transportistas.dto.TransportistaDTO;
import com.Panelinformativo.transportistas.model.Transportista;
import com.Panelinformativo.transportistas.repository.TransportistaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TransportistaService {
    private final TransportistaRepository transportistaRepository;

    @Transactional
    public TransportistaDTO crearObtenerTransportista(String nombre) {
        Transportista transportista = crearObtenerTransportistaEntity(nombre);
        return convertirADTO(transportista);
    }

    @Transactional
    public Transportista crearObtenerTransportistaEntity(String nombre) {
        // Buscar si existe (case insensitive)
        Optional<Transportista> transportistaExistente = transportistaRepository.findByNombreIgnoreCase(nombre.trim());
        
        if (transportistaExistente.isPresent()) {
            // Si existe, devolverlo (aunque esté desactivado, lo activamos)
            Transportista transportista = transportistaExistente.get();
            if (!transportista.getActivo()) {
                transportista.setActivo(true);
                transportista = transportistaRepository.save(transportista);
            }
            return transportista;
        }
        
        // Si no existe, crear nuevo
        Transportista transportista = new Transportista();
        transportista.setNombre(nombre.trim());
        transportista.setActivo(true);
        return transportistaRepository.save(transportista);
    }

    @Transactional
    public TransportistaDTO crearTransportista(String nombre) {
        if (transportistaRepository.findByNombreIgnoreCase(nombre.trim()).isPresent()) {
            throw new IllegalArgumentException("Ya existe un transporte con ese nombre");
        }

        Transportista transportista = new Transportista();
        transportista.setNombre(nombre.trim());
        transportista.setActivo(true);

        transportista = transportistaRepository.save(transportista);
        return convertirADTO(transportista);
    }

    public List<TransportistaDTO> obtenerTodosLosTransportistas() {
        return transportistaRepository.findAllByOrderByNombreAsc().stream()
                .map(this::convertirADTO)
                .collect(Collectors.toList());
    }

    public List<TransportistaDTO> obtenerTransportistasActivos() {
        return transportistaRepository.findByActivoTrueOrderByNombreAsc().stream()
                .map(this::convertirADTO)
                .collect(Collectors.toList());
    }

    public List<TransportistaDTO> buscarTransportistas(String busqueda) {
        return transportistaRepository.findByNombreContainingIgnoreCaseAndActivoTrueOrderByNombreAsc(busqueda).stream()
                .map(this::convertirADTO)
                .collect(Collectors.toList());
    }

    public TransportistaDTO obtenerTransportistaPorId(Long id) {
        Transportista transportista = transportistaRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Transportista no encontrado"));
        return convertirADTO(transportista);
    }

    @Transactional
    public TransportistaDTO actualizarTransportista(Long id, String nombre, Boolean activo) {
        Transportista transportista = transportistaRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Transportista no encontrado"));

        if (nombre != null && !nombre.trim().isEmpty()) {
            // Verificar si el nuevo nombre ya existe (excepto el transportista actual)
            Optional<Transportista> transportistaConMismoNombre = transportistaRepository.findByNombreIgnoreCase(nombre.trim());
            if (transportistaConMismoNombre.isPresent() && !transportistaConMismoNombre.get().getId().equals(id)) {
                throw new IllegalArgumentException("Ya existe un transporte con ese nombre");
            }
            transportista.setNombre(nombre.trim());
        }

        if (activo != null) {
            transportista.setActivo(activo);
        }

        transportista = transportistaRepository.save(transportista);
        return convertirADTO(transportista);
    }

    @Transactional
    public void eliminarTransportista(Long id) {
        Transportista transportista = transportistaRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Transportista no encontrado"));
        
        // En lugar de eliminar físicamente, desactivar el transportista
        // Esto evita problemas de integridad referencial con pedidos asociados
        transportista.setActivo(false);
        transportistaRepository.save(transportista);
    }

    private TransportistaDTO convertirADTO(Transportista transportista) {
        TransportistaDTO dto = new TransportistaDTO();
        dto.setId(transportista.getId());
        dto.setNombre(transportista.getNombre());
        dto.setActivo(transportista.getActivo());
        return dto;
    }
}

