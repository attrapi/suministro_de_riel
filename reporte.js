/* ============================================================
   REPORTE — las cuatro láminas del "Reporte Riel.pptx", armadas con los
   datos vivos de la página.

   La lámina se describe una sola vez, como una lista de figuras en pulgadas
   sobre un lienzo de 13.333 x 7.5 (16:9, igual que el deck). Esa misma lista
   la pintan dos salidas: el PDF -con jsPDF, que ya está en la carpeta- y un
   .pptx de verdad, que se arma aquí mismo (OOXML + ZIP) para que se pueda
   abrir y editar en PowerPoint. Nada sale a la red: los logos y el fondo
   vienen incrustados en reporte-assets.js.
   ============================================================ */
window.REPORTE = (function(){
'use strict';

const W = 13.3333333, H = 7.5;          // pulgadas, lámina 16:9
const EMU = 914400;                      // unidades internas de PowerPoint por pulgada

/* Paleta tal como viene del deck */
const C = {
  guinda:'670103', vino:'611232', verde:'13322B', vinoQro:'63122E',
  gris:'E4E4E4', borde:'D4CBB8', oro:'BF9000', oroClaro:'E6C88B', oroTM:'9A7320',
  tinta:'000000', blanco:'FFFFFF',
  rotulo:'64748B', texto:'374151', suave:'4B5563', tenue:'6B7280', linea:'9D9D9C',
};
const COLOR_PROYECTO = { 'sal-nl': C.verde, 'qro-ira': C.vinoQro };
const CICLO = [C.vinoQro, C.verde, C.guinda, C.vino];

const FUENTE = 'Noto Sans', FUENTE_T = 'Noto Sans ExtraBold';

/* ---------- formato de cifras ---------- */
const esNum = v => typeof v === 'number' && isFinite(v);
const num = (v, dec) => esNum(v)
  ? v.toLocaleString('es-MX', { minimumFractionDigits:dec||0, maximumFractionDigits:dec||0 })
  : '—';
const razon = (a, b) => (esNum(a) && esNum(b) && b > 0) ? a / b : null;
const pctTxt = (p, dec) => p == null ? '—'
  : (p*100).toLocaleString('es-MX', { minimumFractionDigits:dec==null?1:dec, maximumFractionDigits:dec==null?1:dec }) + '%';

/* ---------- Rótulo corto de un centro de acopio ----------
   En la hoja el centro viene con su nombre completo ("BASE DE MONTAJE 1
   SALTILLO, COAHUILA (CICSA). TI (Seg. 13 y 14) P.K. 40+000"). En la lámina de
   contratistas no cabe, y el deck tampoco lo pone: ahí va el contratista -lo
   que viene entre paréntesis- y su tramo. El nombre completo sí va entero en
   las láminas de detalle, que tienen sitio para dos o tres renglones. */
const MENORES = new Set(['de','del','la','las','el','los','y','e','en','a','al','con','por','para']);
/* Pasa un nombre en mayúsculas a capital inicial sin estropear siglas ni
   numeraciones: "MOTA ENGIL" → "Mota Engil", pero "P.L.N.", "TI" y "III" se
   quedan como vienen. Se usa sólo en los rótulos cortos, que es donde la
   página arma el texto; el nombre completo del centro va tal cual lo
   escribe la hoja. */
function titulo(s){
  return String(s || '').trim().split(/(\s+)/).map(tok => {
    if (!tok.trim()) return tok;
    const letras = tok.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, '');
    if (!letras) return tok;                                   // "1", "27+000"
    if (/\d/.test(tok)) return tok;                            // "15B", "T2"
    if (letras.length <= 2 || /^[IVX]+$/.test(letras)) {        // "P.L.N.", "T", "III"
      return MENORES.has(letras.toLowerCase()) ? tok.toLowerCase() : tok;
    }
    const b = tok.toLowerCase();
    if (MENORES.has(b)) return b;
    return b.replace(/[a-záéíóúñ]/, c => c.toUpperCase());
  }).join('');
}
/* El rótulo de un renglón en la lámina de contratistas: contratista y tramo.
   El contratista es lo que viene entre paréntesis; el tramo se busca en este
   orden -numeración romana, ordinal del centro, segmento- porque así sale
   distinto para cada renglón, que es de lo que se trata. */
function rotuloCorto(nombre){
  const n = String(nombre || '').trim();
  const parens = [...n.matchAll(/\(([^)]*)\)/g)].map(m => m[1].trim())
    .filter(t => t && !/^P\.?K\.?/i.test(t) && !/^Seg/i.test(t) && !/^T\s*[IVX0-9]/i.test(t));
  let jefe = parens[0]
    ? (/\s/.test(parens[0]) ? titulo(parens[0]) : parens[0])   // "CICSA" se queda; "MOTA ENGIL" no
    : titulo(n.replace(/\s*\([^)]*\)/g, '').replace(/[.,].*$/, '').trim());

  const roman  = n.match(/\bT\s?([IVX]{1,4})\b/);
  const ordinal = n.match(/\b(CENTRO DE ACOPIO|BASE DE MONTAJE|ACOPIO|MONTAJE|TRAMO)\s*([0-9IVX]+)\b/i);
  const seg    = n.match(/Seg\.?\s*[^)·|]*/i);
  let sufijo = '';
  if (ordinal)      sufijo = /ACOPIO/i.test(ordinal[1]) ? 'Acopio ' + ordinal[2]
                           : /MONTAJE/i.test(ordinal[1]) ? 'Montaje ' + ordinal[2]
                           : 'Tramo ' + ordinal[2];
  else if (roman)   sufijo = 'T ' + roman[1].toUpperCase();
  else if (seg)     sufijo = seg[0].trim().replace(/\s+/g, ' ').replace(/[,.;]$/, '');

  if (jefe.length > 26) jefe = jefe.slice(0, 25).trim() + '…';
  if (!jefe) jefe = n.slice(0, 26);
  if (sufijo && sufijo.toLowerCase() === jefe.toLowerCase()) sufijo = '';
  return { jefe, sufijo };
}

/* ---------- Dona: se dibuja en un lienzo y entra como imagen ----------
   Así sale idéntica en el PDF y en el .pptx, sin pelear con los arcos de cada
   formato. El tamaño es generoso para que no se vea pixeleada al imprimir. */
function dona(parte, total, color){
  try {
    const L = 760, lz = document.createElement('canvas');
    lz.width = lz.height = L;
    const g = lz.getContext('2d');
    if (!g) return null;
    const cx = L/2, cy = L/2, R = L*0.46, r = L*0.30;
    const p = razon(parte, total);
    const gajo = (a0, a1, col)=>{
      g.beginPath();
      g.arc(cx, cy, R, a0, a1);
      g.arc(cx, cy, r, a1, a0, true);
      g.closePath(); g.fillStyle = col; g.fill();
    };
    const inicio = -Math.PI/2;
    gajo(inicio, inicio + Math.PI*2, '#' + C.gris);
    if (p != null && p > 0) gajo(inicio, inicio + Math.PI*2*Math.min(p,1), '#' + color);
    g.fillStyle = '#' + C.texto;
    g.textAlign = 'center';
    g.font = '700 ' + Math.round(L*0.155) + 'px "Noto Sans", Arial, sans-serif';
    g.fillText(pctTxt(p), cx, cy + L*0.035);
    g.fillStyle = '#' + C.tenue;
    g.font = '700 ' + Math.round(L*0.058) + 'px "Noto Sans", Arial, sans-serif';
    g.fillText('ENTREGADO', cx, cy + L*0.135);
    return lz.toDataURL('image/png');
  } catch(e){ return null; }
}

/* ---------- Figuras ---------- */
const figura = {
  img:  (uri, x, y, w, h)        => ({ t:'img', uri, x, y, w, h }),
  caja: (x, y, w, h, o)          => Object.assign({ t:'caja', x, y, w, h, r:0 }, o||{}),
  elip: (x, y, w, h, o)          => Object.assign({ t:'elip', x, y, w, h }, o||{}),
  linea:(x, y, x2, y2, col, lw)  => ({ t:'linea', x, y, x2, y2, col:col||C.linea, lw:lw||0.007 }),
};
/* Un bloque de texto: caja, acomodo y uno o más renglones con su propio tamaño. */
function texto(x, y, w, h, renglones, o){
  const r = (Array.isArray(renglones) ? renglones : [renglones]).filter(Boolean);
  return Object.assign({ t:'texto', x, y, w, h, renglones:r, al:'l', anc:'m', fuente:FUENTE }, o||{});
}
const rg = (s, sz, color, b) => ({ s:String(s), sz, color:color||C.texto, b:b!==false });

/* ============================================================
   ARMADO DE LAS CUATRO LÁMINAS
   ============================================================ */

/* El encabezado que llevan todas: barra guinda, título a dos renglones y,
   en la portada, los dos logotipos con su divisoria. */
function encabezado(F, l1, l2, conLogos, A){
  F.push(figura.caja(0, 0.02, 0.15, 1.35, { fill:C.guinda }));
  F.push(texto(0.28, 0.17, 5.60, 0.86, [
    rg(l1, 20, C.tinta), rg(l2, 24, C.tinta),
  ], { fuente:FUENTE_T, anc:'m' }));
  if (conLogos && A){
    if (A.SICT)   F.push(figura.img(A.SICT.uri,   7.56, 0.34, 3.29, 0.49));
    if (A.TRENES) F.push(figura.img(A.TRENES.uri, 11.12, 0.29, 2.01, 0.60));
    F.push(figura.linea(10.99, 0.20, 10.99, 0.79, C.linea, 0.008));
  }
}

/* Las columnas de totales que van arriba a la derecha en las láminas 2 a 4:
   una divisoria vertical, el rótulo y la cifra. Opcionalmente, una píldora de
   color con el nombre del proyecto. */
function columnaTotal(F, x1, x2, rotulo, cifra, pastilla){
  F.push(figura.linea(x1, 0.30, x1, 1.10, C.linea, 0.008));
  const ancho = x2 - x1;
  if (pastilla){
    F.push(figura.caja(x1 + 0.20, 0.20, Math.min(1.95, ancho - 0.40), 0.26, { fill:pastilla.color, r:0.07 }));
    F.push(texto(x1 + 0.20, 0.20, Math.min(1.95, ancho - 0.40), 0.26,
      [rg(pastilla.nombre, 10.5, C.blanco, false)], { al:'c' }));
    F.push(figura.linea(x1 + 0.33, 0.52, x1 + 1.80, 0.52, C.linea, 0.006));
  }
  F.push(texto(x1 + 0.10, pastilla ? 0.58 : 0.40, ancho - 0.20, 0.24, [rg(rotulo, 11.33, C.suave, false)], { al:pastilla ? 'l' : 'c' }));
  F.push(texto(x1 + 0.06, pastilla ? 0.80 : 0.62, ancho - 0.12, 0.45, [rg(cifra, 15, C.texto, false)], { al:'c' }));
}

/* ---------- Lámina 1 · Estado general ---------- */
function lamina1(ctx, A){
  const F = [], k = ctx.kpis;
  if (A && A.BG) F.push(figura.img(A.BG.uri, 0, 0, W, H));
  encabezado(F, 'ESTADO GENERAL', 'SUMINISTRO DE RIEL', true, A);

  const nCentros = ctx.proyectos.reduce((a,p)=> a + p.filas.length, 0);
  F.push(texto(0.29, 1.05, 6.60, 0.27, [rg('CONTRATO — ' + ctx.proyectos.length + ' PROYECTOS · '
    + nCentros + ' CENTROS DE ACOPIO', 11.33, C.oro)], { al:'l' }));
  F.push(texto(6.40, 1.05, 6.60, 0.27, [rg('CORTE AL ' + ctx.fecha.toUpperCase(), 10, C.oro)], { al:'r' }));

  /* Los tres totales de arriba */
  const avance = razon(k.entregado, k.contratado);
  const tarjetas = [
    { rot:'CONTRATADO', lineas:[ num(k.contratado,1) + ' Ton / ' + num(k.contratadoPz) + ' Pz' ] },
    { rot:'AVANCE',     lineas:[ num(k.entregado,1) + ' Ton / ' + num(k.entregadoPz) + ' Pz', pctTxt(avance) ] },
    { rot:'PAGADO',     lineas:[ '$ ' + num(k.monto) + ' MX' ] },
  ];
  tarjetas.forEach((t, i)=>{
    const x = [0.77, 4.90, 9.19][i];
    F.push(figura.caja(x, 1.68, 3.31, 1.22, { fill:C.gris, r:0.08 }));
    F.push(texto(x, 1.84, 3.31, 0.21, [rg(t.rot, 10, C.vino)], { al:'c' }));
    F.push(texto(x + 0.07, 2.12, 3.17, 0.62, t.lineas.map(s=>rg(s, 15, C.vino)), { al:'c' }));
  });

  /* Las tres tarjetas de lote */
  const lotes = [
    { rot:'ENTREGADO',    lote:'Lote 1', pz:k.entregadoPz, tm:k.entregado,  ico:ctx.iconos && ctx.iconos.entregado,  pie:'En centro de acopio' },
    { rot:'EN DESCARGA',  lote:'Lote 2', pz:k.procesoPz,   tm:k.proceso,    ico:ctx.iconos && ctx.iconos.proceso,    pie:'En descarga en puerto' },
    { rot:'POR FABRICAR', lote:'Lote 3', pz:k.pendientePz, tm:k.pendiente,  ico:ctx.iconos && ctx.iconos.pendiente,  pie:'Por fabricar en origen' },
  ];
  lotes.forEach((L, i)=>{
    const x = [0.40, 4.64, 8.88][i], y = 3.22, w = 4.05, h = 3.94;
    F.push(figura.caja(x, y, w, h, { fill:C.blanco, linea:C.borde, lw:0.014, r:0.095 }));
    F.push(figura.caja(x, y, w, 0.48, { fill:C.guinda, r:0.095 }));
    F.push(figura.caja(x, y + 0.24, w, 0.24, { fill:C.guinda }));
    F.push(texto(x + 0.13, y + 0.08, 2.47, 0.32, [rg(L.rot, 11.33, C.blanco)], { al:'l' }));
    F.push(texto(x + 1.45, y + 0.08, 2.47, 0.32, [rg(L.lote, 9.33, C.oroClaro)], { al:'r' }));

    // La mitad izquierda es la del dibujo, como en el deck: va el icono
    // isométrico de la propia página y, debajo, la parte que le toca del
    // contrato dibujada como barra -el mismo número que el recuadro de al lado.
    const q = razon(L.tm, k.contratado);
    if (L.ico) F.push(figura.img(L.ico, x + 0.08, 3.86, 2.05, 1.37));
    F.push(texto(x + 0.14, 5.30, 1.94, 0.30, [rg(L.pie, 9, C.tenue, false)], { al:'c', envolver:true }));
    F.push(figura.caja(x + 0.17, 5.90, 1.86, 0.18, { fill:C.gris, r:0.09 }));
    if (q) F.push(figura.caja(x + 0.17, 5.90, Math.max(0.18, 1.86*Math.min(q, 1)), 0.18, { fill:C.guinda, r:0.09 }));
    F.push(texto(x + 0.14, 6.13, 1.94, 0.22, [rg('del total contratado', 7.5, C.tenue, false)], { al:'c' }));

    const bx = x + 2.16;
    F.push(figura.caja(bx, 4.10, 1.73, 1.23, { fill:C.gris, r:0.06 }));
    F.push(texto(bx + 0.08, 4.18, 1.57, 0.21, [rg('CANTIDAD', 8.67, C.rotulo)], { al:'l' }));
    F.push(texto(bx + 0.08, 4.39, 1.57, 0.45, [rg(num(L.pz) + ' pz', 18, C.guinda)], { al:'l' }));
    F.push(texto(bx + 0.08, 4.87, 1.57, 0.24, [rg(num(L.tm,1) + ' TM', 9.33, C.oroTM)], { al:'l' }));

    F.push(figura.caja(bx, 5.49, 1.73, 1.23, { fill:C.gris, r:0.06 }));
    F.push(texto(bx + 0.08, 5.57, 1.57, 0.29, [rg('Porcentaje Equivalente', 8.67, C.tinta)], { al:'l', envolver:true }));
    F.push(texto(bx + 0.08, 5.90, 1.57, 0.51, [rg(pctTxt(q), 20, C.guinda)], { al:'c' }));
  });
  return { l1:'ESTADO GENERAL', l2:'SUMINISTRO DE RIEL', figuras:F };
}

/* ---------- Lámina 2 · Contratistas de obra ---------- */
function lamina2(ctx, A){
  const F = [];
  if (A && A.BG) F.push(figura.img(A.BG.uri, 0, 0, W, H));
  encabezado(F, 'SUMINISTRO RIEL', 'CONTRATISTAS OBRA', false, A);

  const P = ctx.proyectos;
  const totalEnt = P.reduce((a,p)=> a + p.totalEntregado, 0);
  const totalReq = P.reduce((a,p)=> a + p.totalSolicitado, 0);
  const cortes = [4.72, 7.45, 10.18, 12.86];
  columnaTotal(F, cortes[0], cortes[1], 'Suministrado / Requerido:', num(totalEnt) + ' / ' + num(totalReq) + ' Pzas', null);
  P.slice(0,2).forEach((p, i)=>{
    columnaTotal(F, cortes[i+1], cortes[i+2], 'Total Suministrado:',
      num(p.totalEntregado) + ' Pzas', { nombre:p.corto, color:p.color });
  });
  F.push(figura.linea(cortes[3], 0.30, cortes[3], 1.10, C.linea, 0.008));

  /* Una banda por proyecto; dentro, un renglón por centro de acopio. */
  const ARR = 1.52, ABA = 7.32, bandaH = (ABA - ARR) / Math.max(P.length, 1);
  P.forEach((p, i)=>{
    const yb = ARR + i*bandaH;
    F.push(figura.caja(0.22, yb, 1.95, 0.26, { fill:p.color, r:0.07 }));
    F.push(texto(0.22, yb, 1.95, 0.26, [rg(p.corto, 10.5, C.blanco, false)], { al:'c' }));
    F.push(figura.linea(0.38, yb + 0.33, 1.85, yb + 0.33, C.linea, 0.006));
    F.push(texto(2.30, yb, 3.20, 0.26, [rg('TOTAL Requerido | ' + num(p.totalSolicitado) + ' pz', 9, C.suave, false)], { al:'l' }));

    const filas = p.filas, n = filas.length || 1;
    const y0 = yb + 0.42, alto = (yb + bandaH - 0.16) - y0;
    const paso = n > 1 ? Math.min(0.525, (alto - 0.29) / (n - 1)) : 0;
    filas.forEach((f, j)=>{
      const y = y0 + j*paso;
      const corto = rotuloCorto(f.nombre);
      F.push(texto(0.30, y, 2.05, 0.21,
        [rg(corto.jefe + (corto.sufijo ? ' / ' + corto.sufijo : ''), 9, C.texto)], { al:'l' }));
      F.push(figura.caja(0.32, y + 0.23, 1.53, 0.055, { fill:p.color }));

      const PX = 2.47, PW = 7.72, PH = 0.20, yp = y + 0.03;
      const q = razon(f.entregado, f.solicitado);
      const ancho = q == null ? 0 : Math.max(0, Math.min(1, q)) * PW;
      F.push(figura.caja(PX, yp, PW, PH, { fill:C.gris, r:PH/2 }));
      if (ancho > 0.02) F.push(figura.caja(PX, yp, Math.max(ancho, PH), PH, { fill:p.color, r:PH/2 }));
      const etiqueta = num(f.entregado) + ' Pzas | ' + pctTxt(q);
      if (ancho > 1.45) F.push(texto(PX + 0.10, yp, ancho - 0.30, PH, [rg(etiqueta, 8.5, C.blanco)], { al:'c' }));
      else              F.push(texto(PX + Math.max(ancho, PH) + 0.12, yp, 2.00, PH, [rg(etiqueta, 8.5, p.color)], { al:'l' }));
      if (ancho > 0.02) F.push(figura.elip(PX + ancho - 0.14, yp - 0.04, 0.28, 0.28, { fill:C.blanco, linea:p.color, lw:0.012 }));

      F.push(texto(10.44, y - 0.07, 2.70, 0.21, [rg('Requerido | ' + num(f.solicitado) + ' pz', 8, C.suave, false)], { al:'l' }));
      F.push(texto(10.44, y + 0.12, 2.70, 0.21, [rg('Por entregar | ' + num(f.pendiente) + ' pz', 8, C.tenue)], { al:'l' }));
    });
  });
  return { l1:'SUMINISTRO RIEL', l2:'CONTRATISTAS OBRA', figuras:F };
}

/* ---------- Láminas 3 y 4 · Detalle por proyecto ---------- */
function laminaProyecto(ctx, p, A){
  const F = [];
  if (A && A.BG) F.push(figura.img(A.BG.uri, 0, 0, W, H));
  encabezado(F, 'SUMINISTRO RIEL', p.nombre.toUpperCase(), false, A);

  columnaTotal(F, 4.72, 7.45, 'Total Suministrado:', num(p.totalEntregado) + ' Pzas', null);
  columnaTotal(F, 7.45, 10.18, 'Por suministrar:',   num(p.totalPendiente) + ' Pzas', null);
  F.push(figura.linea(10.18, 0.30, 10.18, 1.10, C.linea, 0.008));

  const uri = dona(p.totalEntregado, p.totalSolicitado, p.color);
  if (uri) F.push(figura.img(uri, 10.67, 0.20, 2.31, 2.31));
  F.push(texto(10.17, 2.54, 3.31, 0.22, [rg('Gráfica Totales (%)', 9, C.tenue, false)], { al:'c' }));

  /* Una barra vertical por centro de acopio: crece desde la base. */
  const IZQ = 0.70, DER = 9.95, BASE = 6.22, TOPE = 1.70, ALTO = BASE - TOPE;
  const filas = p.filas, n = filas.length || 1;
  const col = (DER - IZQ) / n;
  filas.forEach((f, j)=>{
    const cx = IZQ + col*(j + 0.5), BW = 0.20;
    const q = razon(f.entregado, f.solicitado);
    const h = q == null ? 0 : Math.max(0, Math.min(1, q)) * ALTO;
    const anchoRot = Math.min(2.53, col - 0.06);
    F.push(figura.caja(cx - BW/2, TOPE, BW, ALTO, { fill:C.gris, r:BW/2 }));
    if (h > 0.02) F.push(figura.caja(cx - BW/2, BASE - Math.max(h, BW), BW, Math.max(h, BW), { fill:p.color, r:BW/2 }));
    if (h > 0.02) F.push(figura.elip(cx - 0.14, BASE - h - 0.14, 0.28, 0.28, { fill:C.blanco, linea:p.color, lw:0.012 }));

    F.push(texto(cx - anchoRot/2, 1.18, anchoRot, 0.24,
      [rg('Requerido | ' + num(f.solicitado) + ' pz', 8, C.suave, false)], { al:'c', envolver:true }));
    F.push(texto(cx - anchoRot/2, 6.34, anchoRot, 0.24,
      [rg(num(f.entregado) + ' Pzas | ' + pctTxt(q), 8.5, p.color)], { al:'c', envolver:true }));
    F.push(texto(cx - anchoRot/2, 6.56, anchoRot, 0.22,
      [rg('Por entregar | ' + num(f.pendiente) + ' pz', 7.5, C.tenue, false)], { al:'c', envolver:true }));
    F.push(figura.caja(cx - Math.min(1.53, col - 0.22)/2, 6.86, Math.min(1.53, col - 0.22), 0.055, { fill:p.color }));
    F.push(texto(cx - anchoRot/2, 6.96, anchoRot, 0.50,
      [rg(f.nombre, 6.8, C.texto, false)], { al:'c', envolver:true, anc:'t' }));
  });
  return { l1:'SUMINISTRO RIEL', l2:p.nombre.toUpperCase(), figuras:F };
}

function laminas(ctx, A){
  const L = [lamina1(ctx, A), lamina2(ctx, A)];
  ctx.proyectos.forEach(p => L.push(laminaProyecto(ctx, p, A)));
  return L;
}

/* ============================================================
   SALIDA 1 · PDF  (jsPDF, en pulgadas, con el tamaño de la lámina)
   ============================================================ */
const rgb = h => [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];

function pintarPDF(pdf, fig){
  for (const it of fig){
    if (it.t === 'img'){
      const tipo = /^data:image\/jpe?g/.test(it.uri) ? 'JPEG' : 'PNG';
      try { pdf.addImage(it.uri, tipo, it.x, it.y, it.w, it.h, undefined, 'FAST'); } catch(e){}
    }
    else if (it.t === 'caja' || it.t === 'elip'){
      let modo = '';
      if (it.fill){ pdf.setFillColor(...rgb(it.fill)); modo += 'F'; }
      if (it.linea){ pdf.setDrawColor(...rgb(it.linea)); pdf.setLineWidth(it.lw || 0.01); modo += 'D'; }
      if (!modo) continue;
      if (it.t === 'elip') pdf.ellipse(it.x + it.w/2, it.y + it.h/2, it.w/2, it.h/2, modo);
      else if (it.r)       pdf.roundedRect(it.x, it.y, it.w, it.h, it.r, it.r, modo);
      else                 pdf.rect(it.x, it.y, it.w, it.h, modo);
    }
    else if (it.t === 'linea'){
      pdf.setDrawColor(...rgb(it.col)); pdf.setLineWidth(it.lw);
      pdf.line(it.x, it.y, it.x2, it.y2);
    }
    else if (it.t === 'texto'){
      // jsPDF sólo trae Helvetica: es la que más se acerca a Noto Sans
      const lineas = [];
      for (const r of it.renglones){
        const alto = r.sz / 72 * 1.18;
        const partes = it.envolver
          ? (pdf.setFont('helvetica', r.b ? 'bold' : 'normal').setFontSize(r.sz), pdf.splitTextToSize(r.s, it.w))
          : [r.s];
        partes.forEach(s => lineas.push({ s, sz:r.sz, b:r.b, color:r.color, alto }));
      }
      const total = lineas.reduce((a,l)=> a + l.alto, 0);
      let y = it.anc === 't' ? it.y : it.anc === 'b' ? it.y + it.h - total : it.y + (it.h - total)/2;
      const x = it.al === 'c' ? it.x + it.w/2 : it.al === 'r' ? it.x + it.w : it.x;
      for (const l of lineas){
        pdf.setFont('helvetica', l.b ? 'bold' : 'normal').setFontSize(l.sz).setTextColor(...rgb(l.color));
        pdf.text(l.s, x, y + l.alto*0.78, { align: it.al === 'c' ? 'center' : it.al === 'r' ? 'right' : 'left' });
        y += l.alto;
      }
    }
  }
}

function hacerPDFDoc(L){
  const jsPDF = window.jspdf && window.jspdf.jsPDF;
  if (!jsPDF) throw new Error('Falta jsPDF');
  const pdf = new jsPDF({ orientation:'landscape', unit:'in', format:[W, H], compress:true });
  L.forEach((lam, i)=>{
    if (i) pdf.addPage([W, H], 'landscape');
    pintarPDF(pdf, lam.figuras);
  });
  return pdf;
}
const hacerPDF = L => hacerPDFDoc(L).output('blob');

/* ============================================================
   SALIDA 2 · PPTX  (OOXML armado a mano y comprimido en un ZIP)
   ============================================================ */
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const emu = v => Math.round(v * EMU);

function xfrm(it){
  return '<a:xfrm><a:off x="' + emu(it.x) + '" y="' + emu(it.y) + '"/>'
       + '<a:ext cx="' + emu(Math.max(it.w, 0.001)) + '" cy="' + emu(Math.max(it.h, 0.001)) + '"/></a:xfrm>';
}
function relleno(it){
  let s = it.fill ? '<a:solidFill><a:srgbClr val="' + it.fill + '"/></a:solidFill>' : '<a:noFill/>';
  s += it.linea
    ? '<a:ln w="' + Math.round((it.lw || 0.01) * 914400) + '"><a:solidFill><a:srgbClr val="' + it.linea + '"/></a:solidFill><a:prstDash val="solid"/></a:ln>'
    : '<a:ln><a:noFill/></a:ln>';
  return s;
}
const vacio = '<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody>';

function figuraXML(it, id, rid){
  const nv = (nombre)=> '<p:nvSpPr><p:cNvPr id="' + id + '" name="' + esc(nombre) + ' ' + id + '"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>';
  if (it.t === 'img'){
    return '<p:pic><p:nvPicPr><p:cNvPr id="' + id + '" name="Imagen ' + id + '"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>'
      + '<p:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>'
      + '<p:spPr>' + xfrm(it) + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>';
  }
  if (it.t === 'caja' || it.t === 'elip'){
    let geo;
    if (it.t === 'elip') geo = '<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>';
    else if (it.r){
      const adj = Math.round(it.r / Math.min(it.w, it.h) * 100000);
      geo = '<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ' + Math.max(0, Math.min(50000, adj)) + '"/></a:avLst></a:prstGeom>';
    } else geo = '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>';
    return '<p:sp>' + nv('Forma') + '<p:spPr>' + xfrm(it) + geo + relleno(it) + '</p:spPr>' + vacio + '</p:sp>';
  }
  if (it.t === 'linea'){
    const x = Math.min(it.x, it.x2), y = Math.min(it.y, it.y2);
    const cx = Math.abs(it.x2 - it.x), cy = Math.abs(it.y2 - it.y);
    return '<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="' + id + '" name="Linea ' + id + '"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>'
      + '<p:spPr><a:xfrm><a:off x="' + emu(x) + '" y="' + emu(y) + '"/><a:ext cx="' + emu(cx) + '" cy="' + emu(cy) + '"/></a:xfrm>'
      + '<a:prstGeom prst="line"><a:avLst/></a:prstGeom>'
      + '<a:ln w="' + Math.round(it.lw * 914400) + '"><a:solidFill><a:srgbClr val="' + it.col + '"/></a:solidFill></a:ln>'
      + '</p:spPr></p:cxnSp>';
  }
  if (it.t === 'texto'){
    const algn = it.al === 'c' ? 'ctr' : it.al === 'r' ? 'r' : 'l';
    const anc  = it.anc === 't' ? 't' : it.anc === 'b' ? 'b' : 'ctr';
    const paras = it.renglones.map(r =>
      '<a:p><a:pPr algn="' + algn + '"/><a:r><a:rPr lang="es-MX" sz="' + Math.round(r.sz*100) + '"'
      + (r.b ? ' b="1"' : '') + ' dirty="0"><a:solidFill><a:srgbClr val="' + r.color + '"/></a:solidFill>'
      + '<a:latin typeface="' + esc(it.fuente) + '"/><a:ea typeface="' + esc(it.fuente) + '"/><a:cs typeface="Arial"/>'
      + '</a:rPr><a:t>' + esc(r.s) + '</a:t></a:r></a:p>').join('');
    return '<p:sp>' + nv('Texto') + '<p:spPr>' + xfrm(it)
      + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr>'
      + '<p:txBody><a:bodyPr wrap="square" rtlCol="0" anchor="' + anc + '" lIns="0" tIns="0" rIns="0" bIns="0"><a:spAutoFit/></a:bodyPr>'
      + '<a:lstStyle/>' + (paras || '<a:p/>') + '</p:txBody></p:sp>';
  }
  return '';
}

function laminaXML(lam, medios){
  let id = 2, cuerpo = '';
  for (const it of lam.figuras){
    let rid = null;
    if (it.t === 'img'){
      let m = medios.find(x => x.uri === it.uri);
      if (!m){ m = { uri:it.uri, idx:medios.length + 1 }; medios.push(m); }
      rid = 'rId' + (m.idx + 1);               // rId1 es el diseño de la lámina
    }
    cuerpo += figuraXML(it, id++, rid);
  }
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
    + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
    + ' xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
    + '<p:cSld><p:spTree>'
    + '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
    + '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>'
    + '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
    + cuerpo
    + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>';
}

/* --- Las partes fijas del paquete --- */
const ESQ_COLOR = '<a:clrScheme name="Riel"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>'
  + '<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>'
  + '<a:dk2><a:srgbClr val="611232"/></a:dk2><a:lt2><a:srgbClr val="E4E4E4"/></a:lt2>'
  + '<a:accent1><a:srgbClr val="670103"/></a:accent1><a:accent2><a:srgbClr val="13322B"/></a:accent2>'
  + '<a:accent3><a:srgbClr val="63122E"/></a:accent3><a:accent4><a:srgbClr val="BF9000"/></a:accent4>'
  + '<a:accent5><a:srgbClr val="9A7320"/></a:accent5><a:accent6><a:srgbClr val="64748B"/></a:accent6>'
  + '<a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme>';

function temaXML(){
  const fmt = '<a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
    + '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>'
    + '<a:lnStyleLst><a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>'
    + '<a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>'
    + '<a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst>'
    + '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle>'
    + '<a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>'
    + '<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
    + '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>';
  const fuente = (tag, cara)=> '<a:' + tag + '><a:latin typeface="' + cara + '"/><a:ea typeface=""/><a:cs typeface=""/></a:' + tag + '>';
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Riel">'
    + '<a:themeElements>' + ESQ_COLOR
    + '<a:fontScheme name="Riel">' + fuente('majorFont', FUENTE_T) + fuente('minorFont', FUENTE) + '</a:fontScheme>'
    + '<a:fmtScheme name="Riel">' + fmt + '</a:fmtScheme>'
    + '</a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>';
}

const ARBOL_VACIO = '<p:cSld><p:spTree>'
  + '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
  + '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
  + '</p:spTree></p:cSld>';

function maestroXML(){
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
    + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
    + ' xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
    + ARBOL_VACIO
    + '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2"'
    + ' accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>'
    + '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>'
    + '</p:sldMaster>';
}
function disenoXML(){
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
    + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
    + ' xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">'
    + ARBOL_VACIO
    + '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>';
}
function presentacionXML(n){
  let ids = '';
  for (let i = 1; i <= n; i++) ids += '<p:sldId id="' + (255 + i) + '" r:id="rId' + (i + 1) + '"/>';
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
    + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
    + ' xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" saveSubsetFonts="1">'
    + '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>'
    + '<p:sldIdLst>' + ids + '</p:sldIdLst>'
    + '<p:sldSz cx="' + emu(W) + '" cy="' + emu(H) + '"/><p:notesSz cx="' + emu(H) + '" cy="' + emu(W) + '"/>'
    + '</p:presentation>';
}

/* --- ZIP --- */
let TABLA_CRC = null;
function crc32(u8){
  if (!TABLA_CRC){
    TABLA_CRC = new Uint32Array(256);
    for (let i = 0; i < 256; i++){
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      TABLA_CRC[i] = c >>> 0;
    }
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < u8.length; i++) c = TABLA_CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
async function desinflar(u8){
  if (typeof CompressionStream !== 'function') return null;
  try {
    const cs = new CompressionStream('deflate-raw');
    const w = cs.writable.getWriter(); w.write(u8); w.close();
    const buf = await new Response(cs.readable).arrayBuffer();
    return new Uint8Array(buf);
  } catch(e){ return null; }
}
async function zip(archivos){
  const enc = new TextEncoder(), trozos = [], centro = [];
  let desplazo = 0, cuenta = 0;
  for (const a of archivos){
    const nombre = enc.encode(a.nombre), crudo = a.datos, crc = crc32(crudo);
    let datos = crudo, metodo = 0;
    const comp = await desinflar(crudo);
    if (comp && comp.length < crudo.length){ datos = comp; metodo = 8; }

    const lh = new Uint8Array(30 + nombre.length), v = new DataView(lh.buffer);
    v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0, true);
    v.setUint16(8, metodo, true); v.setUint16(10, 0, true); v.setUint16(12, 0x2821, true);
    v.setUint32(14, crc, true); v.setUint32(18, datos.length, true); v.setUint32(22, crudo.length, true);
    v.setUint16(26, nombre.length, true); v.setUint16(28, 0, true);
    lh.set(nombre, 30);

    const ch = new Uint8Array(46 + nombre.length), w = new DataView(ch.buffer);
    w.setUint32(0, 0x02014b50, true); w.setUint16(4, 20, true); w.setUint16(6, 20, true);
    w.setUint16(8, 0, true); w.setUint16(10, metodo, true); w.setUint16(12, 0, true);
    w.setUint16(14, 0x2821, true); w.setUint32(16, crc, true);
    w.setUint32(20, datos.length, true); w.setUint32(24, crudo.length, true);
    w.setUint16(28, nombre.length, true); w.setUint32(42, desplazo, true);
    ch.set(nombre, 46);

    trozos.push(lh, datos); centro.push(ch);
    desplazo += lh.length + datos.length; cuenta++;
  }
  const tamCentro = centro.reduce((a, c)=> a + c.length, 0);
  const fin = new Uint8Array(22), f = new DataView(fin.buffer);
  f.setUint32(0, 0x06054b50, true); f.setUint16(8, cuenta, true); f.setUint16(10, cuenta, true);
  f.setUint32(12, tamCentro, true); f.setUint32(16, desplazo, true);
  return new Blob(trozos.concat(centro, [fin]),
    { type:'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
}

function deBase64(b64){
  const bin = atob(b64), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
function deURI(uri){
  const i = uri.indexOf(',');
  return { ext: /image\/jpe?g/.test(uri.slice(0,i)) ? 'jpg' : 'png', datos: deBase64(uri.slice(i+1)) };
}

async function hacerPPTX(L, fecha){
  const ENC = new TextEncoder(), A = [];
  const txt = (nombre, s)=> A.push({ nombre, datos:ENC.encode(s) });

  // Las láminas primero: de paso juntan los medios que cada una usa.
  const porLamina = L.map(lam => { const m = []; return { xml:laminaXML(lam, m), medios:m }; });

  const tipos = new Set(['png','jpg']);
  let ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Default Extension="png" ContentType="image/png"/>'
    + '<Default Extension="jpg" ContentType="image/jpeg"/>'
    + '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>'
    + '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>'
    + '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>'
    + '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'
    + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
    + '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>';
  for (let i = 1; i <= L.length; i++)
    ct += '<Override PartName="/ppt/slides/slide' + i + '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>';
  ct += '</Types>';
  txt('[Content_Types].xml', ct);
  void tipos;

  txt('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>'
    + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
    + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
    + '</Relationships>');

  const iso = new Date().toISOString().replace(/\.\d+Z$/,'Z');
  txt('docProps/core.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"'
    + ' xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"'
    + ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
    + '<dc:title>Suministro de riel — ' + esc(fecha) + '</dc:title>'
    + '<dcterms:created xsi:type="dcterms:W3CDTF">' + iso + '</dcterms:created>'
    + '<dcterms:modified xsi:type="dcterms:W3CDTF">' + iso + '</dcterms:modified>'
    + '</cp:coreProperties>');
  txt('docProps/app.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"'
    + ' xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
    + '<Application>Adquisicion de riel</Application><Slides>' + L.length + '</Slides></Properties>');

  let pr = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>';
  for (let i = 1; i <= L.length; i++)
    pr += '<Relationship Id="rId' + (i+1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide' + i + '.xml"/>';
  pr += '<Relationship Id="rId' + (L.length+2) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>'
      + '</Relationships>';
  txt('ppt/_rels/presentation.xml.rels', pr);
  txt('ppt/presentation.xml', presentacionXML(L.length));
  txt('ppt/theme/theme1.xml', temaXML());
  txt('ppt/slideMasters/slideMaster1.xml', maestroXML());
  txt('ppt/slideMasters/_rels/slideMaster1.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>'
    + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>'
    + '</Relationships>');
  txt('ppt/slideLayouts/slideLayout1.xml', disenoXML());
  txt('ppt/slideLayouts/_rels/slideLayout1.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>'
    + '</Relationships>');

  porLamina.forEach((p, i)=>{
    const n = i + 1;
    txt('ppt/slides/slide' + n + '.xml', p.xml);
    let r = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>';
    p.medios.forEach(m => {
      const d = deURI(m.uri);
      m.archivo = 'media/l' + n + '-' + m.idx + '.' + d.ext;
      A.push({ nombre:'ppt/' + m.archivo, datos:d.datos });
      r += '<Relationship Id="rId' + (m.idx+1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../' + m.archivo + '"/>';
    });
    r += '</Relationships>';
    txt('ppt/slides/_rels/slide' + n + '.xml.rels', r);
  });

  return zip(A);
}

/* ============================================================
   API
   ============================================================ */
function bajar(blob, nombre){
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=> URL.revokeObjectURL(url), 4000);
}

/* Pasa un SVG de la página a PNG, para reaprovechar sus propios iconos
   isométricos en las tarjetas de lote. Si falla, la tarjeta va sin dibujo. */
function svgAPng(svg, ancho, alto){
  return new Promise(resolve => {
    try {
      if (!svg) return resolve(null);
      const copia = svg.cloneNode(true);
      copia.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      copia.setAttribute('width', ancho); copia.setAttribute('height', alto);
      const s = new XMLSerializer().serializeToString(copia);
      const img = new Image();
      img.onload = ()=>{
        try {
          const lz = document.createElement('canvas');
          lz.width = ancho; lz.height = alto;
          const g = lz.getContext('2d');
          g.drawImage(img, 0, 0, ancho, alto);
          resolve(lz.toDataURL('image/png'));
        } catch(e){ resolve(null); }
      };
      img.onerror = ()=> resolve(null);
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(s)));
    } catch(e){ resolve(null); }
  });
}

async function iconosDeLaPagina(){
  const ids = { entregado:'ico3', proceso:'ico2', pendiente:'ico6' };
  const out = {};
  for (const k in ids){
    const cont = document.getElementById(ids[k]);
    out[k] = await svgAPng(cont && cont.querySelector('svg'), 560, 373);
  }
  return out;
}

return {
  COLOR_PROYECTO, CICLO, rotuloCorto, titulo, num, pctTxt, razon,
  laminas, hacerPDF, hacerPDFDoc, hacerPPTX, bajar, iconosDeLaPagina,
  get assets(){ return window.REPORTE_ASSETS || null; },
};
})();
