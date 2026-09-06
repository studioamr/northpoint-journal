/* ============================================================================
   NORTHPOINT JOURNAL — temas y perfil
   El tema se aplica con data-theme en <html>; los tokens viven en app.css.
   ========================================================================= */
(function(){
  const TEMAS = [
    {id:'glass-oscuro', n:'Glass Oscuro', d:'Minimal glassmorphism · negro + azulito · el de fábrica', sw:['#0a0d14','#5B9BFF']},
    {id:'glass-claro',  n:'Glass Claro',  d:'Minimal glassmorphism · blanco · clean, calm, clear', sw:['#DDE4EE','#ffffff']},
    {id:'glass-diamante', n:'Diamante', d:'Dark liquid glass animado · cristales blancos · fosfo verde = RICH', sw:['#04050a','#39FF14']},
    {id:'acido',   n:'Lima',         d:'Carbón + lima', sw:['#0d0d0f','#C6FF3D']},
    {id:'bosque',  n:'Bosque',       d:'Verde profundo → menta · vidrio', sw:['#051F20','#8EB69B']},
    {id:'oceano',  n:'Océano',       d:'Azul marino → hielo · vidrio', sw:['#021024','#7DA0CA']},
    {id:'noche',   n:'Noche',        d:'Navy + azul eléctrico + ámbar', sw:['#0a0e1a','#4F8CFF']},
    {id:'blanco',  n:'Blanco',       d:'Negro + blanco · la marca original'},
    {id:'oro',     n:'Oro',          d:'Negro + dorado NorthPoint · trader backing'},
    {id:'papel',   n:'Papel',        d:'Claro, tinta y un acento · para el día'},
    {id:'cobalto', n:'Cobalto',      d:'Azul profundo + hielo'},
    {id:'aurora-azul',    n:'Aurora Azul',    d:'Vidrio + aurora cian que se mueve', sw:['#070b16','#38BDF8']},
    {id:'aurora-naranja', n:'Aurora Naranja', d:'Vidrio + aurora ámbar y coral', sw:['#120906','#FB923C']},
    {id:'aurora-morado',  n:'Aurora Morado',  d:'Vidrio + aurora violeta y rosa', sw:['#0c0714','#A78BFA']},
    {id:'aurora-verde',   n:'Aurora Verde',   d:'Vidrio + aurora esmeralda', sw:['#06110d','#34D399']}
  ];
  function aplicar(id){
    if(id && id.startsWith('tron-')) id = id.replace('tron-', 'aurora-');   // los Tron viejos pasan a Aurora
    if(!id || id === 'acido' && !Store.ajustes._glass1){ id = 'glass-oscuro'; Store.ajustes.tema = id; Store.ajustes._glass1 = true; }
    if(!Store.ajustes._diam1){ id = 'glass-diamante'; Store.ajustes.tema = id; Store.ajustes._diam1 = true; Store.ajustes._glass1 = true; if(Store.guardar) Store.guardar(); }   // 6-sep-2026: estrena Diamante una vez; se cambia en Ajustes
    document.documentElement.setAttribute('data-theme', id || 'glass-oscuro');
    const acc = getComputedStyle(document.documentElement).getPropertyValue('--acc').trim();
    window.__temaAcc = acc;
    document.dispatchEvent(new CustomEvent('mesa:tema', {detail:{id, acc}}));
  }
  function perfil(){ return Object.assign({nombre:'André', alias:'', ciudad:'Morelia', frase:'Del examen al payout', foto:null, iniciales:'AM'}, Store.ajustes.perfil || {}); }
  function guardaPerfil(campos){ Store.ajustes.perfil = Object.assign(perfil(), campos); Store.guardar(); }
  /* Copy del tema Diamante: exagerado, «rich diamonds». Fuera de ese tema cada texto vuelve al normal. */
  const VOZ = {
    'trade.win':    n => '💎 RICH · ' + n + ' · DIAMOND HANDS',
    'trade.loss':   n => '💎 STAY RICH · ' + n + ' · el diamante no se raya',
    'trade.be':     n => '💎 BREAK EVEN · el diamante sigue intacto',
    'resumen.sub':  () => 'RICH DIAMONDS · los cinco números que te hacen rico',
    'gana.titulo':  () => 'GANASTE · RICH · DIAMOND HANDS · FUERA DE LAS GRÁFICAS',
    'gana.razon':   () => 'If W, get off the charts. Ya brillaste hoy: cierra la plataforma y cuida el diamante.',
    'fin.titulo':   () => 'SE ACABÓ · EL DIAMANTE NO SE ARRIESGA',
    'ficha.pie':    () => 'RICH DIAMONDS · CONDICIÓN · CONTINUACIÓN · EQUILIBRIO + FVG · TP INTERNO',
    'cinta.vacia':  () => 'NORTHPOINT · RICH DIAMONDS · el primer trade es el primer quilate'
  };
  function voz(clave, normal, arg){ const esD = document.documentElement.getAttribute('data-theme') === 'glass-diamante'; return esD && VOZ[clave] ? VOZ[clave](arg) : normal; }
  window.Tema = { TEMAS, aplicar, perfil, guardaPerfil, voz };
  aplicar((Store.ajustes && Store.ajustes.tema) || 'glass-oscuro');
})();
