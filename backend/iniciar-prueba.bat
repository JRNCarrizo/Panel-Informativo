@echo off
echo ========================================
echo   Panel Informativo - Iniciando (H2)
echo ========================================
echo.

REM Verificar que Java esté instalado
java -version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Java no está instalado o no está en el PATH
    echo Por favor, instala Java 21 o superior
    pause
    exit /b 1
)

REM Verificar que el JAR exista (en la misma carpeta que el script)
if not exist "Proyecto-Panel-Informativo-0.0.1-SNAPSHOT.jar" (
    echo ERROR: El archivo JAR no existe en esta carpeta
    echo Asegurate de que el JAR esté en la misma carpeta que este script
    pause
    exit /b 1
)

echo Iniciando aplicación con H2 (desarrollo)...
echo.
echo La aplicación estará disponible en:
echo   - Local: http://localhost:8080
echo   - Red: http://[IP_DE_ESTA_COMPUTADORA]:8080
echo.
echo Presiona Ctrl+C para detener el servidor
echo.

java -jar Proyecto-Panel-Informativo-0.0.1-SNAPSHOT.jar

pause

