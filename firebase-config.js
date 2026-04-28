// ============================================================================
// firebase-config.js - Configuración mejorada de Firebase con Firestore (V16)
// ============================================================================
// Este archivo inicializa Firebase y proporciona funciones para sincronizar
// el catálogo de productos desde Firestore, así como la gestión de usuarios,
// sesiones, cotizaciones y configuración del negocio.
// ============================================================================

var db = null;
var catalogoCache = null;
var ultimaCargaCatalogo = 0;
var CACHE_TTL = 5 * 60 * 1000; // 5 minutos en milisegundos

var firebaseConfig = {
  apiKey: "AIzaSyCUWgGMzPxGu9aZTr5Hf-_YfiI-3MdiwLQ",
  authDomain: "ferreteria-oviedo.firebaseapp.com",
  projectId: "ferreteria-oviedo",
  storageBucket: "ferreteria-oviedo.firebasestorage.app",
  messagingSenderId: "869283555582",
  appId: "1:869283555582:web:6d5c64b33fd9cf6d861daf"
};

// Inicializar Firebase (solo si está disponible y no ha sido inicializado)
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  console.log('[Firebase] Inicializado correctamente. Proyecto:', firebaseConfig.projectId);
} else if (typeof firebase !== 'undefined' && firebase.apps.length) {
  db = firebase.firestore();
  console.log('[Firebase] Ya inicializado. Usando instancia existente.');
} else {
  console.error('[Firebase] SDK de Firebase no cargado.');
}

// ============================================================================
// FUNCIONES DE CATÁLOGO - Sincronización con Firestore
// ============================================================================

function cargarCatalogo(callback) {
  if (!db) return callback(new Error('Firebase no disponible'), null);
  const ahora = Date.now();
  if (catalogoCache && (ahora - ultimaCargaCatalogo) < CACHE_TTL) return callback(null, catalogoCache);

  db.collection('productos').get()
    .then(snapshot => {
      const productos = [];
      snapshot.forEach(doc => productos.push(doc.data()));
      catalogoCache = { productos: productos, ultimaActualizacion: new Date().toISOString() };
      ultimaCargaCatalogo = ahora;
      callback(null, catalogoCache);
    })
    .catch(err => callback(err, null));
}

function guardarCotizacion(cotizacion, callback) {
  if (!db) return callback(new Error('Firebase no disponible'), null);
  db.collection('cotizaciones').add({
    ...cotizacion,
    ts: firebase.firestore.FieldValue.serverTimestamp(),
    createdAt: new Date().toISOString()
  }).then(doc => callback(null, { id: doc.id })).catch(err => callback(err, null));
}

// ============================================================================
// FUNCIONES DE USUARIOS Y SESIONES
// ============================================================================

function normalizeUserRecord(data) {
  if (!data) return data;
  data.u = data.u || data.user || '';
  data.p = data.p || data.pass || '';
  data.nombre = data.nombre || data.name || '';
  data.role = data.role || 'cliente';
  data.estado = data.estado || 'activo';
  return data;
}

function apiGet(params, cb) {
  if (!db) return cb(new Error('Firebase no disponible'), null);
  const { action } = params;
  if (action === 'getUsers') {
    db.collection('users').get().then(snap => {
      const users = []; snap.forEach(doc => users.push(normalizeUserRecord(doc.data())));
      cb(null, users);
    }).catch(err => cb(err, null));
  } else if (action === 'getSessions') {
    db.collection('sessions').where('ts', '>', new Date(Date.now() - 30 * 60000)).get().then(snap => {
      const sessions = []; snap.forEach(doc => sessions.push(doc.data()));
      cb(null, sessions);
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
    db.collection('sessions').add({ ...data, ts: firebase.firestore.FieldValue.serverTimestamp() }).then(() => cb(null, { success: true })).catch(err => cb(err, null));
  } else if (action === 'savePromo') {
    db.collection('promos').add({ ...data, ts: firebase.firestore.FieldValue.serverTimestamp() }).then(() => cb(null, { success: true })).catch(err => cb(err, null));
  } else if (action === 'deletePromo') {
    db.collection('promos').doc(body.id).delete().then(() => cb(null, { success: true })).catch(err => cb(err, null));
  }
}

// ============================================================================
// HERRAMIENTAS DE CONFIGURACIÓN
// ============================================================================

function guardarURLWebhook(url, cb) {
  if (!db) return cb(new Error('Firebase no disponible'));
  db.collection('config').doc('webhook').set({ url: url, ts: firebase.firestore.FieldValue.serverTimestamp() })
    .then(() => cb(null)).catch(err => cb(err));
}

function probarConexionFirebase(cb) {
  if (!db) return cb(new Error('Firebase no disponible'));
  db.collection('config').doc('test').set({ ping: Date.now() })
    .then(() => cb(null, { proyecto: firebaseConfig.projectId }))
    .catch(err => cb(err));
}
