# Romería Segura — Demo v0.7

Prototipo para GitHub Pages orientado a acompañamiento de romeros en Cartago.

## Funcionalidad incorporada hasta v0.7

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


## Cambios v0.4
- Seguimiento tipo navegador mediante el botón ➤: mantiene la ubicación centrada hacia la parte inferior y orienta el mapa hacia el avance.
- El seguimiento se pausa si el usuario arrastra manualmente el mapa y se reactiva tocando ➤.
- Ruta peatonal reforzada con segundo motor de respaldo cuando el servicio principal no responde.
- La línea de navegación llega visualmente al marcador exacto del puesto, aun cuando el motor de rutas ajuste el destino a la calle o acera más cercana.
- Nuevas categorías demostrativas: puntos de hidratación y puntos de encuentro.
- Ícono de Cruz Roja sustituido por una cruz médica vertical más clara.
- Crédito visible: proyecto elaborado por la Dirección de Programas Policiales Preventivos.


## Cambios v0.7
- Corrección definitiva de la coincidencia entre ruta y marcador de destino.
- Durante una navegación, el pin del puesto se ancla al punto peatonal real de llegada devuelto por el motor de rutas.
- Se eliminó el conector recto artificial que podía atravesar edificios o quedar visualmente separado.
- Al finalizar la navegación, el pin vuelve automáticamente a su coordenada original definida en `data.js`.
- El cálculo de llegada usa el mismo punto visible donde termina la ruta.
- Se añadieron parámetros de versión a CSS y JavaScript (`?v=0.7.0`) para evitar que GitHub Pages o el navegador mantengan archivos anteriores en caché.


## Cambios v0.7

- Los marcadores ya no interpolan su `transform` al mover el mapa: quedan visualmente anclados a su coordenada.
- Marcadores de servicios y Basílica mantienen orientación vertical aunque se incline o rote el mapa.
- Diseño móvil reforzado: ancho completo, mapa más alto, tarjetas compactas, navegación inferior con safe-area y aspecto de aplicación.
- Detección adicional de dispositivo móvil para aplicar el layout aun cuando el navegador utilice un viewport amplio.


## Corrección v0.7
- Restablece el posicionamiento absoluto requerido por MapLibre para todos los marcadores.
- Elimina cualquier transformación CSS del elemento raíz de los pines.
- La animación y forma visual de la Basílica se ejecutan en pseudo-elementos, sin interferir con las coordenadas.
- Mantiene las mejoras móviles incorporadas en v0.6.
