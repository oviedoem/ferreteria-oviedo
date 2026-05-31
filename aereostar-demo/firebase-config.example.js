// firebase-config.example.js — Plantilla para conexión futura con Firebase
// Copia este archivo como firebase-config.js y reemplaza con tus valores reales.
// NUNCA subas firebase-config.js a un repositorio público.

const firebaseConfig = {
  apiKey:            "TU_API_KEY",
  authDomain:        "tu-proyecto.firebaseapp.com",
  databaseURL:       "https://tu-proyecto-default-rtdb.firebaseio.com",
  projectId:         "tu-proyecto",
  storageBucket:     "tu-proyecto.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId:             "TU_APP_ID",
};

// ── Cómo activarlo ──────────────────────────────────────────────────────────
//
// 1. Crea un proyecto en https://console.firebase.google.com
// 2. Activa Firestore Database (modo producción)
// 3. Activa Authentication si necesitas login del dueño
// 4. Copia los valores de Configuración del proyecto aquí
//
// 5. En index.html, agrega antes de app.js:
//    <script src="https://www.gstatic.com/firebasejs/10.x.x/firebase-app-compat.js"></script>
//    <script src="https://www.gstatic.com/firebasejs/10.x.x/firebase-firestore-compat.js"></script>
//    <script src="firebase-config.js"></script>
//
// 6. En app.js, reemplaza el array LEADS por:
//    const db = firebase.firestore();
//    db.collection('leads').orderBy('fecha', 'desc').onSnapshot(snapshot => {
//      const leads = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
//      renderLeadsTable(leads);
//    });
//
// ── Estructura de documento en Firestore ──────────────────────────────────
//
// Colección: "leads"
// Documento: {
//   nombre:  "Carlos Mendoza",
//   fecha:   Timestamp,
//   origen:  "Google Ads" | "WhatsApp" | "Referido" | ...,
//   destino: "SCL → Las Condes",
//   vuelo:   "LA 800",
//   hora:    "06:30",
//   estado:  "nuevo" | "contactado" | "cotizado" | "cliente_real" | "perdido",
//   valor:   38000,
//   notas:   "...",
// }
