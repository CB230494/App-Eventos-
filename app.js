(() => {
  'use strict';

  const data = window.ROMERIA_DATA;
  const basilica = data.basilica;
  const $ = id => document.getElementById(id);
  const qsa = (selector, root=document) => [...root.querySelectorAll(selector)];

  const ROUTER_BASE = 'https://routing.openstreetmap.de/routed-foot';
  const VALHALLA_BASE = 'https://valhalla1.openstreetmap.de';
  const ROUTING_TIMEOUT_MS = 9000;
  const LIGHT_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
  const DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark';
  const ROUTE_RECALC_MS = 18000;
  const ROUTE_RECALC_MOVE_M = 28;

  const serviceMeta = {
    police:   { label:'Fuerza Pública', icon:'👮', color:'#1769d2', markerClass:'police' },
    redcross: { label:'Cruz Roja', icon:'➕', color:'#d93838', markerClass:'redcross' },
    transit:  { label:'Tránsito', icon:'🚗', color:'#e28a16', markerClass:'transit' },
    restroom: { label:'Sanitarios', icon:'🚻', color:'#2b9b69', markerClass:'restroom' },
    hydration:{ label:'Hidratación', icon:'💧', color:'#14a9d6', markerClass:'hydration' },
    meeting:  { label:'Punto de encuentro', icon:'⚑', color:'#7657c8', markerClass:'meeting' }
  };

  let map;
  let selectedService = 'all';
  let serviceMarkers = new Map();
  let basilicaMarker = null;
  let userMarker = null;
  let userLocation = null;
  let previousUserLocation = null;
  let watchId = null;
  let demoReports = [...data.reports];
  let nearestService = null;
  let nearestRouteInfo = null;
  let basilicaRouteInfo = null;
  let routingRequestToken = 0;
  let lastNearestCalcAt = 0;
  let lastNearestCalcLocation = null;
  let isDark = localStorage.getItem('romeria-theme') === 'dark';
  let mapFocusMode = false;

  let navigation = {
    active:false,
    destination:null,
    route:null,
    voice:true,
    lastRecalcAt:0,
    lastRecalcLocation:null,
    wakeLock:null,
    announcedInstruction:'',
    followUser:false,
    destinationMarker:null,
    destinationOriginalLngLat:null,
    destinationAccessLngLat:null
  };

  init();

  function init() {
    detectMobileLayout();
    applyTheme(false);
    initMap();
    wireUi();
    renderReports();
    populateAdminStations();
    setDefaultAdminTime();
  }


  function detectMobileLayout() {
    const ua = navigator.userAgent || '';
    const uaMobile = navigator.userAgentData?.mobile === true || /Android|iPhone|iPod|Mobile/i.test(ua);
    const touchPhone = navigator.maxTouchPoints > 1 && Math.min(window.screen?.width || 9999, window.screen?.height || 9999) <= 820;
    const mobile = uaMobile || touchPhone;
    document.documentElement.classList.toggle('mobile-device', mobile);
    document.body.classList.toggle('mobile-device', mobile);
  }

  function initMap() {
    map = new maplibregl.Map({
      container:'map',
      style:isDark ? DARK_STYLE : LIGHT_STYLE,
      center:[basilica.lng, basilica.lat],
      zoom:11.4,
      pitch:0,
      bearing:0,
      attributionControl:true
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass:false }), 'bottom-right');

    map.on('load', () => {
      addReferenceArea();
      addBasilicaMarker();
      renderServiceMarkers();
      restoreRouteLayer();
    });

    map.on('style.load', () => {
      if (!map.loaded()) return;
      addReferenceArea();
      restoreRouteLayer();
    });

    // Si el usuario mueve manualmente el mapa, se pausa el seguimiento tipo Waze.
    map.on('dragstart', () => {
      if (navigation.followUser) setCameraFollow(false, false);
    });
  }

  function addReferenceArea() {
    const circle = createCircleGeoJSON(basilica.lng, basilica.lat, 40, 96);
    if (map.getSource('demo-area')) {
      map.getSource('demo-area').setData(circle);
      return;
    }
    map.addSource('demo-area', { type:'geojson', data:circle });
    map.addLayer({
      id:'demo-area-fill', type:'fill', source:'demo-area',
      paint:{ 'fill-color':'#c7a64c', 'fill-opacity':0.035 }
    });
    map.addLayer({
      id:'demo-area-line', type:'line', source:'demo-area',
      paint:{ 'line-color':'#c7a64c', 'line-width':1.5, 'line-opacity':0.48, 'line-dasharray':[3,3] }
    });
  }

  function createCircleGeoJSON(lng, lat, radiusKm, points=64) {
    const coords=[];
    const earth=6371;
    const latRad=lat*Math.PI/180;
    const lngRad=lng*Math.PI/180;
    const d=radiusKm/earth;
    for (let i=0;i<=points;i++) {
      const brng=(i/points)*Math.PI*2;
      const lat2=Math.asin(Math.sin(latRad)*Math.cos(d)+Math.cos(latRad)*Math.sin(d)*Math.cos(brng));
      const lng2=lngRad+Math.atan2(Math.sin(brng)*Math.sin(d)*Math.cos(latRad),Math.cos(d)-Math.sin(latRad)*Math.sin(lat2));
      coords.push([lng2*180/Math.PI, lat2*180/Math.PI]);
    }
    return { type:'Feature', properties:{}, geometry:{ type:'Polygon', coordinates:[coords] } };
  }

  function addBasilicaMarker() {
    if (basilicaMarker) basilicaMarker.remove();
    const el=document.createElement('button');
    el.className='map-marker basilica-marker';
    el.type='button';
    el.innerHTML='<span>✦</span>';
    el.title=basilica.name;
    el.addEventListener('click', () => openDestinationPopup(basilica, true));
    basilicaMarker=new maplibregl.Marker({element:el, anchor:'bottom', rotationAlignment:'viewport', pitchAlignment:'viewport'})
      .setLngLat([basilica.lng,basilica.lat]).addTo(map);
  }

  function renderServiceMarkers() {
    serviceMarkers.forEach(marker => marker.remove());
    serviceMarkers.clear();

    data.services
      .filter(s => selectedService === 'all' || s.type === selectedService)
      .forEach(service => {
        const meta=serviceMeta[service.type];
        const el=document.createElement('button');
        el.className=`map-marker service-marker ${meta.markerClass}`;
        el.type='button';
        el.innerHTML=serviceMarkerHtml(service.type, meta.icon);
        el.title=service.name;
        el.addEventListener('click', () => openDestinationPopup(service, false));
        const marker=new maplibregl.Marker({element:el, anchor:'bottom', rotationAlignment:'viewport', pitchAlignment:'viewport'})
          .setLngLat([service.lng,service.lat]).addTo(map);
        serviceMarkers.set(service.id, marker);
      });
  }

  function openDestinationPopup(place, isBasilica=false) {
    const meta=isBasilica ? {icon:'✦', label:'Basílica'} : serviceMeta[place.type];
    const routeInfo = isBasilica ? basilicaRouteInfo : (nearestService?.id === place.id ? nearestRouteInfo : null);
    const routeText = routeInfo ? `${formatDistanceMeters(routeInfo.distance)} · ${formatDuration(routeInfo.duration)}` : 'Calcular al iniciar';
    const html=`
      <div class="map-popup">
        <div class="popup-kicker">${meta.icon} ${escapeHtml(meta.label)}</div>
        <strong>${escapeHtml(place.name)}</strong>
        <p>${escapeHtml(place.note || '')}</p>
        <small>${routeText} caminando</small>
        <button class="popup-route-btn" data-route-destination="${escapeHtml(place.id)}" type="button">Ir ahora</button>
      </div>`;
    const popup=new maplibregl.Popup({offset:28, closeButton:true}).setLngLat([place.lng,place.lat]).setHTML(html).addTo(map);
    setTimeout(() => {
      const btn=document.querySelector(`[data-route-destination="${CSS.escape(place.id)}"]`);
      if (btn) btn.addEventListener('click', () => startNavigationTo(place));
    }, 0);
  }

  function wireUi() {
    $('locateBtn').addEventListener('click', startGeolocation);
    $('themeToggle').addEventListener('click', () => { isDark=!isDark; localStorage.setItem('romeria-theme',isDark?'dark':'light'); applyTheme(true); });
    $('centerBasilicaBtn').addEventListener('click', () => map.easeTo({center:[basilica.lng,basilica.lat],zoom:15,pitch:0,bearing:0,duration:900}));
    $('routeBasilicaBtn').addEventListener('click', () => startNavigationTo(basilica));
    $('recenterBtn').addEventListener('click', recenterOnUser);
    $('followBtn').addEventListener('click', toggleCameraFollow);
    $('northBtn').addEventListener('click', () => {
      if (navigation.followUser) setCameraFollow(false, false);
      map.easeTo({bearing:0,pitch:navigation.active?55:0,duration:600});
    });
    $('fullscreenMapBtn').addEventListener('click', toggleMapFocusMode);
    $('compactNavigationBtn').addEventListener('click', toggleNavigationCompact);

    $('legendToggle').addEventListener('click', () => {
      const expanded=$('legendToggle').getAttribute('aria-expanded') === 'true';
      $('legendToggle').setAttribute('aria-expanded', String(!expanded));
      $('legendContent').classList.toggle('open', !expanded);
    });

    qsa('.service-chip').forEach(btn => btn.addEventListener('click', async () => {
      selectedService=btn.dataset.service;
      qsa('.service-chip').forEach(b => b.classList.toggle('active', b===btn));
      renderServiceMarkers();
      nearestService=null;
      nearestRouteInfo=null;
      if (!userLocation) {
        updateNearestResultEmpty();
        if (selectedService !== 'all') fitServiceType(selectedService);
        return;
      }
      await updateNearestByWalkingRoute(true);
    }));

    qsa('.nav-item').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
    qsa('.report-tab').forEach(btn => btn.addEventListener('click', () => {
      qsa('.report-tab').forEach(b => b.classList.toggle('active', b===btn));
      renderReports(btn.dataset.reportFilter);
    }));

    $('closeNavigationBtn').addEventListener('click', stopNavigation);
    $('stopNavigationBtn').addEventListener('click', stopNavigation);
    $('overviewRouteBtn').addEventListener('click', showRouteOverview);
    $('voiceBtn').addEventListener('click', () => {
      navigation.voice=!navigation.voice;
      $('voiceBtn').classList.toggle('active',navigation.voice);
      $('voiceBtn').textContent=navigation.voice?'🔊 Voz':'🔇 Voz';
      showToast(navigation.voice?'Indicaciones por voz activadas':'Indicaciones por voz desactivadas');
    });

    $('adminLink').addEventListener('click', openAdmin);
    $('closeAdminBtn').addEventListener('click', closeAdmin);
    $('adminModal').addEventListener('click', e => { if (e.target === $('adminModal')) closeAdmin(); });
    $('adminLoginBtn').addEventListener('click', adminLogin);
    $('adminCode').addEventListener('keydown', e => { if (e.key==='Enter') adminLogin(); });
    $('adminLogoutBtn').addEventListener('click', adminLogout);
    qsa('.admin-type').forEach(btn => btn.addEventListener('click', () => {
      qsa('.admin-type').forEach(b => b.classList.toggle('active',b===btn));
      $('adminForm').dataset.type=btn.dataset.adminType;
    }));
    $('adminForm').dataset.type='object';
    $('adminForm').addEventListener('submit', submitAdminReport);
    $('adminPhoto').addEventListener('change', previewPhoto);
    $('simulateHandoverBtn').addEventListener('click', simulateHandover);

    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible' && navigation.active) await requestWakeLock();
    });
  }

  function toggleNavigationCompact() {
    const panel=$('navigationPanel');
    setNavigationCompact(!panel.classList.contains('compact'));
  }

  function setNavigationCompact(compact) {
    const panel=$('navigationPanel');
    if (!panel) return;
    panel.classList.toggle('compact', compact);
    const btn=$('compactNavigationBtn');
    if (btn) {
      btn.textContent=compact?'⌄':'⌃';
      btn.setAttribute('aria-label',compact?'Ampliar indicaciones':'Contraer indicaciones');
      btn.title=compact?'Ampliar indicaciones':'Contraer indicaciones';
    }
    setTimeout(()=>map?.resize(),120);
  }

  async function toggleMapFocusMode() {
    const stage=document.querySelector('.map-stage');
    if (!stage) return;
    mapFocusMode=!mapFocusMode;
    document.body.classList.toggle('map-focus',mapFocusMode);
    stage.classList.toggle('map-focus-stage',mapFocusMode);
    const btn=$('fullscreenMapBtn');
    btn.textContent=mapFocusMode?'✕':'⛶';
    btn.title=mapFocusMode?'Salir de pantalla completa':'Ampliar mapa a pantalla completa';
    btn.setAttribute('aria-label',btn.title);

    // El modo inmersivo funciona incluso donde Fullscreen API no está disponible.
    // En navegadores compatibles también solicita pantalla completa real.
    try {
      if (mapFocusMode && stage.requestFullscreen && !document.fullscreenElement) {
        await stage.requestFullscreen();
      } else if (!mapFocusMode && document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (_) {
      // Se mantiene el modo inmersivo CSS como respaldo.
    }

    if (navigation.active && mapFocusMode) setNavigationCompact(true);
    setTimeout(()=>{
      map?.resize();
      if (navigation.active) followUserCamera(true);
    },180);
  }

  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && mapFocusMode) {
      // Si el usuario sale con ESC o con el control del navegador, restaurar interfaz.
      mapFocusMode=false;
      document.body.classList.remove('map-focus');
      const stage=document.querySelector('.map-stage');
      stage?.classList.remove('map-focus-stage');
      const btn=$('fullscreenMapBtn');
      if (btn) { btn.textContent='⛶'; btn.title='Ampliar mapa a pantalla completa'; btn.setAttribute('aria-label',btn.title); }
      setTimeout(()=>map?.resize(),120);
    }
  });

  function applyTheme(updateMap) {
    document.documentElement.dataset.theme=isDark?'dark':'light';
    $('themeIcon').textContent=isDark?'☀':'☾';
    document.querySelector('meta[name="theme-color"]').setAttribute('content',isDark?'#11151b':'#f7f2e7');
    if (updateMap && map) {
      map.setStyle(isDark ? DARK_STYLE : LIGHT_STYLE);
      setTimeout(() => { renderServiceMarkers(); addBasilicaMarker(); }, 350);
    }
  }

  function startGeolocation() {
    if (!navigator.geolocation) {
      showToast('Tu navegador no permite geolocalización');
      setGpsStatus('GPS no disponible', false);
      return;
    }

    setGpsStatus('Solicitando ubicación…', false);
    $('locateBtn').disabled=true;
    navigator.geolocation.getCurrentPosition(
      async pos => {
        await handlePosition(pos, true);
        $('locateBtn').disabled=false;
        if (watchId === null) {
          watchId=navigator.geolocation.watchPosition(
            p => handlePosition(p, false),
            err => console.warn('GPS watch:',err),
            {enableHighAccuracy:true,timeout:20000,maximumAge:3000}
          );
        }
      },
      err => {
        $('locateBtn').disabled=false;
        const message=err.code===1?'Ubicación no autorizada':'No se pudo obtener tu ubicación';
        setGpsStatus(message,false);
        $('basilicaDistance').textContent='GPS no disponible';
        $('distanceNote').textContent='Podés seguir usando el mapa manualmente.';
        showToast(message);
      },
      {enableHighAccuracy:true,timeout:15000,maximumAge:3000}
    );
  }

  async function handlePosition(position, centerMap) {
    const {latitude,longitude,accuracy,heading,speed}=position.coords;
    previousUserLocation=userLocation;
    userLocation={lat:latitude,lng:longitude,accuracy:accuracy||30,heading,speed,timestamp:position.timestamp};
    setGpsStatus('GPS activo',true);
    updateUserMarker();
    $('routeBasilicaBtn').disabled=false;

    if (centerMap && !navigation.active) {
      map.easeTo({center:[longitude,latitude],zoom:15.2,pitch:0,bearing:0,duration:900});
    }

    if (!navigation.active) {
      if (!basilicaRouteInfo || movedMeters(previousUserLocation,userLocation) > 80) updateBasilicaRouteSummary();
      const now=Date.now();
      const movedSinceNearest=movedMeters(lastNearestCalcLocation,userLocation);
      if (!lastNearestCalcLocation || (now-lastNearestCalcAt>20000 && movedSinceNearest>45)) updateNearestByWalkingRoute(false);
      if (navigation.followUser) followUserCamera(false);
    } else {
      if (navigation.followUser) followUserCamera(false);
      maybeRecalculateNavigation();
      updateNavigationProgressFromGps();
    }
  }

  function updateUserMarker() {
    if (!userLocation) return;
    const bearing=getUserBearing();
    if (!userMarker) {
      const el=document.createElement('div');
      el.className='user-location-marker';
      el.innerHTML='<div class="user-accuracy"></div><div class="user-arrow">➤</div>';
      userMarker=new maplibregl.Marker({element:el,anchor:'center',rotationAlignment:'map'})
        .setLngLat([userLocation.lng,userLocation.lat]).addTo(map);
    } else {
      userMarker.setLngLat([userLocation.lng,userLocation.lat]);
    }
    if (Number.isFinite(bearing)) userMarker.setRotation(bearing);
    const el=userMarker.getElement();
    const acc=Math.min(110,Math.max(28,userLocation.accuracy*1.4));
    el.style.setProperty('--accuracy-size',`${acc}px`);
    el.classList.toggle('navigating',navigation.active);
  }

  function getUserBearing() {
    if (userLocation && Number.isFinite(userLocation.heading) && userLocation.heading >= 0) return userLocation.heading;
    if (previousUserLocation && userLocation && movedMeters(previousUserLocation,userLocation) > 4) {
      return bearingBetween(previousUserLocation.lat,previousUserLocation.lng,userLocation.lat,userLocation.lng);
    }
    return map ? map.getBearing() : 0;
  }

  async function updateBasilicaRouteSummary() {
    if (!userLocation) return;
    try {
      const route=await fetchWalkingRoute(userLocation,basilica,false);
      basilicaRouteInfo={distance:route.distance,duration:route.duration};
      $('basilicaDistance').textContent=`${formatDistanceMeters(route.distance)} · ${formatDuration(route.duration)}`;
      $('distanceNote').textContent='Recorrido peatonal estimado por calles y caminos disponibles.';
    } catch (err) {
      console.warn(err);
      $('basilicaDistance').textContent='Ruta temporalmente no disponible';
      $('distanceNote').textContent='Tu GPS está activo. Reintentaremos la ruta peatonal automáticamente.';
    }
  }

  async function updateNearestByWalkingRoute(force=false) {
    if (!userLocation) return;
    const now=Date.now();
    if (!force && lastNearestCalcLocation && now-lastNearestCalcAt<20000 && movedMeters(lastNearestCalcLocation,userLocation)<45) return;
    lastNearestCalcAt=now;
    lastNearestCalcLocation={...userLocation};
    const token=++routingRequestToken;
    setRoutingBusy(true);
    const eligible=data.services.filter(s => selectedService==='all' || s.type===selectedService);

    try {
      let winner=null;
      try {
        const matrix=await fetchWalkingMatrix(userLocation,eligible);
        if (token !== routingRequestToken) return;
        const ranked=eligible.map((service,i)=>({service,duration:matrix.durations?.[0]?.[i],distance:matrix.distances?.[0]?.[i]}))
          .filter(x => Number.isFinite(x.duration) && Number.isFinite(x.distance))
          .sort((a,b)=>a.distance-b.distance || a.duration-b.duration);
        if (ranked.length) winner=ranked[0];
      } catch (matrixError) {
        console.warn('Walking matrix unavailable; testing route alternatives:',matrixError);
      }

      // Respaldo: si la matriz falla, prueba rutas peatonales reales a los candidatos más cercanos.
      // No se muestra al usuario una distancia en línea recta como si fuera una ruta.
      if (!winner) winner=await findNearestByIndividualRoutes(userLocation,eligible);
      if (!winner) throw new Error('No fue posible calcular recorridos peatonales');

      nearestService=winner.service;
      nearestRouteInfo={duration:winner.duration,distance:winner.distance,provider:winner.provider||'routing'};
      renderNearestResult(false);
    } catch (err) {
      console.warn('Nearest walking route:',err);
      nearestService=null;
      nearestRouteInfo=null;
      renderRoutingUnavailableResult();
    } finally {
      if (token === routingRequestToken) setRoutingBusy(false);
    }
  }

  async function findNearestByIndividualRoutes(origin,eligible) {
    const shortlist=[...eligible]
      .map(service=>({service,air:haversineMeters(origin.lat,origin.lng,service.lat,service.lng)}))
      .sort((a,b)=>a.air-b.air)
      .slice(0,Math.min(6,eligible.length));
    const settled=await Promise.allSettled(shortlist.map(async ({service})=>{
      const route=await fetchWalkingRoute(origin,service,false);
      return {service,distance:route.distance,duration:route.duration,provider:route.provider};
    }));
    return settled
      .filter(r=>r.status==='fulfilled')
      .map(r=>r.value)
      .sort((a,b)=>a.distance-b.distance || a.duration-b.duration)[0] || null;
  }

  function renderRoutingUnavailableResult() {
    $('nearestResult').innerHTML=`
      <div class="nearest-icon routing-warning">↻</div>
      <div class="nearest-copy"><strong>GPS activo · ruta pendiente</strong><p>No pudimos consultar el servicio de rutas peatonales en este momento.</p></div>
      <button id="retryRoutingBtn" class="go-route-btn retry" type="button">REINTENTAR</button>`;
    $('retryRoutingBtn')?.addEventListener('click',()=>updateNearestByWalkingRoute(true));
  }

  function renderNearestResult(fallback=false) {
    if (!nearestService) return updateNearestResultEmpty();
    const meta=serviceMeta[nearestService.type];
    const routeLine=nearestRouteInfo
      ? `<strong>${escapeHtml(nearestService.name)}</strong><div class="route-metrics"><b>${formatDistanceMeters(nearestRouteInfo.distance)}</b><span>·</span><b>${formatDuration(nearestRouteInfo.duration)}</b><span>caminando</span></div>`
      : `<strong>${escapeHtml(nearestService.name)}</strong><div class="route-metrics fallback"><span>Ruta peatonal temporalmente no disponible</span></div>`;
    $('nearestResult').innerHTML=`
      <div class="nearest-icon service-color-${nearestService.type}">${nearestInlineIcon(nearestService.type,meta.icon)}</div>
      <div class="nearest-copy">${routeLine}<p>Es el punto con menor recorrido peatonal disponible de esta categoría.</p></div>
      <button id="goNearestBtn" class="go-route-btn" type="button">IR AHORA <span>→</span></button>`;
    $('goNearestBtn').addEventListener('click',()=>startNavigationTo(nearestService));
    focusService(nearestService.id,false);
  }

  function updateNearestResultEmpty() {
    $('nearestResult').innerHTML='<div class="nearest-icon">⌖</div><div class="nearest-copy"><strong>Activá tu ubicación</strong><p>Así podremos buscar el servicio seleccionado más cercano por recorrido peatonal.</p></div>';
  }

  async function startNavigationTo(destination) {
    if (!userLocation) {
      showToast('Primero activá tu ubicación');
      startGeolocation();
      return;
    }
    switchView('map');
    setRoutingBusy(true);
    try {
      const route=await fetchWalkingRoute(userLocation,destination,true);
      navigation.active=true;
      navigation.destination=destination;
      navigation.route=route;
      syncDestinationMarkerToRoute(destination, route);
      navigation.lastRecalcAt=Date.now();
      navigation.lastRecalcLocation={...userLocation};
      navigation.announcedInstruction='';
      setDestinationHighlight(destination);
      setCameraFollow(true, false);
      $('navigationPanel').classList.remove('hidden');
      document.body.classList.add('navigation-active');
      if (mapFocusMode || window.innerWidth <= 900) setNavigationCompact(true);
      updateUserMarker();
      drawRoute(route.geometry);
      updateNavigationUi(route);
      await requestWakeLock();
      followUserCamera(true);
      speakCurrentInstruction(true);
      showToast('Navegación peatonal iniciada');
    } catch (err) {
      console.error(err);
      showToast('No fue posible calcular la ruta peatonal');
    } finally {
      setRoutingBusy(false);
    }
  }

  async function fetchWalkingMatrix(origin,destinations) {
    const coords=[[origin.lng,origin.lat],...destinations.map(d=>[d.lng,d.lat])];
    const coordText=coords.map(c=>`${c[0]},${c[1]}`).join(';');
    const destIndexes=destinations.map((_,i)=>i+1).join(';');
    const url=`${ROUTER_BASE}/table/v1/driving/${coordText}?sources=0&destinations=${destIndexes}&annotations=duration,distance`;
    const json=await fetchJsonWithTimeout(url,{},ROUTING_TIMEOUT_MS);
    if (json.code!=='Ok') throw new Error(json.message||'Routing table error');
    return json;
  }

  async function fetchWalkingRoute(origin,destination,withSteps=true) {
    let primaryError=null;
    try {
      return await fetchOsrmWalkingRoute(origin,destination,withSteps);
    } catch (err) {
      primaryError=err;
      console.warn('Primary pedestrian router unavailable:',err);
    }
    try {
      return await fetchValhallaWalkingRoute(origin,destination,withSteps);
    } catch (fallbackError) {
      const combined=new Error(`No pedestrian route available: ${primaryError?.message||'primary'} / ${fallbackError?.message||'fallback'}`);
      combined.primary=primaryError; combined.fallback=fallbackError;
      throw combined;
    }
  }

  async function fetchOsrmWalkingRoute(origin,destination,withSteps=true) {
    const url=`${ROUTER_BASE}/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=${withSteps?'true':'false'}&alternatives=false`;
    const json=await fetchJsonWithTimeout(url,{},ROUTING_TIMEOUT_MS);
    if (json.code!=='Ok' || !json.routes?.length) throw new Error(json.message||'No route');
    const raw=json.routes[0];
    const snapped=json.waypoints?.[1]?.location || raw.geometry?.coordinates?.at?.(-1);
    return finalizeRoute({
      distance:raw.distance,
      duration:raw.duration,
      geometry:raw.geometry,
      steps:(raw.legs||[]).flatMap(leg=>leg.steps||[]),
      raw, provider:'OSRM-foot', snappedDestination:snapped
    },destination);
  }

  async function fetchValhallaWalkingRoute(origin,destination,withSteps=true) {
    const payload={
      locations:[{lon:origin.lng,lat:origin.lat,type:'break'},{lon:destination.lng,lat:destination.lat,type:'break'}],
      costing:'pedestrian',
      units:'kilometers',
      directions_options:{language:'es-ES',units:'kilometers'}
    };
    const url=`${VALHALLA_BASE}/route?json=${encodeURIComponent(JSON.stringify(payload))}`;
    const json=await fetchJsonWithTimeout(url,{},ROUTING_TIMEOUT_MS+2500);
    if (!json.trip?.legs?.length) throw new Error(json.error||json.error_code||'Valhalla route unavailable');
    const leg=json.trip.legs[0];
    const coords=decodePolyline6(leg.shape||'');
    if (coords.length<2) throw new Error('Valhalla returned no route geometry');
    const maneuvers=withSteps?(leg.maneuvers||[]):[];
    const steps=maneuvers.map((m,i)=>{
      const c=coords[Math.min(coords.length-1,Math.max(0,m.begin_shape_index||0))] || coords[0];
      return {
        distance:Number(m.length||0)*1000, duration:Number(m.time||0), name:m.street_names?.[0]||'',
        maneuver:{instruction:m.instruction||m.verbal_pre_transition_instruction||'',location:c,type:i===maneuvers.length-1?'arrive':'continue',modifier:''}
      };
    });
    const summary=json.trip.summary||leg.summary||{};
    return finalizeRoute({
      distance:Number(summary.length||0)*1000, duration:Number(summary.time||0),
      geometry:{type:'LineString',coordinates:coords}, steps, raw:json, provider:'Valhalla',
      snappedDestination:coords[coords.length-1]
    },destination);
  }

  function finalizeRoute(route,destination) {
    const geometry=route.geometry?.type==='LineString'
      ? {type:'LineString',coordinates:(route.geometry.coordinates||[]).map(c=>[Number(c[0]),Number(c[1])])}
      : route.geometry;
    if (!geometry?.coordinates?.length) return {...route,geometry};

    // Los motores de navegación terminan en el punto peatonal accesible más cercano
    // (acera/calle/sendero). Ese es el punto real de llegada que debe coincidir
    // visualmente con el pin durante la navegación. No agregamos una línea recta
    // artificial atravesando lotes o edificios hasta la coordenada original.
    const last=geometry.coordinates[geometry.coordinates.length-1];
    const accessPoint = Array.isArray(route.snappedDestination) && route.snappedDestination.length >= 2
      ? [Number(route.snappedDestination[0]), Number(route.snappedDestination[1])]
      : [Number(last[0]), Number(last[1])];
    const snapGap=haversineMeters(accessPoint[1],accessPoint[0],destination.lat,destination.lng);

    // Garantiza que la geometría termine exactamente donde quedará anclado el marcador.
    const endGap=haversineMeters(last[1],last[0],accessPoint[1],accessPoint[0]);
    if (endGap>0.75) geometry.coordinates.push(accessPoint);

    return {...route,geometry,accessPoint,snapGapMeters:snapGap};
  }

  async function fetchJsonWithTimeout(url,options={},timeoutMs=9000) {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try {
      const res=await fetch(url,{...options,headers:{Accept:'application/json',...(options.headers||{})},signal:controller.signal});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function decodePolyline6(encoded) {
    const coords=[]; let index=0,lat=0,lng=0;
    while (index<encoded.length) {
      let b,shift=0,result=0;
      do { b=encoded.charCodeAt(index++)-63; result|=(b&0x1f)<<shift; shift+=5; } while (b>=0x20 && index<=encoded.length);
      const dlat=(result&1)?~(result>>1):(result>>1); lat+=dlat;
      shift=0; result=0;
      do { b=encoded.charCodeAt(index++)-63; result|=(b&0x1f)<<shift; shift+=5; } while (b>=0x20 && index<=encoded.length);
      const dlng=(result&1)?~(result>>1):(result>>1); lng+=dlng;
      coords.push([lng/1e6,lat/1e6]);
    }
    return coords;
  }

  function drawRoute(geometry) {
    if (!geometry || !map.getStyle()) return;
    const geo={type:'Feature',properties:{},geometry};
    if (map.getSource('active-route')) {
      map.getSource('active-route').setData(geo);
      return;
    }
    map.addSource('active-route',{type:'geojson',data:geo});
    map.addLayer({
      id:'active-route-casing',type:'line',source:'active-route',
      layout:{'line-cap':'round','line-join':'round'},
      paint:{'line-color':isDark?'#111827':'#ffffff','line-width':10,'line-opacity':0.9}
    });
    map.addLayer({
      id:'active-route-line',type:'line',source:'active-route',
      layout:{'line-cap':'round','line-join':'round'},
      paint:{'line-color':'#d4af37','line-width':6,'line-opacity':0.98}
    });
  }

  function restoreRouteLayer() {
    if (navigation.active && navigation.route?.geometry) {
      setTimeout(()=>drawRoute(navigation.route.geometry),80);
    }
  }

  function updateNavigationUi(route) {
    $('navRemainingDistance').textContent=formatDistanceMeters(route.distance);
    $('navRemainingTime').textContent=formatDuration(route.duration);
    $('navDestination').textContent=navigation.destination?.name || 'Destino';
    $('navEta').textContent=`Llegada aprox. ${formatEta(route.duration)}`;
    const step=findCurrentStep(route.steps);
    setInstructionUi(step);
  }

  function findCurrentStep(steps) {
    if (!steps?.length) return null;
    if (!userLocation) return steps[0];
    let best={step:steps[0],distance:Infinity};
    for (const step of steps) {
      const loc=step.maneuver?.location;
      if (!loc) continue;
      const d=haversineMeters(userLocation.lat,userLocation.lng,loc[1],loc[0]);
      if (d<best.distance) best={step,distance:d};
    }
    const idx=steps.indexOf(best.step);
    if (best.distance < 28 && idx < steps.length-1) return steps[idx+1];
    return best.step;
  }

  function setInstructionUi(step) {
    if (!step) {
      $('navInstruction').textContent='Continúe por la ruta';
      $('navStepDistance').textContent='';
      $('navTurnIcon').textContent='↑';
      return;
    }
    const instruction=step.maneuver?.instruction || step.name || instructionFromManeuver(step.maneuver);
    $('navInstruction').textContent=instruction || 'Continúe por la ruta';
    $('navStepDistance').textContent=step.distance?`en ${formatDistanceMeters(step.distance)}`:'';
    $('navTurnIcon').textContent=turnIcon(step.maneuver);
  }

  function instructionFromManeuver(m={}) {
    const mod=m.modifier||'';
    if (m.type==='arrive') return 'Ha llegado a su destino';
    if (m.type==='depart') return 'Inicie el recorrido';
    if (mod.includes('right')) return 'Gire a la derecha';
    if (mod.includes('left')) return 'Gire a la izquierda';
    if (mod==='uturn') return 'Dé la vuelta cuando sea posible';
    return 'Continúe recto';
  }

  function turnIcon(m={}) {
    const mod=m.modifier||'';
    if (m.type==='arrive') return '●';
    if (mod.includes('right')) return '↱';
    if (mod.includes('left')) return '↰';
    if (mod==='uturn') return '↶';
    return '↑';
  }

  function toggleCameraFollow() {
    if (!userLocation) {
      showToast('Activá primero tu ubicación');
      startGeolocation();
      return;
    }
    setCameraFollow(!navigation.followUser,true);
  }

  function setCameraFollow(active,announce=true) {
    navigation.followUser=Boolean(active);
    const btn=$('followBtn');
    if (btn) {
      btn.classList.toggle('active',navigation.followUser);
      btn.title=navigation.followUser?'Seguimiento activo · tocar para liberar mapa':'Seguir mi marcha y mirar hacia adelante';
      btn.setAttribute('aria-label',btn.title);
    }
    if (navigation.followUser && userLocation) followUserCamera(true);
    if (announce) showToast(navigation.followUser?'Seguimiento de marcha activado':'Mapa liberado · tocá ➤ para seguirte');
  }

  function followUserCamera(force=false) {
    if (!navigation.followUser || !userLocation) return;
    const bearing=getNavigationBearing();
    map.easeTo({
      center:[userLocation.lng,userLocation.lat],
      zoom:navigation.active?17.35:16.7,
      pitch:navigation.active?61:48,
      bearing:Number.isFinite(bearing)?bearing:map.getBearing(),
      // Desplaza la marca un poco hacia abajo para mostrar más camino por delante, estilo navegador.
      offset:[0,Math.min(145,Math.max(70,window.innerHeight*0.14))],
      duration:force?850:520,
      easing:t=>t
    });
  }

  function getNavigationBearing() {
    if (userLocation && Number.isFinite(userLocation.heading) && userLocation.heading>=0) return userLocation.heading;
    if (previousUserLocation && userLocation && movedMeters(previousUserLocation,userLocation)>3) {
      return bearingBetween(previousUserLocation.lat,previousUserLocation.lng,userLocation.lat,userLocation.lng);
    }
    const coords=navigation.route?.geometry?.coordinates||[];
    if (coords.length>1 && userLocation) {
      let idx=0,best=Infinity;
      coords.forEach((c,i)=>{ const d=haversineMeters(userLocation.lat,userLocation.lng,c[1],c[0]); if(d<best){best=d;idx=i;} });
      const ahead=coords[Math.min(coords.length-1,idx+Math.max(2,Math.min(8,Math.floor(coords.length/30))))];
      if (ahead) return bearingBetween(userLocation.lat,userLocation.lng,ahead[1],ahead[0]);
    }
    return getUserBearing();
  }

  async function maybeRecalculateNavigation() {
    if (!navigation.active || !navigation.destination || !userLocation) return;
    const now=Date.now();
    const moved=movedMeters(navigation.lastRecalcLocation,userLocation);
    if (now-navigation.lastRecalcAt < ROUTE_RECALC_MS && moved < ROUTE_RECALC_MOVE_M) return;

    navigation.lastRecalcAt=now;
    navigation.lastRecalcLocation={...userLocation};
    try {
      const route=await fetchWalkingRoute(userLocation,navigation.destination,true);
      navigation.route=route;
      syncDestinationMarkerToRoute(navigation.destination, route);
      drawRoute(route.geometry);
      updateNavigationUi(route);
      speakCurrentInstruction(false);
    } catch (err) {
      console.warn('Recalculate route:',err);
    }
  }

  function updateNavigationProgressFromGps() {
    if (!navigation.active || !navigation.route || !userLocation) return;
    const remainingApprox=distanceAlongRouteFromNearestPoint(userLocation,navigation.route.geometry?.coordinates||[]);
    if (Number.isFinite(remainingApprox)) {
      $('navRemainingDistance').textContent=formatDistanceMeters(remainingApprox);
      const ratio=navigation.route.distance>0?Math.min(1,remainingApprox/navigation.route.distance):1;
      const remainingTime=Math.max(0,navigation.route.duration*ratio);
      $('navRemainingTime').textContent=formatDuration(remainingTime);
      $('navEta').textContent=`Llegada aprox. ${formatEta(remainingTime)}`;
    }
    const step=findCurrentStep(navigation.route.steps);
    setInstructionUi(step);
    speakCurrentInstruction(false);

    const arrivalPoint=navigation.destinationAccessLngLat || [navigation.destination.lng,navigation.destination.lat];
    const finalDist=haversineMeters(userLocation.lat,userLocation.lng,arrivalPoint[1],arrivalPoint[0]);
    if (finalDist < 30) {
      $('navInstruction').textContent='Ha llegado a su destino';
      $('navTurnIcon').textContent='✓';
      $('navStepDistance').textContent='';
      if (navigation.voice) speak('Ha llegado a su destino.');
    }
  }

  function distanceAlongRouteFromNearestPoint(pos,coords) {
    if (!coords?.length) return NaN;
    let nearestIndex=0;
    let nearestDistance=Infinity;
    coords.forEach((c,i)=>{
      const d=haversineMeters(pos.lat,pos.lng,c[1],c[0]);
      if (d<nearestDistance) {nearestDistance=d;nearestIndex=i;}
    });
    let total=nearestDistance;
    for (let i=nearestIndex;i<coords.length-1;i++) total+=haversineMeters(coords[i][1],coords[i][0],coords[i+1][1],coords[i+1][0]);
    return total;
  }

  function speakCurrentInstruction(force) {
    if (!navigation.voice || !navigation.route?.steps?.length) return;
    const step=findCurrentStep(navigation.route.steps);
    if (!step) return;
    const text=step.maneuver?.instruction || instructionFromManeuver(step.maneuver);
    if (!text || (!force && navigation.announcedInstruction===text)) return;
    navigation.announcedInstruction=text;
    speak(text);
  }

  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter=new SpeechSynthesisUtterance(text);
    utter.lang='es-CR';
    utter.rate=0.95;
    window.speechSynthesis.speak(utter);
  }

  async function requestWakeLock() {
    if (!('wakeLock' in navigator) || document.visibilityState!=='visible') return;
    try {
      navigation.wakeLock=await navigator.wakeLock.request('screen');
    } catch (err) {
      console.debug('Wake lock unavailable',err);
    }
  }

  async function stopNavigation() {
    restoreDestinationMarker();
    navigation.active=false;
    navigation.destination=null;
    navigation.route=null;
    navigation.announcedInstruction='';
    clearDestinationHighlight();
    setCameraFollow(false,false);
    $('navigationPanel').classList.add('hidden');
    $('navigationPanel').classList.remove('compact');
    $('compactNavigationBtn').textContent='⌃';
    $('compactNavigationBtn').setAttribute('aria-label','Contraer indicaciones');
    document.body.classList.remove('navigation-active');
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (navigation.wakeLock) {
      try { await navigation.wakeLock.release(); } catch (_) {}
      navigation.wakeLock=null;
    }
    removeRouteLayer();
    updateUserMarker();
    if (userLocation) map.easeTo({center:[userLocation.lng,userLocation.lat],zoom:15.2,pitch:0,bearing:0,duration:800});
  }

  function removeRouteLayer() {
    ['active-route-line','active-route-casing'].forEach(id=>{if(map.getLayer(id))map.removeLayer(id);});
    if (map.getSource('active-route')) map.removeSource('active-route');
  }

  function showRouteOverview() {
    if (!navigation.active || !navigation.route?.geometry?.coordinates?.length) return;
    setCameraFollow(false,false);
    const bounds=new maplibregl.LngLatBounds();
    navigation.route.geometry.coordinates.forEach(c=>bounds.extend(c));
    map.fitBounds(bounds,{padding:{top:120,bottom:230,left:55,right:55},maxZoom:16,duration:800});
  }

  function recenterOnUser() {
    if (!userLocation) return showToast('Activá primero tu ubicación');
    const bearing=navigation.active?getNavigationBearing():0;
    map.easeTo({
      center:[userLocation.lng,userLocation.lat],
      zoom:navigation.active?17:15.4,
      pitch:navigation.active?55:0,
      bearing,
      duration:700
    });
  }

  function getDestinationMarker(destination) {
    if (!destination) return null;
    return destination.id==='basilica' ? basilicaMarker : serviceMarkers.get(destination.id);
  }

  function syncDestinationMarkerToRoute(destination, route) {
    if (!destination || !route) return;
    const marker=getDestinationMarker(destination);
    const coords=route.accessPoint || route.geometry?.coordinates?.[route.geometry.coordinates.length-1];
    if (!marker || !Array.isArray(coords) || coords.length<2) return;

    // Guardamos una sola vez la ubicación definida en data.js para poder restaurarla.
    if (navigation.destinationMarker !== marker || !navigation.destinationOriginalLngLat) {
      restoreDestinationMarker();
      navigation.destinationMarker=marker;
      navigation.destinationOriginalLngLat=[Number(destination.lng),Number(destination.lat)];
    }

    navigation.destinationAccessLngLat=[Number(coords[0]),Number(coords[1])];
    marker.setLngLat(navigation.destinationAccessLngLat);
    marker.getElement()?.classList.add('destination-route-anchor');
  }

  function restoreDestinationMarker() {
    if (navigation.destinationMarker && navigation.destinationOriginalLngLat) {
      navigation.destinationMarker.setLngLat(navigation.destinationOriginalLngLat);
      navigation.destinationMarker.getElement()?.classList.remove('destination-route-anchor');
    }
    navigation.destinationMarker=null;
    navigation.destinationOriginalLngLat=null;
    navigation.destinationAccessLngLat=null;
  }

  function setDestinationHighlight(destination) {
    clearDestinationHighlight();
    const marker=destination.id==='basilica'?basilicaMarker:serviceMarkers.get(destination.id);
    marker?.getElement()?.classList.add('destination-active');
  }

  function clearDestinationHighlight() {
    document.querySelectorAll('.map-marker.destination-active').forEach(el=>el.classList.remove('destination-active'));
  }

  function serviceMarkerHtml(type,icon) {
    if (type==='redcross') return '<span class="marker-medical-cross" aria-hidden="true"></span>';
    return `<span>${icon}</span>`;
  }

  function nearestInlineIcon(type,icon) {
    return type==='redcross'?'<span class="inline-medical-cross" aria-hidden="true"></span>':icon;
  }

  function focusService(id,openPopup=true) {
    const service=data.services.find(s=>s.id===id);
    if (!service) return;
    map.easeTo({center:[service.lng,service.lat],zoom:15.8,duration:700});
    if (openPopup) setTimeout(()=>openDestinationPopup(service,false),350);
  }

  function fitServiceType(type) {
    const services=data.services.filter(s=>s.type===type);
    if (!services.length) return;
    const bounds=new maplibregl.LngLatBounds();
    services.forEach(s=>bounds.extend([s.lng,s.lat]));
    map.fitBounds(bounds,{padding:80,maxZoom:14.5,duration:700});
  }

  function switchView(name) {
    qsa('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));
    qsa('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
    if (name==='map') setTimeout(()=>map.resize(),80);
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function renderReports(filter='all') {
    const labels={object:'Objeto',person:'Persona',medical:'Traslado médico'};
    const filtered=demoReports.filter(r=>filter==='all'||r.category===filter);
    $('reportGrid').innerHTML=filtered.map(report=>{
      const station=data.services.find(s=>s.id===report.stationId);
      return `<article class="report-card glass">
        <div class="report-top"><div><span class="report-badge">${labels[report.category]||'Reporte'}</span><h3>${escapeHtml(report.title)}</h3></div><small>${escapeHtml(report.id)}</small></div>
        <p>${escapeHtml(report.summary)}</p>
        <div class="report-meta"><span>◷ ${escapeHtml(report.time)}</span><span>● ${escapeHtml(report.state)}</span></div>
        <div class="report-station"><span>${escapeHtml(report.institution)}</span><strong>${escapeHtml(station?.name||'Puesto de apoyo')}</strong></div>
        <div class="report-hint">${escapeHtml(report.publicHint||'')}</div>
        ${station?`<button class="outline-btn report-map-btn" data-station-id="${station.id}" type="button">Ver punto en el mapa</button>`:''}
      </article>`;
    }).join('') || '<div class="empty-state">No hay registros en esta categoría.</div>';

    qsa('.report-map-btn').forEach(btn=>btn.addEventListener('click',()=>{
      switchView('map');
      const s=data.services.find(x=>x.id===btn.dataset.stationId);
      if (s) setTimeout(()=>{map.easeTo({center:[s.lng,s.lat],zoom:16,duration:800});openDestinationPopup(s,false);},120);
    }));
  }

  function openAdmin() { $('adminModal').classList.add('open'); $('adminModal').setAttribute('aria-hidden','false'); }
  function closeAdmin() { $('adminModal').classList.remove('open'); $('adminModal').setAttribute('aria-hidden','true'); }
  function adminLogin() {
    if ($('adminCode').value.trim()==='DEMO2026') {
      $('adminLoginView').classList.add('hidden'); $('adminWorkspace').classList.remove('hidden'); $('adminLoginMessage').textContent='';
    } else $('adminLoginMessage').textContent='Código de demostración incorrecto.';
  }
  function adminLogout() { $('adminWorkspace').classList.add('hidden'); $('adminLoginView').classList.remove('hidden'); $('adminCode').value=''; }
  function populateAdminStations() { $('adminStation').innerHTML=data.services.map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join(''); }
  function setDefaultAdminTime() { const d=new Date(); $('adminTime').value=`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
  function previewPhoto() {
    const file=$('adminPhoto').files?.[0];
    if (!file) return $('photoPreview').innerHTML='<span>Sin fotografía seleccionada</span>';
    const url=URL.createObjectURL(file);
    $('photoPreview').innerHTML=`<img src="${url}" alt="Vista previa de evidencia" />`;
  }
  function submitAdminReport(e) {
    e.preventDefault();
    const category=$('adminForm').dataset.type||'object';
    const prefix=category==='object'?'OBJ':category==='person'?'PER':'MED';
    const time=$('adminTime').value||'--:--';
    demoReports.unshift({
      id:`${prefix}-DEMO-${String(demoReports.length+1).padStart(3,'0')}`, category,
      title:$('adminTitleInput').value.trim(), summary:$('adminSummary').value.trim(), stationId:$('adminStation').value,
      institution:$('adminInstitution').value, time:to12h(time), state:$('adminState').value.trim(),
      publicHint:'Registro agregado durante esta sesión de demostración. No se almacena al recargar la página.'
    });
    renderReports(qsa('.report-tab.active')[0]?.dataset.reportFilter||'all');
    e.target.reset(); setDefaultAdminTime(); $('photoPreview').innerHTML='<span>Sin fotografía seleccionada</span>';
    showToast('Reporte agregado a la demostración');
  }
  function simulateHandover() {
    if (!$('idFront').files?.[0] || !$('idBack').files?.[0]) return $('handoverStatus').textContent='Seleccioná ambas imágenes de identificación para completar la simulación.';
    $('handoverStatus').textContent='Entrega simulada. En producción, la identificación quedaría protegida con controles de acceso, trazabilidad y política de retención.';
    showToast('Entrega simulada correctamente');
  }

  function setRoutingBusy(active) { $('routingBusy').classList.toggle('hidden',!active); }
  function setGpsStatus(text,live) { $('gpsStatus').innerHTML=`<span class="pulse-dot ${live?'live':''}"></span>${escapeHtml(text)}`; }
  function showToast(message) { const el=$('toast'); el.textContent=message; el.classList.add('show'); clearTimeout(showToast.t); showToast.t=setTimeout(()=>el.classList.remove('show'),2800); }

  function formatDistance(km) { return km<1?`${Math.round(km*1000)} m`:`${km.toFixed(km<10?1:0)} km`; }
  function formatDistanceMeters(m) { return m<1000?`${Math.max(1,Math.round(m/10)*10)} m`:`${(m/1000).toFixed(m<10000?1:0)} km`; }
  function formatDuration(sec) { const min=Math.max(1,Math.round(sec/60)); if(min<60)return `${min} min`; const h=Math.floor(min/60),r=min%60; return r?`${h} h ${r} min`:`${h} h`; }
  function formatEta(sec) { return new Intl.DateTimeFormat('es-CR',{hour:'numeric',minute:'2-digit'}).format(new Date(Date.now()+sec*1000)); }
  function to12h(v) { const [h,m]=v.split(':').map(Number); return `${((h+11)%12)+1}:${String(m).padStart(2,'0')} ${h>=12?'p. m.':'a. m.'}`; }

  function movedMeters(a,b) { if(!a||!b)return Infinity; return haversineMeters(a.lat,a.lng,b.lat,b.lng); }
  function haversineKm(lat1,lon1,lat2,lon2) { return haversineMeters(lat1,lon1,lat2,lon2)/1000; }
  function haversineMeters(lat1,lon1,lat2,lon2) {
    const R=6371000,toRad=x=>x*Math.PI/180;
    const dLat=toRad(lat2-lat1),dLon=toRad(lon2-lon1);
    const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(a));
  }
  function bearingBetween(lat1,lon1,lat2,lon2) {
    const r=x=>x*Math.PI/180,d=x=>x*180/Math.PI;
    const y=Math.sin(r(lon2-lon1))*Math.cos(r(lat2));
    const x=Math.cos(r(lat1))*Math.sin(r(lat2))-Math.sin(r(lat1))*Math.cos(r(lat2))*Math.cos(r(lon2-lon1));
    return (d(Math.atan2(y,x))+360)%360;
  }
  function escapeHtml(value='') { return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c])); }
})();
