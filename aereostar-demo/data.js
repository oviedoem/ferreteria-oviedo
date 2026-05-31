// data.js — Datos públicos y simulados. Solo para demostración.
// No conecta a Google Ads real ni a ninguna cuenta de Aereostar.

const BRAND = {
  name: "Aereostar",
  tagline: "Transfer Aeropuerto Santiago",
  phone: "+56 9 3779 3527",
  whatsapp: "56937793527",
  website: "https://aereostar.cl",
};

const PERIOD = {
  label: "Últimos 30 días",
  start: "1 May 2026",
  end: "31 May 2026",
};

const KPIS = [
  {
    key: "impressions",
    label: "Impresiones",
    value: 31700,
    prev: 28400,
    format: "number",
    color: "blue",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    trend: [76, 80, 86, 88, 90, 95, 100],
  },
  {
    key: "clicks",
    label: "Clics al sitio",
    value: 2740,
    prev: 2190,
    format: "number",
    color: "cyan",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3l14 9-14 9V3z"/></svg>`,
    trend: [67, 75, 79, 84, 88, 94, 100],
  },
  {
    key: "ctr",
    label: "CTR",
    value: 8.76,
    prev: 7.71,
    format: "percent",
    color: "green",
    badge: "Excelente",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`,
    trend: [88, 90, 87, 93, 91, 96, 100],
  },
  {
    key: "leads",
    label: "Leads estimados",
    value: 82,
    prev: 68,
    format: "number",
    color: "purple",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    trend: [64, 71, 77, 83, 87, 93, 100],
  },
  {
    key: "clients",
    label: "Clientes reales",
    value: 18,
    prev: 14,
    format: "number",
    color: "amber",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    trend: [56, 67, 72, 78, 83, 89, 100],
  },
  {
    key: "cpl",
    label: "Costo por lead",
    value: 8287,
    prev: 9154,
    format: "currency",
    color: "teal",
    note: "↓ es mejor",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    trend: [100, 95, 90, 89, 86, 83, 91],
    invertChange: true,
  },
];

const FUNNEL = [
  {
    label: "Impresiones",
    value: 31700,
    note: "Personas que vieron tu anuncio en Google",
    color: "#2563eb",
    visualW: 100,
    convRate: null,
    convLabel: null,
  },
  {
    label: "Clics al sitio",
    value: 2740,
    note: "8.76% CTR — más del doble del promedio del sector",
    color: "#0891b2",
    visualW: 66,
    convRate: "8.64%",
    convLabel: "de impresiones hacen clic",
  },
  {
    label: "Leads recibidos",
    value: 82,
    note: "Formulario web, llamada telefónica o WhatsApp",
    color: "#059669",
    visualW: 38,
    convRate: "2.99%",
    convLabel: "de los clics se convierten en lead",
  },
  {
    label: "Clientes reales",
    value: 18,
    note: "22% tasa de cierre — hay margen de mejora visible",
    color: "#7c3aed",
    visualW: 20,
    convRate: "21.95%",
    convLabel: "de los leads se cierran como cliente",
  },
];

const LEADS = [
  { id:1,  nombre:"Carlos Mendoza V.",  fecha:"2026-05-30", origen:"Google Ads",        destino:"SCL → Las Condes",    vuelo:"LA 800",  hora:"06:30", estado:"cliente_real", valor:38000, notas:"Corporativo, repite semanalmente" },
  { id:2,  nombre:"Ana Rodríguez P.",   fecha:"2026-05-30", origen:"Google Ads",        destino:"SCL → Providencia",   vuelo:"AA 2345", hora:"14:15", estado:"cotizado",     valor:32000, notas:"Esperando confirmación de vuelo" },
  { id:3,  nombre:"Roberto Silva M.",   fecha:"2026-05-29", origen:"WhatsApp",          destino:"SCL → Vitacura",      vuelo:"LA 412",  hora:"08:00", estado:"contactado",   valor:35000, notas:"Llamar mañana 10am" },
  { id:4,  nombre:"María Torres F.",    fecha:"2026-05-29", origen:"Google Ads",        destino:"Maipú → SCL",         vuelo:"JJ 3892", hora:"19:45", estado:"nuevo",        valor:28000, notas:"" },
  { id:5,  nombre:"Diego Fuentes A.",   fecha:"2026-05-28", origen:"Referido",          destino:"SCL → Lo Barnechea",  vuelo:"LA 600",  hora:"11:30", estado:"perdido",      valor:42000, notas:"Eligió otro servicio" },
  { id:6,  nombre:"Patricia Molina C.", fecha:"2026-05-28", origen:"Google Ads",        destino:"SCL → Stgo Centro",   vuelo:"CM 447",  hora:"22:00", estado:"cliente_real", valor:25000, notas:"Pago confirmado vía transferencia" },
  { id:7,  nombre:"Andrés Vargas L.",   fecha:"2026-05-27", origen:"Google Ads",        destino:"SCL → Ñuñoa",         vuelo:"LA 1102", hora:"07:15", estado:"cotizado",     valor:30000, notas:"Negociando precio" },
  { id:8,  nombre:"Claudia Herrera B.", fecha:"2026-05-27", origen:"Búsqueda orgánica", destino:"Puente Alto → SCL",   vuelo:"AC 789",  hora:"16:30", estado:"contactado",   valor:33000, notas:"Confirmó número WhatsApp" },
  { id:9,  nombre:"Juan Pérez G.",      fecha:"2026-05-26", origen:"Google Ads",        destino:"SCL → Peñalolén",     vuelo:"LA 2201", hora:"09:00", estado:"cliente_real", valor:27000, notas:"Segunda vez con Aereostar" },
  { id:10, nombre:"Sofía Castillo R.",  fecha:"2026-05-26", origen:"Google Ads",        destino:"SCL → Las Condes",    vuelo:"IB 6753", hora:"12:45", estado:"nuevo",        valor:38000, notas:"" },
  { id:11, nombre:"Francisco Muñoz T.", fecha:"2026-05-25", origen:"WhatsApp",          destino:"La Florida → SCL",    vuelo:"LA 800",  hora:"05:30", estado:"perdido",      valor:29000, notas:"Sin respuesta luego de cotizar" },
  { id:12, nombre:"Valentina Soto O.",  fecha:"2026-05-25", origen:"Google Ads",        destino:"SCL → Providencia",   vuelo:"AA 900",  hora:"18:00", estado:"cliente_real", valor:32000, notas:"Referida por Carlos Mendoza" },
  { id:13, nombre:"Matías González H.", fecha:"2026-05-24", origen:"Google Ads",        destino:"SCL → Vitacura",      vuelo:"UX 042",  hora:"10:00", estado:"cotizado",     valor:40000, notas:"Ida y vuelta el mismo día" },
  { id:14, nombre:"Camila Rojas E.",    fecha:"2026-05-24", origen:"Referido",          destino:"SCL → Lo Curro",      vuelo:"LA 502",  hora:"08:30", estado:"cliente_real", valor:45000, notas:"Servicio VIP, ejecutiva" },
  { id:15, nombre:"Ignacio Pino D.",    fecha:"2026-05-23", origen:"Google Ads",        destino:"Maipú → SCL",         vuelo:"G3 1234", hora:"04:45", estado:"contactado",   valor:26000, notas:"Vuelo madrugada, precio especial" },
];

const STATUS_CONFIG = {
  nuevo:        { label:"Nuevo",         bg:"#eff6ff", color:"#2563eb" },
  contactado:   { label:"Contactado",    bg:"#ecfeff", color:"#0891b2" },
  cotizado:     { label:"Cotizado",      bg:"#fffbeb", color:"#b45309" },
  cliente_real: { label:"Cliente Real",  bg:"#ecfdf5", color:"#065f46" },
  perdido:      { label:"Perdido",       bg:"#fef2f2", color:"#991b1b" },
};

const RECOMMENDATIONS = [
  {
    id:1, priority:"alta", emoji:"🎯",
    title:"Crear landing page de conversión dedicada",
    desc:"Tu CTR de 8.76% supera el doble del promedio del sector (≈4%). El problema está en la conversión post-clic. Una landing específica para Google Ads —con formulario visible sin scroll— puede doblar los leads sin gastar más.",
    action:"Diseñar landing específica para Google Ads con formulario visible",
    impact:"+40 leads/mes estimado",
    tag:"Landing Page",
  },
  {
    id:2, priority:"alta", emoji:"💬",
    title:"Activar WhatsApp Business con auto-respuesta",
    desc:"Solo el 18% de los leads llega por WhatsApp actualmente. Con botón flotante visible en mobile y respuesta automática en menos de 1 minuto, ese canal puede triplicarse. El cliente que contacta por WhatsApp cierra 3× más.",
    action:"Configurar WhatsApp Business API + botón flotante en web",
    impact:"+25 leads/mes estimado",
    tag:"WhatsApp",
  },
  {
    id:3, priority:"media", emoji:"✍️",
    title:"Testear nuevos call-to-action en los anuncios",
    desc:"Los anuncios con CTAs de urgencia convierten más. Probar variantes: 'Reserva tu transfer ahora', 'Transfer garantizado al SCL' y 'Cotiza en 2 minutos'. Un buen A/B test mejora el CTR entre 15–20% en 2 semanas.",
    action:"Crear 3 variantes de anuncio en Google Ads Editor y activar experimento",
    impact:"+500 clics/mes estimado",
    tag:"Anuncios",
  },
  {
    id:4, priority:"media", emoji:"🚫",
    title:"Filtrar tráfico no calificado con palabras negativas",
    desc:"Búsquedas como 'taxi gratis SCL', 'bus aeropuerto barato' o 'microbús Pudahuel' generan clics que nunca convierten. Agregar 60–80 palabras clave negativas puede reducir el gasto desperdiciado hasta un 15%.",
    action:"Revisar informe de términos de búsqueda y agregar lista de negativas",
    impact:"-15% gasto en tráfico no calificado",
    tag:"Keywords",
  },
  {
    id:5, priority:"baja", emoji:"📊",
    title:"Instalar etiquetas de conversión en la web",
    desc:"Sin conversiones trackeadas, Google Ads no puede aprender ni optimizar. Con smart bidding activado y conversiones configuradas, el algoritmo puede reducir el costo por lead hasta un 30% automáticamente en 30 días.",
    action:"Instalar Google Tag Manager + etiqueta de conversión en página de gracias",
    impact:"+30% eficiencia del presupuesto",
    tag:"Tracking",
  },
];

const AUDIT = {
  score: 62,
  items: [
    { label:"Número de teléfono visible en header",      status:"ok",      note:"Aparece y es clickeable" },
    { label:"Botón WhatsApp flotante en mobile",          status:"fail",    note:"No aparece en dispositivos móviles" },
    { label:"Formulario de cotización sobre el fold",     status:"fail",    note:"El formulario está muy abajo, requiere scroll" },
    { label:"Velocidad de carga < 3s en móvil",          status:"warning", note:"≈4.2s según Google PageSpeed" },
    { label:"Diseño adaptado a móvil (responsive)",      status:"ok",      note:"Funciona correctamente en smartphones" },
    { label:"Testimonios o reseñas de clientes visibles",status:"fail",    note:"No hay sección de reviews en la página" },
    { label:"Call-to-action principal destacado",        status:"warning", note:"CTA poco visible en mobile, se pierde" },
    { label:"Precios o rango de precios visibles",       status:"fail",    note:"Sin precios genera fricción y más rebotes" },
    { label:"Seguimiento de conversiones (Google Ads)",  status:"fail",    note:"Sin etiqueta de conversión detectada" },
    { label:"HTTPS / Certificado SSL activo",            status:"ok",      note:"Certificado válido y vigente ✓" },
  ],
};

const FLOW_STEPS = [
  { icon:"📣", step:"01", title:"Google Ads", desc:"Tu anuncio aparece en Google cuando alguien busca 'transfer aeropuerto Santiago'", tag:"2,740 clics/mes" },
  { icon:"🖥️", step:"02", title:"Landing Page", desc:"El usuario llega a tu sitio web y ve el servicio, precio y CTA para contactar", tag:"31,700 impresiones" },
  { icon:"📩", step:"03", title:"Lead captado", desc:"Completa el formulario, llama al teléfono o escribe por WhatsApp Business", tag:"82 leads/mes" },
  { icon:"💬", step:"04", title:"Seguimiento", desc:"Respuesta rápida por WhatsApp o teléfono con cotización personalizada", tag:"< 5 min respuesta" },
  { icon:"✅", step:"05", title:"Cliente real", desc:"Pago confirmado, transfer agendado y cliente recurrente a largo plazo", tag:"18 clientes/mes" },
];
