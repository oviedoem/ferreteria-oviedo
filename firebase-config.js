// firebase-config-V16.js
var db = null;
var catalogoCache = null;
var ultimaCargaCatalogo = 0;
var CACHE_TTL = 5 * 60 * 1000;

var firebaseConfig = {
  apiKey: "AIzaSyCUWgGMzPxGu9aZTr5Hf-_YfiI-3MdiwLQ",
  authDomain: "ferreteria-oviedo.firebaseapp.com",
  projectId: "ferreteria-oviedo",
  storageBucket: "ferreteria-oviedo.firebasestorage.app",
  messagingSenderId: "869283555582",
  appId: "1:869283555582:web:6d5c64b33fd9cf6d861daf"
};

(function(){
  if (typeof firebase === 'undefined') return;
  if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  window.db = db;
})();

function nowTs(){ return firebase.firestore.FieldValue.serverTimestamp(); }
function normalizeUserRecord(data) { if (!data) return data; data.u = data.u || data.user || ''; data.p = data.p || data.pass || ''; data.nombre = data.nombre || data.name || ''; data.role = data.role || 'cliente'; data.estado = data.estado || 'activo'; data.app = data.app || data.origen || 'cliente'; return data; }
function cargarCatalogo(callback) { if (!db) return callback(new Error('Firebase no disponible'), null); const ahora = Date.now(); if (catalogoCache && (ahora - ultimaCargaCatalogo) < CACHE_TTL) return callback(null, catalogoCache); db.collection('productos').get().then(snapshot => { const productos = []; snapshot.forEach(doc => productos.push(doc.data())); catalogoCache = { productos, ultimaActualizacion: new Date().toISOString() }; ultimaCargaCatalogo = ahora; callback(null, catalogoCache); }).catch(err => callback(err, null)); }
function guardarCotizacion(cotizacion, callback) { if (!db) return callback(new Error('Firebase no disponible'), null); db.collection('cotizaciones').add({ ...cotizacion, ts: nowTs(), createdAt: new Date().toISOString() }).then(doc => callback(null, { id: doc.id })).catch(err => callback(err, null)); }
function obtenerUsuarioFirebase(usuario, cb) { if (!db) return cb(new Error('Firebase no disponible'), null); db.collection('users').where('u', '==', usuario).limit(1).get().then(snap => { if (snap.empty) return cb(null, null); cb(null, normalizeUserRecord(snap.docs[0].data())); }).catch(err => cb(err, null)); }
function validarCredencialesFirebase(usuario, clave, rol, cb) { obtenerUsuarioFirebase(usuario, function(err, user) { if (err) return cb(err, null); if (!user) return cb(null, { ok: false, reason: 'usuario_no_existe' }); if ((user.p || '') !== clave) return cb(null, { ok: false, reason: 'clave_incorrecta' }); if (rol && (user.role || '').toLowerCase() !== rol.toLowerCase()) return cb(null, { ok: false, reason: 'rol_incorrecto' }); cb(null, { ok: true, user }); }); }
function apiGet(params, cb) { if (!db) return cb(new Error('Firebase no disponible'), null); const action = params && params.action; if (action === 'getUsers') { db.collection('users').get().then(snap => { const users = []; snap.forEach(doc => users.push(normalizeUserRecord(doc.data()))); cb(null, users); }).catch(err => cb(err, null)); } else if (action === 'getSessions') { db.collection('sessions').where('ts', '>', new Date(Date.now() - 30 * 60000)).get().then(snap => { const sessions = []; snap.forEach(doc => sessions.push(doc.data())); cb(null, sessions); }).catch(err => cb(err, null)); } else if (action === 'getConfigUrls') { db.collection('config').doc('urls').get().then(doc => cb(null, doc.exists ? doc.data() : null)).catch(err => cb(err, null)); } else if (action === 'getSesionesActivas') { db.collection('sesiones_activas').get().then(snap => { const items = []; snap.forEach(doc => items.push(doc.data())); cb(null, items); }).catch(err => cb(err, null)); } else if (action === 'getCotizaciones') { var limitN = parseInt(params.limit || 50, 10); db.collection('cotizaciones').orderBy('ts', 'desc').limit(limitN).get().then(snap => { const items = []; snap.forEach(doc => items.push(doc.data())); cb(null, items); }).catch(err => cb(err, null)); } else if (action === 'getProductos') { db.collection('productos').get().then(snap => { const items = []; snap.forEach(doc => items.push(doc.data())); cb(null, items); }).catch(err => cb(err, null)); } else { cb(new Error('Acción no soportada'), null); } }
function apiPost(body, cb) { if (!db) return cb(new Error('Firebase no disponible'), null); const action = body && body.action; const data = body && body.data ? body.data : {}; if (action === 'saveUser') { db.collection('users').doc(data.u).set(data).then(() => cb(null, { success: true })).catch(err => cb(err, null)); } else if (action === 'deleteUser') { db.collection('users').doc(body.u).delete().then(() => cb(null, { success: true })).catch(err => cb(err, null)); } else if (action === 'logSession') { db.collection('sessions').add({ ...data, ts: nowTs() }).then(() => cb(null, { success: true })).catch(err => cb(err, null)); } else if (action === 'savePromo') { db.collection('promos').add({ ...data, ts: nowTs() }).then(() => cb(null, { success: true })).catch(err => cb(err, null)); } else if (action === 'deletePromo') { db.collection('promos').doc(body.id).delete().then(() => cb(null, { success: true })).catch(err => cb(err, null)); } else if (action === 'guardarConfigUrls') { db.collection('config').doc('urls').set({ pub: data.pub || '', proxy: data.proxy || '', ts: nowTs() }).then(() => cb(null, { success: true })).catch(err => cb(err, null)); } else if (action === 'promoverConexion') { db.collection('config').doc('broadcast').set({ msg: data.msg || 'Actualización detectada', ts: nowTs() }).then(() => cb(null, { success: true })).catch(err => cb(err, null)); } else if (action === 'registrarSesionActiva') { db.collection('sesiones_activas').doc(data.uid).set({ ...data, ts: nowTs() }).then(() => cb(null, { success: true })).catch(err => cb(err, null)); } else if (action === 'guardarNotificacion') { db.collection('notificaciones').add({ ...data, ts: nowTs() }).then(() => cb(null, { success: true })).catch(err => cb(err, null)); } else if (action === 'saveCotizacion') { db.collection('cotizaciones').add({ ...data, ts: nowTs() }).then(() => cb(null, { success: true })).catch(err => cb(err, null)); } else { cb(new Error('Acción no soportada'), null); } }
function guardarConfigUrls(pub, proxy, cb) { apiPost({ action: 'guardarConfigUrls', data: { pub, proxy } }, cb); }
function promoverConexion(msg, cb) { apiPost({ action: 'promoverConexion', data: { msg } }, cb); }
function registrarSesionActiva(uid, nombre, app, dispositivo, cb) { apiPost({ action: 'registrarSesionActiva', data: { uid, nombre, app, dispositivo } }, cb); }
function guardarNotificacion(msg, cb) { apiPost({ action: 'guardarNotificacion', data: { msg } }, cb); }
function escucharConfigUrls(cb) { if (db) db.collection('config').doc('urls').onSnapshot(doc => cb(doc.exists ? doc.data() : null)); }
function escucharBroadcast(cb) { if (db) db.collection('config').doc('broadcast').onSnapshot(doc => cb(doc.exists ? doc.data() : null)); }
function escucharSesionesActivas(cb) { if (db) db.collection('sesiones_activas').onSnapshot(snap => { const items=[]; snap.forEach(doc => items.push(doc.data())); cb(items); }); }
function escucharNotificaciones(cb) { if (db) db.collection('notificaciones').orderBy('ts', 'desc').limit(20).onSnapshot(snap => { const items=[]; snap.forEach(doc => items.push(doc.data())); cb(items); }); }
function escucharMetricasDashboard(cb) { if (!db) return; Promise.all([db.collection('sesiones_activas').get(), db.collection('users').get(), db.collection('cotizaciones').get()]).then(([sesSnap, userSnap, cotSnap]) => { const sesiones=[]; sesSnap.forEach(doc => sesiones.push(doc.data())); const users=[]; userSnap.forEach(doc => users.push(normalizeUserRecord(doc.data()))); const cots=[]; cotSnap.forEach(doc => cots.push(doc.data())); cb({ sesiones, users, cots }); }); }
function apiGetFirebase(params, cb) { return apiGet(params, cb); }
function apiPostFirebase(body, cb) { return apiPost(body, cb); }
