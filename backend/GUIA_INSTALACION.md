# Guía de Instalación - Panel Informativo

Esta guía te ayudará a instalar y ejecutar la aplicación La aplicacion desde cero.

## Requisitos Previos

Necesitarás instalar:
1. **Java 21** (o superior)
2. **MySQL** (versión 5.7 o superior)
3. Tener **El archivo JAR** de la aplicación

---

## Paso 1: Instalar Java 21

### Windows

1. **Descargar Java 21:**
   - Visita: https://www.oracle.com/java/technologies/downloads/#java21
   - O usa OpenJDK: https://adoptium.net/temurin/releases/?version=21
   - Descarga la versión para Windows (x64 Installer)

2. **Instalar Java:**
   - Ejecuta el instalador descargado
   - Sigue el asistente de instalación
   - Acepta los términos y condiciones
   - Deja las opciones por defecto (se instalará en `C:\Program Files\Java\jdk-21`)

3. **Verificar instalación:**
   - Abre PowerShell o CMD
   - Ejecuta: `java -version`
   - Deberías ver algo como:
     ```
     java version "21.0.x"
     ```

4. **Si no funciona después de instalar:**
   - Necesitas agregar Java al PATH del sistema
   - Busca "Variables de entorno" en el menú de Windows
   - En "Variables del sistema", busca `Path` y edítalo
   - Agrega la ruta: `C:\Program Files\Java\jdk-21\bin`
   - Reinicia PowerShell/CMD y verifica nuevamente

---

## Paso 2: Instalar MySQL

### Windows

1. **Descargar MySQL:**
   - Visita: https://dev.mysql.com/downloads/installer/
   - Descarga "MySQL Installer for Windows"
   - Elige la versión completa (Full) o la versión web (más pequeña)

2. **Instalar MySQL:**
   - Ejecuta el instalador
   - Selecciona "Developer Default" o "Server only"
   - Completa el asistente de instalación
   - **IMPORTANTE:** Durante la instalación, se te pedirá configurar la contraseña del usuario `root`
   - **Configura la contraseña como: `123456`** (esta es la contraseña que usa la aplicación por defecto)

3. **Verificar instalación:**
   - Abre MySQL Command Line Client o MySQL Workbench
   - O desde PowerShell ejecuta: `mysql -u root -p`
   - Ingresa la contraseña: `123456`
   - Si puedes ingresar, MySQL está funcionando correctamente
   - **Si obtienes error "Could not connect, server may not be running":**
     - MySQL puede no estar iniciado automáticamente
     - Ve a la sección de "Solución de Problemas" → "Error de conexión a MySQL"
     - Sigue los pasos para iniciar el servicio de MySQL manualmente

---

## Paso 3: Configurar la Base de Datos

1. **Crear la base de datos:**
   - Abre MySQL Command Line Client o MySQL Workbench
   - Ejecuta el siguiente comando:
     ```sql
     CREATE DATABASE panel_informativo;
     ```
   - Verifica que se creó correctamente:
     ```sql
     SHOW DATABASES;
     ```
     Deberías ver `panel_informativo` en la lista

2. **Crear usuario (Opcional):**
   - La aplicación está configurada para usar el usuario `root` con contraseña `123456`
   - Si prefieres crear un usuario específico, puedes hacerlo, pero tendrás que modificar la configuración de la aplicación
   - Por simplicidad, se recomienda usar `root` con contraseña `123456`

---

## Paso 4: Configurar la Aplicación

1. **Preparar los archivos:**
   - Tienes el archivo `Proyecto-Panel-Informativo-0.0.1-SNAPSHOT.jar`
   - Tienes el archivo `iniciar.bat`
   - Coloca ambos archivos en la misma carpeta (por ejemplo: `C:\PanelInformativo\`)

2. **Configuración:**
   - El archivo `iniciar.bat` ya está configurado para usar MySQL con usuario `root` y contraseña `123456`
   - La aplicación está lista para usar con esta configuración
   - **No necesitas modificar nada** si instalaste MySQL con contraseña `123456`

3. **Si usaste una contraseña diferente:**
   - Si configuraste MySQL con otra contraseña distinta a `123456`, necesitas crear un archivo `application-prod.properties` en la misma carpeta del JAR
   - Crea el archivo con este contenido:
     ```properties
     # Configuración MySQL
     spring.datasource.url=jdbc:mysql://localhost:3306/panel_informativo?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true
     spring.datasource.username=root
     spring.datasource.password=tu_contraseña_aqui
     ```
   - Reemplaza `tu_contraseña_aqui` con la contraseña que configuraste en MySQL

---

## Paso 5: Ejecutar la Aplicación

1. **Asegúrate de que MySQL esté corriendo:**
   - Puedes verificar desde el "Services" de Windows
   - Busca "MySQL80" (o similar) y verifica que esté "Running"

2. **Ejecutar la aplicación:**
   - Haz doble clic en `iniciar.bat`
   - O desde PowerShell/CMD en la carpeta donde está el JAR:
     ```powershell
     .\iniciar.bat
     ```

3. **Esperar a que inicie:**
   - Verás mensajes en la consola indicando que la aplicación está iniciando
   - Busca el mensaje: `Started ProyectoPanelInformativoApplication`
   - Si ves errores, revisa la sección de "Solución de Problemas" más abajo

4. **Acceder a la aplicación:**
   - Abre tu navegador web
   - Ve a: `http://localhost:8080`
   - Deberías ver la pantalla de login

---

## Solución de Problemas Comunes

### Error: "Java no está instalado o no está en el PATH"

**Solución:**
- Verifica que Java esté instalado: `java -version`
- Si no aparece, reinstala Java
- Asegúrate de agregar Java al PATH (ver Paso 1)

### Error: "Port 8080 was already in use"

**Solución:**
- Otro programa está usando el puerto 8080
- Cierra otros programas que puedan estar usando ese puerto
- O cambia el puerto en la configuración (pide ayuda al administrador)

### Error de conexión a MySQL

**Error común:** `Could not connect, server may not be running. Unable to connect to 127.0.0.1:3306`

Este error puede aparecer en dos situaciones:
1. **Cuando intentas abrir MySQL** (MySQL Command Line Client, MySQL Workbench, etc.)
2. **Cuando intentas ejecutar la aplicación** (el JAR no puede conectarse a MySQL)

En ambos casos, significa que el servicio de MySQL no está corriendo.

**Solución paso a paso:**

1. **Verifica que MySQL esté corriendo (PASO MÁS IMPORTANTE):**
   - Presiona `Windows + R`, escribe `services.msc` y presiona Enter
   - Busca en la lista "MySQL80" o "MySQL" (puede tener otro nombre como "MySQL57" o "MySQL")
   - Verifica que el **Estado** diga "En ejecución" o "Running"
   - **Si dice "Detenido" o "Stopped":**
     - Haz clic derecho sobre MySQL
     - Selecciona "Iniciar" o "Start"
     - Espera unos segundos (puede tardar 10-30 segundos)
     - Verifica que cambie a "En ejecución" o "Running"
     - **Si aparece un error al intentar iniciar:**
       - Revisa el "Registro de eventos" (Event Viewer) para ver el error específico
       - Puede ser un problema de permisos o de configuración
       - Intenta reiniciar la computadora
       - Si persiste, puede ser necesario reinstalar MySQL

2. **Si MySQL no aparece en Services:**
   - MySQL puede no estar instalado correctamente
   - Vuelve al **Paso 2** de esta guía e instala MySQL nuevamente

3. **Si MySQL aparece pero no puedes iniciarlo:**
   - Haz clic derecho sobre el servicio MySQL → "Propiedades"
   - En la pestaña "Inicio", verifica que el "Tipo de inicio" esté en "Automático" o "Manual"
   - Intenta iniciar el servicio nuevamente
   - Si sigue sin iniciar:
     - Abre "Registro de eventos de Windows" (Event Viewer)
     - Ve a "Registros de Windows" → "Aplicación"
     - Busca errores relacionados con MySQL
     - Los mensajes de error te darán más información sobre qué está fallando

4. **Verifica que MySQL esté escuchando en el puerto 3306:**
   - Abre PowerShell como Administrador
   - Ejecuta: `netstat -ano | findstr :3306`
   - Si aparece algo como `TCP    0.0.0.0:3306`, MySQL está corriendo
   - Si no aparece nada, MySQL no está corriendo o está en otro puerto

5. **Prueba conectarte manualmente:**
   - Abre "MySQL Command Line Client" desde el menú de Windows
   - O desde PowerShell ejecuta: `mysql -u root -p`
   - Ingresa la contraseña: `123456`
   - Si puedes conectarte, MySQL está funcionando correctamente
   - Si no puedes conectarte, verifica que MySQL esté instalado correctamente y que la contraseña sea `123456`

6. **Verifica las credenciales en la configuración:**
   - La aplicación está configurada para usar usuario `root` con contraseña `123456`
   - Si usaste otra contraseña en MySQL, crea el archivo `application-prod.properties` con la contraseña correcta
   - Asegúrate de que la contraseña en la configuración coincida con la que configuraste en MySQL

6. **Verifica que la base de datos exista:**
   - Conecta a MySQL usando MySQL Command Line Client
   - Ejecuta: `SHOW DATABASES;`
   - Debe aparecer `panel_informativo` en la lista
   - Si no existe, créala con: `CREATE DATABASE panel_informativo;`

8. **Verifica permisos del usuario:**
   - Si usas un usuario específico (no `root`), verifica que tenga permisos:
     ```sql
     SHOW GRANTS FOR 'tu_usuario'@'localhost';
     ```
   - Si no tiene permisos, otórgaselos:
     ```sql
     GRANT ALL PRIVILEGES ON panel_informativo.* TO 'tu_usuario'@'localhost';
     FLUSH PRIVILEGES;
     ```

### La aplicación inicia pero no puedo acceder desde otra computadora

**Solución:**
- La aplicación está configurada para aceptar conexiones desde cualquier IP (`server.address=0.0.0.0`)
- Verifica el firewall de Windows:
  - Abre "Windows Defender Firewall"
  - Busca reglas para el puerto 8080
  - Si no existe, permite el puerto 8080 en las conexiones entrantes
- Usa la IP de la computadora en lugar de `localhost`:
  - Ejemplo: `http://192.168.1.100:8080`
  - Para saber tu IP, ejecuta en PowerShell: `ipconfig`

---

## Estructura de Archivos Recomendada

```
C:\PanelInformativo\
├── Proyecto-Panel-Informativo-0.0.1-SNAPSHOT.jar
├── iniciar.bat
└── application-prod.properties (opcional, solo si necesitas personalizar)
```

---

## Notas Importantes

1. **Primera ejecución:**
   - La aplicación creará automáticamente las tablas necesarias en la base de datos
   - Esto puede tardar unos segundos la primera vez

2. **Crear el primer administrador:**
   - La primera vez que accedas, verás una opción para registrar el primer administrador
   - Este será el usuario principal del sistema

3. **Datos de la base de datos:**
   - Si eliminas la base de datos, perderás todos los datos
   - Se recomienda hacer respaldos periódicos de MySQL

4. **Detener la aplicación:**
   - Presiona `Ctrl+C` en la consola donde está corriendo
   - O cierra la ventana de la consola

---

## Soporte

Si tienes problemas que no se resuelven con esta guía:
1. Revisa los mensajes de error en la consola
2. Verifica los logs de la aplicación
3. Contacta al equipo de soporte técnico

---

## Resumen Rápido

1. ✅ Instalar Java 21
2. ✅ Instalar MySQL (configurar contraseña como `123456` para usuario `root`)
3. ✅ Crear base de datos `panel_informativo`
4. ✅ Ejecutar `iniciar.bat` (ya está configurado para usar contraseña `123456`)
5. ✅ Acceder a `http://localhost:8080`

**Nota importante:** Si configuraste MySQL con una contraseña distinta a `123456`, deberás crear el archivo `application-prod.properties` con tu contraseña (ver Paso 4).

¡Listo! Tu aplicación debería estar funcionando.

