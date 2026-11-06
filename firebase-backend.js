/* Conexión exclusiva de novedades y administración; no modifica mapas ni GPS. */
(function () {
  'use strict';
  const config = window.ROMERIA_FIREBASE_CONFIG || {};
  const enabled = !!config.apiKey && !config.apiKey.startsWith('REEMPLAZAR') &&
    !!config.projectId && !config.projectId.startsWith('REEMPLAZAR');
  if (!enabled || !window.firebase) {
    window.ROMERIA_BACKEND = { enabled:false };
    return;
  }
  if (!firebase.apps.length) firebase.initializeApp(config);
  const auth = firebase.auth();
  const db = firebase.firestore();
  let isAdmin = false;
  const toDisplay = d => ({
    id:d.id, category:d.category, title:d.title, summary:d.summary,
    stationId:d.stationId, institution:d.institution, time:d.time,
    state:d.state, publicHint:d.publicHint, createdAt:d.createdAt
  });
  window.ROMERIA_BACKEND = {
    enabled:true,
    watchReports(onData,onError) {
      return db.collection('reportes').where('published','==',true).limit(300)
        .onSnapshot(snapshot => {
          const items=snapshot.docs.map(doc => toDisplay({id:doc.id,...doc.data()}));
          items.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
          onData(items);
        },onError);
    },
    watchAuth(callback) {
      return auth.onAuthStateChanged(async user => {
        isAdmin=false;
        if(user) {
          try { isAdmin = (await db.collection('admins').doc(user.uid).get()).exists; }
          catch (e) { console.error('Validación administrador:',e); }
        }
        callback(isAdmin);
      });
    },
    async login(email,password) {
      if (!email || !password) throw new Error('Credenciales incompletas');
      const credential=await auth.signInWithEmailAndPassword(email,password);
      const administrator=(await db.collection('admins').doc(credential.user.uid).get()).exists;
      if(!administrator){await auth.signOut();throw new Error('Usuario no autorizado');}
      isAdmin=true;
    },
    async logout() { isAdmin=false; await auth.signOut(); },
    async publishReport(report,privateNote='') {
      if(!auth.currentUser || !isAdmin) throw new Error('No autorizado');
      const doc=db.collection('reportes').doc();
      const item={
        category:report.category, title:report.title.slice(0,120),
        summary:report.summary.slice(0,900), stationId:report.stationId,
        institution:report.institution, time:report.time, state:report.state.slice(0,100),
        publicHint:report.publicHint, published:true,
        createdBy:auth.currentUser.uid,
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      };
      const batch=db.batch();
      batch.set(doc,item);
      if(privateNote.trim())batch.set(db.collection('reportes_privados').doc(doc.id),{
        notes:privateNote.slice(0,2000), createdBy:auth.currentUser.uid,
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      });
      await batch.commit();
      return doc.id;
    }
  };
})();
