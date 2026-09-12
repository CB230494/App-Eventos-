# Romería Segura — Demo v0.2

Prototipo para GitHub Pages orientado a acompañamiento de romeros en Cartago.

## Qué cambia en v0.2

- Mapa vectorial moderno con **MapLibre GL JS + OpenFreeMap**.
- Modo claro y oscuro también para el mapa.
- GPS continuo del dispositivo.
- Búsqueda del punto más cercano según **tiempo de recorrido peatonal**, no solo línea recta.
- Cálculo de distancia y tiempo caminando mediante el servidor peatonal de OpenStreetMap Alemania.
- Botón **IR AHORA**.
- Modo navegación con mapa inclinado, ruta dorada, seguimiento de ubicación, rumbo, distancia restante, tiempo estimado e instrucciones.
- Recalculo periódico mientras la persona avanza.
- Instrucciones por voz cuando el navegador lo permite.
- Intento de mantener la pantalla encendida durante navegación mediante Wake Lock cuando el dispositivo lo soporta.
- Conserva reportes, objetos/personas, administración demo y modo oscuro.

## Archivos que debés subir/reemplazar

Reemplazá los cinco archivos del repositorio por estos:

- `index.html`
- `styles.css`
- `data.js`
- `app.js`
- `README.md`

No se necesita una API key para esta demostración.

## Publicación en GitHub Pages

1. Abrí tu repositorio.
2. Reemplazá los archivos anteriores por los de esta carpeta.
3. Commit de los cambios.
4. En **Settings > Pages**, publicá desde la rama principal y carpeta raíz si aún no está configurado.
5. Abrí la URL HTTPS de GitHub Pages.
6. En el teléfono, permití el acceso a ubicación cuando la página lo solicite.

## Importante sobre GPS

La geolocalización del navegador requiere HTTPS. GitHub Pages funciona bajo HTTPS, por lo que el GPS puede utilizarse una vez publicado. Si abrís `index.html` directamente desde el explorador de archivos, el comportamiento puede ser diferente según el navegador.

## Routing de demostración

La demo utiliza el servidor público peatonal de `routing.openstreetmap.de`. Es apropiado para una demostración/prototipo y no debe asumirse como infraestructura con SLA para una operación institucional de alta demanda.

Para una implementación oficial se recomienda contratar/operar un servicio de routing propio o con garantías de disponibilidad, monitoreo y capacidad.

## Datos

Los puestos incluidos en `data.js` son de demostración. No representan ubicaciones oficiales de operativos reales.

## Administración demo

Código: `DEMO2026`

Es solo una demostración visual. Una contraseña dentro de GitHub Pages no constituye seguridad real porque el código JavaScript es público.

## Datos sensibles

No almacenar en GitHub Pages ni en `data.js`:

- fotografías de cédulas;
- información clínica;
- datos personales sensibles;
- fotografías privadas;
- información reservada de personas extraviadas.

La versión productiva deberá usar backend, autenticación por roles, bitácora, permisos, almacenamiento seguro y política de retención de datos.


## Cambios v0.3
- Botón **⛶** para abrir el mapa en modo inmersivo/pantalla completa.
- En modo mapa se ocultan automáticamente tarjetas, leyenda, navegación inferior y acceso administrativo para dejar el mapa limpio.
- El panel de navegación ahora puede **contraerse** a una barra pequeña con la siguiente indicación.
- En pantallas pequeñas la navegación inicia contraída automáticamente.
- El mapa se redimensiona y continúa siguiendo el GPS al entrar o salir del modo inmersivo.
