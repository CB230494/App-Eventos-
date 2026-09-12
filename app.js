(() => {
  'use strict';

  const data = window.ROMERIA_DATA;
  const basilica = data.basilica;
  const serviceMeta = {
    all: { label:'Todos los servicios', icon:'◎' },
    police: { label:'Fuerza Pública', icon:'👮', color:'#1967d2' },
    redcross: { label:'Cruz Roja', icon:'✚', color:'#d7263d' },
    transit: { label:'Tránsito', icon:'🚗', color:'#ef8c22' },
    restroom: { label:'Servicios sanitarios', icon:'🚻', color:'#2b9a66' },
    basilica: { label:'Basílica', icon:'✦', color:'#c5a24a' }
  };

  let map;
  let radiusCircle;
  let basilicaMarker;
  let userMarker;
  let accuracyCircle;
  let userLocation = null;
  let selectedService = 'all';
  let markerById = new Map();
  let watchId = null;
  let demoReports = [...data.reports];
  let currentAdminType = 'object';

  const $ = (id) => document.getElementById(id);
  const qsa = (selector) => [...document.querySelectorAll(selector)];

  initTheme();
  initMap();
  renderReports();
  populateStationSelect();
  bindEvents();

  function initTheme() {
    const saved = localStorage.getItem('romeria-theme');
    const preferredDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(saved || (preferredDark ? 'dark' : 'light'));
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    $('themeIcon').textContent = theme === 'dark' ? '☀' : '☾';
    $('themeToggle').title = theme === 'dark' ? 'Modo claro' : 'Modo oscuro';
    localStorage.setItem('romeria-theme', theme);
  }

  function initMap() {
    map = L.map('map', { zoomControl:true, minZoom:8, maxZoom:19, preferCanvas:true })
      .setView([basilica.lat, basilica.lng], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom:19,
      attribution:'&copy; OpenStreetMap contributors'
    }).addTo(map);

    radiusCircle = L.circle([basilica.lat,basilica.lng], {
      radius:40000,
      color:'#c5a24a',
      weight:1.5,
      opacity:.55,
      fillColor:'#d9bb63',
      fillOpacity:.045,
      dashArray:'7 9'
    }).addTo(map);

    basilicaMarker = L.marker([basilica.lat,basilica.lng], { icon:createIcon('basilica') })
      .addTo(map)
      .bindPopup(popupHtml(basilica));

    renderServiceMarkers();
    setTimeout(() => map.invalidateSize(), 150);
  }

  function createIcon(type) {
    if (type === 'basilica') {
      return L.divIcon({
        className:'custom-div-icon',
        html:'<div class="basilica-marker"><span>✦</span></div>',
        iconSize:[58,58],
        iconAnchor:[29,55],
        popupAnchor:[0,-50]
      });
    }
    const icon = serviceMeta[type]?.icon || '●';
    return L.divIcon({
      className:'custom-div-icon',
      html:`<div class="service-marker ${type}"><span>${icon}</span></div>`,
      iconSize:[44,44],
      iconAnchor:[22,41],
      popupAnchor:[0,-37]
    });
  }

  function createUserIcon() {
    return L.divIcon({ className:'custom-div-icon', html:'<div class="user-marker"></div>', iconSize:[20,20], iconAnchor:[10,10] });
  }

  function renderServiceMarkers() {
    markerById.forEach(marker => map.removeLayer(marker));
    markerById.clear();

    data.services
      .filter(s => selectedService === 'all' || s.type === selectedService)
      .forEach(service => {
        const marker = L.marker([service.lat,service.lng], { icon:createIcon(service.type) })
          .addTo(map)
          .bindPopup(popupHtml(service));
        markerById.set(service.id, marker);
      });
  }

  function popupHtml(item) {
    const meta = serviceMeta[item.type] || serviceMeta.all;
    const distance = userLocation ? haversineKm(userLocation.lat,userLocation.lng,item.lat,item.lng) : null;
    return `
      <div class="popup-card">
        <div class="popup-type">${meta.label}</div>
        <h4>${escapeHtml(item.name)}</h4>
        <p>${escapeHtml(item.note || '')}</p>
        ${item.status ? `<strong>${escapeHtml(item.status)}</strong>` : ''}
        ${distance !== null ? `<p><strong>${formatDistance(distance)}</strong> aprox. desde tu ubicación.</p>` : ''}
      </div>`;
  }

  function bindEvents() {
    $('themeToggle').addEventListener('click', () => {
      setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    });

    $('locateBtn').addEventListener('click', startGeolocation);
    $('centerBasilicaBtn').addEventListener('click', () => {
      switchView('map');
      map.flyTo([basilica.lat,basilica.lng], 15, { duration:1.1 });
      basilicaMarker.openPopup();
    });

    $('legendToggle').addEventListener('click', () => {
      const card = $('legendToggle').closest('.legend-card');
      card.classList.toggle('open');
      $('legendToggle').setAttribute('aria-expanded', card.classList.contains('open') ? 'true' : 'false');
    });

    qsa('.nav-item').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));

    qsa('.service-chip').forEach(btn => btn.addEventListener('click', () => {
      qsa('.service-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedService = btn.dataset.service;
      renderServiceMarkers();
      updateNearestResult();
      if (selectedService !== 'all') fitServiceType(selectedService);
    }));

    qsa('.report-tab').forEach(btn => btn.addEventListener('click', () => {
      qsa('.report-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderReports(btn.dataset.reportFilter);
    }));

    $('adminLink').addEventListener('click', openAdmin);
    $('closeAdminBtn').addEventListener('click', closeAdmin);
    $('adminModal').addEventListener('click', e => { if (e.target === $('adminModal')) closeAdmin(); });
    $('adminLoginBtn').addEventListener('click', adminLogin);
    $('adminCode').addEventListener('keydown', e => { if (e.key === 'Enter') adminLogin(); });
    $('adminLogoutBtn').addEventListener('click', adminLogout);

    qsa('.admin-type').forEach(btn => btn.addEventListener('click', () => setAdminType(btn.dataset.adminType)));
    $('institution').addEventListener('change', populateStationSelect);
    $('evidenceInput').addEventListener('change', previewEvidence);
    $('adminForm').addEventListener('submit', addDemoReport);

    $('openClaimDemoBtn').addEventListener('click', openClaimDemo);
    $('closeClaimBtn').addEventListener('click', closeClaimDemo);
    $('claimModal').addEventListener('click', e => { if (e.target === $('claimModal')) closeClaimDemo(); });
    $('claimDemoBtn').addEventListener('click', () => {
      $('claimMessage').textContent = 'Demostración completada. En producción, la entrega quedaría registrada con auditoría y controles de acceso.';
      showToast('Entrega simulada correctamente');
    });
  }

  function switchView(name) {
    qsa('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
    qsa('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    if (name === 'map') setTimeout(() => map.invalidateSize(), 80);
    window.scrollTo({ top:0, behavior:'smooth' });
  }

  function startGeolocation() {
    if (!navigator.geolocation) {
      showToast('Tu navegador no permite geolocalización');
      setGpsStatus('GPS no disponible', false);
      return;
    }

    setGpsStatus('Solicitando ubicación…', false);
    $('locateBtn').disabled = true;

    const options = { enableHighAccuracy:true, timeout:12000, maximumAge:8000 };
    navigator.geolocation.getCurrentPosition(
      pos => {
        handlePosition(pos, true);
        $('locateBtn').disabled = false;
        if (watchId === null) {
          watchId = navigator.geolocation.watchPosition(
            p => handlePosition(p, false),
            () => {},
            { enableHighAccuracy:true, timeout:20000, maximumAge:10000 }
          );
        }
      },
      err => {
        $('locateBtn').disabled = false;
        const message = err.code === 1 ? 'Ubicación no autorizada' : 'No se pudo obtener tu ubicación';
        setGpsStatus(message, false);
        $('basilicaDistance').textContent = 'GPS no disponible';
        $('distanceNote').textContent = 'Podés seguir usando el mapa manualmente.';
        showToast(message);
      },
      options
    );
  }

  function handlePosition(position, centerMap) {
    const { latitude, longitude, accuracy } = position.coords;
    userLocation = { lat:latitude, lng:longitude, accuracy };
    setGpsStatus('GPS activo', true);

    if (!userMarker) {
      userMarker = L.marker([latitude,longitude], { icon:createUserIcon(), zIndexOffset:1000 }).addTo(map).bindPopup('Tu ubicación aproximada');
      accuracyCircle = L.circle([latitude,longitude], { radius:accuracy || 30, color:'#2a7fff', weight:1, fillOpacity:.07 }).addTo(map);
    } else {
      userMarker.setLatLng([latitude,longitude]);
      accuracyCircle.setLatLng([latitude,longitude]).setRadius(accuracy || 30);
    }

    const km = haversineKm(latitude,longitude,basilica.lat,basilica.lng);
    $('basilicaDistance').textContent = formatDistance(km);
    $('distanceNote').textContent = 'Aproximación en línea recta; no equivale a distancia caminando.';

    if (centerMap) {
      const bounds = L.latLngBounds([[latitude,longitude],[basilica.lat,basilica.lng]]).pad(.25);
      map.fitBounds(bounds, { maxZoom:14 });
    }

    renderServiceMarkers();
    updateNearestResult();
  }

  function setGpsStatus(text, live) {
    $('gpsStatus').innerHTML = `<span class="pulse-dot ${live ? 'live' : ''}"></span>${escapeHtml(text)}`;
  }

  function updateNearestResult() {
    const container = $('nearestResult');
    if (!userLocation) {
      container.innerHTML = '<div class="nearest-icon">⌖</div><div><strong>Activá tu ubicación</strong><p>Así podremos señalarte el servicio seleccionado más cercano.</p></div>';
      return;
    }

    const eligible = data.services.filter(s => selectedService === 'all' || s.type === selectedService);
    if (!eligible.length) return;

    const ranked = eligible.map(s => ({...s, distance:haversineKm(userLocation.lat,userLocation.lng,s.lat,s.lng)})).sort((a,b) => a.distance-b.distance);
    const nearest = ranked[0];
    const meta = serviceMeta[nearest.type];
    container.innerHTML = `
      <div class="nearest-icon">${meta.icon}</div>
      <div>
        <strong>${escapeHtml(nearest.name)} · ${formatDistance(nearest.distance)}</strong>
        <p>Es el punto ${selectedService === 'all' ? 'de apoyo' : meta.label.toLowerCase()} más cercano de esta demostración.</p>
      </div>`;
    container.style.cursor = 'pointer';
    container.onclick = () => focusService(nearest.id);
  }

  function fitServiceType(type) {
    const points = data.services.filter(s => s.type === type).map(s => [s.lat,s.lng]);
    if (points.length) map.fitBounds(L.latLngBounds(points).pad(.18), { maxZoom:14 });
  }

  function focusService(id) {
    switchView('map');
    const service = data.services.find(s => s.id === id);
    if (!service) return;

    if (selectedService !== 'all' && selectedService !== service.type) {
      selectedService = service.type;
      qsa('.service-chip').forEach(b => b.classList.toggle('active', b.dataset.service === selectedService));
      renderServiceMarkers();
    } else if (!markerById.has(id)) {
      selectedService = 'all';
      qsa('.service-chip').forEach(b => b.classList.toggle('active', b.dataset.service === 'all'));
      renderServiceMarkers();
    }

    setTimeout(() => {
      map.flyTo([service.lat,service.lng], 16, { duration:1.1 });
      const marker = markerById.get(id);
      if (marker) marker.openPopup();
    }, 80);
  }

  function renderReports(filter='all') {
    const grid = $('reportGrid');
    const filtered = demoReports.filter(r => filter === 'all' || r.category === filter);
    const labels = { object:'Objeto', person:'Persona', medical:'Traslado médico' };
    grid.innerHTML = filtered.map(report => {
      const station = data.services.find(s => s.id === report.stationId);
      return `
        <article class="report-card" data-category="${report.category}">
          <div class="report-top">
            <div>
              <span class="report-badge">${labels[report.category] || 'Reporte'}</span>
              <h3>${escapeHtml(report.title)}</h3>
            </div>
            <small>${escapeHtml(report.id)}</small>
          </div>
          <p>${escapeHtml(report.summary)}</p>
          <div class="report-meta">
            <span><strong>Estado:</strong> ${escapeHtml(report.state)}</span>
            <span><strong>Punto:</strong> ${escapeHtml(station?.name || 'Punto no disponible')}</span>
            <span><strong>Registro:</strong> ${escapeHtml(report.time)}</span>
            <span>${escapeHtml(report.publicHint || '')}</span>
          </div>
          <button type="button" data-focus-station="${report.stationId}">Ver punto en el mapa</button>
        </article>`;
    }).join('') || '<div class="notice-card glass"><div class="notice-icon">i</div><div><strong>Sin registros</strong><p>No hay reportes para este filtro.</p></div></div>';

    qsa('[data-focus-station]').forEach(btn => btn.addEventListener('click', () => focusService(btn.dataset.focusStation)));
  }

  function openAdmin() {
    $('adminModal').classList.add('open');
    $('adminModal').setAttribute('aria-hidden','false');
    setTimeout(() => $('adminCode').focus(), 100);
  }

  function closeAdmin() {
    $('adminModal').classList.remove('open');
    $('adminModal').setAttribute('aria-hidden','true');
  }

  function adminLogin() {
    const code = $('adminCode').value.trim();
    if (code !== 'DEMO2026') {
      $('adminLoginMessage').textContent = 'Código de demostración incorrecto.';
      return;
    }
    $('adminLoginView').classList.add('hidden');
    $('adminWorkspace').classList.remove('hidden');
    $('adminLoginMessage').textContent = '';
    showToast('Acceso de demostración habilitado');
  }

  function adminLogout() {
    $('adminWorkspace').classList.add('hidden');
    $('adminLoginView').classList.remove('hidden');
    $('adminCode').value = '';
  }

  function setAdminType(type) {
    currentAdminType = type;
    qsa('.admin-type').forEach(btn => btn.classList.toggle('active', btn.dataset.adminType === type));
    $('objectFields').classList.toggle('hidden', type !== 'object');
    $('personFields').classList.toggle('hidden', type !== 'person');
    $('medicalFields').classList.toggle('hidden', type !== 'medical');
  }

  function populateStationSelect() {
    const institution = $('institution')?.value || 'police';
    const allowedType = institution;
    const options = data.services.filter(s => s.type === allowedType);
    $('stationSelect').innerHTML = options.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  }

  function previewEvidence(event) {
    const file = event.target.files?.[0];
    const preview = $('evidencePreview');
    if (!file) {
      preview.classList.add('hidden');
      preview.innerHTML = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      preview.innerHTML = `<img src="${reader.result}" alt="Vista previa local de evidencia" />`;
      preview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  function addDemoReport(event) {
    event.preventDefault();
    const stationId = $('stationSelect').value;
    const station = data.services.find(s => s.id === stationId);
    const now = new Date();
    const stamp = now.toLocaleTimeString('es-CR',{hour:'numeric',minute:'2-digit'});

    let report;
    if (currentAdminType === 'object') {
      const type = $('objectType').value.trim() || 'Objeto';
      report = {
        id:`OBJ-DEMO-${String(demoReports.length+1).padStart(3,'0')}`,
        category:'object',
        title:`${type} encontrado`,
        summary:$('objectDetail').value.trim() || `Reporte de demostración: ${$('objectFeature').value.trim() || 'características reservadas para validación'}.`,
        stationId,
        institution:station?.type === 'police' ? 'Fuerza Pública' : 'Institución',
        time:stamp,
        state:'En custodia',
        publicHint:'Las características de seguridad deben reservarse para validar a la persona reclamante.'
      };
    } else if (currentAdminType === 'person') {
      report = {
        id:`PER-DEMO-${String(demoReports.length+1).padStart(3,'0')}`,
        category:'person',
        title:'Persona ubicada en puesto de apoyo',
        summary:$('personDetail').value.trim() || 'Persona que manifestó encontrarse separada de su grupo.',
        stationId,
        institution:'Institución de apoyo',
        time:$('personTime').value || stamp,
        state:'En acompañamiento',
        publicHint:$('personName').value.trim() ? `Referencia pública: ${$('personName').value.trim()}` : 'Sin datos personales publicados.'
      };
    } else {
      report = {
        id:`MED-DEMO-${String(demoReports.length+1).padStart(3,'0')}`,
        category:'medical',
        title:$('medicalType').value.trim() || 'Atención médica registrada',
        summary:`Traslado de demostración${$('medicalDestination').value.trim() ? ` hacia ${$('medicalDestination').value.trim()}` : ''}. No se publican diagnósticos ni identidad.`,
        stationId,
        institution:'Cruz Roja',
        time:$('medicalTime').value || stamp,
        state:'Registro de atención',
        publicHint:$('medicalTransport').value.trim() ? `Traslado: ${$('medicalTransport').value.trim()}` : 'Información operativa reservada.'
      };
    }

    demoReports.unshift(report);
    renderReports();
    $('adminFormMessage').textContent = 'Reporte agregado únicamente a esta sesión de demostración. Al recargar la página desaparecerá.';
    showToast('Reporte de demostración agregado');
  }

  function openClaimDemo() {
    $('claimModal').classList.add('open');
    $('claimModal').setAttribute('aria-hidden','false');
  }
  function closeClaimDemo() {
    $('claimModal').classList.remove('open');
    $('claimModal').setAttribute('aria-hidden','true');
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    const toRad = deg => deg * Math.PI / 180;
    const R = 6371;
    const dLat = toRad(lat2-lat1);
    const dLon = toRad(lon2-lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }

  function formatDistance(km) {
    if (km < 1) return `${Math.round(km*1000)} m`;
    if (km < 10) return `${km.toFixed(1)} km`;
    return `${Math.round(km)} km`;
  }

  function escapeHtml(value='') {
    return String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[char]));
  }

  function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
  }
})();
