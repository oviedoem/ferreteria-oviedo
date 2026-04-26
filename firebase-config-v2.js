// ============================================================================
// firebase-config-v2.js - Configuración mejorada de Firebase con Firestore
// ============================================================================
// Este archivo inicializa Firebase y proporciona funciones para sincronizar
// el catálogo de productos desde Firestore. Reemplaza el firebase-config.js
// anterior con funcionalidad completa de lectura/escritura.
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

if (typeof window.FIREBASE_CONFIG === 'object') {
  Object.assign(firebaseConfig, window.FIREBASE_CONFIG);
}

// Inicializar Firebase
if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  console.log('[Firebase] Inicializado correctamente. Proyecto:', firebaseConfig.projectId);
}

// ============================================================================
// FUNCIONES DE CATÁLOGO - Sincronización con Firestore
// ============================================================================

/**
 * Carga el catálogo de productos desde Firestore con caché en memoria.
 * @param {Function} callback - Función de retorno (err, data)
 */
function cargarCatalogo(callback) {
  if (!db) {
    console.error('[Catálogo] Firebase no disponible');
    return callback(new Error('Firebase no disponible'), null);
  }

  const ahora = Date.now();
  if (catalogoCache && (ahora - ultimaCargaCatalogo) < CACHE_TTL) {
    console.log('[Catálogo] Usando caché (edad: ' + Math.round((ahora - ultimaCargaCatalogo) / 1000) + 's)');
    return callback(null, catalogoCache);
  }

  console.log('[Catálogo] Cargando desde Firestore...');
  
  Promise.all([
    db.collection('productos').get(),
    db.collection('config').doc('negocio').get()
  ])
    .then(([productosSnap, configSnap]) => {
      const productos = [];
      productosSnap.forEach(doc => {
        productos.push(doc.data());
      });
      
      const config = configSnap.exists ? configSnap.data() : {};
      
      catalogoCache = {
        productos: productos,
        horario: config.horario || 'Consultar por WhatsApp',
        ubicacion: config.ubicacion || 'Las Cabras',
        ultimaActualizacion: config.ultima_actualizacion || new Date().toISOString()
      };
      
      ultimaCargaCatalogo = ahora;
      console.log('[Catálogo] Cargados ' + productos.length + ' productos desde Firestore');
      callback(null, catalogoCache);
    })
    .catch(err => {
      console.error('[Catálogo] Error al cargar:', err.message);
      callback(err, null);
    });
}

/**
 * Busca productos por nombre o código.
 * @param {String} termino - Término de búsqueda
 * @param {Function} callback - Función de retorno (err, resultados)
 */
function buscarProductos(termino, callback) {
  cargarCatalogo((err, catalogo) => {
    if (err) return callback(err, null);
    
    const terminoLower = termino.toLowerCase();
    const resultados = catalogo.productos.filter(p => {
      const nombre = (p.nombre || p.descripcion || '').toLowerCase();
      const codigo = (p.codigo || '').toLowerCase();
      return nombre.includes(terminoLower) || codigo.includes(terminoLower);
    });
    
    callback(null, resultados);
  });
}

/**
 * Obtiene un producto específico por código.
 * @param {String} codigo - Código del producto
 * @param {Function} callback - Función de retorno (err, producto)
 */
function obtenerProducto(codigo, callback) {
  if (!db) return callback(new Error('Firebase no disponible'), null);
  
  db.collection('productos').doc(codigo).get()
    .then(doc => {
      if (doc.exists) {
        callback(null, doc.data());
      } else {
        callback(new Error('Producto no encontrado'), null);
      }
    })
    .catch(err => callback(err, null));
}

/**
 * Guarda una cotización en Firestore.
 * @param {Object} cotizacion - Objeto con datos de la cotización
 * @param {Function} callback - Función de retorno (err, resultado)
 */
function guardarCotizacion(cotizacion, callback) {
  if (!db) return callback(new Error('Firebase no disponible'), null);
  
  const docData = {
    ...cotizacion,
    ts: firebase.firestore.FieldValue.serverTimestamp(),
    createdAt: new Date().toISOString()
  };
  
  db.collection('cotizaciones').add(docData)
    .then(docRef => {
      console.log('[Cotización] Guardada con ID:', docRef.id);
      callback(null, { id: docRef.id, success: true });
    })
    .catch(err => {
      console.error('[Cotización] Error al guardar:', err.message);
      callback(err, null);
    });
}

/**
 * Obtiene todas las cotizaciones (requiere autenticación).
 * @param {Function} callback - Función de retorno (err, cotizaciones)
 */
function obtenerCotizaciones(callback) {
  if (!db) return callback(new Error('Firebase no disponible'), null);
  
  db.collection('cotizaciones')
    .orderBy('ts', 'desc')
    .limit(100)
    .get()
    .then(snapshot => {
      const cotizaciones = [];
      snapshot.forEach(doc => {
        cotizaciones.push({ id: doc.id, ...doc.data() });
      });
      callback(null, cotizaciones);
    })
    .catch(err => callback(err, null));
}

// ============================================================================
// FUNCIONES DE USUARIOS - Autenticación y Sesiones
// ============================================================================

/**
 * Normaliza un registro de usuario.
 */
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
  if (!data.licExpiry) data.licExpiry = new Date(Date.now() + 30 * 864e5).toISOString();
  if (!data.exp) data.exp = new Date(data.licExpiry).getTime();
  return data;
}

/**
 * Obtiene todos los usuarios (requiere autenticación de admin).
 */
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
        .where('ts', '>', Date.now() - 30 * 60 * 1000)
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

/**
 * Guarda datos en Firestore (usuarios, sesiones, cotizaciones).
 */
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
    case 'saveCotizacion':
      db.collection('cotizaciones').add(data)
        .then(() => cb(null, { success: true }))
        .catch(err => cb(err, null));
      break;
    default:
      cb(new Error('Acción no soportada'), null);
  }
}

/**
 * Función genérica para GET que usa Firebase.
 */
function apiGet(params, cb) {
  if (db) {
    apiGetFirebase(params, cb);
  } else {
    console.error('[API] Firebase no disponible para GET');
    cb(new Error('Firebase no disponible'), null);
  }
}

/**
 * Función genérica para POST que usa Firebase.
 */
function apiPost(body, cb) {
  if (db) {
    apiPostFirebase(body, cb);
  } else {
    console.error('[API] Firebase no disponible para POST');
    cb(new Error('Firebase no disponible'), null);
  }
}

// ============================================================================
// FUNCIONES DE CONFIGURACIÓN - Panel de Admin
// ============================================================================

/**
 * Prueba la conexión a Firestore.
 * @param {Function} callback - Función de retorno (err, resultado)
 */
function probarConexionFirebase(callback) {
  if (!db) {
    return callback(new Error('Firebase no inicializado'), null);
  }

  console.log('[Conexión] Probando acceso a Firestore...');
  
  db.collection('config').doc('negocio').get()
    .then(doc => {
      const estado = doc.exists ? 'OK' : 'SIN_DATOS';
      console.log('[Conexión] Firestore accesible. Estado:', estado);
      callback(null, {
        success: true,
        estado: estado,
        proyecto: firebaseConfig.projectId,
        timestamp: new Date().toISOString()
      });
    })
    .catch(err => {
      console.error('[Conexión] Error:', err.message);
      callback(err, null);
    });
}

/**
 * Actualiza la URL de webhook en la configuración de Firestore.
 * @param {String} url - URL del webhook
 * @param {Function} callback - Función de retorno (err, resultado)
 */
function guardarURLWebhook(url, callback) {
  if (!db) {
    return callback(new Error('Firebase no disponible'), null);
  }

  console.log('[Webhook] Guardando URL:', url);
  
  db.collection('config').doc('webhook').set({
    url: url,
    actualizado: firebase.firestore.FieldValue.serverTimestamp(),
    estado: 'pendiente_verificacion'
  }, { merge: true })
    .then(() => {
      console.log('[Webhook] URL guardada exitosamente');
      callback(null, { success: true, url: url });
    })
    .catch(err => {
      console.error('[Webhook] Error al guardar:', err.message);
      callback(err, null);
    });
}

/**
 * Obtiene la URL de webhook guardada.
 * @param {Function} callback - Función de retorno (err, url)
 */
function obtenerURLWebhook(callback) {
  if (!db) {
    return callback(new Error('Firebase no disponible'), null);
  }

  db.collection('config').doc('webhook').get()
    .then(doc => {
      if (doc.exists) {
        callback(null, doc.data().url || '');
      } else {
        callback(null, '');
      }
    })
    .catch(err => callback(err, null));
}

/**
 * Verifica la URL del webhook haciendo un test.
 * @param {String} url - URL a verificar
 * @param {Function} callback - Función de retorno (err, resultado)
 */
function verificarURLWebhook(url, callback) {
  console.log('[Webhook] Verificando URL:', url);
  
  fetch(url, {
    method: 'GET',
    timeout: 5000
  })
    .then(response => {
      const ok = response.ok || response.status === 200;
      console.log('[Webhook] Respuesta:', response.status);
      callback(null, {
        success: ok,
        status: response.status,
        statusText: response.statusText
      });
    })
    .catch(err => {
      console.error('[Webhook] Error de verificación:', err.message);
      callback(err, null);
    });
}

console.log('[Firebase] Configuración v2 cargada correctamente');
