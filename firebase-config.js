
// ============================================================================
// firebase-config.js - Configuración mejorada de Firebase con Firestore (V16)
// ============================================================================

var db = null;
var catalogoCache = null;
var ultimaCargaCatalogo = 0;
var CACHE_TTL = 5 * 60 * 1000;
var presenciaCache = {};

var firebaseConfig = {
  apiKey: "AIzaSyCUWgGMzPxGu9aZTr5Hf-_YfiI-3MdiwLQ",
  authDomain: "ferreteria-oviedo.firebaseapp.com",
  projectId: "ferreteria-oviedo",
  storageBucket: "ferreteria-oviedo.firebasestorage.app",
  messagingSenderId: "869283555582",
  appId: "1:869283555582:web:6d5c64b33fd9cf6d861daf"
};

if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
} else if (typeof firebase !== 'undefined' && firebase.apps.length) {
  db = firebase.firestore();
}

function nowTs() {
  return firebase.firestore.FieldValue.serverTimestamp();
}

function cargarCatalogo(callback) {
  if (!db) return callback(new Error('Firebase no disponible'), null);
  const ahora = Date.now();
  if (catalogoCache && (ahora - ultimaCargaCatalogo) < CACHE_TTL) return callback(null, catalogoCache);
  db.collection('productos').get().then(snapshot => {
    const productos = [];
    snapshot.forEach(doc => productos.push(doc.data()));
    catalogoCache = { productos: productos, ultimaActualizacion: new Date().toISOString() };
    ultimaCargaCatalogo = ahora;
    callback(null, catalogoCache);
  }).catch(err => callback(err, null));
}

function guardarCotizacion(cotizacion, callback) {
  if (!db) return callback(new Error('Firebase no disponible'), null);
  db.collection('cotizaciones').add({
    ...cotizacion,
    ts: nowTs(),
    createdAt: new Date().toISOString()
  }).then(doc => callback(null, { id: doc.id })).catch(err => callback(err, null));
}

function normalizeUserRecord(data) {
  if (!data) return data;
  data.u = data.u || data.user || '';
  data.p = data.p || data.pass || '';
  data.nombre = data.nombre || data.name || '';
  data.role = data.role || 'cliente';
  data.estado = data.estado || 'activo';
  data.app = data.app || data.origen || 'cliente';
  return data;
}

function apiGet(params, cb) {
  if (!db) return cb(new Error('Firebase no disponible'), null);
  const { action } = params;
  if (action === 'getUsers') {
    db.collection('users').get().then(snap => {
      const users = [];
      snap.forEach(doc => users.push(normalizeUserRecord(doc.data())));
      cb(null, users);
    }).catch(err => cb(err, null));
  } else if (action === 'getSessions') {
    db.collection('sessions').where('ts', '>', new Date(Date.now() - 30 * 60000)).get().then(snap => {
      const sessions = [];
      snap.forEach(doc => sessions.push(doc.data()));
      cb(null, sessions);
    }).catch(err => cb(err, null));
  } else if (action === 'getConfigUrls') {
    db.collection('config').doc('urls').get().then(doc => cb(null, doc.exists ? doc.data() : null)).catch(err => cb(err, null));
  } else if (action === 'getSesionesActivas') {
    db.collection('sesiones_activas').get().then(snap => {
      const items = [];
      snap.forEach(doc => items.push(doc.data()));
      cb(null, items);
    }).catch(err => cb(err, null));
  }
}

function apiPost(body, cb) {
  if (!db) return cb(new Error('Firebase no disponible'), null);
  const { action, data } = body;
  if (action === 'saveUser') {
    db.collection('users').doc(data.u).set(data).then(() => cb(null, { success: true })).catch(err => cb(err, null));
  } else if (action === 'deleteUser') {
    db.collection('users').doc(body.u).delete().then(() => cb(null, { success: true })).catch(err => cb(err, null));
  } else if (action === 'logSession') {
    db.collection('sessions').add({ ...data, ts: nowTs() }).then(() => cb(null, { success: true })).catch(err => cb(err, null));
  } else if (action === 'savePromo') {
    db.collection('promos').add({ ...data, ts: nowTs() }).then(() => cb(null, { success: true })).catch(err => cb(err, null));
  } else if (action === 'deletePromo') {
    db.collection('promos').doc(body.id).delete().then(() => cb(null, { success: true })).catch(err => cb(err, null));
  } else if (action === 'guardarConfigUrls') {
    db.collection('config').doc('urls').set({ pub: data.pub || '', proxy: data.proxy || '', ts: nowTs() }).then(() => cb(null, { success: true })).catch(err => cb(err, null));
  } else if (action === 'promoverConexion') {
    db.collection('config').doc('broadcast').set({ msg: data.msg || 'Actualización detectada', ts: nowTs() }).then(() => cb(null, { success: true })).catch(err => cb(err, null));
  } else if (action === 'registrarSesionActiva') {
    db.collection('sesiones_activas').doc(data.uid).set({ ...data, ts: nowTs() }).then(() => cb(null, { success: true })).catch(err => cb(err, null));
  } else if (action === 'guardarNotificacion') {
    db.collection('notificaciones').add({ ...data, ts: nowTs() }).then(() => cb(null, { success: true })).catch(err => cb(err, null));
  }
}

function guardarURLWebhook(url, cb) {
  if (!db) return cb(new Error('Firebase no disponible'));
  db.collection('config').doc('webhook').set({ url: url, ts: nowTs() }).then(() => cb(null)).catch(err => cb(err));
}

function probarConexionFirebase(cb) {
  if (!db) return cb(new Error('Firebase no disponible'));
  db.collection('config').doc('test').set({ ping: Date.now() }).then(() => cb(null, { proyecto: firebaseConfig.projectId })).catch(err => cb(err));
}

function guardarConfigUrls(pub, proxy, cb) {
  apiPost({ action: 'guardarConfigUrls', data: { pub: pub, proxy: proxy } }, cb);
}

function promoverConexion(msg, cb) {
  apiPost({ action: 'promoverConexion', data: { msg: msg } }, cb);
}

function registrarSesionActiva(uid, nombre, app, dispositivo, cb) {
  apiPost({ action: 'registrarSesionActiva', data: { uid: uid, nombre: nombre, app: app, dispositivo: dispositivo } }, cb);
}

function guardarNotificacion(msg, cb) {
  apiPost({ action: 'guardarNotificacion', data: { msg: msg } }, cb);
}

function escucharConfigUrls(cb) {
  if (!db) return;
  db.collection('config').doc('urls').onSnapshot(doc => {
    cb(doc.exists ? doc.data() : null);
  });
}

function escucharBroadcast(cb) {
  if (!db) return;
  db.collection('config').doc('broadcast').onSnapshot(doc => {
    cb(doc.exists ? doc.data() : null);
  });
}

function escucharSesionesActivas(cb) {
  if (!db) return;
  db.collection('sesiones_activas').onSnapshot(snap => {
    const items = [];
    snap.forEach(doc => items.push(doc.data()));
    cb(items);
  });
}

function escucharNotificaciones(cb) {
  if (!db) return;
  db.collection('notificaciones').orderBy('ts', 'desc').limit(20).onSnapshot(snap => {
    const items = [];
    snap.forEach(doc => items.push(doc.data()));
    cb(items);
  });
}

function escucharMetricasDashboard(cb) {
  if (!db) return;
  Promise.all([
    db.collection('sesiones_activas').get(),
    db.collection('users').get(),
    db.collection('cotizaciones').get()
  ]).then(([sesSnap, userSnap, cotSnap]) => {
    const sesiones = [];
    sesSnap.forEach(doc => sesiones.push(doc.data()));
    const users = [];
    userSnap.forEach(doc => users.push(normalizeUserRecord(doc.data())));
    const cots = [];
    cotSnap.forEach(doc => cots.push(doc.data()));
    cb({ sesiones, users, cots });
  });
}

