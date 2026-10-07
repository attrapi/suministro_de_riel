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
  durmiente:'#ab9174', fleje:'#d9743a',
};

/* ------------------------------------------------------- tramos del eje X ---- */
const MAR0 = 74, MAR1 = 114;                     // el estrecho: ahí la tierra se corta
const Z_FONDO = -30, Z_FRENTE = 34;              // el mar justo lo que la travesía necesita
const X_INI = -8, X_FIN = 192;
const PLANTA   = {x0:2,   x1:34};
const PUERTO   = {x0:38,  x1:70};
const DESCARGA = {x0:118, x1:148};
const ACOPIO   = {x0:152, x1:186};
const NIVEL_MAR = -1.4;                          // el agua va bajo la tierra: el corte del muelle se ve
const VIA_Z = 3;                                 // vía férrea pegada a la costa, a todo lo largo
// Una sola carretera por continente, delante de todo: con esta cámara lo que tiene
// más Z queda en primer plano, así que lo alto va al fondo y los patios adelante.
const CAMINO_Z = 23;
const PATA_Z0 = -1.5, PATA_Z1 = 6.5;             // dónde apoyan las grúas de muelle

// Las cinco estaciones, en el mismo orden que el modelo plano.
const EST = [
  {k:'produccion', n:'Por fabricar',      x:18,  z:28,  y:13, cx:18,  cz:20, zoom:1.6},
  {k:'puerto',     n:'Origen · puerto',   x:54,  z:2,   y:16, cx:54,  cz:0,  zoom:1.6},
  {k:'traslado',   n:'Traslado marítimo', x:94,  z:-18, y:10, cx:94,  cz:-14,zoom:1.3},
  {k:'descarga',   n:'Descarga',          x:133, z:2,   y:16, cx:133, cz:0,  zoom:1.6},
  {k:'acopio',     n:'Centro de acopio',  x:169, z:11,  y:14, cx:169, cz:12, zoom:1.6},
];

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
#riel3d .r3-bar{position:absolute;top:12px;left:16px;right:16px;display:flex;align-items:center;
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
  #riel3d .r3-hint,#riel3d .r3-tools{display:none}
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

  <aside class="r3-panel r3-glass" id="r3Panel">
    <div class="r3-ph">
      <p class="eyebrow" id="r3PanelFase">Entrega</p>
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
    for (let k=-1.5; k<=1.5; k++) box(largo, 0.56, 0.52, col, 0, yy, k*0.62, g);
    // flejes en los extremos: sin ellos el haz se lee como una estera, no como bulto
    box(0.55, 0.64, 2.9, C.fleje, -largo/2 + 1.2, yy - 0.04, 0, g);
    box(0.55, 0.64, 2.9, C.fleje,  largo/2 - 1.2, yy - 0.04, 0, g);
  }
  return g;
}
// Vía con durmientes: cose la planta con el muelle y el acopio con la salida
function via(x0, x1, z, parent){
  const g = grupo(0,0,0,parent);
  box(x1-x0, 0.12, 0.16, C.acero2, (x0+x1)/2, 0.22, z-0.72, g, true);
  box(x1-x0, 0.12, 0.16, C.acero2, (x0+x1)/2, 0.22, z+0.72, g, true);
  for (let x=x0+0.9; x<x1; x+=2.0) box(0.9, 0.22, 2.2, C.durmiente, x, 0, z, g, true);
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

/* ---------- grúa de pórtico: la pieza que más se repite en la maqueta ---------- */
// Sobre el muelle monta a caballo la vía y asoma el brazo al agua; en el acopio
// cruza el patio. El carro corre por la viga y el aparejo sube y baja.
function gruaPortico(x, z0, z1, alto, voladizo){
  const g = grupo(x, 0, 0, world);
  const vol = voladizo || 0;
  const zv0 = z0 - vol, zc = (zv0 + z1)/2;                       // la viga sale sobre el agua
  const pata = (zz)=>{
    box(1.6, alto, 1.6, C.grua, 0, 0, zz, g);
    box(2.8, 0.5, 2.8, C.gruaOsc, 0, 0, zz, g);                  // zapata sobre el carril
    box(0.6, alto*0.5, 0.6, C.gruaOsc, 0, alto*0.35, zz, g, true);
  };
  pata(z0); pata(z1);
  box(2.0, 1.6, z1 - zv0 + 2.4, C.grua, 0, alto, zc, g);         // viga carril
  box(1.0, 1.0, z1 - z0, C.grua, 0, alto - 2.6, (z0+z1)/2, g);   // travesaño inferior
  if (vol){                                                       // torre y tirantes del voladizo
    box(1.2, 5.0, 1.2, C.grua, 0, alto + 1.6, z1 - 1.5, g);
    const tir = box(0.5, 0.5, vol + (z1 - z0), C.gruaOsc, 0, alto + 4.0, zc, g, true);
    tir.rotation.x = -Math.atan2(5.0, vol + (z1 - z0)) * 0.55;
  }
  const carro = grupo(0, alto + 0.2, zc, g);
  box(2.4, 1.1, 3.0, C.gruaOsc, 0, -1.1, 0, carro);
  const cable1 = box(0.12, 4, 0.12, C.gruaOsc, 0, -5, -1.1, carro, true);
  const cable2 = box(0.12, 4, 0.12, C.gruaOsc, 0, -5, 1.1, carro, true);
  const viga = box(11.6, 0.45, 1.5, C.grua, 0, -6.9, 0, carro);    // bastidor de izaje
  const pinza = hazRiel(0, -6.4, 0, 11, 1, carro, C.acero2);
  const z0c = zv0 + 2.5, z1c = z1 - 2.5;
  const fase = Math.random()*Math.PI*2;
  animadores.push((t)=>{
    const u = (Math.sin(t*0.26 + fase) + 1)/2;                   // vaivén del carro
    carro.position.z = z0c + (z1c - z0c)*u;
    const h = 1.8 + Math.abs(Math.sin(t*0.52 + fase))*4.8;       // el aparejo sube al cruzar
    viga.position.y = -0.4 - h;
    pinza.position.y = 0.1 - h;
    pinza.visible = u > 0.16 && u < 0.88;                         // suelta el haz en cada punta
    cable1.scale.y = cable2.scale.y = h/4;
    cable1.position.y = cable2.position.y = -0.2 - h/2;
  });
  return g;
}

/* ---------------------------------------------------------------- buques ---- */
function buque(){
  const g = grupo(0,0,0,world);
  const L = 28, A = 7.6;
  box(L, 2.4, A, C.cascoBajo, 0, -1.0, 0, g);                    // obra viva
  box(L, 2.2, A, C.casco, 0, 1.4, 0, g);                         // obra muerta
  for (let i=0;i<3;i++){                                          // proa en tres escalones, para que afine
    const k = (i+1)/3;
    box(1.8, 2.2, A*(1 - k*0.78), C.casco, L/2 + 0.9 + i*1.8, 1.4, 0, g);
    box(1.8, 2.4, A*(1 - k*0.78), C.cascoBajo, L/2 + 0.9 + i*1.8, -1.0, 0, g);
  }
  box(L - 1, 0.4, A - 1.4, C.cubierta, 0, 3.6, 0, g);            // cubierta
  box(L - 1, 1.0, 0.35, C.casco, 0, 3.6, -A/2 + 0.75, g, true);  // bordas
  box(L - 1, 1.0, 0.35, C.casco, 0, 3.6,  A/2 - 0.75, g, true);
  const casilla = grupo(-L/2 + 3.4, 4.0, 0, g);                  // castillo de popa
  box(5.2, 4.4, A - 1.6, C.torre, 0, 0, 0, casilla);
  box(5.4, 0.9, A - 1.2, C.vidrio, 0, 2.8, 0, casilla, true);
  box(4.4, 1.3, A - 2.8, C.torre, 0, 4.4, 0, casilla);
  cil(0.95, 3.2, C.chimenea, -0.6, 5.7, 0, casilla, 12);
  const carga = grupo(2.0, 4.0, 0, g);                           // los haces que lleva
  const haces = [];
  for (let i=0;i<3;i++) haces.push(hazRiel(i*7.4 - 7.4, 0, 0, 6.8, 2, carga));
  g.userData = {carga, haces};
  return g;
}

/* ------------------------------------------------------------------ camión ---- */
function camion(){
  const g = grupo(0,0,0,world);
  box(3.0, 2.3, 2.6, C.camion, 1.9, 0.7, 0, g);                  // tractor
  box(2.9, 0.7, 2.5, C.vidrio, 2.0, 2.3, 0, g, true);
  box(9.4, 0.7, 2.7, C.caja, -3.0, 1.0, 0, g);                   // plataforma
  box(0.5, 1.1, 2.7, C.caja, -7.6, 1.7, 0, g);
  const carga = grupo(-3.2, 1.7, 0, g);
  hazRiel(0, 0, 0, 8.4, 2, carga, C.acero);
  const rueda = (x,z)=>{ const r = cil(0.72, 0.5, C.llanta, x, 0, z, g, 12); r.rotation.x = Math.PI/2; r.position.y = 0.72; };
  [3.1, -0.6, -5.6, -6.9].forEach(x=>{ rueda(x, -1.25); rueda(x, 1.25); });
  g.userData = {carga};
  return g;
}

/* ============================================================================
   ARMADO DE LA MAQUETA
   ============================================================================ */
const pilas = {};        // los patios que cambian con el dato
let buques = [], camiones = [], vapor = [];

function construir(){
  world = new THREE.Group();
  scene.add(world);

  /* ---------- mar, tierra y muelles ---------- */
  const texA = texAgua();
  const agua = new THREE.Mesh(new THREE.PlaneGeometry(X_FIN - X_INI, Z_FRENTE - Z_FONDO),
    new THREE.MeshStandardMaterial({map:texA, color:'#ffffff', roughness:.16, metalness:.05}));
  agua.rotation.x = -Math.PI/2;
  agua.position.set((X_INI + X_FIN)/2, NIVEL_MAR, (Z_FONDO + Z_FRENTE)/2);
  agua.receiveShadow = true;
  world.add(agua);
  animadores.push((t)=>{ texA.offset.x = t*0.009; texA.offset.y = Math.sin(t*0.08)*0.01; });

  // Los dos continentes, cortados por el estrecho. Son bloques, no planos: el corte
  // de tierra a la vista es lo que hace que esto se lea como maqueta y no como mapa.
  const tierra = (x0,x1)=>{
    box(x1-x0, 2.6, Z_FRENTE + 2, C.tierra, (x0+x1)/2, -2.6, (Z_FRENTE - 2)/2);
    placa(x0, x1, 0, Z_FRENTE, 0.002, C.pasto);                  // explanada
    placa(x0, x1, Z_FRENTE - 7, Z_FRENTE, 0.006, C.pasto2);      // franja al frente, para que no sea un plano muerto
    box(x1-x0, 0.38, 2.2, C.muelle, (x0+x1)/2, 0, 1.1);          // coronamiento del muelle
    for (let x=x0+5; x<x1-2; x+=9) cil(0.42, 1.0, C.gruaOsc, x, 0.38, 0.5);   // bolardos
  };
  tierra(X_INI, MAR0);
  tierra(MAR1, X_FIN);

  // delantal de concreto donde hay operación; el pasto queda alrededor, no debajo de todo
  placa(PUERTO.x0 - 5, MAR0, 2.4, 20, 0.014, C.piso);
  placa(MAR1, DESCARGA.x1 + 5, 2.4, 20, 0.014, C.piso);
  placa(PLANTA.x0 - 4, PLANTA.x1 + 6, 4, 33, 0.014, C.piso);
  placa(ACOPIO.x0 - 5, ACOPIO.x1 + 7, 4, 21, 0.014, C.piso);

  /* ---------- 1 · planta: la nave de laminación, con el patio por delante ---------- */
  const nave = grupo(PLANTA.x0, 0, 6, world);
  const NW = 30, ND = 12, NH = 11;
  box(NW + 1.8, 0.4, ND + 1.8, C.muelle, NW/2, 0, ND/2, nave);               // plataforma
  box(NW, NH, ND, C.muro, NW/2, 0.4, ND/2, nave);
  box(NW + 0.2, 1.6, ND + 0.2, C.cobalto, NW/2, 0.4, ND/2, nave);            // zócalo
  box(NW + 0.7, 0.8, ND + 0.7, C.cobalto, NW/2, NH + 0.4, ND/2, nave);       // cenefa
  for (let i=0;i<4;i++){                                                      // techo de diente de sierra
    const z = 1.7 + i*2.9;
    const p = box(NW, 3.2, 0.3, C.techo, NW/2, NH + 1.2, z + 1.35, nave);
    p.rotation.x = -0.76;
    box(NW - 1.4, 2.1, 0.22, C.vidrio, NW/2, NH + 1.2, z - 1.2, nave, true);
  }
  // Andén de salida, en la cara de adelante: es lo que da al patio y a la carretera
  for (let i=0;i<5;i++) box(0.6, 4.6, 0.6, C.muro2, 2.5 + i*6.4, 0, ND + 2.2, nave);
  box(NW, 0.9, 3.4, C.cobalto, NW/2, 4.6, ND + 1.6, nave);
  [-3.6, NW + 3.6].forEach((cx,i)=>{                                          // chimeneas: flanquean la nave, sin taparla
    cil(1.3, 17, C.muro2, cx, 0, ND/2, nave, 16);
    cil(1.5, 1.2, C.chimenea, cx, 16.6, ND/2, nave, 16);
    for (let k=0;k<5;k++){                                                    // humo: esferas que suben y se diluyen
      const s = new THREE.Mesh(new THREE.SphereGeometry(1.4 + k*0.5, 10, 8),
        new THREE.MeshStandardMaterial({color:'#ffffff', roughness:1, transparent:true, opacity:.3, depthWrite:false}));
      nave.add(s);
      vapor.push({m:s, cx, k, i});
    }
  });
  // riel al rojo saliendo del tren de laminación, bajo el alero
  const vivo = box(14, 0.42, 1.2, C.rielVivo, 11, 4.7, ND + 2.4, nave, true);
  vivo.material = new THREE.MeshStandardMaterial({color:C.rielVivo, emissive:'#ff5a1f', emissiveIntensity:.5, roughness:.5});
  animadores.push(t=>{ vivo.material.emissiveIntensity = 0.3 + Math.abs(Math.sin(t*1.4))*0.45; });

  via(PLANTA.x0 - 3, PUERTO.x1, VIA_Z, world);                                // vía: de la planta al muelle
  carretera(X_INI + 1, MAR0 - 2, CAMINO_Z, 5.6, world);
  pilas.produccion = grupo(PLANTA.x0 + 2, 0, 27.5, world);                    // lo laminado, delante de la nave

  /* ---------- 2 · puerto de origen ---------- */
  gruaPortico(PUERTO.x0 + 6,  PATA_Z0, PATA_Z1, 13, 12);
  gruaPortico(PUERTO.x0 + 22, PATA_Z0, PATA_Z1, 13, 12);
  pilas.puerto = grupo(PUERTO.x0 + 2, 0, 8.6, world);
  bodega(PUERTO.x0 + 30, 18, 8, 6, 4.6);
  banderaEn(MAR0 - 6, 13.5, 'cn');
  faro(MAR0 - 3, 2.5);

  /* ---------- 3 · travesía ---------- */
  for (let i=0;i<4;i++){                                                      // boyas del canal
    const x = MAR0 + 7 + i*((MAR1 - MAR0 - 14)/3);
    const b = cil(0.7, 2.4, i%2 ? '#1f9a63' : C.chimenea, x, -2.2, -20, world, 10);
    animadores.push(t=>{ b.rotation.z = Math.sin(t*1.1 + i)*0.12; b.position.y = -1.0 + Math.sin(t*1.3 + i)*0.12; });
  }

  /* ---------- 4 · descarga ---------- */
  gruaPortico(DESCARGA.x0 + 5,  PATA_Z0, PATA_Z1, 13, 12);
  gruaPortico(DESCARGA.x0 + 21, PATA_Z0, PATA_Z1, 13, 12);
  pilas.descarga = grupo(DESCARGA.x0 + 2, 0, 8.6, world);
  bodega(DESCARGA.x0 + 30, 18, 9, 6, 5.0);
  banderaEn(MAR1 + 6, 13.5, 'mx');
  faro(MAR1 + 3, 2.5);
  carretera(MAR1 + 2, X_FIN - 1, CAMINO_Z, 5.6, world);
  via(MAR1 + 2, X_FIN - 1, VIA_Z, world);

  /* ---------- 5 · centro de acopio ---------- */
  gruaPortico(ACOPIO.x0 + 10, 4, 18, 11, 0);
  gruaPortico(ACOPIO.x0 + 26, 4, 18, 11, 0);
  pilas.acopio = grupo(ACOPIO.x0 + 2, 0, 5, world);
  const ofi = grupo(ACOPIO.x1 - 1, 0, 26, world);                             // caseta de control
  box(7, 3.4, 5, C.muro, 0, 0, 0, ofi);
  box(7.4, 0.5, 5.4, C.cobalto, 0, 3.4, 0, ofi);
  box(7.1, 0.9, 5.1, C.vidrio, 0, 1.6, 0, ofi, true);
  cil(0.3, 7, C.acero, 4.4, 0, -1, ofi, 8);
  arbolado();

  /* ---------- flota ---------- */
  // Dos buques desfasados: siempre hay uno cargando y otro en el mar, como en el plano.
  const AMARRE = -6.4, IDA = -15.5, VUELTA = -24.5, CALADO = -1.2;
  const X_ORIG = PUERTO.x0 + 14, X_DEST = DESCARGA.x0 + 13;
  buques = [buque(), buque()];
  buques[0].userData.t = 0.52; buques[1].userData.t = 0.04;
  animadores.push((t, dt)=>{
    buques.forEach((b,i)=>{
      const u = b.userData;
      u.t = (u.t + dt*0.019) % 1;
      // 0–.13 carga en origen · .13–.60 travesía · .60–.73 descarga · .73–1 regreso en vacío
      let x, z = AMARRE, dir = 1, cargado = true;
      if (u.t < 0.13){ x = X_ORIG; cargado = u.t > 0.07; }
      else if (u.t < 0.60){ x = X_ORIG + (X_DEST - X_ORIG)*((u.t - 0.13)/0.47); z = IDA; }
      else if (u.t < 0.73){ x = X_DEST; cargado = u.t < 0.66; }
      else { x = X_DEST + (X_ORIG - X_DEST)*((u.t - 0.73)/0.27); z = VUELTA; dir = -1; cargado = false; }
      b.position.set(x, CALADO + Math.sin(t*0.8 + i*2)*0.14, z);   // flota con su línea de agua
      b.rotation.y = dir > 0 ? 0 : Math.PI;
      b.rotation.z = Math.sin(t*0.9 + i)*0.012;
      u.carga.visible = cargado;
    });
  });

  /* ---------- camiones: planta→muelle en China, descarga→acopio en México ---------- */
  const rutas = [
    {x0:PLANTA.x0 + 6,   x1:PUERTO.x0 + 18, z:CAMINO_Z - 1.4, dir: 1},
    {x0:PUERTO.x0 + 18,  x1:PLANTA.x0 + 6,  z:CAMINO_Z + 1.4, dir:-1},
    {x0:DESCARGA.x0 + 6, x1:ACOPIO.x1 - 4,  z:CAMINO_Z - 1.4, dir: 1},
    {x0:ACOPIO.x1 - 4,   x1:DESCARGA.x0 + 6,z:CAMINO_Z + 1.4, dir:-1},
  ];
  rutas.forEach((r,i)=>{
    for (let n=0;n<2;n++){
      const c = camion();
      c.userData.r = r; c.userData.t = (n*0.5 + i*0.13) % 1;
      c.rotation.y = r.dir > 0 ? 0 : Math.PI;
      c.userData.carga.visible = r.dir > 0;             // cargados van, vacíos vuelven
      camiones.push(c);
    }
  });
  animadores.push((t, dt)=>{
    camiones.forEach(c=>{
      const u = c.userData, r = u.r;
      u.t = (u.t + dt*0.05) % 1;
      c.position.set(r.x0 + (r.x1 - r.x0)*u.t, 0, r.z);
    });
  });

  animadores.push((t)=>{                                 // humo de las chimeneas
    vapor.forEach(v=>{
      const u = ((t*0.2 + v.k*0.2 + v.i*0.1) % 1);
      v.m.position.set(v.cx + u*2.6, 17.6 + u*12, 7 - u*1.4);
      v.m.material.opacity = 0.32*(1 - u);
      v.m.scale.setScalar(0.6 + u*1.5);
    });
  });
}

// Arbolado: ocupa el pasto que queda libre y le da escala a todo lo demás.
// Posiciones con una secuencia fija, no al azar: la maqueta se ve igual cada vez.
function arbolado(){
  const copaG = new THREE.SphereGeometry(1, 10, 8);
  const tronG = new THREE.CylinderGeometry(0.22, 0.3, 1.8, 7);
  const copaM = [mat('#8fb46e'), mat('#9cc07a'), mat('#7fa661')];
  const tronM = mat('#9a7f63');
  const bandas = [[-8, 0], [36, 70], [116, 148], [152, 180]];
  let s = 7;
  const rnd = ()=>{ s = (s*1103515245 + 12345) % 2147483648; return s/2147483648; };
  bandas.forEach(b=>{
    const n = Math.round((b[1] - b[0])/5.5);
    for (let i=0;i<n;i++){
      const x = b[0] + (i + 0.3 + rnd()*0.5)*((b[1]-b[0])/n);
      const z = 26 + rnd()*7;
      const r = 1.3 + rnd()*0.9;
      const t = new THREE.Mesh(tronG, tronM);
      t.position.set(x, 0.9, z); t.castShadow = true; world.add(t);
      const c = new THREE.Mesh(copaG, copaM[(i + Math.round(z)) % 3]);
      c.position.set(x, 1.8 + r*0.8, z); c.scale.set(r, r*1.1, r);
      c.castShadow = true; c.receiveShadow = true; world.add(c);
    }
  });
}
// Nave chica de patio: la misma pieza sirve de bodega en los dos puertos.
function bodega(x, z, w, d, h){
  const g = grupo(x, 0, z, world);
  box(w, h, d, C.muro, 0, 0, 0, g);
  box(w + 0.3, 0.5, d + 0.3, C.cobalto, 0, h, 0, g);
  box(w + 0.6, 1.0, d*0.5, C.techo, 0, h + 0.5, 0, g);
  box(w*0.3, h*0.6, 0.3, C.vidrio, -w*0.25, 0, d/2, g, true);
  box(w*0.3, h*0.6, 0.3, C.vidrio,  w*0.25, 0, d/2, g, true);
  return g;
}
function faro(x, z){
  const g = grupo(x, 0, z, world);
  cil(1.5, 1.0, C.muelle, 0, 0, 0, g, 12);
  cil(1.0, 7.0, C.torre, 0, 1.0, 0, g, 12);
  cil(1.05, 1.2, C.chimenea, 0, 4.6, 0, g, 12);
  const luz = cil(0.8, 1.4, C.grua, 0, 8.0, 0, g, 12);
  luz.material = new THREE.MeshStandardMaterial({color:'#fff6d8', emissive:'#ffd166', emissiveIntensity:.8, roughness:.5});
  cil(1.3, 0.3, C.gruaOsc, 0, 9.4, 0, g, 12);
  animadores.push(t=>{ luz.material.emissiveIntensity = 0.3 + Math.abs(Math.sin(t*1.6))*1.1; });
  return g;
}
function banderaEn(x, z, cual){
  const g = grupo(x, 0, z, world);
  cil(0.22, 12, C.torre, 0, 0, 0, g, 10);
  const tela = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.8),
    new THREE.MeshStandardMaterial({map:texBandera(cual), roughness:.9, side:THREE.DoubleSide}));
  tela.position.set(2.2, 10.4, 0);
  tela.castShadow = true;
  g.add(tela);
  animadores.push(t=>{ tela.rotation.y = Math.sin(t*1.5)*0.16; tela.position.z = Math.sin(t*1.5)*0.3; });
  return g;
}

/* ============================================================================
   LOS DATOS SOBRE LA MAQUETA — los patios de riel crecen con el tonelaje
   ============================================================================ */
const LARGO_HAZ = 11, PASO_X = 13.4, PASO_Z = 3.6;
const FORMA = {   // cuántas filas y cuántos haces por fila caben en cada patio
  produccion: {f:2, p:2},
  puerto:     {f:2, p:2},
  descarga:   {f:2, p:2},
  acopio:     {f:4, p:2},
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
  // El tonelaje en travesía no tiene patio: se ve en lo que llevan los buques.
  const t = d.traslado;
  const cuantos = typeof t === 'number' && t > 0 ? Math.max(1, Math.min(3, Math.round(t/TOPE*3))) : 0;
  buques.forEach(b=> b.userData.haces.forEach((h,i)=>{ h.visible = i < cuantos; }));
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
const R = 260;

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
  sun.position.set(t.x - 34, 70, t.z + 48);
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
// Encuadre: toda la cadena dentro, con sitio arriba para la barra y abajo para la cadena
function encuadrar(suave){
  const b = base();
  let x0=1e9, x1=-1e9, y0=1e9, y1=-1e9;
  const v = new THREE.Vector3();
  [X_INI, X_FIN].forEach(X=>[Z_FONDO, Z_FRENTE].forEach(Z=>[0, 15].forEach(Y=>{
    v.set(X, Y, Z);
    const px = v.dot(b.r), py = v.dot(b.u);
    x0=Math.min(x0,px); x1=Math.max(x1,px); y0=Math.min(y0,py); y1=Math.max(y1,py);
  })));
  const W = innerWidth, H = innerHeight, angosto = W <= 760;
  // El HUD flota encima de la maqueta, así que solo se le reserva lo justo para que
  // los rótulos no se metan bajo las tarjetas; el resto del lienzo sí se aprovecha.
  const padT = angosto ? 118 : 148, padB = angosto ? 164 : 82;
  const padL = 20, padR = (W > 980 ? 296 : 20);                   // el panel de la derecha
  // unidades de mundo por píxel: lo que haga falta para que quepa en la franja libre
  const k = Math.max((x1-x0)/Math.max(80, W - padL - padR), (y1-y0)/Math.max(80, H - padT - padB));
  const xc = (padL + W - padR)/2, yc = (padT + H - padB)/2;       // centro de la franja libre
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
  vista.tT.set(e.cx, 0, e.cz);
  vista.zoomT = e.zoom;
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
    {k:'pendiente',  n:'Pendiente',        u:UNIDAD,  ic:ICO.falta,    cl:'mal',   pct:num(d.pendiente)/contratado*100, m:'mal'},
    {k:'monto',      n:'Monto pendiente',  u:'M',     ic:ICO.dinero,   cl:'flama', pct:null},
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
    $('#r3Rows').innerHTML = '<p class="r3-vacio">Sin datos para esta entrega.</p>';
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
  // El rótulo se esconde si cae fuera, bajo la barra o detrás del panel: ahí estorbaría
  const panel = $('#r3Panel');
  const limite = (panel && panel.offsetParent) ? panel.getBoundingClientRect().left - 10 : w;
  labs.forEach(L=>{
    _v.set(L.e.x, L.e.y, L.e.z).project(cam);
    const x = (_v.x*0.5 + 0.5)*w, y = (-_v.y*0.5 + 0.5)*h;
    L.el.style.transform = 'translate(' + (x|0) + 'px,' + (y|0) + 'px) translate(-50%,-100%)';
    // y es el pie del rótulo: la tarjeta va encima, así que se descuenta su alto
    L.el.style.visibility = (x < 80 || x > limite || y < 205 || y > h - 60) ? 'hidden' : 'visible';
  });
}
function pintarTodo(){
  pintarKpis(); pintarPanel(); pintarCadena(); pintarLabs(); pintarPatios();
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

  raiz.querySelectorAll('[data-rot]').forEach(b=>{
    b.onclick = ()=>{ vista.azT += (+b.dataset.rot) * Math.PI/12; ocultarPista(); };
  });
  raiz.querySelectorAll('[data-zoom]').forEach(b=>{
    b.onclick = ()=>{ vista.zoomT = clamp(vista.zoomT * (+b.dataset.zoom > 0 ? 1.3 : 1/1.3), 0.5, 5); ocultarPista(); };
  });
  $('#r3Fit').onclick = ()=>{ vista.azT = AZ_BASE; encuadrar(true);
    $('#r3Chain').querySelectorAll('[data-est]').forEach(o=>o.setAttribute('aria-current', 'false')); };
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
      vista.zoomT = clamp(pinza.z * Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y)/pinza.d, 0.5, 5);
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
    vista.tT.x = clamp(vista.tT.x + paso.x, X_INI - 30, X_FIN + 30);
    vista.tT.z = clamp(vista.tT.z + paso.z, Z_FONDO - 20, Z_FRENTE + 20);
    vista.t.copy(vista.tT);
  });
  const suelta = e=>{ dedos.delete(e.pointerId); if (dedos.size < 2) pinza = null;
    if (!dedos.size){ arrastre = null; el.classList.remove('arrastra'); } };
  el.addEventListener('pointerup', suelta);
  el.addEventListener('pointercancel', suelta);
  el.addEventListener('wheel', e=>{
    e.preventDefault();
    vista.zoomT = clamp(vista.zoomT * Math.pow(0.9988, e.deltaY), 0.5, 5);
    ocultarPista();
  }, {passive:false});
  addEventListener('keydown', atajos);
}
function atajos(e){
  if (raiz.hidden) return;
  if (e.key === 'Escape'){ cerrar(); return; }
  if (e.key === 'q' || e.key === 'Q') vista.azT -= Math.PI/12;
  if (e.key === 'e' || e.key === 'E') vista.azT += Math.PI/12;
  if (e.key === '+' || e.key === '=') vista.zoomT = clamp(vista.zoomT*1.3, 0.5, 5);
  if (e.key === '-') vista.zoomT = clamp(vista.zoomT/1.3, 0.5, 5);
  if (e.key === 'f' || e.key === 'F'){ vista.azT = AZ_BASE; encuadrar(true); }
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
  scene.fog = new THREE.Fog('#e4eaf2', 330, 640);   // solo suaviza las puntas de la cadena
  // Las tres luces suman ≈1 sobre una cara horizontal: más y los colores claros
  // se van todos a blanco, que es justo lo que no queremos en una maqueta pastel.
  scene.add(new THREE.HemisphereLight('#ffffff', '#aebfd6', 0.50));
  sun = new THREE.DirectionalLight('#fffaf0', 0.62);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left:-120, right:120, top:120, bottom:-120, near:1, far:340});
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  scene.add(sun); scene.add(sun.target);
  scene.add(new THREE.AmbientLight('#dfe7f5', 0.10));

  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -500, 900);

  construir();
  armarLabs();
  armarControles();
  armarRaton();
  pintarTodo();
  encuadrar(false);
  addEventListener('resize', alRedimensionar);
  $('#r3Load').remove();
  listo = true;
}
// Al cambiar de tamaño se respeta el encuadre del usuario: solo se corrige la relación de aspecto.
function alRedimensionar(){ if (!raiz.hidden) medir(); }

let t0 = performance.now(), reloj = 0;
function ciclo(now){
  if (!corriendo) return;
  const dt = Math.min(0.05, (now - t0)/1000);
  t0 = now; reloj += dt;
  // la cámara persigue su objetivo, nunca salta
  vista.t.lerp(vista.tT, 1 - Math.pow(0.001, dt));
  vista.zoom += (vista.zoomT - vista.zoom) * (1 - Math.pow(0.001, dt));
  vista.az += (vista.azT - vista.az) * (1 - Math.pow(0.001, dt));
  if (!REDUCE) animadores.forEach(f=>f(reloj, dt));
  colocar();
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
