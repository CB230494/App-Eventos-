window.ROMERIA_DATA = {
  basilica: {
    id: 'basilica',
    name: 'Basílica de Nuestra Señora de los Ángeles',
    lat: 9.8641,
    lng: -83.91288,
    type: 'basilica',
    note: 'Punto central de la demostración.'
  },
  services: [
    { id:'fp-01', type:'police', name:'Puesto Fuerza Pública · Cartago Centro', lat:9.8631, lng:-83.9184, status:'Operativo', note:'Punto demostrativo de orientación y apoyo policial.' },
    { id:'fp-02', type:'police', name:'Puesto Fuerza Pública · Taras', lat:9.8872, lng:-83.9369, status:'Operativo', note:'Puesto demostrativo en corredor de ingreso.' },
    { id:'fp-03', type:'police', name:'Puesto Fuerza Pública · Tres Ríos', lat:9.9079, lng:-83.9876, status:'Operativo', note:'Punto demostrativo sobre ruta occidental.' },
    { id:'fp-04', type:'police', name:'Puesto Fuerza Pública · Paraíso', lat:9.8386, lng:-83.8644, status:'Operativo', note:'Punto demostrativo al este de Cartago.' },

    { id:'cr-01', type:'redcross', name:'Cruz Roja · Basílica', lat:9.8650, lng:-83.9105, status:'Atención', note:'Puesto médico demostrativo cercano al destino.' },
    { id:'cr-02', type:'redcross', name:'Cruz Roja · Cartago Centro', lat:9.8622, lng:-83.9254, status:'Atención', note:'Punto demostrativo para primeros auxilios.' },
    { id:'cr-03', type:'redcross', name:'Cruz Roja · Ochomogo', lat:9.8955, lng:-83.9474, status:'Atención', note:'Puesto demostrativo sobre corredor de ingreso.' },
    { id:'cr-04', type:'redcross', name:'Cruz Roja · Curridabat', lat:9.9148, lng:-84.0364, status:'Atención', note:'Punto demostrativo occidental.' },

    { id:'tr-01', type:'transit', name:'Tránsito · La Lima', lat:9.8708, lng:-83.9402, status:'Control vial', note:'Puesto demostrativo para regulación y orientación vial.' },
    { id:'tr-02', type:'transit', name:'Tránsito · Ochomogo', lat:9.8936, lng:-83.9578, status:'Control vial', note:'Punto demostrativo sobre carretera principal.' },
    { id:'tr-03', type:'transit', name:'Tránsito · Tres Ríos', lat:9.9053, lng:-83.9925, status:'Control vial', note:'Puesto demostrativo de tránsito.' },

    { id:'wc-01', type:'restroom', name:'Servicios sanitarios · Basílica Norte', lat:9.8662, lng:-83.9134, status:'Disponible', note:'Punto sanitario de demostración.' },
    { id:'wc-02', type:'restroom', name:'Servicios sanitarios · Cartago Centro', lat:9.8610, lng:-83.9204, status:'Disponible', note:'Punto sanitario de demostración.' },
    { id:'wc-03', type:'restroom', name:'Servicios sanitarios · Taras', lat:9.8811, lng:-83.9345, status:'Disponible', note:'Punto sanitario de demostración.' },
    { id:'wc-04', type:'restroom', name:'Servicios sanitarios · Ochomogo', lat:9.8978, lng:-83.9625, status:'Disponible', note:'Punto sanitario de demostración.' },
    { id:'wc-05', type:'restroom', name:'Servicios sanitarios · Tres Ríos', lat:9.9039, lng:-83.9890, status:'Disponible', note:'Punto sanitario de demostración.' }
  ],
  reports: [
    {
      id:'OBJ-2026-014',
      category:'object',
      title:'Bolso pequeño encontrado',
      summary:'Bolso oscuro con elementos personales. Se omiten características de verificación.',
      stationId:'fp-01',
      institution:'Fuerza Pública',
      time:'11:25 a. m.',
      state:'En custodia',
      publicHint:'Para reclamarlo se requerirá describir características que no se publican.'
    },
    {
      id:'PER-2026-006',
      category:'person',
      title:'Persona ubicada en puesto de apoyo',
      summary:'Persona adulta que manifestó haberse separado de su grupo familiar.',
      stationId:'cr-02',
      institution:'Cruz Roja',
      time:'12:40 p. m.',
      state:'En acompañamiento',
      publicHint:'Se mantiene en el punto indicado mientras se gestiona el contacto familiar.'
    },
    {
      id:'MED-2026-003',
      category:'medical',
      title:'Traslado médico registrado',
      summary:'Atención de demostración con traslado a centro médico. No se publican datos clínicos ni identidad.',
      stationId:'cr-01',
      institution:'Cruz Roja',
      time:'1:05 p. m.',
      state:'Traslado realizado',
      publicHint:'Destino de demostración: centro médico de Cartago.'
    }
  ]
};
