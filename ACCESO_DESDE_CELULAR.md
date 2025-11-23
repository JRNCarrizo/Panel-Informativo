# Acceso desde Celular

## Configuración realizada

La aplicación ahora está configurada para poder acceder desde tu celular usando la IP de tu computadora.

## Pasos para acceder desde el celular

### 1. Encontrar tu IP local

**Windows:**
- Abre PowerShell o CMD
- Ejecuta: `ipconfig`
- Busca "Dirección IPv4" en la sección de tu conexión WiFi/Ethernet
- Ejemplo: `192.168.1.100`

**Mac/Linux:**
- Abre Terminal
- Ejecuta: `ifconfig` o `ip addr`
- Busca tu IP en la sección de tu conexión WiFi/Ethernet

### 2. Asegúrate de que tu celular esté en la misma red WiFi

- Tu celular debe estar conectado a la misma red WiFi que tu computadora
- No funciona con datos móviles (4G/5G)

### 3. Iniciar el backend y frontend

**Backend:**
```bash
cd backend
sh mvnw spring-boot:run
```

**Frontend:**
```bash
cd frontend
npm run dev
```

### 4. Acceder desde el celular

Una vez que ambos estén corriendo, abre el navegador en tu celular y ve a:

```
http://TU_IP:5173
```

Por ejemplo, si tu IP es `192.168.1.100`:
```
http://192.168.1.100:5173
```

## Funcionamiento automático

- El frontend detecta automáticamente la IP desde la que estás accediendo
- Si accedes desde `localhost`, usa `localhost` para el backend
- Si accedes desde una IP (ej: `192.168.1.100`), usa esa misma IP para el backend
- CORS está configurado para aceptar conexiones desde cualquier IP de la red local (192.168.*, 10.*, 172.16-31.*)

## Notas importantes

1. **Firewall:** Asegúrate de que el firewall de Windows permita conexiones en los puertos 8080 (backend) y 5173 (frontend)
2. **Misma red:** Tu celular y tu computadora deben estar en la misma red WiFi
3. **IP dinámica:** Si tu IP cambia (es común en WiFi), necesitarás usar la nueva IP
4. **Seguridad:** Esta configuración es para uso en red local. Para producción, configura HTTPS y restricciones de seguridad adecuadas

## Solución de problemas

### No puedo acceder desde el celular

1. Verifica que el celular esté en la misma red WiFi
2. Verifica que ambos servicios estén corriendo
3. Verifica que tu firewall permita conexiones en los puertos 8080 y 5173
4. Prueba hacer ping desde el celular a la IP de tu computadora
5. Verifica que tu IP no haya cambiado

### Error de CORS

- El backend ahora acepta conexiones desde cualquier IP de la red local
- Si tienes problemas, verifica que tu IP esté en el rango permitido (192.168.*, 10.*, 172.16-31.*)

