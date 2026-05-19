// ============================================================
// firebase-config.js — Ferretería Oviedo V28
// Bloques A, F, G implementados
// ============================================================

var db   = null;
var auth = null;   // Firebase Auth — Bloque C/D/E

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
  db   = firebase.firestore();
  // Auth solo disponible si se cargó firebase-auth-compat.js
  if (typeof firebase.auth === 'function') {
    auth = firebase.auth();
  }
  window.db   = db;
  window.auth = auth;
}

function nowTs() { return firebase.firestore.FieldValue.serverTimestamp(); }

// ══════════════════════════════════════════════════════════════
// BLOQUE F — Funciones de identificación de dispositivo
// Compartidas entre Panel Cliente, Vendedor y Admin
// ══════════════════════════════════════════════════════════════

function generateDeviceId() {
  var raw = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset()
  ].join('|');
  var hash = 0;
  for (var i = 0; i < raw.length; i++) {
    var char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function detectarDispositivo() {
  var ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua))                                        return '📟 Tablet';
  if (/mobile|iphone|ipod|android|blackberry|opera mini|windows phone/i.test(ua))  return '📱 Móvil';
  return '💻 PC';
}

// ── Generar deviceId persistente por navegador (compatible con código anterior) ─
function getDeviceId() {
  var key = 'ov_device_id';
  var id  = localStorage.getItem(key);
  if (!id) {
    id = 'dv_' + generateDeviceId() + '_' + Date.now().toString(36);
    localStorage.setItem(key, id);
  }
  return id;
}

// ══════════════════════════════════════════════════════════════
// BLOQUE A — Esquema de usuario unificado
// saveUserCompleto: guarda campos legacy + nuevos sin borrar existentes
// ══════════════════════════════════════════════════════════════

function saveUser(userData, cb) {
  if (!db) { if(cb) cb(new Error('Firebase no disponible')); return; }
  var id = userData.uid || userData.u || userData.user || '';
  if (!id) { if(cb) cb(new Error('Sin ID')); return; }
  // Campos legacy (siempre presentes para compatibilidad)
  var doc = {
    u:         userData.u    || userData.user  || id,
    user:      userData.user || userData.u     || id,
    p:         userData.p    || userData.pass  || '',
    pass:      userData.pass || userData.p     || '',
    nombre:    userData.nombre    || userData.nombreCompleto || '',
    role:      userData.role      || 'cliente',
    estado:    userData.estado    || 'activo',
    licExpiry: userData.licExpiry || new Date(userData.exp || Date.now()+30*864e5).toISOString(),
    exp:       userData.exp || new Date(userData.licExpiry || Date.now()+30*864e5).getTime()
  };
  // Campos nuevos (Bloque A) — solo se agregan si vienen en userData
  if (userData.uid)             doc.uid             = userData.uid;
  if (userData.email)           doc.email           = userData.email;
  if (userData.nombreCompleto)  doc.nombreCompleto  = userData.nombreCompleto;
  if (userData.rut)             doc.rut             = userData.rut;
  if (userData.creadoPor)       doc.creadoPor       = userData.creadoPor;
  if (userData.registroAprobado !== undefined) doc.registroAprobado = userData.registroAprobado;
  if (!doc.fechaRegistro)       doc.fechaRegistro   = userData.fechaRegistro || nowTs();

  db.collection('users').doc(id).set(doc, { merge: true })
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
    .then(function(snap){ var r=[]; snap.forEach(function(d){ r.push(Object.assign({id:d.id},d.data())); }); cb(null,r); })
    .catch(function(e){ cb(e,[]); });
}

// ── Aprobar usuario pendiente (Bloque E) ──────────────────────────────────────
function aprobarUsuario(uid, cb) {
  if (!db) { if(cb) cb(new Error('Firebase no disponible')); return; }
  db.collection('users').doc(uid).update({
    estado: 'activo',
    registroAprobado: true,
    fechaAprobacion: nowTs()
  })
  .then(function(){ if(cb) cb(null,{success:true}); })
  .catch(function(e){ if(cb) cb(e); });
}

// ── Bloquear / activar usuario ────────────────────────────────────────────────
function toggleEstadoUsuario(uid, nuevoEstado, cb) {
  if (!db) { if(cb) cb(new Error('Firebase no disponible')); return; }
  db.collection('users').doc(uid).update({ estado: nuevoEstado })
    .then(function(){ if(cb) cb(null,{success:true}); })
    .catch(function(e){ if(cb) cb(e); });
}

// ══════════════════════════════════════════════════════════════
// BLOQUE B — config/registroControl
// ══════════════════════════════════════════════════════════════

var _configRegistroUnsubscribe = null;

// Lee una vez y llama al callback con el objeto de configuración
function leerConfigRegistro(cb) {
  if (!db) { cb(null, _configRegistroDefault()); return; }
  db.collection('config').doc('registroControl').get()
    .then(function(doc) {
      cb(null, doc.exists ? doc.data() : _configRegistroDefault());
    })
    .catch(function() { cb(null, _configRegistroDefault()); });
}

// Escucha cambios en tiempo real (para que el panel cliente/vendedor reaccione)
function escucharConfigRegistro(onCambio) {
  if (!db) { onCambio(_configRegistroDefault()); return function(){}; }
  if (_configRegistroUnsubscribe) _configRegistroUnsubscribe();
  _configRegistroUnsubscribe = db.collection('config').doc('registroControl')
    .onSnapshot(function(doc) {
      onCambio(doc.exists ? doc.data() : _configRegistroDefault());
    }, function() { onCambio(_configRegistroDefault()); });
  return _configRegistroUnsubscribe;
}

function _configRegistroDefault() {
  return {
    registroClienteHabilitado:  false,
    registroVendedorHabilitado: false,
    requiereAprobacionAdmin:    true
  };
}

// Guardar configuración de registro (solo admin)
function guardarConfigRegistro(cfg, adminUid, cb) {
  if (!db) { if(cb) cb(new Error('Firebase no disponible')); return; }
  db.collection('config').doc('registroControl').set(Object.assign({}, cfg, {
    ultimaModificacion: nowTs(),
    modificadoPor: adminUid || 'admin'
  }), { merge: true })
  .then(function(){ if(cb) cb(null); })
  .catch(function(e){ if(cb) cb(e); });
}

// ══════════════════════════════════════════════════════════════
// BLOQUE G — sesionesLog con datos enriquecidos (email, rut, nombreCompleto)
// ══════════════════════════════════════════════════════════════

function registrarSesionLog(uid, nombre, app, deviceId, cb) {
  if (!db) { if(cb) cb(null,{esNuevo:false}); return; }
  var docId  = uid + '_' + (deviceId || generateDeviceId());
  var docRef = db.collection('sesionesLog').doc(docId);
  docRef.get().then(function(snap) {
    var esNuevo = !snap.exists;
    var payload = {
      uid:          uid,
      nombre:       nombre,
      app:          app,
      deviceId:     deviceId || generateDeviceId(),
      dispositivo:  detectarDispositivo(),
      ultimoAcceso: nowTs(),
      activo:       true,
      leido:        esNuevo ? false : (snap.data().leido || false)
    };
    if (esNuevo) payload.creadoEn = nowTs();
    docRef.set(payload, { merge: true })
      .then(function(){ if(cb) cb(null,{esNuevo:esNuevo}); })
      .catch(function(){ if(cb) cb(null,{esNuevo:false}); });
  }).catch(function(){ if(cb) cb(null,{esNuevo:false}); });
}

// Versión enriquecida — recibe todos los datos del usuario (Bloque G completo)
function registrarSesionLogCompleto(params, cb) {
  if (!db) { if(cb) cb(null,{esNuevo:false}); return; }
  var uid      = params.uid      || params.nombre.replace(/\s+/g,'_');
  var deviceId = params.deviceId || generateDeviceId();
  var docId    = uid + '_' + deviceId;
  var docRef   = db.collection('sesionesLog').doc(docId);
  docRef.get().then(function(snap) {
    var esNuevo = !snap.exists;
    var payload = {
      uid:           uid,
      deviceId:      deviceId,
      email:         params.email         || '',
      nombreCompleto:params.nombreCompleto|| params.nombre || '',
      rut:           params.rut           || '',
      role:          params.role          || 'cliente',
      panelTipo:     params.panelTipo     || params.role  || 'cliente',
      dispositivo:   detectarDispositivo(),
      userAgent:     (navigator.userAgent||'').substring(0,100),
      ultimoAcceso:  nowTs(),
      activo:        true,
      leido:         esNuevo ? false : (snap.data().leido || false)
    };
    if (esNuevo) {
      payload.timestamp  = nowTs();
      payload.creadoEn   = nowTs();
    }
    docRef.set(payload, { merge: true })
      .then(function(){ if(cb) cb(null,{esNuevo:esNuevo}); })
      .catch(function(){ if(cb) cb(null,{esNuevo:false}); });
  }).catch(function(){ if(cb) cb(null,{esNuevo:false}); });
}

function limpiarSesionLog(uid, deviceId, cb) {
  if (!db) { if(cb) cb(null); return; }
  var docId = uid + '_' + (deviceId || '');
  db.collection('sesionesLog').doc(docId).delete()
    .then(function(){ if(cb) cb(null); })
    .catch(function(){ if(cb) cb(null); });
}

// ══════════════════════════════════════════════════════════════
// BLOQUE C/D — Validaciones de formulario de registro
// ══════════════════════════════════════════════════════════════

// Valida RUT chileno formato XX.XXX.XXX-X con dígito verificador
function validarRUT(rut) {
  if (!rut) return false;
  var r = rut.replace(/\./g,'').replace(/-/g,'').toUpperCase();
  if (r.length < 2) return false;
  var cuerpo = r.slice(0,-1);
  var dv     = r.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return false;
  var suma = 0, multiplo = 2;
  for (var i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo.charAt(i)) * multiplo;
    multiplo = multiplo < 7 ? multiplo + 1 : 2;
  }
  var dvCalc = 11 - (suma % 11);
  var dvEsp  = dvCalc === 11 ? '0' : dvCalc === 10 ? 'K' : String(dvCalc);
  return dv === dvEsp;
}

// Formatea RUT: 12345678 → 12.345.678  (sin DV)
function formatearRUT(rut) {
  var r = rut.replace(/\./g,'').replace(/-/g,'');
  if (r.length < 2) return rut;
  var cuerpo = r.slice(0,-1);
  var dv     = r.slice(-1);
  return cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g,'.') + '-' + dv;
}

// Verifica que un email no esté ya registrado en Firestore
// cb(esLibre) → true = libre, false = ya existe
function verificarEmailLibre(email, cb) {
  if (!db) { cb(true); return; }
  db.collection('users').where('email','==', email.toLowerCase()).get()
    .then(function(snap){ cb(snap.empty); })
    .catch(function(){ cb(true); }); // ante error, dejar continuar
}

// Verifica que un RUT no esté ya en Firestore
// cb(esLibre) → true = libre, false = ya existe
function verificarRUTLibre(rut, cb) {
  if (!db) { cb(true); return; }
  // Normalizar igual que al guardar (formatearRUT: 12.345.678-9)
  var rutNorm = formatearRUT(rut);
  db.collection('users').where('rut','==', rutNorm).get()
    .then(function(snap){ cb(snap.empty); })
    .catch(function(){ cb(true); }); // ante error, dejar continuar
}

// ── SESIONES ACTIVAS ─────────────────────────────────────────
// V28: incluye email, nombreCompleto, rut cuando están disponibles
function registrarPresencia(uid, nombre, app, dispositivo, datosExtra) {
  if (!db) return;
  var payload = {
    uid:        uid,
    nombre:     nombre,
    app:        app,
    dispositivo:dispositivo || detectarDispositivo(),
    ts:         nowTs(),
    loginTs:    Date.now(),
    activo:     true
  };
  if (datosExtra) {
    if (datosExtra.email)          payload.email          = datosExtra.email;
    if (datosExtra.nombreCompleto) payload.nombreCompleto = datosExtra.nombreCompleto;
    if (datosExtra.rut)            payload.rut            = datosExtra.rut;
  }
  db.collection('sesiones_activas').doc(uid).set(payload).catch(function(){});
}

function limpiarPresencia(uid) {
  if (!db) return;
  db.collection('sesiones_activas').doc(uid).delete().catch(function(){});
}

// ── CIERRE REMOTO DE SESIÓN (Bloque 3) ───────────────────────
function cerrarSesionRemota(uid, cb) {
  if (!db) { if(cb) cb(new Error('Firebase no disponible')); return; }
  db.collection('sesiones_activas').doc(uid).update({ activo: false })
    .then(function(){ if(cb) cb(null,{success:true}); })
    .catch(function(e){ if(cb) cb(e); });
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

// ── CORRELATIVO DE COTIZACIONES ───────────────────────────────
function obtenerSiguienteCorrelativo(cb) {
  if (!db) { cb(null, 1); return; }
  var ref = db.collection('config').doc('correlativo');
  db.runTransaction(function(tx) {
    return tx.get(ref).then(function(doc) {
      var siguiente = doc.exists ? (doc.data().ultimo || 0) + 1 : 1;
      tx.set(ref, { ultimo: siguiente }, { merge: true });
      return siguiente;
    });
  })
  .then(function(n) { cb(null, n); })
  .catch(function() { cb(null, Date.now() % 10000 + 1); });
}

function resetearCorrelativo(desde, cb) {
  if (!db) { if(cb) cb(new Error('Firebase no disponible')); return; }
  var val = (desde && desde > 0) ? (desde - 1) : 0;
  db.collection('config').doc('correlativo').set({ ultimo: val })
    .then(function() { if(cb) cb(null); })
    .catch(function(e) { if(cb) cb(e); });
}

function fmtNroCotiz(n) {
  var s = String(n);
  return s.length < 2 ? '0' + s : s;
}

// ── CONFIG SOLICITUDES CLIENTES ───────────────────────────────
function guardarConfigSolicitudesCliente(habilitado, cb) {
  if (!db) { if(cb) cb(new Error('Firebase no disponible')); return; }
  db.collection('config').doc('cupones').set({ solicitudesHabilitadas: habilitado }, { merge: true })
    .then(function() { if(cb) cb(null); })
    .catch(function(e) { if(cb) cb(e); });
}

function leerConfigSolicitudesCliente(cb) {
  if (!db) { cb(null, true); return; }
  db.collection('config').doc('cupones').get()
    .then(function(doc) {
      var val = doc.exists ? doc.data().solicitudesHabilitadas : true;
      cb(null, val !== false);
    })
    .catch(function() { cb(null, true); });
}

// ── COTIZACIONES ─────────────────────────────────────────────
function guardarCotizacion(cot, cb) {
  if (!db) { if(cb) cb(new Error('Firebase no disponible')); return; }
  db.collection('cotizaciones').add(Object.assign({}, cot, {ts: nowTs(), createdAt: new Date().toISOString()}))
    .then(function(ref){ if(cb) cb(null,{id:ref.id}); })
    .catch(function(e){ if(cb) cb(e); });
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

// VERSIÓN: 2026-05-07 | BLOQUES: A, B, F, G | COMPATIBILIDAD: usuarios legacy OK
