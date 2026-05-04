// ============================================================
// firebase-config.js — Ferretería Oviedo V26
// ============================================================

var db = null;

var firebaseConfig = {
  apiKey:            "AIzaSyCUWgGMzPxGu9aZTr5Hf-_YfiI-3MdiwLQ",
  authDomain:        "ferreteria-oviedo.firebaseapp.com",
  projectId:         "ferreteria-oviedo",
  storageBucket:     "ferreteria-oviedo.firebasestorage.app",
  messagingSenderId: "869283555582",
  appId:             "1:869283555582:web:6d5c64b33fd9cf6d861daf"
};

if (typeof firebase !== 'undefined') {
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  window.db = db;
}

function nowTs() { return firebase.firestore.FieldValue.serverTimestamp(); }

// ── USUARIOS ─────────────────────────────────────────────────
function saveUser(userData, cb) {
  if (!db) { if(cb) cb(new Error('Firebase no disponible')); return; }
  var id = userData.u || userData.user || '';
  if (!id) { if(cb) cb(new Error('Sin ID')); return; }
  var doc = {
    u: id, user: id,
    p: userData.p || userData.pass || '',
    pass: userData.pass || userData.p || '',
    nombre: userData.nombre || '',
    role: userData.role || 'cliente',
    estado: userData.estado || 'activo',
    licExpiry: userData.licExpiry || new Date(userData.exp || Date.now()+30*864e5).toISOString(),
    exp: userData.exp || new Date(userData.licExpiry || Date.now()+30*864e5).getTime()
  };
  db.collection('users').doc(id).set(doc)
    .then(function(){ if(cb) cb(null,{success:true}); })
    .catch(function(e){ if(cb) cb(e); });
}

function deleteUser(uid, cb) {
  if (!db) { if(cb) cb(new Error('Firebase no disponible')); return; }
  db.collection('users').doc(uid).delete()
    .then(function(){ if(cb) cb(null,{success:true}); })
    .catch(function(e){ if(cb) cb(e); });
}

function loadUsersFirestore(cb) {
  if (!db) { cb(null,[]); return; }
  db.collection('users').get()
    .then(function(snap){ var r=[]; snap.forEach(function(d){ r.push(d.data()); }); cb(null,r); })
    .catch(function(e){ cb(e,[]); });
}

// ── COTIZACIONES ─────────────────────────────────────────────
function guardarCotizacion(cot, cb) {
  if (!db) { if(cb) cb(new Error('Firebase no disponible')); return; }
  db.collection('cotizaciones').add(Object.assign({}, cot, {ts: nowTs(), createdAt: new Date().toISOString()}))
    .then(function(ref){ if(cb) cb(null,{id:ref.id}); })
    .catch(function(e){ if(cb) cb(e); });
}

// ── SESIONES ACTIVAS ─────────────────────────────────────────
// FIX V26: agregado loginTs para que el admin detecte ingresos nuevos
function registrarPresencia(uid, nombre, app, dispositivo) {
  if (!db) return;
  db.collection('sesiones_activas').doc(uid).set({
    uid: uid,
    nombre: nombre,
    app: app,
    dispositivo: dispositivo || (navigator.userAgent.indexOf('Mobile')>=0 ? '📱 Móvil' : '💻 PC'),
    ts: nowTs(),
    loginTs: Date.now()
  }).catch(function(){});
}

function limpiarPresencia(uid) {
  if (!db) return;
  db.collection('sesiones_activas').doc(uid).delete().catch(function(){});
}

// ── PROMOCIONES ───────────────────────────────────────────────
function cargarPromos(cb) {
  if (!db) { cb(null,[]); return; }
  db.collection('promos').orderBy('ts','desc').get()
    .then(function(snap){ var r=[]; snap.forEach(function(d){ r.push(Object.assign({id:d.id},d.data())); }); cb(null,r); })
    .catch(function(){ cb(null,[]); });
}

function guardarPromoFirestore(promo, cb) {
  if (!db) { if(cb) cb(new Error('Firebase no disponible')); return; }
  db.collection('promos').add(Object.assign({},promo,{ts:nowTs()}))
    .then(function(){ if(cb) cb(null); }).catch(function(e){ if(cb) cb(e); });
}

function eliminarPromoFirestore(id, cb) {
  if (!db) { if(cb) cb(new Error('Firebase no disponible')); return; }
  db.collection('promos').doc(id).delete()
    .then(function(){ if(cb) cb(null); }).catch(function(e){ if(cb) cb(e); });
}

// ── CONFIG URLs ───────────────────────────────────────────────
function guardarConfigURLs(pub, proxy, cb) {
  if (!db) { if(cb) cb(new Error('Firebase no disponible')); return; }
  db.collection('config').doc('urls').set({pub:pub,proxy:proxy,ts:nowTs()})
    .then(function(){ if(cb) cb(null); }).catch(function(e){ if(cb) cb(e); });
}

function cargarConfigURLs(cb) {
  if (!db) { cb(null,null); return; }
  db.collection('config').doc('urls').get()
    .then(function(d){ cb(null,d.exists?d.data():null); })
    .catch(function(){ cb(null,null); });
}

// ── TEST ──────────────────────────────────────────────────────
function probarConexion(cb) {
  if (!db) { cb(new Error('Firebase no inicializado')); return; }
  db.collection('config').doc('ping').set({ts:nowTs()})
    .then(function(){ cb(null,{ok:true,proyecto:firebaseConfig.projectId}); })
    .catch(function(e){ cb(e); });
}

// ── API UNIFICADA ─────────────────────────────────────────────
function apiGet(params, cb) {
  if (!db) { cb(new Error('Firebase no disponible'),null); return; }
  var action = params.action;
  if (action === 'getUsers') {
    loadUsersFirestore(cb);
  } else if (action === 'getSessions') {
    db.collection('sesiones_activas').get()
      .then(function(snap){ var r=[]; snap.forEach(function(d){ r.push(d.data()); }); cb(null,r); })
      .catch(function(e){ cb(e,null); });
  } else if (action === 'getCotizaciones') {
    db.collection('cotizaciones').orderBy('ts','desc').limit(parseInt(params.limit)||100).get()
      .then(function(snap){ var r=[]; snap.forEach(function(d){ r.push(d.data()); }); cb(null,r); })
      .catch(function(e){ cb(e,null); });
  } else {
    cb(null,[]);
  }
}

function apiPost(body, cb) {
  if (!db) { cb(new Error('Firebase no disponible'),null); return; }
  var action = body.action, data = body.data;
  if (action === 'saveUser') {
    saveUser(data, function(e){ cb(e, e?null:{success:true}); });
  } else if (action === 'deleteUser') {
    deleteUser(body.u||(data&&(data.u||data.user))||'', function(e){ cb(e, e?null:{success:true}); });
  } else if (action === 'saveCotizacion') {
    guardarCotizacion(data, function(e,r){ cb(e,r); });
  } else if (action === 'logSession') {
    var uid = (data.user||data.nombre||'?').replace(/\s+/g,'_')+'_'+(data.app||'App');
    registrarPresencia(uid, data.user||data.nombre||'?', data.app||'App', data.device||'');
    cb(null,{success:true});
  } else {
    cb(null,{success:true});
  }
}
