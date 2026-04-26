// Configuración Firebase - Proyecto Ferretería Oviedo
// Reemplaza estos valores con tu propia configuración desde Firebase Console.
var db = null;
var firebaseConfig = {
  apiKey: "AIzaSyCUWgGMzPxGu9aZTr5Hf-_YfiI-3MdiwLQ",
  authDomain: "ferreteria-oviedo.firebaseapp.com",
  projectId: "ferreteria-oviedo",
  storageBucket: "ferreteria-oviedo.firebasestorage.app",
  messagingSenderId: "869283555582",
  appId: "1:869283555582:web:6d5c64b33fd9cf6d861daf"
};

if (typeof window.FIREBASE_CONFIG === 'object') {
  Object.assign(firebaseConfig, window.FIREBASE_CONFIG);
}

// Inicializar Firebase (solo si está disponible)
if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
}

function normalizeUserRecord(data) {
  if (!data) return data;
  data.u = data.u || data.user || '';
  data.user = data.user || data.u || '';
  data.p = data.p || data.pass || '';
  data.pass = data.pass || data.p || '';
  data.nombre = data.nombre || data.name || '';
  data.role = data.role || 'cliente';
  data.estado = data.estado || 'activo';
  if (data.exp && !data.licExpiry) data.licExpiry = new Date(data.exp).toISOString();
  if (data.licExpiry && !data.exp) data.exp = new Date(data.licExpiry).getTime();
  if (!data.licExpiry) data.licExpiry = new Date(Date.now()+30*864e5).toISOString();
  if (!data.exp) data.exp = new Date(data.licExpiry).getTime();
  return data;
}

// Funciones API alternativas usando Firebase
function apiGetFirebase(params, cb) {
  if (!db) return cb(new Error('Firebase no disponible'), null);

  const { action } = params;
  switch (action) {
    case 'getUsers':
      db.collection('users').get()
        .then(snapshot => {
          const users = [];
          snapshot.forEach(doc => users.push(doc.data()));
          cb(null, users);
        })
        .catch(err => cb(err, null));
      break;
    case 'getSessions':
      db.collection('sessions')
        .where('ts', '>', Date.now() - 30*60*1000)
        .get()
        .then(snapshot => {
          const sessions = [];
          snapshot.forEach(doc => sessions.push(doc.data()));
          cb(null, sessions);
        })
        .catch(err => cb(err, null));
      break;
    case 'getCotizaciones':
      db.collection('cotizaciones')
        .orderBy('ts', 'desc')
        .limit(parseInt(params.limit) || 50)
        .get()
        .then(snapshot => {
          const cotizaciones = [];
          snapshot.forEach(doc => cotizaciones.push(doc.data()));
          cb(null, cotizaciones);
        })
        .catch(err => cb(err, null));
      break;
    default:
      cb(new Error('Acción no soportada'), null);
  }
}

function apiPostFirebase(body, cb) {
  if (!db) return cb(new Error('Firebase no disponible'), null);

  const { action, data } = body;
  switch (action) {
    case 'saveUser':
      normalizeUserRecord(data);
      db.collection('users').doc(data.u).set(data)
        .then(() => cb(null, { success: true }))
        .catch(err => cb(err, null));
      break;
    case 'deleteUser':
      db.collection('users').doc(body.u || body.user).delete()
        .then(() => cb(null, { success: true }))
        .catch(err => cb(err, null));
      break;
    case 'logSession':
      db.collection('sessions').add(data)
        .then(() => cb(null, { success: true }))
        .catch(err => cb(err, null));
      break;
    case 'clearSession':
      // Para simplificar, no implementamos borrado de sesiones en Firebase
      cb(null, { success: true });
      break;
    case 'saveCotizacion':
      db.collection('cotizaciones').add(data)
        .then(() => cb(null, { success: true }))
        .catch(err => cb(err, null));
      break;
    default:
      cb(new Error('Acción no soportada'), null);
  }
}

// Función para alternar entre Google Apps Script y Firebase
function apiGet(params, cb) {
  // Intentar Firebase primero, fallback a Google Apps Script
  if (db) {
    apiGetFirebase(params, cb);
  } else {
    // Fallback al código original
    var url = API_URL + '?' + Object.keys(params).map(function(k){
      return encodeURIComponent(k)+'='+encodeURIComponent(params[k]);
    }).join('&');
    fetch(url)
      .then(function(r){ return r.json(); })
      .then(function(d){ cb(null, d); })
      .catch(function(e){ cb(e, null); });
  }
}

function apiPost(body, cb) {
  if (db) {
    apiPostFirebase(body, cb);
  } else {
    fetch(API_URL, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(body)
    })
      .then(function(r){ return r.json(); })
      .then(function(d){ cb(null, d); })
      .catch(function(e){ cb(e, null); });
  }
}