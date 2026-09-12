# Romería Segura — Demo GitHub Pages

Prototipo estático para visualizar una aplicación de apoyo a personas que realizan la Romería hacia la Basílica de Nuestra Señora de los Ángeles en Cartago.

## Qué incluye

- Interfaz blanco/dorado con modo oscuro.
- Mapa Leaflet + OpenStreetMap.
- Basílica como punto central y radio visual aproximado de 40 km.
- Marcadores diferenciados para Fuerza Pública, Cruz Roja, Policía de Tránsito y servicios sanitarios.
- Geolocalización del dispositivo (requiere permiso del usuario y HTTPS).
- Distancia aproximada en línea recta hacia la Basílica.
- Filtro por servicio y cálculo del punto de demostración más cercano.
- Pestaña de objetos/personas/traslados reportados.
- Acceso administrativo discreto.
- Formularios de demostración y vista previa local de fotografía.
- Flujo ilustrativo para retiro de objetos con identificación.

## Importante

Los puestos incluidos son datos ficticios/de demostración. No deben publicarse como ubicaciones oficiales.

Esta versión no tiene backend ni base de datos. Los reportes creados durante la sesión desaparecen al recargar.

No cargue cédulas reales, fotografías de documentos, datos médicos ni datos personales sensibles en esta demo pública.

## Acceso administrativo de demostración

Código: `DEMO2026`

Este código no constituye seguridad real; todo JavaScript publicado en GitHub Pages es visible públicamente.

## Publicar en GitHub Pages

1. Cree un repositorio nuevo en GitHub.
2. Suba `index.html`, `styles.css`, `data.js` y `app.js` en la raíz.
3. Vaya a **Settings → Pages**.
4. En **Build and deployment**, elija **Deploy from a branch**.
5. Seleccione la rama `main` y la carpeta `/ (root)`.
6. Guarde y espere a que GitHub publique la URL.

## Próxima etapa recomendada

Para una versión real se requiere backend seguro, autenticación por roles, bitácora/auditoría, almacenamiento privado de evidencias, tratamiento de datos personales, publicación moderada y una fuente oficial de puestos operativos.
