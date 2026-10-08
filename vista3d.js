/* ============================================================================
   VISTA 3D — maqueta aparte. Vive en su propio archivo a propósito: la maqueta
   SVG de index.html no se toca ni se mezcla con esta, y lo único que comparten
   son los datos, que esta vista lee por el puente window.RIEL3D_API.
   Se carga la primera vez que se pulsa «3D» y se cierra para volver al plano.

   Lenguaje visual: maqueta clara de patio logístico (fondo frío, piezas mates,
   sombras suaves, tarjetas de cristal encima), en vez del escenario oscuro del
   modelo plano. Así se distingue de un golpe de vista en cuál de los dos estás.

   Mundo: X = largo de la cadena (planta → acopio), Z = profundidad
   (Z<0 mar, Z>0 tierra), Y = altura.
   ============================================================================ */
(function(){
'use strict';
if (window.RIEL3D) return;                       // ya estaba cargada

const API = window.RIEL3D_API || {};
const UNIDAD = API.UNIDAD || 'tm';
const FASES  = API.FASES  || [{id:'f1',nombre:'Entrega I'}];
const TRAMOS = API.TRAMOS || [{id:'x',nombre:'Proyecto'}];
const fmt = API.fmt || (v => typeof v==='number' ? v.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2}) : String(v));
const datos = (f,t) => (API.datos ? API.datos(f,t) : {});
const tabla = (f,t) => (API.tabla ? API.tabla(f,t) : []);
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;

let FASE = API.fase || FASES[0].id;
let SEG  = API.proyecto || TRAMOS[0].id;

/* ---------------------------------------------------------------- paleta ---- */
const C = {
  agua:'#86bde8', tierra:'#cbbda2',        // el corte de tierra del diorama
  pasto:'#c3d8a8', pasto2:'#b7cf9b',
  piso:'#dbe1ec', muelle:'#c4cedd', asfalto:'#a7b3c4', raya:'#ffffff',
  acero:'#8792a3', acero2:'#6d7786', rielVivo:'#e8642c',
  muro:'#eff3f9', muro2:'#dae2ee', techo:'#c2cdde', vidrio:'#a9c3ef',
  grua:'#f2c230', gruaOsc:'#39404c', casco:'#24487f', cascoBajo:'#16233a',
  cubierta:'#dde4ee', torre:'#fbfcfe', chimenea:'#d24b42',
  camion:'#fbfcfe', caja:'#e3e9f2', llanta:'#2a2f38', cobalto:'#2f5be0',
  fleje:'#d9743a',
};

/* ------------------------------------------------------- traza del mundo ---- */
// El sitio es grande a propósito y la cámara se mueve por él, en vez de verse
// entero y diminuto: cada estación es un recinto completo, no una fila de piezas.
// Eje X: el largo de la cadena. Eje Z: la profundidad, mar negativo y tierra positiva.
const SITIO = {
  planta:   {x0:   0, x1: 170},
  origen:   {x0: 360, x1: 530},
  mar:      {x0: 530, x1: 900},
  descarga: {x0: 900, x1:1070},
  acopio:   {x0:1230, x1:1420},
};
const MAR0 = 530, MAR1 = 900;                    // el estrecho: ahí la tierra se corta
const X_INI = -60, X_FIN = 1480;
const Z_FONDO = -190, Z_FRENTE = 196;            // hasta donde llega lo construido
// La cámara ve más allá del recuadro que encuadra, así que el terreno y el mar se
// extienden bastante más: si no, por los bordes asoma el fondo de la escena.
const MARGEN = 760;

// Ritmos del proceso, en segundos. Puestos para que se siga con la vista; el
// control de velocidad de la barra los multiplica.
const CICLO_GRUA = 9.5, CICLO_BUQUE = 150, CICLO_CAMION = 85, CICLO_TREN = 110;
const CICLO_CARGA = 8;                           // las grúas de carretera, algo más vivas
let VEL = 1;                                     // 0 = pausa · 0.5 · 1 · 2

const NIVEL_MAR = -1.4;                          // el agua va bajo la tierra: el corte del muelle se ve
// Con esta cámara lo que tiene más Z queda en primer plano, así que un edificio
// alto esconde unas 1.5 veces su altura en Z por detrás. De ahí el orden de las
// franjas: atrás el muelle y los patios, y las naves al fondo del predio con un
// respiro por delante para que no tapen nada que importe.
const VIA_Z = 8;                                 // línea principal, pegada a la costa
const CAMINO_Z = 128;                            // carretera principal, al fondo del predio
const VIAL_Z = 66;                               // vialidad interna del recinto
// Las bahías dan a la vialidad interna, no al campo: el camión llega por calle.
const ACCESO = {};                               // por donde cada recinto sale a la carretera
// Las bahías de carga, todas bien apartadas del carril: así la entrada es una
// vuelta que se ve, y no un empujón de costado.
// Van bien adentro del predio: pegadas a la carretera, un camión de paso rozaba
// al que estaba cargando.
const BAHIA_PLANTA = 54, BAHIA_MUELLE = 44, BAHIA_ACOPIO = 54, BAHIA_SALIDA = 14;
// El haz del camión va 4.4 por detrás de su morro: la bahía se corre otro tanto
// para que quede justo bajo la grúa y el traspaso no dé un brinco de costado.
const OFS_CAMION = 4.4;
const PATA_Z0 = 2, PATA_Z1 = 56;                 // el pórtico abre mucho: la grúa de patio va debajo
const PILA_MUELLE = 30;                          // la pila donde se encuentran las dos máquinas

// Las cinco estaciones. 'enc' es el recuadro que la cámara encuadra al visitarlas.
const EST = [
  {k:'produccion', n:'Por fabricar',      x: 85, z: 36, y:26,
   enc:{x0:-40, x1:210, z0:-30, z1:200}},
  {k:'puerto',     n:'Origen · puerto',   x:445, z: 22, y:32,
   enc:{x0:330, x1:570, z0:-70, z1:200}},
  {k:'traslado',   n:'Traslado marítimo', x:715, z:-95, y:18,
   enc:{x0:500, x1:930, z0:-190, z1: 40}},
  {k:'descarga',   n:'Descarga',          x:985, z: 22, y:32,
   enc:{x0:870, x1:1110, z0:-70, z1:200}},
  {k:'acopio',     n:'Centro de acopio',  x:1300, z: 36, y:26,
   enc:{x0:1190, x1:1460, z0:-30, z1:200}},
];
const TODO = {x0:X_INI, x1:X_FIN, z0:Z_FONDO, z1:Z_FRENTE};

/* ============================================================================
   ESTILOS — todo bajo #riel3d y con variables propias (--r3-*), para que no se
   cruce con los tokens de la página de abajo.
   ============================================================================ */
const CSS = `
#riel3d{
  --r3-ground:#e4eaf2; --r3-glass:rgba(255,255,255,.86); --r3-solid:#fff;
  --r3-line:rgba(28,44,74,.10); --r3-ink:#1b2638; --r3-ink2:#56667f; --r3-ink3:#8796ab;
  --r3-cobalto:#2f5be0; --r3-cobalto-s:#e7edfd;
  --r3-oro:#f2c230; --r3-oro-s:#fdf4d3; --r3-oro-i:#8a6400;
  --r3-ok:#1f9a63; --r3-ok-s:#e1f4ea; --r3-mal:#d24b42; --r3-mal-s:#fbe4e2;
  --r3-flama:#e8642c; --r3-flama-s:#ffe9dc; --r3-mute:#eef1f6;
  --r3-d:'Bricolage Grotesque','Barlow Condensed',system-ui,sans-serif;
  --r3-b:'Figtree','IBM Plex Sans',system-ui,'Segoe UI',sans-serif;
  --r3-m:'JetBrains Mono','IBM Plex Mono',ui-monospace,Consolas,monospace;
  --r3-r:14px; --r3-sh:0 1px 2px rgba(20,34,60,.06),0 8px 24px rgba(20,34,60,.08);
  position:fixed;inset:0;z-index:60;background:var(--r3-ground);color:var(--r3-ink);
  font-family:var(--r3-b);font-size:13px;-webkit-font-smoothing:antialiased;color-scheme:light;
  overscroll-behavior:none;
}
#riel3d[hidden]{display:none!important}
#riel3d *{box-sizing:border-box}
#riel3d button{font:inherit;color:inherit;border:0;background:none;cursor:pointer;padding:0}
#riel3d button:focus-visible{outline:2px solid var(--r3-cobalto);outline-offset:2px}
#riel3d .r3-stage{position:absolute;inset:0}
#riel3d .r3-stage canvas{display:block;touch-action:none;cursor:grab}
#riel3d .r3-stage canvas.arrastra{cursor:grabbing}
#riel3d .r3-stage canvas.toca{cursor:pointer}
#riel3d .r3-load{position:absolute;inset:0;display:grid;place-items:center;font-family:var(--r3-m);
  font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--r3-ink3)}
#riel3d .r3-hud{position:absolute;inset:0;pointer-events:none}
#riel3d .r3-hud>*{pointer-events:auto}
#riel3d .r3-glass{background:var(--r3-glass);backdrop-filter:blur(14px) saturate(1.3);
  -webkit-backdrop-filter:blur(14px) saturate(1.3);border:1px solid var(--r3-line);
  border-radius:var(--r3-r);box-shadow:var(--r3-sh)}
#riel3d .r3-mono{font-family:var(--r3-m);font-variant-numeric:tabular-nums}

/* barra superior */
#riel3d .r3-bar{position:absolute;top:12px;left:16px;right:16px;z-index:20;display:flex;align-items:center;
  gap:8px;padding:8px 10px;min-height:52px;flex-wrap:wrap}
#riel3d .r3-brand{display:flex;align-items:center;gap:8px;font-family:var(--r3-d);font-weight:800;
  font-size:17px;letter-spacing:-.01em;white-space:nowrap}
#riel3d .r3-brand svg{width:22px;height:22px;color:var(--r3-cobalto)}
#riel3d .r3-brand i{font-style:normal;font-family:var(--r3-m);font-size:10px;font-weight:700;
  letter-spacing:.08em;background:var(--r3-cobalto);color:#fff;border-radius:6px;padding:3px 6px}
#riel3d .r3-code{font-family:var(--r3-m);font-size:10px;letter-spacing:.06em;color:var(--r3-ink3);
  border:1px solid var(--r3-line);border-radius:7px;padding:4px 7px;white-space:nowrap}
#riel3d .r3-sp{flex:1 1 auto;min-width:8px}
#riel3d .r3-site{position:relative;display:flex;align-items:center;gap:8px;padding:4px 10px 4px 4px;
  border:1px solid var(--r3-line);border-radius:10px;background:var(--r3-solid);white-space:nowrap;text-align:left}
#riel3d .r3-site .cod{background:var(--r3-cobalto);color:#fff;font-family:var(--r3-m);font-size:10px;
  font-weight:700;border-radius:6px;padding:4px 6px}
#riel3d .r3-site b{display:block;font-size:12px;font-weight:700}
#riel3d .r3-site small{display:block;color:var(--r3-ink3);font-size:10.5px}
#riel3d .r3-site .chev{width:12px;height:12px;color:var(--r3-ink3)}
#riel3d .r3-pop{position:absolute;top:calc(100% + 6px);right:0;min-width:230px;background:var(--r3-solid);
  border:1px solid var(--r3-line);border-radius:12px;box-shadow:0 12px 32px rgba(20,34,60,.18);
  padding:6px;display:none;z-index:5}
#riel3d .r3-pop.abierto{display:block}
#riel3d .r3-pop button{display:block;width:100%;text-align:left;padding:8px 10px;border-radius:8px;font-size:12.5px}
#riel3d .r3-pop button:hover{background:var(--r3-mute)}
#riel3d .r3-pop button[aria-current="true"]{color:var(--r3-cobalto);font-weight:700;background:var(--r3-cobalto-s)}
#riel3d .r3-seg{display:inline-flex;background:var(--r3-mute);border-radius:10px;padding:3px;gap:2px}
#riel3d .r3-seg button{font-size:11px;font-weight:700;padding:5px 10px;border-radius:7px;color:var(--r3-ink3);white-space:nowrap}
#riel3d .r3-seg button.on{background:#fff;color:var(--r3-ink);box-shadow:0 1px 2px rgba(20,30,60,.12)}
#riel3d .r3-vel button{min-width:34px;text-align:center}
#riel3d .r3-tools{display:flex;background:var(--r3-mute);border-radius:10px;padding:3px;gap:2px}
#riel3d .r3-ibtn{height:28px;min-width:30px;padding:0 8px;border-radius:7px;display:grid;place-items:center;
  color:var(--r3-ink2);font-weight:700;font-size:12px}
#riel3d .r3-ibtn:hover{background:var(--r3-solid);color:var(--r3-cobalto)}
#riel3d .r3-ibtn svg{width:14px;height:14px}
#riel3d .r3-close{display:flex;align-items:center;gap:6px;background:var(--r3-ink);color:#fff;
  border-radius:10px;padding:7px 12px;font-weight:700;font-size:12px;white-space:nowrap}
#riel3d .r3-close:hover{background:#2c3a52}

/* tarjetas de cifras */
#riel3d .r3-kpis{position:absolute;top:76px;left:16px;right:16px;display:flex;gap:10px;flex-wrap:wrap;pointer-events:none}
#riel3d .r3-kpi{pointer-events:auto;display:flex;align-items:center;gap:10px;padding:10px 14px 10px 10px;min-width:166px}
#riel3d .r3-kpi .ic{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;
  background:var(--r3-cobalto-s);color:var(--r3-cobalto);flex:none}
#riel3d .r3-kpi .ic svg{width:18px;height:18px}
#riel3d .r3-kpi.oro .ic{background:var(--r3-oro-s);color:var(--r3-oro-i)}
#riel3d .r3-kpi.ok .ic{background:var(--r3-ok-s);color:var(--r3-ok)}
#riel3d .r3-kpi.mal .ic{background:var(--r3-mal-s);color:var(--r3-mal)}
#riel3d .r3-kpi.flama .ic{background:var(--r3-flama-s);color:var(--r3-flama)}
#riel3d .r3-kpi .t{min-width:0}
#riel3d .r3-kpi label{display:block;font-size:11px;color:var(--r3-ink2);font-weight:600}
#riel3d .r3-kpi .v{display:flex;align-items:baseline;gap:5px;font-family:var(--r3-d);font-weight:800;
  font-size:19px;letter-spacing:-.01em;line-height:1.15;font-variant-numeric:tabular-nums}
#riel3d .r3-kpi .v small{font-family:var(--r3-b);font-size:10.5px;font-weight:700;color:var(--r3-ink3)}
#riel3d .r3-kpi .v em{font-style:normal;font-size:13px;color:var(--r3-ink3)}
#riel3d .r3-medidor{height:4px;border-radius:4px;background:var(--r3-mute);overflow:hidden;margin-top:5px;width:100%}
#riel3d .r3-medidor i{display:block;height:100%;border-radius:inherit;background:var(--r3-cobalto);transition:width .5s}
#riel3d .r3-medidor.ok i{background:var(--r3-ok)}
#riel3d .r3-medidor.oro i{background:var(--r3-oro)}
#riel3d .r3-medidor.mal i{background:var(--r3-mal)}

/* dona: el reparto del contratado, entre las tarjetas y la cadena */
#riel3d .r3-dona{position:absolute;top:166px;left:16px;display:flex;align-items:center;gap:11px;
  padding:10px 14px 10px 10px;width:max-content}
#riel3d .r3-dona svg{width:78px;height:78px;flex:none;overflow:visible}
#riel3d .r3-dona .leyenda{display:flex;flex-direction:column;gap:4px}
#riel3d .r3-dona .l{display:grid;grid-template-columns:8px 1fr auto;align-items:center;gap:8px;
  font-size:10.5px;font-weight:600;color:var(--r3-ink2);white-space:nowrap}
#riel3d .r3-dona .l i{width:9px;height:9px;border-radius:3px}
#riel3d .r3-dona .l b{font-family:var(--r3-m);font-weight:700;color:var(--r3-ink);font-variant-numeric:tabular-nums}

/* panel derecho: la tabla del proyecto */
#riel3d .r3-panel{position:absolute;top:172px;right:16px;bottom:124px;width:336px;display:flex;
  flex-direction:column;overflow:hidden}
#riel3d .r3-ph{padding:12px 14px 10px;border-bottom:1px solid var(--r3-line)}
#riel3d .r3-ph .eyebrow{font-family:var(--r3-m);font-size:10px;letter-spacing:.12em;text-transform:uppercase;
  color:var(--r3-ink3);margin:0 0 3px}
#riel3d .r3-ph h2{margin:0;font-family:var(--r3-d);font-weight:800;font-size:16px;letter-spacing:-.01em}
#riel3d .r3-tot{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:10px 14px}
#riel3d .r3-mini{background:var(--r3-solid);border:1px solid var(--r3-line);border-radius:10px;padding:8px 10px;min-width:0}
#riel3d .r3-mini label{display:block;font-size:9.5px;color:var(--r3-ink3);font-weight:700;text-transform:uppercase;letter-spacing:.05em}
#riel3d .r3-mini b{display:block;font-family:var(--r3-m);font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#riel3d .r3-rows{flex:1;overflow:auto;padding:4px 10px 12px;scrollbar-width:thin}
#riel3d .r3-row{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;
  padding:9px 4px;border-bottom:1px solid var(--r3-line)}
#riel3d .r3-row:last-child{border-bottom:0}
#riel3d .r3-row .ic{width:26px;height:26px;border-radius:8px;background:var(--r3-mute);color:var(--r3-ink2);
  display:grid;place-items:center;flex:none}
#riel3d .r3-row .ic svg{width:14px;height:14px}
#riel3d .r3-row .t{min-width:0}
#riel3d .r3-row .t b{display:block;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#riel3d .r3-row .t small{display:block;color:var(--r3-ink3);font-size:10.5px}
#riel3d .r3-row .r{text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:3px}
#riel3d .r3-row .r .r3-mono{font-weight:700;font-size:12.5px}
#riel3d .r3-row.total{border-top:1px solid var(--r3-line);margin-top:4px;padding-top:12px;border-bottom:0}
#riel3d .r3-row.total .t b{font-family:var(--r3-d);font-weight:800}
#riel3d .r3-row.total .ic{background:var(--r3-cobalto-s);color:var(--r3-cobalto)}
#riel3d .r3-pill{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:2px 8px;
  font-size:10px;font-weight:700;background:var(--r3-mute);color:var(--r3-ink2);white-space:nowrap}
#riel3d .r3-pill.ok{background:var(--r3-ok-s);color:var(--r3-ok)}
#riel3d .r3-pill.mal{background:var(--r3-mal-s);color:var(--r3-mal)}
#riel3d .r3-vacio{font-size:11.5px;color:var(--r3-ink3);padding:14px 4px;line-height:1.5}

/* la cadena, abajo */
#riel3d .r3-chain{position:absolute;left:16px;bottom:16px;right:368px;display:grid;
  grid-template-columns:repeat(5,minmax(0,1fr));gap:2px;padding:6px;overflow:hidden}
#riel3d .r3-paso{display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:10px;text-align:left}
#riel3d .r3-paso:hover{background:var(--r3-mute)}
#riel3d .r3-paso[aria-current="true"]{background:var(--r3-cobalto-s)}
#riel3d .r3-paso .ic{width:30px;height:30px;border-radius:9px;background:var(--r3-solid);
  border:1px solid var(--r3-line);color:var(--r3-cobalto);display:grid;place-items:center;flex:none}
#riel3d .r3-paso .ic svg{width:17px;height:17px}
#riel3d .r3-paso .t{min-width:0}
#riel3d .r3-paso label{display:block;font-size:10px;font-weight:700;text-transform:uppercase;
  letter-spacing:.05em;color:var(--r3-ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#riel3d .r3-paso b{display:block;font-family:var(--r3-m);font-size:13px;font-weight:700;white-space:nowrap}
#riel3d .r3-paso b small{font-family:var(--r3-b);font-size:10px;font-weight:600;color:var(--r3-ink3)}
#riel3d .r3-paso.apagado{opacity:.42}
#riel3d .r3-paso.apagado .ic{color:var(--r3-ink3)}

/* rótulos flotando sobre la maqueta */
#riel3d .r3-labs{position:absolute;inset:0;pointer-events:none;overflow:hidden}
#riel3d .r3-lab{position:absolute;left:0;top:0;display:flex;flex-direction:column;align-items:center;
  will-change:transform}
#riel3d .r3-lab .caja{background:var(--r3-solid);border:1px solid var(--r3-line);border-radius:10px;
  box-shadow:var(--r3-sh);padding:5px 10px;text-align:center;white-space:nowrap}
#riel3d .r3-lab .caja label{display:block;font-size:9.5px;font-weight:700;text-transform:uppercase;
  letter-spacing:.07em;color:var(--r3-ink3)}
#riel3d .r3-lab .caja b{font-family:var(--r3-m);font-size:12.5px;font-weight:700}
#riel3d .r3-lab .caja b small{font-family:var(--r3-b);font-size:9.5px;font-weight:600;color:var(--r3-ink3)}
#riel3d .r3-lab .palo{width:1px;height:28px;background:rgba(28,44,74,.28)}
#riel3d .r3-lab.apagado{opacity:.45}
#riel3d .r3-hint{position:absolute;left:50%;bottom:92px;transform:translateX(-50%);font-size:11.5px;
  color:var(--r3-ink2);background:var(--r3-glass);border:1px solid var(--r3-line);border-radius:999px;
  padding:5px 12px;white-space:nowrap;transition:opacity .6s;box-shadow:var(--r3-sh)}
#riel3d .r3-hint.ido{opacity:0}

@media (max-width:1180px){
  #riel3d .r3-panel{width:300px}
  #riel3d .r3-chain{right:332px}
  #riel3d .r3-kpi{min-width:150px}
}
@media (max-width:980px){
  #riel3d .r3-panel{display:none}
  #riel3d .r3-dona{padding:9px 12px 9px 9px}
  #riel3d .r3-dona svg{width:76px;height:76px}
  #riel3d .r3-chain{right:16px}
  #riel3d .r3-code,#riel3d .r3-site small{display:none}
}
@media (max-width:760px){
  #riel3d .r3-bar{left:10px;right:10px;padding:7px 8px}
  #riel3d .r3-brand{font-size:15px}
  #riel3d .r3-kpis{top:auto;bottom:124px;left:10px;right:10px;overflow-x:auto;flex-wrap:nowrap;
    scrollbar-width:none;padding-bottom:2px}
  #riel3d .r3-kpi{min-width:148px;flex:none}
  #riel3d .r3-chain{left:10px;right:10px;grid-template-columns:repeat(5,minmax(104px,1fr));overflow-x:auto}
  #riel3d .r3-paso{flex-direction:column;align-items:flex-start;gap:4px;padding:7px 8px}
  #riel3d .r3-hint,#riel3d .r3-tools,#riel3d .r3-dona{display:none}
}
`;

/* ------------------------------------------------------------------ iconos ---- */
const ICO = {
  fabrica: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M3 20V10l5 3V10l5 3V8l5 3v9z"/><path d="M3 20h18"/><path d="M6 4h2v6"/></svg>',
  puerto:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M4 20V5l12 3"/><path d="M4 11h9"/><path d="M16 8v12"/><path d="M2 20h20"/></svg>',
  barco:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M3 14l1.6 5.2a1 1 0 0 0 .96.8h12.9a1 1 0 0 0 .96-.8L21 14z"/><path d="M6 14V9h12v5"/><path d="M9 9V6h6v3"/></svg>',
  descarga:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 18h20"/><path d="M5 18V8h7l3 3v7"/><circle cx="8" cy="20.3" r="1.5"/><circle cx="17" cy="20.3" r="1.5"/></svg>',
  acopio:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="3" y="7" width="18" height="3.5" rx="1"/><rect x="3" y="13.5" width="18" height="3.5" rx="1"/><path d="M6 4v3M18 4v3"/></svg>',
  riel:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M7 3v18M17 3v18"/><path d="M3 8h18M3 13h18M3 18h18"/></svg>',
  reloj:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  check:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>',
  falta:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 4.5l8.5 15H3.5z" stroke-linejoin="round"/><path d="M12 10v4"/><path d="M12 16.8v.1"/></svg>',
  dinero:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.1M17.9 12h.1"/></svg>',
  tramo:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 17.5h16"/><path d="M4 6.5h16"/><path d="M8 6.5v11M16 6.5v11"/></svg>',
  suma:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 6.5h14M5 11h14M5 15.5h9"/><path d="M5 20h14" stroke-width="2.6"/></svg>',
  izq:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l-6 6 6 6"/><path d="M3 12h12a6 6 0 0 1 6 6"/></svg>',
  der:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l6 6-6 6"/><path d="M21 12H9a6 6 0 0 0-6 6"/></svg>',
  marco:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
};

/* ============================================================================
   DOM del modo 3D
   ============================================================================ */
const raiz = document.createElement('div');
raiz.id = 'riel3d';
raiz.hidden = true;
raiz.innerHTML = `
<div class="r3-stage" id="r3Stage"><div class="r3-load" id="r3Load">Preparando la maqueta…</div></div>
<div class="r3-hud">
  <div class="r3-bar r3-glass">
    <span class="r3-brand">${ICO.riel} Adquisición de riel <i>3D</i></span>
    <span class="r3-code">ATTRAPI · ARTF / 076-A-P / 2025</span>
    <span class="r3-sp"></span>
    <div class="r3-seg" id="r3Fases"></div>
    <div style="position:relative">
      <button class="r3-site" id="r3Site" aria-haspopup="true" aria-expanded="false">
        <span class="cod" id="r3SiteCod">P1</span>
        <span><b id="r3SiteNom">—</b><small>Proyecto en pantalla</small></span>
        <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="r3-pop" id="r3Pop" role="menu"></div>
    </div>
    <div class="r3-seg r3-vel" id="r3Vel" role="group" aria-label="Velocidad">
      <button type="button" data-v="0" title="Pausa" aria-label="Pausa">&#10073;&#10073;</button>
      <button type="button" data-v="0.5">&frac12;&times;</button>
      <button type="button" data-v="1" class="on">1&times;</button>
      <button type="button" data-v="2">2&times;</button>
    </div>
    <div class="r3-tools">
      <button class="r3-ibtn" data-rot="-1" title="Girar a la izquierda" aria-label="Girar a la izquierda">${ICO.izq}</button>
      <button class="r3-ibtn" data-rot="1" title="Girar a la derecha" aria-label="Girar a la derecha">${ICO.der}</button>
      <button class="r3-ibtn" data-zoom="1" title="Acercar" aria-label="Acercar">+</button>
      <button class="r3-ibtn" data-zoom="-1" title="Alejar" aria-label="Alejar">&minus;</button>
      <button class="r3-ibtn" id="r3Fit" title="Encuadrar la cadena completa" aria-label="Encuadrar">${ICO.marco}</button>
    </div>
    <button class="r3-close" id="r3Close" title="Volver a la maqueta plana (Esc)">&larr; Volver al 2D</button>
  </div>

  <div class="r3-kpis" id="r3Kpis"></div>

  <div class="r3-dona r3-glass" id="r3Dona"></div>

  <aside class="r3-panel r3-glass" id="r3Panel">
    <div class="r3-ph">
      <p class="eyebrow" id="r3PanelFase">Lote</p>
      <h2 id="r3PanelNom">—</h2>
    </div>
    <div class="r3-tot" id="r3Tot"></div>
    <div class="r3-rows" id="r3Rows"></div>
  </aside>

  <div class="r3-chain r3-glass" id="r3Chain"></div>
  <div class="r3-hint" id="r3Hint">Arrastra para mover · scroll o pinza para acercar</div>
  <div class="r3-labs" id="r3Labs"></div>
</div>`;

const estilo = document.createElement('style');
estilo.textContent = CSS;

// Las tipografías de esta vista son otras a propósito; si no cargan, caen a las de la página.
const fuentes = document.createElement('link');
fuentes.rel = 'stylesheet';
fuentes.href = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Figtree:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap';

document.head.appendChild(estilo);
document.head.appendChild(fuentes);
document.body.appendChild(raiz);

const $ = s => raiz.querySelector(s);
const elStage = $('#r3Stage'), elLabs = $('#r3Labs'), elHint = $('#r3Hint');

/* ============================================================================
   ESCENA
   ============================================================================ */
let renderer, scene, cam, world, sun, listo = false, corriendo = false;
const MATS = {}, GEOS = {};
const animadores = [];                            // cada pieza viva se registra aquí

function mat(c, o){
  const k = c + (o ? JSON.stringify(o) : '');
  return MATS[k] || (MATS[k] = new THREE.MeshStandardMaterial(Object.assign({color:c, roughness:.82, metalness:0}, o||{})));
}
function bgeo(w,h,d){
  const k = w+'|'+h+'|'+d;
  return GEOS[k] || (GEOS[k] = new THREE.BoxGeometry(w,h,d));
}
// y = base de la pieza (no su centro): así se apilan cosas sin pensar en mitades
function box(w,h,d,c,x,y,z,parent,sinSombra){
  const m = new THREE.Mesh(bgeo(w,h,d), typeof c === 'string' ? mat(c) : c);
  m.position.set(x, y + h/2, z);
  if (!sinSombra){ m.castShadow = true; m.receiveShadow = true; }
  (parent || world).add(m);
  return m;
}
function placa(x0,x1,z0,z1,y,c,recibe){         // suelo horizontal
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1-x0, z1-z0), typeof c === 'string' ? mat(c) : c);
  m.rotation.x = -Math.PI/2;
  m.position.set((x0+x1)/2, y, (z0+z1)/2);
  if (recibe !== false) m.receiveShadow = true;
  world.add(m);
  return m;
}
function cil(r,h,c,x,y,z,parent,seg){
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,seg||14), typeof c === 'string' ? mat(c) : c);
  m.position.set(x, y + h/2, z);
  m.castShadow = true; m.receiveShadow = true;
  (parent || world).add(m);
  return m;
}
function grupo(x,y,z,parent){
  const g = new THREE.Group();
  g.position.set(x||0, y||0, z||0);
  (parent || world).add(g);
  return g;
}

/* ---------- texturas dibujadas a mano, para no depender de archivos ---------- */
function texAgua(){
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = C.agua; x.fillRect(0,0,256,256);
  for (let i=0;i<70;i++){
    const y = Math.random()*256, w = 18 + Math.random()*54;
    x.strokeStyle = 'rgba(255,255,255,' + (0.05 + Math.random()*0.13) + ')';
    x.lineWidth = 1 + Math.random()*1.6;
    x.beginPath(); x.moveTo(Math.random()*256, y);
    x.lineTo(Math.random()*256 + w, y + (Math.random()-.5)*3); x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(14,6);
  return t;
}
function texBandera(cual){
  const c = document.createElement('canvas'); c.width = 96; c.height = 64;
  const x = c.getContext('2d');
  if (cual === 'cn'){
    x.fillStyle = '#de2910'; x.fillRect(0,0,96,64);
    const estrella = (cx,cy,r)=>{ x.beginPath();
      for (let i=0;i<10;i++){ const a = -Math.PI/2 + i*Math.PI/5, rr = i%2 ? r*.42 : r;
        x[i?'lineTo':'moveTo'](cx + Math.cos(a)*rr, cy + Math.sin(a)*rr); }
      x.closePath(); x.fillStyle = '#ffde00'; x.fill(); };
    estrella(20,20,11);
    [[38,9],[46,18],[46,30],[38,39]].forEach(p=>estrella(p[0],p[1],4));
  } else {
    x.fillStyle = '#006847'; x.fillRect(0,0,32,64);
    x.fillStyle = '#ffffff'; x.fillRect(32,0,32,64);
    x.fillStyle = '#ce1126'; x.fillRect(64,0,32,64);
    x.fillStyle = '#8a6a3a'; x.beginPath(); x.arc(48,32,7,0,7); x.fill();
  }
  return new THREE.CanvasTexture(c);
}

/* ---------------------------------------------------------- piezas sueltas ---- */
// Haz de rieles: la carga que recorre toda la cadena. n = cuántos lechos se apilan.
function hazRiel(x, y, z, largo, n, parent, color){
  const g = grupo(x, y, z, parent);
  const col = color || C.acero;
  for (let i=0;i<n;i++){
    const yy = i*0.66;
    for (let k=-1; k<=1; k++) box(largo, 0.56, 0.68, col, 0, yy, k*0.78, g);
    // flejes en los extremos: sin ellos el haz se lee como una estera, no como bulto
    box(0.55, 0.64, 2.9, C.fleje, -largo/2 + 1.2, yy - 0.04, 0, g);
    box(0.55, 0.64, 2.9, C.fleje,  largo/2 - 1.2, yy - 0.04, 0, g);
  }
  return g;
}
// Carretera con raya central
function carretera(x0, x1, z, ancho, parent){
  placa(x0, x1, z-ancho/2, z+ancho/2, 0.03, C.asfalto);
  for (let x=x0+1.6; x<x1-1.6; x+=6.4){
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.26), mat(C.raya, {roughness:.7}));
    m.rotation.x = -Math.PI/2; m.position.set(x+1.6, 0.05, z);
    world.add(m);
  }
}

/* ============================================================================
   GRÚA DE PÓRTICO — la máquina que hace todos los traspasos.
   Tiene dos paradas, A y B. En cada una hay una pila (o la cubierta de un buque,
   que no tiene tope). Baja hasta lo que haya, engancha, cruza con el haz colgando
   del bastidor y lo deja del otro lado. Nada aparece ni se esfuma por su cuenta:
   si un haz cambia de sitio es porque una grúa lo movió, a la vista.
   ============================================================================ */
const PASO_PILA = 1.5;
const hayDonde = p => p !== false && p !== undefined;

function gruaPortico(x, zPata0, zPata1, alto, opc){
  opc = opc || {};
  const vol = opc.vol || 0, ciclo = opc.ciclo || CICLO_GRUA;
  const zReposo = opc.reposo != null ? opc.reposo : (opc.trabajos && opc.trabajos[0] ? opc.trabajos[0].zo : zPata1 - 3);
  const g = grupo(x, 0, 0, world);
  const zv0 = zPata0 - vol, zc = (zv0 + zPata1)/2;
  const pata = zz => {
    box(2.0, alto, 2.0, C.grua, 0, 0, zz, g);
    box(3.4, 0.6, 3.4, C.gruaOsc, 0, 0, zz, g);                  // zapata sobre el carril
    box(0.8, alto*0.55, 0.8, C.gruaOsc, 0, alto*0.3, zz, g, true);
  };
  pata(zPata0); pata(zPata1);
  box(2.6, 1.8, zPata1 - zv0 + 3, C.grua, 0, alto, zc, g);       // viga carril
  box(1.3, 1.3, zPata1 - zPata0, C.grua, 0, alto - 3.2, (zPata0+zPata1)/2, g);
  if (vol){                                                       // torre del voladizo
    box(1.8, 7, 1.8, C.grua, 0, alto + 1.8, zPata1 - 3, g);
    box(1.4, 1.2, 5, C.grua, 0, alto + 7.6, zPata1 - 4.5, g);     // cabeza, sin tirante largo:
  }                                                               // una barra de 50 sobre la viga la ensombrecía entera
  // El carro cuelga BAJO la viga, nunca encima: el haz jamás pasa por arriba del arco.
  const carroY = alto - 0.4;
  const carro = grupo(0, carroY, zReposo, g);
  box(3.0, 1.4, 3.6, C.gruaOsc, 0, -1.4, 0, carro);
  const cables = [];
  [[-1.4,-1.9],[1.4,-1.9],[-1.4,1.9],[1.4,1.9]].forEach(c=>
    cables.push(box(0.14, 4, 0.14, C.gruaOsc, c[0], -5, c[1], carro, true)));
  const bastidor = box(13.5, 0.7, 4.5, C.grua, 0, -7.2, 0, carro);    // bastidor de izaje
  const pinza = hazRiel(0, -6.6, 0, 11, 1, carro, C.acero2);

  const ALTO = 2.2;                                               // cuánto cuelga en viaje
  let t = opc.desfase || 0;
  function poner(z, cuelga, lleva){
    carro.position.z = z;
    bastidor.position.y = -0.7 - cuelga;
    pinza.position.y = -0.1 - cuelga;
    pinza.visible = lleva;
    cables.forEach(c=>{ c.scale.y = cuelga/4; c.position.y = -0.4 - cuelga/2; });
  }
  const suave = u => u*u*(3 - 2*u);
  const cuelgaHasta = y => carroY - 0.1 - y;
  const yTomar = p => (p.base || 0) + (p.plano ? 0 : Math.max(0, p.n - 1)*PASO_PILA);
  const yDejar = p => (p.base || 0) + (p.plano ? 0 : p.n*PASO_PILA);
  const libre  = p => (p && p.restante != null) ? p.restante : Infinity;
  poner(zReposo, ALTO, false);

  // Una grúa puede tener varias tareas (del camión a la pila, de la pila al buque).
  // En cada maniobra toma la primera que se pueda hacer; si ninguna, espera.
  function viable(j){
    const o = j.o(), d = j.d();
    if (!hayDonde(o) || !hayDonde(d)) return false;
    if (o.n <= 0) return false;                                   // no hay qué tomar
    if (d.n >= d.max) return false;                               // no cabe
    // Dos máquinas sobre la misma pila se cruzaban en el aire. La que llega primero
    // la aparta y la otra espera su turno: el relevo se entiende.
    if ((o.toma && o.toma !== yo) || (d.toma && d.toma !== yo)) return false;
    return Math.min(libre(o), libre(d)) > ciclo*1.15;             // le dará tiempo al vehículo
  }
  let faena = null, tomados = [];                                 // lo que esta grúa tiene apartado
  const yo = {};
  return {
    update(dt){
      if (!faena){                                                // entre maniobra y maniobra, decide
        faena = (opc.trabajos || []).find(viable) || null;
        if (!faena){ poner(zReposo, ALTO, false); return; }
        const o0 = faena.o(), d0 = faena.d();
        tomados = [o0, d0].filter(Boolean);                       // se guarda qué apartó,
        tomados.forEach(q=> q.toma = yo);                         // para poder soltarlo luego
        t = 0;
      }
      const o = faena.o(), d = faena.d();
      const bajoO = cuelgaHasta(yTomar(o)), bajoD = cuelgaHasta(yDejar(d));
      const antes = t;
      t += dt/ciclo;
      const paso = u => antes < u && t >= u;
      if (paso(0.18)) o.n--;                                       // ya lo levantó: sale de su pila
      if (paso(0.66)) d.n++;                                       // ya lo soltó: entra en la otra
      const zo = faena.zo, zd = faena.zd;
      if (t >= 1){                                                 // suelta lo que apartó, no lo que haya ahora:
        t = 0; faena = null;                                       // si el buque ya zarpó, su pila quedaba trabada
        tomados.forEach(q=> { if (q.toma === yo) q.toma = null; });
        tomados = [];
        poner(zd, ALTO, false); return;
      }
      if (t < 0.10)      poner(zo, ALTO + (bajoO-ALTO)*(t/0.10), false);
      else if (t < 0.18) poner(zo, bajoO - (bajoO-ALTO)*((t-0.10)/0.08), true);
      else if (t < 0.50) poner(zo + (zd-zo)*suave((t-0.18)/0.32), ALTO, true);
      else if (t < 0.58) poner(zd, ALTO + (bajoD-ALTO)*((t-0.50)/0.08), true);
      else if (t < 0.66) poner(zd, bajoD, true);                   // asentado, antes de soltar
      else if (t < 0.74) poner(zd, bajoD - (bajoD-ALTO)*((t-0.66)/0.08), false);
      else               poner(zd + (zo-zd)*suave((t-0.74)/0.26), ALTO, false);
    },
  };
}

/* ---------- pilas: todo lo que una grúa puede tomar o dejar ---------- */
// Pila fija en el suelo. Es lo que hace que un haz se quede donde lo dejaron.
function pilaMuelle(x, z, max, largo){
  const items = [];
  for (let i=0;i<max;i++){
    const h = hazRiel(x, i*PASO_PILA, z, largo || 11, 2, world);
    h.visible = false;
    items.push(h);
  }
  let n = 0;
  return {
    max, base:0, x, z,
    get n(){ return n; },
    set n(v){ n = Math.max(0, Math.min(max, Math.round(v))); items.forEach((h,i)=> h.visible = i < n); },
  };
}
// Un vehículo parado también es una pila: a la altura de su cama y con sus lugares.
function pilaVehiculo(obj, base, max){
  const cargas = obj.userData.cargas;
  let n = 0;
  const api = {
    max: max || cargas.length, base, restante: 0,
    get n(){ return n; },
    set n(v){ n = Math.max(0, Math.min(api.max, Math.round(v))); cargas.forEach((c,i)=> c.visible = i < n); },
  };
  api.n = 0;
  return api;
}
// Una bahía: el sitio de la carretera o de la vía donde el vehículo se para a que
// lo carguen. Mientras hay alguien, la grúa de al lado tiene con quién trabajar.
function bahia(){ return {pila:false}; }

/* ---------------------------------------------------------------- buques ---- */
function buque(){
  const g = grupo(0,0,0,world);
  const L = 66, A = 13;
  box(L, 3.2, A, C.cascoBajo, 0, -1.6, 0, g);                    // obra viva
  box(L, 3.0, A, C.casco, 0, 1.6, 0, g);                         // obra muerta
  for (let i=0;i<4;i++){                                          // proa en cuatro escalones
    const k = (i+1)/4;
    box(2.8, 3.0, A*(1 - k*0.80), C.casco,     L/2 + 1.4 + i*2.8, 1.6, 0, g);
    box(2.8, 3.2, A*(1 - k*0.80), C.cascoBajo, L/2 + 1.4 + i*2.8, -1.6, 0, g);
  }
  box(L - 1.5, 0.5, A - 2, C.cubierta, 0, 4.6, 0, g);            // cubierta
  box(L - 1.5, 1.4, 0.5, C.casco, 0, 4.6, -A/2 + 1, g, true);    // bordas
  box(L - 1.5, 1.4, 0.5, C.casco, 0, 4.6,  A/2 - 1, g, true);
  const casilla = grupo(-L/2 + 5, 5.1, 0, g);                    // castillo de popa
  box(7.5, 6.4, A - 2.4, C.torre, 0, 0, 0, casilla);
  box(7.8, 1.3, A - 1.8, C.vidrio, 0, 4.0, 0, casilla, true);
  box(6.4, 1.8, A - 4, C.torre, 0, 6.4, 0, casilla);
  cil(1.4, 4.6, C.chimenea, -0.8, 8.2, 0, casilla, 12);
  // Dos columnas de cubierta, cada una bajo su grúa y apilada de tres.
  const columnas = [-22, 22].map(lx=>{
    const col = [];
    for (let k=0;k<3;k++) col.push(hazRiel(lx, 4.6 + k*PASO_PILA, 0, 10.6, 2, g));
    return col;
  });
  g.userData = {cargas: columnas[0].concat(columnas[1]), columnas};
  return g;
}

/* ------------------------------------------------------------------ camión ---- */
function camion(){
  const g = grupo(0,0,0,world);
  box(4.2, 3.2, 3.6, C.camion, 2.6, 1.0, 0, g);                  // tractor
  box(4.0, 1.0, 3.5, C.vidrio, 2.7, 3.3, 0, g, true);
  box(1.0, 1.6, 3.4, C.cobalto, 0.3, 1.0, 0, g);
  box(13.5, 0.9, 3.8, C.caja, -4.2, 1.4, 0, g);                  // plataforma
  box(0.7, 1.6, 3.8, C.caja, -10.7, 2.3, 0, g);
  const cargas = [hazRiel(-4.4, 2.3, 0, 11, 2, g)];
  const rueda = (x,z)=>{ const r = cil(1.0, 0.7, C.llanta, x, 0, z, g, 8);
                         r.rotation.x = Math.PI/2; r.position.y = 1.0; r.castShadow = false; };
  [4.3, -0.8, -7.8, -9.6].forEach(x=>{ rueda(x, -1.75); rueda(x, 1.75); });
  g.userData = {cargas, carga:cargas[0]};
  return g;
}

/* -------------------------------------------------- edificios y relleno ---- */
function naveIndustrial(x, z, w, d, h, dientes){
  const g = grupo(x, 0, z, world);
  box(w + 2.4, 0.5, d + 2.4, C.muelle, 0, 0, 0, g);              // plataforma
  box(w, h, d, C.muro, 0, 0.5, 0, g);
  box(w + 0.3, 2.0, d + 0.3, C.cobalto, 0, 0.5, 0, g);           // zócalo
  box(w + 0.9, 0.9, d + 0.9, C.cobalto, 0, h + 0.5, 0, g);       // cenefa
  if (dientes){
    const paso = d/dientes;
    for (let i=0;i<dientes;i++){
      const zz = -d/2 + paso*(i + 0.5);
      const p = box(w, paso*0.95, 0.35, C.techo, 0, h + 1.4, zz + paso*0.32, g);
      p.rotation.x = -0.76;
      box(w - 1.6, paso*0.6, 0.25, C.vidrio, 0, h + 1.4, zz - paso*0.3, g, true);
    }
  } else {
    box(w + 1.2, 1.2, d + 1.2, C.techo, 0, h + 1.4, 0, g);
  }
  for (let i=0, n=Math.max(2, Math.round(w/11)); i<n; i++)       // portones
    box(0.4, h*0.55, 4.6, C.vidrio, -w/2 + 5 + i*11, 0.5, d/2, g, true);
  return g;
}
function oficina(x, z, w, d, pisos){
  const g = grupo(x, 0, z, world);
  for (let i=0;i<pisos;i++){
    box(w, 3.0, d, C.muro, 0, i*3.6, 0, g);
    box(w + 0.4, 1.2, d + 0.4, C.vidrio, 0, i*3.6 + 1.0, 0, g, true);
  }
  box(w + 1.4, 0.8, d + 1.4, C.cobalto, 0, pisos*3.6, 0, g);
  return g;
}
function tanque(x, z, r, h){
  const g = grupo(x, 0, z, world);
  cil(r, h, C.muro2, 0, 0, 0, g, 16);
  cil(r + 0.4, 0.6, C.gruaOsc, 0, h, 0, g, 16);
  cil(r*0.22, h + 2, C.acero, r + 1.4, 0, 0, g, 8);
  return g;
}
/* ---------- relleno instanciado: cientos de piezas en pocas llamadas ---------- */
const detalles = [];                              // se apagan al mirar todo de lejos
function arbolesEn(puntos){
  if (!puntos.length) return;
  const copa = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), mat('#8fb46e'), puntos.length);
  const tron = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.42, 2.6, 6), mat('#9a7f63'), puntos.length);
  copa.castShadow = tron.castShadow = copa.receiveShadow = true;
  const m = new THREE.Matrix4();
  puntos.forEach((p,i)=>{
    m.makeScale(p.r, p.r*1.2, p.r); m.setPosition(p.x, 2.4 + p.r*0.9, p.z); copa.setMatrixAt(i, m);
    m.makeScale(1,1,1); m.setPosition(p.x, 1.3, p.z); tron.setMatrixAt(i, m);
  });
  world.add(copa); world.add(tron);
  detalles.push(copa, tron);
}
function farolasEn(puntos){
  if (!puntos.length) return;
  const mastil = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.26, 11, 6), mat(C.acero), puntos.length);
  const brazo  = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.34, 3), mat(C.acero), puntos.length);
  mastil.castShadow = true;
  const m = new THREE.Matrix4();
  puntos.forEach((p,i)=>{
    m.makeTranslation(p.x, 5.5, p.z); mastil.setMatrixAt(i, m);
    m.makeTranslation(p.x, 10.8, p.z + (p.lado || 1)*1.5); brazo.setMatrixAt(i, m);
  });
  world.add(mastil); world.add(brazo);
  detalles.push(mastil, brazo);
}
// Patio decorativo: cientos de haces en dos llamadas de dibujo
function patioDecorativo(bultos){
  if (!bultos.length) return;
  const riel = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1), mat(C.acero), bultos.length*3);
  const flej = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1), mat(C.fleje), bultos.length*2);
  riel.castShadow = riel.receiveShadow = flej.castShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const e = new THREE.Vector3(), pos = new THREE.Vector3();
  let i = 0, j = 0;
  bultos.forEach(b=>{
    const h = 0.56*b.alto;
    for (let k=-1;k<=1;k++){
      e.set(b.largo, h, 0.68); pos.set(b.x, h/2, b.z + k*0.78);
      m.compose(pos, q, e); riel.setMatrixAt(i++, m);
    }
    [-1, 1].forEach(k=>{
      e.set(0.55, h*1.14, 2.9); pos.set(b.x + k*(b.largo/2 - 1.2), h*0.57, b.z);
      m.compose(pos, q, e); flej.setMatrixAt(j++, m);
    });
  });
  riel.count = i; flej.count = j;
  world.add(riel); world.add(flej);
}
function faro(x, z){
  const g = grupo(x, 0, z, world);
  cil(2.4, 1.4, C.muelle, 0, 0, 0, g, 12);
  cil(1.6, 11, C.torre, 0, 1.4, 0, g, 12);
  cil(1.7, 1.8, C.chimenea, 0, 7.0, 0, g, 12);
  const luz = cil(1.3, 2.2, C.grua, 0, 12.4, 0, g, 12);
  luz.material = new THREE.MeshStandardMaterial({color:'#fff6d8', emissive:'#ffd166', emissiveIntensity:.8, roughness:.5});
  cil(2.1, 0.5, C.gruaOsc, 0, 14.6, 0, g, 12);
  animadores.push(t=>{ luz.material.emissiveIntensity = 0.3 + Math.abs(Math.sin(t*1.6))*1.1; });
  return g;
}
// Letrero del puerto, junto a su bandera. Gira con la cámara para que siempre se
// lea, que es lo que se espera de un rótulo y no de una pieza de la maqueta.
function letrero(x, z, texto){
  const c = document.createElement('canvas');
  c.width = 1400; c.height = 220;
  const g2 = c.getContext('2d');
  g2.fillStyle = '#ffffff'; g2.fillRect(0, 0, 1400, 220);
  g2.fillStyle = '#2f5be0'; g2.fillRect(0, 0, 1400, 22);              // franja de color arriba
  g2.strokeStyle = '#2f5be0'; g2.lineWidth = 10; g2.strokeRect(5, 5, 1390, 210);
  g2.fillStyle = '#1b2638';
  g2.font = '700 104px "Figtree", "Segoe UI", sans-serif';
  g2.textAlign = 'center'; g2.textBaseline = 'middle';
  g2.fillText(texto, 700, 128);
  const tex = new THREE.CanvasTexture(c);
  const g = grupo(x, 0, z, world);
  cil(0.8, 14, C.acero, -18, 0, 0, g, 8);
  cil(0.8, 14, C.acero,  18, 0, 0, g, 8);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(45, 7.1),
    new THREE.MeshStandardMaterial({map:tex, roughness:.85, side:THREE.DoubleSide}));
  panel.position.y = 17.4;
  panel.castShadow = true;
  g.add(panel);
  animadores.push(()=>{ g.rotation.y = vista.az; });   // siempre de frente
  return g;
}
function banderaEn(x, z, cual){
  const g = grupo(x, 0, z, world);
  cil(0.34, 20, C.torre, 0, 0, 0, g, 10);
  const tela = new THREE.Mesh(new THREE.PlaneGeometry(7, 4.6),
    new THREE.MeshStandardMaterial({map:texBandera(cual), roughness:.9, side:THREE.DoubleSide}));
  tela.position.set(3.7, 17.4, 0);
  tela.castShadow = true;
  g.add(tela);
  animadores.push(t=>{ tela.rotation.y = Math.sin(t*1.5)*0.16; tela.position.z = Math.sin(t*1.5)*0.5; });
  return g;
}

/* ============================================================================
   ARMADO DE LA MAQUETA
   El predio es grande y la cámara se mueve por él. Las franjas de profundidad van
   en este orden, y el orden importa: desde esta cámara lo que tiene más Z queda
   en primer plano y esconde una franja por detrás de vez y media su altura. Por
   eso las naves van al frente del predio y detrás de ellas solo queda el
   estacionamiento, que no estorba perder.
       mar  <  muelle 0–28  <  patios 34–50  <  carretera 56  <  (franja ciega)  <  naves 78–92
   ============================================================================ */
const pilas = {};        // los patios que cambian con el dato
const gruas = [];        // todas las grúas; se actualizan juntas
const muelles = {};      // las pilas con las que trabajan
let buques = [], camiones = [], vapor = [];

let _s = 20250101;       // azar fijo: la maqueta se ve igual cada vez que se abre
const rnd = ()=>{ _s = (_s*1103515245 + 12345) % 2147483648; return _s/2147483648; };
const lerp = (a,b,u)=> a + (b-a)*u;
const suaveU = u => u*u*(3 - 2*u);



function construir(){
  world = new THREE.Group();
  scene.add(world);

  /* ---------- mar y tierra ---------- */
  const texA = texAgua();
  const AX0 = X_INI - MARGEN, AX1 = X_FIN + MARGEN;
  const AZ0 = Z_FONDO - MARGEN, AZ1 = Z_FRENTE + MARGEN;
  const agua = new THREE.Mesh(new THREE.PlaneGeometry(AX1 - AX0, AZ1 - AZ0),
    new THREE.MeshStandardMaterial({map:texA, color:'#ffffff', roughness:.16, metalness:.05}));
  agua.rotation.x = -Math.PI/2;
  agua.position.set((AX0 + AX1)/2, NIVEL_MAR, (AZ0 + AZ1)/2);
  agua.receiveShadow = true;
  world.add(agua);
  animadores.push(t=>{ texA.offset.x = t*0.004; texA.offset.y = Math.sin(t*0.08)*0.01; });

  // La costa se corta en el estrecho; hacia los lados y tierra adentro sigue, para
  // que el encuadre nunca llegue al borde del terreno.
  const ZT = Z_FRENTE + MARGEN;
  const tierra = (x0,x1)=>{
    box(x1-x0, 4, ZT + 4, C.tierra, (x0+x1)/2, -4, (ZT - 4)/2);
    placa(x0, x1, 0, ZT, 0.002, C.pasto);
    placa(x0, x1, Z_FRENTE + 30, ZT, 0.006, C.pasto2);          // el campo, pasado el predio
    box(x1-x0, 0.5, 3.2, C.muelle, (x0+x1)/2, 0, 1.6);
    for (let x=x0+10; x<x1-5; x+=18) cil(0.6, 1.4, C.gruaOsc, x, 0.5, 0.9);
  };
  tierra(X_INI - MARGEN, MAR0);
  tierra(MAR1, X_FIN + MARGEN);

  const pavimento = (x0,x1)=> placa(x0, x1, 2.6, VIAL_Z + 8, 0.014, C.piso);
  pavimento(SITIO.planta.x0 - 10, SITIO.planta.x1 + 10);
  pavimento(SITIO.origen.x0 - 10, MAR0);
  pavimento(MAR1, SITIO.descarga.x1 + 10);
  pavimento(SITIO.acopio.x0 - 12, SITIO.acopio.x1 + 12);

  carretera(X_INI + 8, MAR0 - 5, CAMINO_Z, 26, world);
  carretera(MAR1 + 5, X_FIN - 8, CAMINO_Z, 26, world);

  planta();
  muelleCompleto(SITIO.origen, 'origen', 'cn');
  travesia();
  muelleCompleto(SITIO.descarga, 'destino', 'mx');
  acopio();
  vialidades();
  [SITIO.planta, SITIO.origen, SITIO.descarga, SITIO.acopio].forEach(S=>{
    // En franjas que ninguna nave esconde y que ningún acceso cruza.
    estacionamiento(S.x0 + 18, 104, 1, 13);
    estacionamiento(S.x0 + 26, 150, 2, 10);
    estacionamiento(S.x0 + 96, 150, 2, 6);
  });
  relleno();

  camionesDeRuta();
  flota();

  animadores.push(t=>{                                            // humo de las chimeneas
    vapor.forEach(v=>{
      const u = (t*0.14 + v.k*0.2 + v.i*0.1) % 1;
      v.m.position.set(v.cx + u*5, v.y + u*22, v.z - u*3);
      v.m.material.opacity = 0.3*(1 - u);
      v.m.scale.setScalar(0.6 + u*1.6);
    });
  });
  animadores.push((t, dt)=> gruas.forEach(g=> g.update(dt)));
}

/* ---------- rejillas de bultos para los patios de fondo ---------- */
function rejilla(x0, z0, cols, filas, pasoX, pasoZ){
  const out = [];
  for (let f=0; f<filas; f++)
    for (let c=0; c<cols; c++)
      out.push({x:x0 + c*pasoX + 5.5, z:z0 + f*pasoZ, largo:11, alto:2 + ((c + f) % 3)});
  return out;
}
function chimenea(x, z, h){
  cil(2.2, h, C.muro2, x, 0, z, world, 16);
  cil(2.5, 2.2, C.chimenea, x, h - 0.4, z, world, 16);
  for (let k=0;k<5;k++){
    const s = new THREE.Mesh(new THREE.SphereGeometry(2.4 + k*0.8, 10, 8),
      new THREE.MeshStandardMaterial({color:'#ffffff', roughness:1, transparent:true, opacity:.3, depthWrite:false}));
    world.add(s);
    vapor.push({m:s, cx:x, z, y:h + 1.5, k, i:(x|0) % 3});
  }
}

/* =================== 1 · PLANTA SIDERÚRGICA =================== */
function planta(){
  const P = SITIO.planta;
  // La nave va al fondo del predio, contra el mar: desde esta cámara esconde una
  // franja por detrás, y por detrás solo hay agua. Todo lo demás queda delante.
  naveIndustrial(P.x0 + 30, 24, 54, 26, 13, 5);                   // tren de laminación
  naveIndustrial(P.x0 + 134, 24, 50, 26, 12, 4);                  // acabado
  oficina(P.x0 + 172, 24, 16, 14, 3);
  chimenea(P.x0 + 2, 26, 32);
  chimenea(P.x0 + 76, 26, 32);
  tanque(P.x0 + 108, 24, 6, 13);
  tanque(P.x0 + 121, 24, 6, 13);

  // Salida del laminador: el riel al rojo, por delante de la nave.
  const vivo = box(30, 0.6, 1.8, C.rielVivo, P.x0 + 50, 5.6, 46, world, true);
  vivo.material = new THREE.MeshStandardMaterial({color:C.rielVivo, emissive:'#ff5a1f', emissiveIntensity:.5, roughness:.5});
  animadores.push(t=>{ vivo.material.emissiveIntensity = 0.3 + Math.abs(Math.sin(t*1.4))*0.45; });
  for (let i=0;i<4;i++) box(1.0, 6.4, 1.0, C.muro2, P.x0 + 38 + i*9, 0, 44, world);
  box(32, 1.4, 5, C.cobalto, P.x0 + 50, 6.4, 44, world);

  // Dos carriles de carga, cada uno con su grúa, su pila y su bahía: así los
  // camiones de las dos rutas no se estorban y se ve quién sube el riel a cuál.
  muelles.plantaX = [P.x0 + 104, P.x0 + 144];
  muelles.plantaBahias = [bahia(), bahia()];
  muelles.planta = pilaMuelle(P.x0 + 72, 38, 10);
  muelles.planta.n = 6;
  animadores.push((t, dt)=>{
    const q = muelles.planta;
    q._c = (q._c || 0) + dt;
    if (q._c > 20){ q._c = 0; q.n++; }
  });
  // una pila por carril, surtida desde la del laminador
  const pilasCarril = muelles.plantaX.map(x=> pilaMuelle(x, 38, 5));
  pilasCarril.forEach(q=> q.n = 3);
  muelles.plantaX.forEach((x, i)=>{
    gruas.push(gruaPortico(x, 32, 60, 14, {
      desfase: 0.2 + i*0.5, ciclo: CICLO_CARGA, reposo: 38,
      trabajos: [ {zo:38, zd:BAHIA_PLANTA, o:()=> pilasCarril[i], d:()=> muelles.plantaBahias[i].pila} ],
    }));
    // el carril se repone solo desde la pila del laminador, por banda
    animadores.push((t, dt)=>{
      const q = pilasCarril[i];
      q._c = (q._c || 0) + dt;
      if (q._c > 16 && q.n < q.max && muelles.planta.n > 0){ q._c = 0; q.n++; muelles.planta.n--; }
    });
  });

  pilas.produccion = grupo(P.x0 + 10, 0, 78, world);              // patio del dato
  patioDecorativo(rejilla(P.x0 + 12, 94, 6, 1, 15.5, 10));        // patio de fondo
  ACCESO.planta = {e:P.x0 + 122, s:P.x0 + 150};
}

/* =================== 2 y 4 · LOS DOS MUELLES =================== */
// Dos carriles autónomos por puerto: cada grúa tiene su pila, su bahía de camión
// y su columna de cubierta, así ninguna depende de otra ni se estorban.
function muelleCompleto(S, lado, bandera){
  const esOrigen = lado === 'origen';
  const gx = [S.x0 + 60, S.x0 + 104];
  muelles[lado] = [];
  muelles[lado + 'Bahias'] = [];
  muelles[lado + 'X'] = gx;
  gx.forEach((x, i)=>{
    // La pila del patio es el punto de encuentro: el pórtico del muelle la usa por
    // el lado del agua y la grúa de patio por el lado de tierra. Son dos máquinas
    // distintas, una no toca nunca el camión y la otra no toca nunca el buque.
    const pila = pilaMuelle(x, PILA_MUELLE, 5);
    pila.n = esOrigen ? 3 : 0;
    const bah = bahia();
    muelles[lado].push(pila);
    muelles[lado + 'Bahias'].push(bah);
    const cubierta = ()=>{
      const b = buques.find(b=> b.userData.puerto === lado);
      return b ? b.userData.pilas[i] : false;
    };
    // Pórtico de muelle: patas muy abiertas, y la grúa de patio le cabe debajo.
    gruas.push(gruaPortico(x, PATA_Z0, PATA_Z1, 25, {
      vol: 34, desfase: i*0.5, reposo: PILA_MUELLE,
      trabajos: esOrigen
        ? [ {zo:PILA_MUELLE, zd:-9, o:()=> pila, d:cubierta} ]      // de la pila al buque
        : [ {zo:-9, zd:PILA_MUELLE, o:cubierta, d:()=> pila} ],     // o del buque a la pila
    }));
    // Grúa de patio: solo atiende camiones, anidada bajo el pórtico.
    gruas.push(gruaPortico(x, PATA_Z0 + 20, PATA_Z1 - 4, 14, {
      desfase: 0.3 + i*0.5, reposo: PILA_MUELLE, ciclo: CICLO_CARGA,
      trabajos: esOrigen
        ? [ {zo:BAHIA_MUELLE, zd:PILA_MUELLE, o:()=> bah.pila, d:()=> pila} ]
        : [ {zo:PILA_MUELLE, zd:BAHIA_MUELLE, o:()=> pila, d:()=> bah.pila} ],
    }));
  });
  // Los patios, dentro del recinto y antes de la carretera: el riel descargado se
  // queda en el patio, no a pie de calle.
  pilas[esOrigen ? 'puerto' : 'descarga'] = grupo(S.x0 + 14, 0, 80, world);
  patioDecorativo(rejilla(S.x0 + 12, 96, 7, 1, 15.5, 10));
  ACCESO[esOrigen ? 'origen' : 'destino'] = {e:S.x0 + 132, s:S.x0 + 156};
  naveIndustrial(S.x0 + 40, 180, 54, 26, 12, 0);                 // naves, pasada la carretera
  naveIndustrial(S.x0 + 124, 180, 46, 26, 11, 0);
  oficina(S.x0 + 14, 180, 16, 14, 3);
  // Bandera y letrero, juntos y en el hueco que dejan los pórticos: con el letrero
  // a 45 de ancho, una pata se le atravesaba por delante y tapaba el texto.
  banderaEn(esOrigen ? MAR0 - 5 : MAR1 + 5, 40, bandera);
  letrero(esOrigen ? MAR0 - 33 : MAR1 + 33, 40,
          esOrigen ? 'Zhangjiagang, P. R. China' : 'Tamaulipas, Altamira');
  faro(esOrigen ? MAR0 - 11 : MAR1 + 11, 8);
}

/* =================== 3 · TRAVESÍA =================== */
function travesia(){
  for (let i=0;i<7;i++){
    const x = MAR0 + 30 + i*((MAR1 - MAR0 - 60)/6);
    const b = cil(1.1, 4, i%2 ? '#1f9a63' : C.chimenea, x, -3.6, -120, world, 10);
    animadores.push(t=>{ b.rotation.z = Math.sin(t*1.1 + i)*0.12; b.position.y = -1.6 + Math.sin(t*1.3 + i)*0.2; });
  }
}

/* =================== 5 · CENTRO DE ACOPIO =================== */
function acopio(){
  const A = SITIO.acopio;
  naveIndustrial(A.x0 + 50, 24, 58, 26, 13, 0);                   // al fondo, contra el mar
  naveIndustrial(A.x0 + 142, 24, 44, 26, 11, 0);
  oficina(A.x0 + 182, 24, 15, 13, 2);
  naveIndustrial(A.x0 + 70, 180, 60, 26, 12, 0);                  // y una hilera pasada la carretera
  pilas.acopio = grupo(A.x0 + 12, 0, 80, world);
  patioDecorativo(rejilla(A.x0 + 14, 96, 7, 1, 15.5, 10));

  // Dos carriles de descarga, uno por ruta, y el patio detrás.
  muelles.acopioX = [A.x0 + 60, A.x0 + 104];
  muelles.acopioBahias = [bahia(), bahia()];
  muelles.salidaBahia = bahia();
  const fondo = pilaMuelle(A.x0 + 82, 30, 10);
  muelles.acopio = pilaMuelle(A.x0 + 82, 44, 6);
  muelles.acopio.n = 2;
  muelles.acopioX.forEach((x, i)=>{
    const q = pilaMuelle(x, 40, 5);
    gruas.push(gruaPortico(x, 34, 62, 14, {
      desfase: 0.15 + i*0.5, reposo: 40, ciclo: CICLO_CARGA,
      trabajos: [ {zo:BAHIA_ACOPIO, zd:40, o:()=> muelles.acopioBahias[i].pila, d:()=> q} ],
    }));
    // del carril al patio general, por banda
    animadores.push((t, dt)=>{
      q._c = (q._c || 0) + dt;
      if (q._c > 14 && q.n > 0 && muelles.acopio.n < muelles.acopio.max){ q._c = 0; q.n--; muelles.acopio.n++; }
    });
  });
  gruas.push(gruaPortico(A.x0 + 82, 10, 50, 16, {
    desfase: 0.6, reposo: 44, ciclo: CICLO_CARGA,
    trabajos: [
      {zo:44, zd:30, o:()=> muelles.acopio, d:()=> fondo},                               // de la pila al patio
      {zo:30, zd:BAHIA_SALIDA, o:()=> fondo, d:()=> muelles.salidaBahia.pila},           // y del patio a la obra
    ],
  }));
  ACCESO.acopio = {e:A.x0 + 146, s:A.x0 + 172};
}

/* ---------- estacionamiento: lo que llena el frente del predio ---------- */
// Filas de unidades paradas junto a las oficinas. Son piezas instanciadas, de
// modo que llenar el terreno no cuesta llamadas de dibujo.
function estacionamiento(x0, z0, filas, porFila){
  const puntos = [];
  for (let f=0; f<filas; f++)
    for (let i=0; i<porFila; i++)
      puntos.push({x:x0 + i*5.2, z:z0 + f*12});
  if (!puntos.length) return;
  const caja = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 2.2, 5.6), mat(C.caja), puntos.length);
  const techo = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 0.9, 2.6), mat(C.vidrio), puntos.length);
  caja.castShadow = caja.receiveShadow = true;
  const m = new THREE.Matrix4();
  puntos.forEach((p,i)=>{
    m.makeTranslation(p.x, 1.1, p.z); caja.setMatrixAt(i, m);
    m.makeTranslation(p.x, 2.7, p.z - 0.4); techo.setMatrixAt(i, m);
  });
  world.add(caja); world.add(techo);
  detalles.push(caja, techo);
  placa(x0 - 4, x0 + porFila*5.2, z0 - 7, z0 + (filas-1)*12 + 7, 0.016, C.piso);
}

/* ---------- vialidad de cada recinto ---------- */
// Sin esto el camión cruzaba el predio campo a través, por encima de los patios y
// entre los postes. Ahora hay calle interna y un acceso a la carretera.
function vialidades(){
  const tramos = [
    {s:SITIO.planta,   a:ACCESO.planta},
    {s:SITIO.origen,   a:ACCESO.origen},
    {s:SITIO.descarga, a:ACCESO.destino},
    {s:SITIO.acopio,   a:ACCESO.acopio},
  ];
  tramos.forEach(t=>{
    carretera(t.s.x0 + 6, Math.min(t.s.x1 - 6, t.a.s + 14), VIAL_Z, 10, world);
    [t.a.e, t.a.s].forEach(x=>{                                            // uno de entrada y otro de salida
      placa(x - 5.5, x + 5.5, VIAL_Z, CAMINO_Z + 2, 0.02, C.asfalto);
      for (let z = VIAL_Z + 12; z < CAMINO_Z - 8; z += 14){
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 5), mat(C.raya, {roughness:.7}));
        m.rotation.x = -Math.PI/2; m.position.set(x, 0.05, z);
        world.add(m);
      }
    });
  });
}

/* ---------- arbolado, farolas ---------- */
function relleno(){
  const arboles = [], faroles = [];
  [[X_INI + 12, MAR0 - 12], [MAR1 + 12, X_FIN - 12]].forEach(b=>{
    for (let x=b[0]; x<b[1]; x+=9){
      // La carretera ocupa de 115 a 141 y las naves de 167 a 193: el arbolado va
      // en la franja libre de en medio, nunca sobre el camino.
      if (rnd() < 0.45) arboles.push({x:x + rnd()*7, z:Z_FRENTE - 2, r:2 + rnd()*1.6});
    }
    const accesos = Object.keys(ACCESO).reduce((a,k)=> a.concat([ACCESO[k].e, ACCESO[k].s]), []);
    for (let x=b[0]; x<b[1]; x+=30){
      if (accesos.some(a=> Math.abs(a - x) < 14)) continue;      // no en mitad del acceso
      faroles.push({x, z:CAMINO_Z - 14, lado:1});
      faroles.push({x, z:CAMINO_Z + 14, lado:-1});
    }
  });
  // En los claros entre recintos no hay nada construido: ahí el monte es tupido.
  const claros = [[X_INI + 10, SITIO.planta.x0 - 14], [SITIO.planta.x1 + 14, SITIO.origen.x0 - 14],
                  [SITIO.descarga.x1 + 14, SITIO.acopio.x0 - 14], [SITIO.acopio.x1 + 14, X_FIN - 10]];
  claros.forEach(c=>{
    for (let x=c[0]; x<c[1]; x+=8){
      for (let k=0;k<3;k++){
        if (rnd() > 0.5) continue;
        // la carretera cruza también los claros: el monte le deja su franja libre
        const z = rnd() < 0.3 ? 98 + rnd()*12 : 146 + rnd()*46;
        arboles.push({x:x + rnd()*7, z, r:1.8 + rnd()*2});
      }
    }
  });
  arbolesEn(arboles);
  farolasEn(faroles);
}

/* ---------- buques ---------- */
// El buque tampoco zarpa por reloj: espera atracado hasta que las grúas acaban de
// cargarlo, cruza, y no se va del otro muelle hasta quedar vacío. Así llega siempre
// con el riel a la vista y nada aparece de golpe. El rumbo sale del camino, de modo
// que no se va de costado al salir.
const CALADO = -1.6;                               // cuánto se hunde el casco
const PACIENCIA = 150;                             // si el muelle no surte, zarpa con lo que haya
const VEL_BUQUE = 7;                               // unidades por segundo

function flota(){
  const AMARRE = -9, FUERA = -52, IDA = -96, VUELTA = -152;
  const xO = SITIO.origen.x0 + 82, xD = SITIO.descarga.x0 + 82;
  const b = buque();
  buques = [b];
  b.userData.pilas = b.userData.columnas.map(col=> pilaVehiculo({userData:{cargas:col}}, 4.6 + CALADO, 3));
  // Los tres tramos del circuito, con sus curvas: el rumbo los sigue.
  // Sale y entra casi de costado, que es como se desatraca con remolcadores; el giro
  // viene después, ya fuera. Si girara pegado al muelle, con 66 de eslora la popa
  // barrería sobre el malecón.
  const rutas = {
    cruce:   camino([ {x:xO, z:AMARRE}, {x:xO + 34, z:FUERA}, {x:xD - 130, z:IDA},
                      {x:xD - 34, z:FUERA}, {x:xD, z:AMARRE} ], 60),
    regreso: camino([ {x:xD, z:AMARRE}, {x:xD + 34, z:FUERA}, {x:xD + 140, z:VUELTA},
                      {x:xO - 160, z:VUELTA}, {x:xO - 34, z:FUERA}, {x:xO, z:AMARRE} ], 70),
  };
  const PARALELO = -38;                            // mientras esté más cerca que esto, proa al muelle
  const u = b.userData;
  u.estado = 'cargando'; u.u = 0; u.espera = 0; u.ang = 0;
  b.position.set(xO, CALADO, AMARRE);

  const lleno = ()=> u.pilas.every(p=> p.n >= p.max);
  const vacio = ()=> u.pilas.every(p=> p.n === 0);

  animadores.push((t, dt)=>{
    u.espera += dt;
    let p = null;
    switch (u.estado){
      case 'cargando':                             // atracado en origen, esperando carga
        u.puerto = 'origen'; u.restante = Infinity;
        p = {x:xO, z:AMARRE, ang:0};
        if ((lleno() || (u.espera > PACIENCIA && !vacio())) && u.espera > 12){
          u.estado = 'cruzando'; u.u = 0; u.espera = 0; u.puerto = null;
        }
        break;
      case 'cruzando':
        u.puerto = null; u.restante = 0;
        u.u += dt*VEL_BUQUE/rutas.cruce.total;
        p = rutas.cruce.en(u.u);
        if (u.u >= 1){ u.u = 1; u.estado = 'descargando'; u.espera = 0; }
        break;
      case 'descargando':                          // atracado en destino, hasta quedar vacío
        u.puerto = 'destino'; u.restante = Infinity;
        p = {x:xD, z:AMARRE, ang:0};
        if (vacio() && u.espera > 12){
          u.estado = 'regresando'; u.u = 0; u.espera = 0; u.puerto = null;
        }
        break;
      default:                                     // regresando en vacío
        u.puerto = null; u.restante = 0;
        u.u += dt*VEL_BUQUE/rutas.regreso.total;
        p = rutas.regreso.en(u.u);
        if (u.u >= 1){ u.u = 1; u.estado = 'cargando'; u.espera = 0; }
    }
    b.position.set(p.x, CALADO + Math.sin(t*0.6)*0.16, p.z);
    // Junto al muelle se mantiene paralelo; mar adentro ya sigue su rumbo.
    const meta = p.z > PARALELO ? 0 : p.ang;
    u.ang = haciaAngulo(u.ang, meta, dt*1.1);      // un buque gira despacio
    b.rotation.y = u.ang;
    b.rotation.z = Math.sin(t*0.7)*0.01;
    u.pilas.forEach(q=> q.restante = u.restante);
  });

  // Un segundo buque, de paso: da vida al estrecho y no ocupa muelle.
  const paso = buque();
  paso.userData.pilas = [];
  paso.userData.columnas.forEach(col=> col.forEach(h=> h.visible = true));
  const vuelta = camino([ {x:MAR0 - 40, z:-176}, {x:MAR1 + 40, z:-176},
                          {x:MAR1 + 90, z:-196}, {x:MAR0 - 90, z:-196},
                          {x:MAR0 - 40, z:-176} ], 70);
  let w = 0, aw = 0;
  animadores.push((t, dt)=>{
    w = (w + dt*VEL_BUQUE*0.8/vuelta.total) % 1;
    const q = vuelta.en(w);
    paso.position.set(q.x, CALADO + Math.sin(t*0.5)*0.16, q.z);
    aw = haciaAngulo(aw, q.ang, dt*1.1);
    paso.rotation.y = aw;
  });
}

/* ---------- camiones ---------- */
// Un camión no entra de lado a la bahía: sigue un camino con sus vueltas y mira
// siempre hacia donde avanza. Y no sale por reloj: se queda en la bahía hasta que
// la grúa lo atiende, así ninguno llega vacío al puerto ni se va con carga.
function camino(pts, r){
  pts = redondear(pts, r || 11);
  const seg = [], acc = [0];
  for (let i=1;i<pts.length;i++){
    const d = Math.hypot(pts[i].x - pts[i-1].x, pts[i].z - pts[i-1].z);
    seg.push(d); acc.push(acc[i-1] + d);
  }
  const total = acc[acc.length-1] || 1;
  return {
    total,
    en(u){
      const s = Math.max(0, Math.min(total, u*total));
      let i = 1;
      while (i < acc.length - 1 && acc[i] < s) i++;
      const t = (s - acc[i-1])/(seg[i-1] || 1);
      const a = pts[i-1], b = pts[i];
      return {x:a.x + (b.x - a.x)*t, z:a.z + (b.z - a.z)*t,
              ang:Math.atan2(-(b.z - a.z), b.x - a.x)};
    },
  };
}
// Las vueltas en escuadra no existen: se redondean con un arco corto, y así el
// rumbo cambia poco a poco en vez de saltar.
function redondear(pts, r){
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i=1;i<pts.length-1;i++){
    const a = pts[i-1], b = pts[i], c = pts[i+1];
    const d1 = Math.hypot(b.x-a.x, b.z-a.z) || 1, d2 = Math.hypot(c.x-b.x, c.z-b.z) || 1;
    const t1 = Math.min(r, d1*0.45)/d1, t2 = Math.min(r, d2*0.45)/d2;
    const p1 = {x:b.x + (a.x-b.x)*t1, z:b.z + (a.z-b.z)*t1};
    const p2 = {x:b.x + (c.x-b.x)*t2, z:b.z + (c.z-b.z)*t2};
    out.push(p1);
    for (let k=1;k<4;k++){
      const u = k/4, m = (1-u)*(1-u), n = 2*(1-u)*u, o = u*u;
      out.push({x:m*p1.x + n*b.x + o*p2.x, z:m*p1.z + n*b.z + o*p2.z});
    }
    out.push(p2);
  }
  out.push(pts[pts.length-1]);
  return out;
}
function haciaAngulo(actual, meta, k){
  let d = meta - actual;
  while (d >  Math.PI) d -= 2*Math.PI;
  while (d < -Math.PI) d += 2*Math.PI;
  return actual + d*Math.min(1, k);
}

const VEL_CAMION = 13;                             // unidades por segundo
const ESPERA_MIN = 3;                              // lo que tarda en maniobrar y arrancar

function camionesDeRuta(){
  const CARRIL_IDA = CAMINO_Z - 4, CARRIL_VUELTA = CAMINO_Z + 4;
  const BORDE_IDA = CAMINO_Z - 11, BORDE_VUELTA = CAMINO_Z + 11;
  // Cada bahía tiene su propio acceso, desplazado según el carril que le toca: si
  // los dos entraran por el mismo sitio, un camión le pasaría por encima al que
  // ya está cargando.
  // De la bahía sale a la vialidad interna del recinto, de ahí al acceso, y del
  // acceso a la carretera. Antes cortaba campo a través por encima de los patios.
  const hacerRuta = (xA, zA, aA, xB, zB, aB, i)=>{
    const dA = xA + 13 + i*9, dB = xB - 13 - i*9;                // cada bahía, su ramal
    return {
      bA:null, bB:null,                                          // los pone quien arma la ruta
      ida: camino([ {x:xA + OFS_CAMION, z:zA}, {x:dA, z:zA}, {x:dA, z:VIAL_Z},
                    {x:aA.s, z:VIAL_Z}, {x:aA.s, z:CARRIL_IDA},
                    {x:aB.e, z:CARRIL_IDA}, {x:aB.e, z:VIAL_Z},
                    {x:dB, z:VIAL_Z}, {x:dB, z:zB}, {x:xB + OFS_CAMION, z:zB} ]),
      vuelta: camino([ {x:xB + OFS_CAMION, z:zB}, {x:dB, z:zB}, {x:dB, z:VIAL_Z},
                       {x:aB.s, z:VIAL_Z}, {x:aB.s, z:CARRIL_VUELTA},
                       {x:aA.e, z:CARRIL_VUELTA}, {x:aA.e, z:VIAL_Z},
                       {x:dA, z:VIAL_Z}, {x:dA, z:zA}, {x:xA + OFS_CAMION, z:zA} ]),
    };
  };

  const O = SITIO.origen, D = SITIO.descarga, A = SITIO.acopio, P = SITIO.planta;
  const rutas = [];
  // Fabricación → muelle de origen. Un camión por cada carril del muelle.
  muelles.origenBahias.forEach((b, i)=>{
    const r = hacerRuta(muelles.plantaX[i], BAHIA_PLANTA, ACCESO.planta,
                        muelles.origenX[i], BAHIA_MUELLE, ACCESO.origen, i);
    r.bA = ()=> muelles.plantaBahias[i];
    r.bB = ()=> b;
    rutas.push(r);
  });
  // Muelle de descarga → centro de acopio.
  muelles.destinoBahias.forEach((b, i)=>{
    const r = hacerRuta(muelles.destinoX[i], BAHIA_MUELLE, ACCESO.destino,
                        muelles.acopioX[i], BAHIA_ACOPIO, ACCESO.acopio, i);
    r.bA = ()=> b;
    r.bB = ()=> muelles.acopioBahias[i];
    rutas.push(r);
  });

  rutas.forEach((r, i)=>{
    const c = camion();
    c.userData.r = r;
    c.userData.pila = pilaVehiculo(c, 2.3, 1);
    c.userData.estado = 'cargando';
    c.userData.u = 0; c.userData.espera = 0; c.userData.ang = 0;
    camiones.push(c);
  });

  // Salida a la obra: el riel que llega al acopio tiene que irse a algún lado, o
  // el patio se llena y la cadena entera se traba.
  const salida = {
    bA: ()=> muelles.salidaBahia,
    bB: ()=> null,
    ida: camino([ {x:A.x0 + 76 + OFS_CAMION, z:BAHIA_SALIDA}, {x:A.x0 + 108, z:BAHIA_SALIDA},
                  {x:A.x0 + 108, z:VIAL_Z}, {x:ACCESO.acopio.s, z:VIAL_Z},
                  {x:ACCESO.acopio.s, z:BORDE_IDA}, {x:X_FIN + 40, z:BORDE_IDA} ]),
    vuelta: camino([ {x:X_FIN + 40, z:BORDE_VUELTA}, {x:ACCESO.acopio.e, z:BORDE_VUELTA},
                     {x:ACCESO.acopio.e, z:VIAL_Z}, {x:A.x0 + 44, z:VIAL_Z},
                     {x:A.x0 + 44, z:BAHIA_SALIDA}, {x:A.x0 + 76 + OFS_CAMION, z:BAHIA_SALIDA} ]),
    esSalida: true,
  };
  const cs = camion();
  cs.userData.r = salida;
  cs.userData.pila = pilaVehiculo(cs, 2.3, 1);
  cs.userData.estado = 'cargando';
  cs.userData.u = 0; cs.userData.espera = 0; cs.userData.ang = 0;
  camiones.push(cs);

  animadores.push((t, dt)=>{
    camiones.forEach(c=>{
      const u = c.userData;
      const r = u.r;
      const bA = r.bA(), bB = r.bB ? r.bB() : null;
      u.espera += dt;
      // Dos camiones que salen a la vez y van igual de rápido por el mismo carril
      // se enciman. Cada uno mira si tiene otro delante y, si lo tiene, no avanza.
      const fx = Math.cos(u.ang), fz = -Math.sin(u.ang);
      const libre = !camiones.some(o=>{
        if (o === c || !o.visible) return false;
        const dx = o.position.x - c.position.x, dz = o.position.z - c.position.z;
        if (dx*dx + dz*dz > 26*26) return false;
        return (dx*fx + dz*fz) > 3;                 // lo tiene por delante, no al lado
      });
      let p;
      switch (u.estado){
        case 'cargando':                             // parado, hasta que la grúa lo cargue
          if (bA) bA.pila = u.pila;
          u.pila.restante = Infinity;                // espera lo que haga falta
          p = r.ida.en(0);
          if (u.pila.n > 0 && u.espera > ESPERA_MIN){
            if (bA) bA.pila = false;
            u.estado = 'yendo'; u.u = 0; u.espera = 0;
          }
          break;
        case 'yendo':
          if (libre) u.u += dt*VEL_CAMION/r.ida.total;
          p = r.ida.en(u.u);
          if (u.u >= 1){
            u.u = 1;
            if (r.esSalida){ u.pila.n = 0; u.estado = 'volviendo'; u.u = 0; }
            else { u.estado = 'descargando'; }
            u.espera = 0;
          }
          break;
        case 'descargando':                          // parado, hasta que lo vacíen
          if (bB) bB.pila = u.pila;
          u.pila.restante = Infinity;
          p = r.vuelta.en(0);
          if (u.pila.n === 0 && u.espera > ESPERA_MIN){
            if (bB) bB.pila = false;
            u.estado = 'volviendo'; u.u = 0; u.espera = 0;
          }
          break;
        default:                                     // volviendo
          if (libre) u.u += dt*VEL_CAMION/r.vuelta.total;
          p = r.vuelta.en(u.u);
          if (u.u >= 1){ u.u = 1; u.estado = 'cargando'; u.espera = 0; }
      }
      c.position.set(p.x, 0, p.z);
      u.ang = haciaAngulo(u.ang, p.ang, dt*3.5);
      c.rotation.y = u.ang;
      c.visible = p.x < X_FIN + 12;                  // al salir del predio, se va
    });
  });
}

/* ============================================================================
   LOS DATOS SOBRE LA MAQUETA — los patios de riel crecen con el tonelaje
   ============================================================================ */
const LARGO_HAZ = 11, PASO_X = 15.5, PASO_Z = 7;
const FORMA = {   // cuántas filas y cuántos haces por fila caben en cada patio
  produccion: {f:2, p:6},
  puerto:     {f:1, p:6},
  descarga:   {f:1, p:6},
  acopio:     {f:2, p:8},
};
const TOPE = 42000;                                 // tonelaje con el que un patio se llena

function pintarPatios(){
  const d = datos(FASE, SEG);
  Object.keys(FORMA).forEach(k=>{
    const g = pilas[k];
    if (!g) return;
    while (g.children.length) g.remove(g.children[0]);
    const v = d[k];
    if (typeof v !== 'number' || v <= 0) return;     // «—»: la estación queda vacía, como en el plano
    const F = FORMA[k], cupo = F.f*F.p;
    const haces = Math.max(1, Math.min(cupo, Math.round(v/TOPE*cupo)));
    let hecho = 0;
    for (let f=0; f<F.f && hecho<haces; f++)
      for (let i=0; i<F.p && hecho<haces; i++, hecho++){
        const n = 2 + ((f + i) % 3);                 // altura de pila variada, para que no parezca molde
        hazRiel(i*PASO_X + LARGO_HAZ/2, 0, f*PASO_Z, LARGO_HAZ, n, g);
      }
  });
}

/* ============================================================================
   CÁMARA — ortográfica, tres cuartos. El eje de la cadena queda casi horizontal
   (az ≈ 30°) para que se lea de izquierda a derecha como el modelo plano.
   ============================================================================ */
const EL = 0.6155;
// AZ_BASE pequeño a propósito: la cadena es muy larga, y cuanto más gira, más alto
// se proyecta en pantalla y más chica queda. A 22° todavía se ven los costados.
const AZ_BASE = 0.384;
const vista = {t:new THREE.Vector3(), tT:new THREE.Vector3(), az:AZ_BASE, azT:AZ_BASE, zoom:1, zoomT:1, size:60};
const R = 760;

function base(){                                      // vectores derecha/arriba de la pantalla, en mundo
  const sa = Math.sin(vista.az), ca = Math.cos(vista.az), se = Math.sin(EL), ce = Math.cos(EL);
  return {r:new THREE.Vector3(ca, 0, -sa), u:new THREE.Vector3(-se*sa, ce, -se*ca)};
}
function colocar(){
  const t = vista.t, sa = Math.sin(vista.az), ca = Math.cos(vista.az);
  cam.position.set(t.x + R*Math.cos(EL)*sa, t.y + R*Math.sin(EL), t.z + R*Math.cos(EL)*ca);
  cam.lookAt(t);
  cam.zoom = vista.zoom;
  cam.updateProjectionMatrix();
  sun.position.set(t.x - 85, 170, t.z + 120);
  sun.target.position.copy(t);
  sun.target.updateMatrixWorld();
}
function medir(){
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  const a = w/h, s = vista.size;
  cam.left = -s*a/2; cam.right = s*a/2; cam.top = s/2; cam.bottom = -s/2;
  cam.updateProjectionMatrix();
}
// Pasa un punto de pantalla (en unidades de mundo: px a la derecha, py arriba) al
// punto del suelo que lo produce. Es invertir la proyección para y=0.
function alSuelo(px, py){
  const sa = Math.sin(vista.az), ca = Math.cos(vista.az), se = Math.sin(EL);
  const A = px, B = -py/se;
  return {x:A*ca + B*sa, z:-A*sa + B*ca};
}
// Encuadra un recuadro del mundo. Por omisión se encuadra un sitio, no la cadena
// entera: con un predio de 870 unidades, verlo todo deja la maqueta diminuta.
let encActual = null;
function encuadrar(rect, suave){
  encActual = rect = rect || encActual || EST[0].enc;
  const b = base();
  let x0=1e9, x1=-1e9, y0=1e9, y1=-1e9;
  const v = new THREE.Vector3();
  [rect.x0, rect.x1].forEach(X=>[rect.z0, rect.z1].forEach(Z=>[0, 26].forEach(Y=>{
    v.set(X, Y, Z);
    const px = v.dot(b.r), py = v.dot(b.u);
    x0=Math.min(x0,px); x1=Math.max(x1,px); y0=Math.min(y0,py); y1=Math.max(y1,py);
  })));
  const W = innerWidth, H = innerHeight, angosto = W <= 760;
  const padT = angosto ? 112 : 108, padB = angosto ? 150 : 76;
  const padL = 24, padR = (W > 980 ? 300 : 24);
  const k = Math.max((x1-x0)/Math.max(80, W - padL - padR), (y1-y0)/Math.max(80, H - padT - padB));
  const xc = (padL + W - padR)/2, yc = (padT + H - padB)/2;
  const px = (x0+x1)/2 + (W/2 - xc)*k;
  const py = (y0+y1)/2 + (yc - H/2)*k;
  const p = alSuelo(px, py);
  vista.size = k*H;
  vista.zoomT = 1;
  vista.tT.set(p.x, 0, p.z);
  if (!suave){ vista.t.copy(vista.tT); vista.zoom = 1; vista.az = vista.azT; }
  medir();
  colocar();
}
function irA(e){
  encuadrar(e.enc, true);
  ocultarPista();
}

/* ============================================================================
   HUD
   ============================================================================ */
function medidor(pct, clase){
  return '<span class="r3-medidor ' + (clase||'') + '"><i style="width:' + Math.max(0, Math.min(100, pct)) + '%"></i></span>';
}
function pintarKpis(){
  const d = datos(FASE, SEG);
  const num = v => typeof v === 'number' ? v : 0;
  const contratado = num(d.contratado) || 1;
  const tarjetas = [
    {k:'contratado', n:'Contratado',       u:UNIDAD,  ic:ICO.riel,     cl:'',      pct:100},
    {k:'proceso',    n:'En proceso',       u:UNIDAD,  ic:ICO.reloj,    cl:'oro',   pct:num(d.proceso)/contratado*100,   m:'oro'},
    {k:'entregado',  n:'Entregado',        u:UNIDAD,  ic:ICO.check,    cl:'ok',    pct:num(d.entregado)/contratado*100, m:'ok'},
    {k:'pendiente',  n:'Por fabricar',     u:UNIDAD,  ic:ICO.falta,    cl:'mal',   pct:num(d.pendiente)/contratado*100, m:'mal'},
    {k:'monto',      n:'Monto pagado',     u:'M',     ic:ICO.dinero,   cl:'flama', pct:null},
  ];
  const notas = d.notas || {};
  $('#r3Kpis').innerHTML = tarjetas.map(c=>{
    const v = d[c.k];
    return '<div class="r3-kpi r3-glass ' + c.cl + '">' +
      '<span class="ic">' + c.ic + '</span>' +
      '<span class="t"><label>' + c.n + '</label>' +
      '<span class="v">' + fmt(v) + ' <small>' + c.u + '</small>' +
      (notas[c.k] ? ' <em>' + notas[c.k] + '</em>' : '') + '</span>' +
      (c.pct == null ? '' : medidor(c.pct, c.m)) +
      '</span></div>';
  }).join('') +
  '<div class="r3-kpi r3-glass"><span class="ic">' + ICO.tramo + '</span>' +
  '<span class="t"><label>Proyectos</label><span class="v">' + TRAMOS.length +
  ' <small>proyectos</small></span></span></div>';
}
/* Dona: el contratado es el total, así que va al centro y no como gajo; los gajos
   son sus tres partes, que suman ese total. Es cifra del contrato, no del lote. */
const DONA = [
  {k:'entregado', n:'Entregado',    c:'#1f9a63'},
  {k:'proceso',   n:'En proceso',   c:'#f2c230'},
  {k:'pendiente', n:'Por fabricar', c:'#c9d2e0'},
];
function pintarDona(){
  const el = $('#r3Dona');
  const d = datos(FASE, SEG);
  const num = v => typeof v === 'number' ? v : 0;
  const total = num(d.contratado);
  if (!total){ el.hidden = true; return; }
  el.hidden = false;
  // Los atributos van en el propio SVG, igual que en la vista plana, para que el
  // dibujo no dependa de reglas de hoja de estilo que no viajan con el elemento.
  const aro = (color, pct, desde) => '<circle cx="50" cy="50" r="38" fill="none" stroke-width="13"' +
    ' transform="rotate(-90 50 50)" pathLength="100" stroke="' + color +
    '" stroke-dasharray="' + pct.toFixed(2) + ' ' + (100-pct).toFixed(2) +
    '" stroke-dashoffset="' + (-desde).toFixed(2) + '"/>';
  let acc = 0;
  const aros = DONA.map(p=>{
    p.pct = Math.max(0, Math.min(100, num(d[p.k])/total*100));
    const a = aro(p.c, p.pct, acc);
    acc += p.pct;
    return a;
  }).join('');
  el.innerHTML =
    '<svg viewBox="0 0 100 100" role="img" aria-label="Reparto de lo contratado">' +
    aro('#eef1f6', 100, 0) + aros +
    '<text x="50" y="50" text-anchor="middle" fill="#1b2638" font-weight="800" font-size="19"' +
    ' font-family="Bricolage Grotesque, Barlow Condensed, sans-serif">' +
    (total/1000).toLocaleString('es-MX',{maximumFractionDigits:1}) + '</text>' +
    '<text x="50" y="62" text-anchor="middle" fill="#8796ab" font-size="7.5" letter-spacing="0.9"' +
    ' font-family="JetBrains Mono, IBM Plex Mono, monospace">MIL ' + UNIDAD.toUpperCase() + '</text></svg>' +
    '<div class="leyenda">' +
    '<div class="l"><i style="background:transparent;box-shadow:inset 0 0 0 1px var(--r3-ink3)"></i>Contratado<b>100 %</b></div>' +
    DONA.map(p=>'<div class="l"><i style="background:' + p.c + '"></i>' + p.n + '<b>' + p.pct.toFixed(1) + ' %</b></div>').join('') +
    '</div>';
}
function pintarPanel(){
  const d = datos(FASE, SEG);
  const filas = tabla(FASE, SEG);
  const nf = (FASES.find(f=>f.id===FASE) || {}).nombre || '';
  const nt = (TRAMOS.find(t=>t.id===SEG) || {}).nombre || '';
  $('#r3PanelFase').textContent = nf + ' · ' + UNIDAD;
  $('#r3PanelNom').textContent = nt;
  $('#r3Tot').innerHTML =
    '<div class="r3-mini"><label>Solicitado</label><b>' + fmt(d.solicitado) + '</b></div>' +
    '<div class="r3-mini"><label>Entregado</label><b>' + fmt(d.entregadoP) + '</b></div>' +
    '<div class="r3-mini"><label>Pendiente</label><b>' + fmt(d.pendienteP) + '</b></div>';
  if (!filas.length){
    $('#r3Rows').innerHTML = '<p class="r3-vacio">Sin datos para este lote.</p>';
    return;
  }
  const nota = n => n ? ' <span class="r3-pill">' + n + '</span>' : '';
  $('#r3Rows').innerHTML = filas.map(f=>{
    const n = f.notas || {};
    const ent = typeof f.entregado === 'number' ? f.entregado : 0;
    const sol = typeof f.solicitado === 'number' ? f.solicitado : 0;
    const pct = sol ? Math.min(100, ent/sol*100) : 0;
    return '<div class="r3-row"><span class="ic">' + ICO.tramo + '</span>' +
      '<span class="t"><b>' + f.tramo + '</b><small>Solicitado ' + fmt(f.solicitado) + ' ' + UNIDAD + nota(n.solicitado) + '</small>' +
      medidor(pct, 'ok') + '</span>' +
      '<span class="r"><span class="r3-mono">' + fmt(f.entregado) + '</span>' +
      '<span class="r3-pill ' + (typeof f.pendiente === 'number' && f.pendiente > 0 ? 'mal' : 'ok') + '">' +
      fmt(f.pendiente) + ' pend.</span></span></div>';
  }).join('') +
  '<div class="r3-row total"><span class="ic">' + ICO.suma + '</span>' +
  '<span class="t"><b>Total</b><small>' + filas.length + ' tramos</small></span>' +
  '<span class="r"><span class="r3-mono">' + fmt(d.entregadoP) + '</span>' +
  '<span class="r3-pill mal">' + fmt(d.pendienteP) + ' pend.</span></span></div>';
}
function pintarCadena(){
  const d = datos(FASE, SEG);
  const iconos = [ICO.fabrica, ICO.puerto, ICO.barco, ICO.descarga, ICO.acopio];
  $('#r3Chain').innerHTML = EST.map((e,i)=>{
    const v = d[e.k], vivo = typeof v === 'number';
    return '<button type="button" class="r3-paso' + (vivo ? '' : ' apagado') + '" data-est="' + i + '">' +
      '<span class="ic">' + iconos[i] + '</span>' +
      '<span class="t"><label>' + e.n + '</label><b>' + fmt(v) + ' <small>' + UNIDAD + '</small></b></span></button>';
  }).join('');
  $('#r3Chain').querySelectorAll('[data-est]').forEach(b=>{
    b.onclick = ()=>{
      const i = +b.dataset.est;
      $('#r3Chain').querySelectorAll('[data-est]').forEach(o=>o.setAttribute('aria-current', o === b));
      irA(EST[i]);
    };
  });
}
// Rótulos: cartelitos HTML anclados a un punto del mundo, como los del modelo plano
let labs = [];
function armarLabs(){
  elLabs.innerHTML = EST.map(e=>
    '<div class="r3-lab" data-k="' + e.k + '"><div class="caja"><label>' + e.n +
    '</label><b data-v>—</b></div><span class="palo"></span></div>').join('');
  labs = EST.map((e,i)=>({e, el: elLabs.children[i]}));
}
function pintarLabs(){
  const d = datos(FASE, SEG);
  labs.forEach(L=>{
    const v = d[L.e.k], vivo = typeof v === 'number';
    L.el.querySelector('[data-v]').innerHTML = fmt(v) + ' <small>' + UNIDAD + '</small>';
    L.el.classList.toggle('apagado', !vivo);
  });
}
const _v = new THREE.Vector3();
function moverLabs(){
  const w = innerWidth, h = innerHeight;
  // El rótulo se esconde si cae fuera o si lo taparía una tarjeta del HUD: ahí no se leería
  const estorbos = [];
  ['#r3Panel', '#r3Dona', '#r3Kpis'].forEach(sel=>{
    const e = $(sel);
    if (e && e.offsetParent && !e.hidden) estorbos.push(e.getBoundingClientRect());
  });
  labs.forEach(L=>{
    _v.set(L.e.x, L.e.y, L.e.z).project(cam);
    const x = (_v.x*0.5 + 0.5)*w, y = (-_v.y*0.5 + 0.5)*h;
    L.el.style.transform = 'translate(' + (x|0) + 'px,' + (y|0) + 'px) translate(-50%,-100%)';
    // y es el pie del rótulo; la tarjeta cuelga hacia arriba, de ahí el recuadro
    const caja = {x0:x - 72, x1:x + 72, y0:y - 76, y1:y};
    // se esconde solo si de verdad lo tapa; rozar una esquina por unos píxeles no cuenta
    const tapado = estorbos.some(r=>
      Math.min(caja.x1, r.right) - Math.max(caja.x0, r.left) > 18 &&
      Math.min(caja.y1, r.bottom) - Math.max(caja.y0, r.top) > 18);
    L.el.style.visibility = (tapado || x < 0 || x > w || y < 60 || y > h - 50) ? 'hidden' : 'visible';
  });
}
function pintarTodo(){
  pintarKpis(); pintarDona(); pintarPanel(); pintarCadena(); pintarLabs(); pintarPatios();
  $('#r3SiteNom').textContent = (TRAMOS.find(t=>t.id===SEG) || {}).nombre || '—';
  $('#r3SiteCod').textContent = 'P' + (TRAMOS.findIndex(t=>t.id===SEG) + 1);
}

/* ---------------------------------------------------------------- controles ---- */
function armarControles(){
  const seg = $('#r3Fases');
  seg.innerHTML = FASES.map(f=>'<button type="button" data-fase="' + f.id + '">' + f.nombre + '</button>').join('');
  seg.querySelectorAll('[data-fase]').forEach(b=>{
    b.onclick = ()=>{
      FASE = b.dataset.fase;
      if (API.setFase) API.setFase(FASE);             // la maqueta plana queda en la misma entrega
      marcarFase(); pintarTodo();
    };
  });
  marcarFase();

  const pop = $('#r3Pop'), site = $('#r3Site');
  pop.innerHTML = TRAMOS.map(t=>'<button type="button" role="menuitem" data-tramo="' + t.id + '">' + t.nombre + '</button>').join('');
  pop.querySelectorAll('[data-tramo]').forEach(b=>{
    b.onclick = ()=>{
      SEG = b.dataset.tramo;
      if (API.setProyecto) API.setProyecto(SEG);
      marcarProyecto(); cerrarPop(); pintarTodo();
    };
  });
  site.onclick = (ev)=>{ ev.stopPropagation(); pop.classList.toggle('abierto');
    site.setAttribute('aria-expanded', pop.classList.contains('abierto')); };
  raiz.addEventListener('click', e=>{ if (!site.contains(e.target)) cerrarPop(); });
  marcarProyecto();

  const vel = $('#r3Vel');
  vel.querySelectorAll('[data-v]').forEach(b=>{
    b.onclick = ()=>{
      VEL = +b.dataset.v;
      vel.querySelectorAll('[data-v]').forEach(o=> o.classList.toggle('on', o === b));
    };
  });
  raiz.querySelectorAll('[data-rot]').forEach(b=>{
    b.onclick = ()=>{ vista.azT += (+b.dataset.rot) * Math.PI/12; ocultarPista(); };
  });
  raiz.querySelectorAll('[data-zoom]').forEach(b=>{
    b.onclick = ()=>{ vista.zoomT = clamp(vista.zoomT * (+b.dataset.zoom > 0 ? 1.3 : 1/1.3), 0.3, 8); ocultarPista(); };
  });
  $('#r3Fit').onclick = ()=>{
    vista.azT = AZ_BASE;
    const todo = encActual === TODO;
    encuadrar(todo ? EST[0].enc : TODO, true);
    $('#r3Fit').setAttribute('aria-label', todo ? 'Ver un sitio' : 'Ver la cadena completa');
    $('#r3Chain').querySelectorAll('[data-est]').forEach(o=>o.setAttribute('aria-current', 'false'));
  };
  $('#r3Close').onclick = cerrar;
}
function cerrarPop(){
  $('#r3Pop').classList.remove('abierto');
  $('#r3Site').setAttribute('aria-expanded', 'false');
}
function marcarFase(){
  $('#r3Fases').querySelectorAll('[data-fase]').forEach(b=>{
    const on = b.dataset.fase === FASE;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on);
  });
}
function marcarProyecto(){
  $('#r3Pop').querySelectorAll('[data-tramo]').forEach(b=>b.setAttribute('aria-current', b.dataset.tramo === SEG));
}
const clamp = (v,a,b)=> v < a ? a : v > b ? b : v;
let pistaIda = false;
function ocultarPista(){ if (!pistaIda){ pistaIda = true; elHint.classList.add('ido'); } }

function armarRaton(){
  const el = renderer.domElement;
  const dedos = new Map();
  let arrastre = null, pinza = null;
  el.addEventListener('pointerdown', e=>{
    el.setPointerCapture(e.pointerId);
    dedos.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if (dedos.size === 1) arrastre = {x:e.clientX, y:e.clientY};
    else if (dedos.size === 2){
      const v = [...dedos.values()];
      pinza = {d:Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y) || 1, z:vista.zoomT};
      arrastre = null;
    }
  });
  el.addEventListener('pointermove', e=>{
    if (dedos.has(e.pointerId)) dedos.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if (pinza && dedos.size === 2){
      const v = [...dedos.values()];
      vista.zoomT = clamp(pinza.z * Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y)/pinza.d, 0.3, 8);
      return;
    }
    if (!arrastre) return;
    const dx = e.clientX - arrastre.x, dy = e.clientY - arrastre.y;
    arrastre.x = e.clientX; arrastre.y = e.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 2){ el.classList.add('arrastra'); ocultarPista(); }
    // un píxel de pantalla vale lo mismo en mundo sobre el plano del suelo
    const upp = (cam.top - cam.bottom)/vista.zoom/innerHeight;
    const b = base();
    const paso = b.r.clone().multiplyScalar(-dx*upp).add(b.u.clone().multiplyScalar(dy*upp/Math.sin(EL)));
    vista.tT.x = clamp(vista.tT.x + paso.x, X_INI - 60, X_FIN + 60);
    vista.tT.z = clamp(vista.tT.z + paso.z, Z_FONDO - 40, Z_FRENTE + 40);
    vista.t.copy(vista.tT);
  });
  const suelta = e=>{ dedos.delete(e.pointerId); if (dedos.size < 2) pinza = null;
    if (!dedos.size){ arrastre = null; el.classList.remove('arrastra'); } };
  el.addEventListener('pointerup', suelta);
  el.addEventListener('pointercancel', suelta);
  el.addEventListener('wheel', e=>{
    e.preventDefault();
    vista.zoomT = clamp(vista.zoomT * Math.pow(0.9988, e.deltaY), 0.3, 8);
    ocultarPista();
  }, {passive:false});
  addEventListener('keydown', atajos);
}
function atajos(e){
  if (raiz.hidden) return;
  if (e.key === 'Escape'){ cerrar(); return; }
  if (e.key === 'q' || e.key === 'Q') vista.azT -= Math.PI/12;
  if (e.key === 'e' || e.key === 'E') vista.azT += Math.PI/12;
  if (e.key === '+' || e.key === '=') vista.zoomT = clamp(vista.zoomT*1.3, 0.3, 8);
  if (e.key === '-') vista.zoomT = clamp(vista.zoomT/1.3, 0.3, 8);
  if (e.key === 'f' || e.key === 'F'){ vista.azT = AZ_BASE; encuadrar(encActual === TODO ? EST[0].enc : TODO, true); }
}

/* ============================================================================
   ARRANQUE Y CICLO
   ============================================================================ */
function iniciar(){
  renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth <= 760 ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  elStage.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color('#e4eaf2');
  scene.fog = new THREE.Fog('#e4eaf2', 1100, 2600);  // solo suaviza las puntas de la cadena
  // Las tres luces suman ≈1 sobre una cara horizontal: más y los colores claros
  // se van todos a blanco, que es justo lo que no queremos en una maqueta pastel.
  scene.add(new THREE.HemisphereLight('#ffffff', '#aebfd6', 0.50));
  sun = new THREE.DirectionalLight('#fffaf0', 0.62);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  Object.assign(sun.shadow.camera, {left:-190, right:190, top:190, bottom:-190, near:1, far:620});
  sun.shadow.bias = -0.0015;
  sun.shadow.normalBias = 0.5;    // con el predio grande, el texel de sombra es grosero
  scene.add(sun); scene.add(sun.target);
  scene.add(new THREE.AmbientLight('#dfe7f5', 0.10));

  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -1400, 2400);

  construir();
  armarLabs();
  armarControles();
  armarRaton();
  pintarTodo();
  encuadrar(EST[0].enc, false);
  addEventListener('resize', alRedimensionar);
  $('#r3Load').remove();
  listo = true;
}
// Al cambiar de tamaño se respeta el encuadre del usuario: solo se corrige la relación de aspecto.
function alRedimensionar(){ if (!raiz.hidden) medir(); }

let t0 = performance.now(), reloj = 0, _lejos = false;
function ciclo(now){
  if (!corriendo) return;
  const dt = Math.min(0.05, (now - t0)/1000);
  t0 = now;
  // la cámara persigue su objetivo al margen de la velocidad: en pausa se sigue pudiendo mirar
  vista.t.lerp(vista.tT, 1 - Math.pow(0.001, dt));
  vista.zoom += (vista.zoomT - vista.zoom) * (1 - Math.pow(0.001, dt));
  vista.az += (vista.azT - vista.az) * (1 - Math.pow(0.001, dt));
  const dtA = dt*VEL;
  reloj += dtA;
  if (!REDUCE && dtA > 0) animadores.forEach(f=>f(reloj, dtA));
  colocar();
  // de lejos no se distingue el detalle menudo y sí cuesta dibujarlo
  const lejos = vista.size/vista.zoom > 420;
  if (lejos !== _lejos){ _lejos = lejos; detalles.forEach(d=> d.visible = !lejos); }
  renderer.render(scene, cam);
  moverLabs();
  requestAnimationFrame(ciclo);
}

/* ------------------------------------------------------------- abrir/cerrar ---- */
function abrir(){
  raiz.hidden = false;
  if (!listo){
    try { iniciar(); }
    catch(err){
      $('#r3Load').textContent = 'Este navegador no pudo iniciar los gráficos 3D.';
      console.error(err);
      return;
    }
  } else {
    FASE = API.fase || FASE; SEG = API.proyecto || SEG;
    marcarFase(); marcarProyecto(); pintarTodo();
    medir();
  }
  if (API.pausar2D) API.pausar2D(true);               // la maqueta plana no anima a ciegas
  corriendo = true; t0 = performance.now();
  requestAnimationFrame(ciclo);
  setTimeout(()=>{ if (!pistaIda) ocultarPista(); }, 9000);
}
function cerrar(){
  corriendo = false;
  raiz.hidden = true;
  cerrarPop();
  if (API.pausar2D) API.pausar2D(false);
  const b = document.getElementById('btn3d');
  if (b) b.focus();
}

window.RIEL3D = {abrir, cerrar, refrescar: ()=>{ if (listo) pintarTodo(); }};
abrir();
})();
