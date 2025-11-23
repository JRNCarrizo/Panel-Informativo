#!/bin/bash

echo "========================================"
echo "  Panel Informativo - Iniciando..."
echo "========================================"
echo ""

# Verificar que Java esté instalado
if ! command -v java &> /dev/null; then
    echo "ERROR: Java no está instalado o no está en el PATH"
    echo "Por favor, instala Java 21 o superior"
    exit 1
fi

# Verificar que el JAR exista
if [ ! -f "target/Proyecto-Panel-Informativo-0.0.1-SNAPSHOT.jar" ]; then
    echo "ERROR: El archivo JAR no existe"
    echo "Por favor, compila el proyecto primero con: ./mvnw clean package -DskipTests"
    exit 1
fi

echo "Iniciando aplicación..."
echo ""
echo "La aplicación estará disponible en:"
echo "  - Local: http://localhost:8080"
echo "  - Red: http://[IP_DE_ESTA_COMPUTADORA]:8080"
echo ""
echo "Presiona Ctrl+C para detener el servidor"
echo ""

java -jar -Dspring.profiles.active=prod target/Proyecto-Panel-Informativo-0.0.1-SNAPSHOT.jar

