# 🚀 Acceso Rápido - Panel de Depósito

## Para entrar al Panel de Depósito desde el Panel de Administración:

### Opción 1: Crear Usuario y Cambiar Sesión

1. **En Panel Admin → Pestaña "Usuarios"**
2. **Clic en "Nuevo Usuario"**
3. **Completa:**
   - Usuario: `deposito1`
   - Nombre: `Operador Depósito`
   - Contraseña: `deposito123`
4. **Clic en "Crear"**
5. **Cerrar sesión** (botón "Salir")
6. **Hacer login** con `deposito1` / `deposito123`
7. ✅ Entras al Panel de Depósito

---

### Opción 2: Dos Ventanas Simultáneas (Recomendado para pruebas)

1. **Deja el Panel de Administración abierto**
2. **Abre una nueva ventana de incógnito** (Ctrl+Shift+N) o **otro navegador**
3. **Ve a:** `http://localhost:5173/login`
4. **Login con:** `deposito1` / `deposito123`
5. ✅ Ahora tienes ambos paneles abiertos

---

## 📝 Usuarios de Prueba Rápida

### Admin (ya creado)
- Usuario: `admin` (o el que hayas creado)
- Contraseña: La que configuraste

### Depósito (crear desde admin)
- Usuario: `deposito1`
- Contraseña: `deposito123`
- Rol: DEPOSITO (se asigna automáticamente)

---

## 🎯 Funciones del Panel de Depósito

1. **Ver Pedidos Pendientes** - Filtro activo por defecto
2. **Asignar Grupos** - Selecciona grupo del dropdown
3. **Cambiar Estados** - Pendiente → En Proceso → Realizado
4. **Filtrar por Estado** - Botones de filtro en la parte superior

---

## 💡 Tip

Para simular el flujo completo:
- **Ventana 1:** Panel Admin (crear pedidos)
- **Ventana 2:** Panel Depósito (asignar grupos y cambiar estados)
- **Ventana 3:** Pantalla Pública `/pantalla` (ver actualización en tiempo real)

¡Así puedes ver todo el sistema funcionando en simultáneo! 🎉

