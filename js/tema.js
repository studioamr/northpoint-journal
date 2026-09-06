/* ============================================================================
   NORTHPOINT JOURNAL — temas y perfil
   El tema se aplica con data-theme en <html>; los tokens viven en app.css.
   ========================================================================= */
(function(){
  const TEMAS = [
    {id:'glass-oscuro', n:'Glass Oscuro', d:'Minimal glassmorphism · negro + azulito · el de fábrica', sw:['#0a0d14','#5B9BFF']},
    {id:'glass-claro',  n:'Glass Claro',  d:'Minimal glassmorphism · blanco · clean, calm, clear', sw:['#DDE4EE','#ffffff']},
    {id:'glass-diamante', n:'Diamante', d:'Dark liquid glass animado · cristales blancos · fosfo verde = RICH', sw:['#04050a','#39FF14']},
    {id:'glass-oro',      n:'Lingotes',  d:'Liquid glass ámbar · lingotes de oro flotando · GOLD', sw:['#070502','#FFD54A']},
    {id:'glass-billetes', n:'Billetes',  d:'Liquid glass verde dólar · lluvia de billetes · CASH', sw:['#03100a','#85BB65']},
    {id:'glass-esmeralda',n:'Esmeralda', d:'Liquid glass esmeralda · cristales verdes · EMERALD', sw:['#02100b','#50FFB1']},
    {id:'glass-platino',  n:'Platino',   d:'Liquid glass gris hielo · lingotes de platino · PLATINUM', sw:['#07080b','#E6E9F0']},
    {id:'glass-btc',      n:'Bitcoin',   d:'Liquid glass naranja · monedas ₿ flotando · STACK SATS', sw:['#0b0602','#F7931A']},
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
  const RICH = ['glass-diamante','glass-oro','glass-billetes','glass-esmeralda','glass-platino','glass-btc'];
  function aplicar(id){
    if(id && id.startsWith('tron-')) id = id.replace('tron-', 'aurora-');   // los Tron viejos pasan a Aurora
    if(!id || id === 'acido' && !Store.ajustes._glass1){ id = 'glass-oscuro'; Store.ajustes.tema = id; Store.ajustes._glass1 = true; }
    if(!Store.ajustes._diam1){ id = 'glass-diamante'; Store.ajustes.tema = id; Store.ajustes._diam1 = true; Store.ajustes._glass1 = true; if(Store.guardar) Store.guardar(); }   // 6-sep-2026: estrena Diamante una vez; se cambia en Ajustes
    document.documentElement.setAttribute('data-theme', id || 'glass-oscuro');
    const rich = RICH.includes(id) ? id.replace('glass-', '') : null;
    if(rich) document.documentElement.setAttribute('data-rich', rich); else document.documentElement.removeAttribute('data-rich');
    const acc = getComputedStyle(document.documentElement).getPropertyValue('--acc').trim();
    window.__temaAcc = acc;
    document.dispatchEvent(new CustomEvent('mesa:tema', {detail:{id, acc}}));
  }
  function perfilActivo(){ try{ const id = localStorage.getItem('np.perfilActivo'); const lista = JSON.parse(localStorage.getItem('np.perfiles') || '[]'); return lista.find(p => p.id === id) || null; }catch(e){ return null; } }
  function iniciales(n){ return (n || '').trim().split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toUpperCase() || 'NP'; }
  function perfil(){ const pa = perfilActivo(); const nombre = pa ? pa.nombre : 'Trader';
    return Object.assign({nombre, alias:'', ciudad:'', frase:'Del examen al payout', foto:null, iniciales: iniciales(nombre)}, Store.ajustes.perfil || {}); }
  function guardaPerfil(campos){ Store.ajustes.perfil = Object.assign(perfil(), campos); Store.guardar(); }
  /* Copy exagerado por tema RICH («rich diamonds», «gold», «cash»…). Fuera de esos temas cada texto vuelve al normal. */
  const VOCES = {
    diamante:  {e:'💎', nombre:'RICH DIAMONDS', win:'DIAMOND HANDS', loss:'el diamante no se raya', be:'el diamante sigue intacto', gana:'GANASTE · RICH · DIAMOND HANDS · FUERA DE LAS GRÁFICAS', razon:'If W, get off the charts. Ya brillaste hoy: cierra la plataforma y cuida el diamante.', fin:'SE ACABÓ · EL DIAMANTE NO SE ARRIESGA', resumen:'RICH DIAMONDS · los cinco números que te hacen rico', cinta:'NORTHPOINT · RICH DIAMONDS · el primer trade es el primer quilate'},
    oro:       {e:'🥇', nombre:'GOLD', win:'LINGOTE ASEGURADO', loss:'el oro no se oxida', be:'el lingote sigue en la bóveda', gana:'GANASTE · GOLD · LINGOTE EN LA BÓVEDA · FUERA DE LAS GRÁFICAS', razon:'If W, get off the charts. Ya fundiste tu lingote de hoy: cierra la plataforma.', fin:'SE ACABÓ · EL ORO NO SE APUESTA', resumen:'GOLD · los cinco números de la bóveda', cinta:'NORTHPOINT · GOLD · el primer trade es el primer gramo'},
    billetes:  {e:'💵', nombre:'CASH', win:'MONEY PRINTER GO BRRR', loss:'la impresora descansa', be:'ni un billete de más ni de menos', gana:'GANASTE · CASH · APAGA LA IMPRESORA · FUERA DE LAS GRÁFICAS', razon:'If W, get off the charts. Ya imprimiste lo de hoy: cierra la plataforma.', fin:'SE ACABÓ · LOS BILLETES NO SE QUEMAN', resumen:'CASH · los cinco números de la caja fuerte', cinta:'NORTHPOINT · CASH · el primer trade es el primer billete'},
    esmeralda: {e:'💚', nombre:'EMERALD', win:'ESMERALDA TALLADA', loss:'la esmeralda no pierde el verde', be:'la esmeralda sigue entera', gana:'GANASTE · EMERALD · VERDE PROFUNDO · FUERA DE LAS GRÁFICAS', razon:'If W, get off the charts. Ya tallaste la esmeralda de hoy: cierra la plataforma.', fin:'SE ACABÓ · LA ESMERALDA NO SE RAYA', resumen:'EMERALD · los cinco números verdes', cinta:'NORTHPOINT · EMERALD · el primer trade es el primer quilate verde'},
    platino:   {e:'⚪', nombre:'PLATINUM', win:'PLATINUM STATUS', loss:'el platino no se dobla', be:'el platino sigue pulido', gana:'GANASTE · PLATINUM · NIVEL MÁXIMO · FUERA DE LAS GRÁFICAS', razon:'If W, get off the charts. Ya subiste de nivel hoy: cierra la plataforma.', fin:'SE ACABÓ · EL PLATINO NO SE ARRIESGA', resumen:'PLATINUM · los cinco números de élite', cinta:'NORTHPOINT · PLATINUM · el primer trade es el primer gramo'},
    btc:       {e:'₿', nombre:'STACK SATS', win:'SATS APILADOS', loss:'HODL · los sats no se venden', be:'ni un sat de más ni de menos', gana:'GANASTE · SATS APILADOS · HODL · FUERA DE LAS GRÁFICAS', razon:'If W, get off the charts. Ya apilaste los sats de hoy: cierra la plataforma.', fin:'SE ACABÓ · LOS SATS NO SE QUEMAN', resumen:'STACK SATS · los cinco números de la cadena', cinta:'NORTHPOINT · STACK SATS · el primer trade es el primer sat'}
  };
  function voz(clave, normal, arg){
    const r = document.documentElement.getAttribute('data-rich'); const V = r && VOCES[r]; if(!V) return normal;
    switch(clave){
      case 'trade.win':  return V.e + ' ' + V.nombre.split(' ')[0] + ' · ' + arg + ' · ' + V.win;
      case 'trade.loss': return V.e + ' STAY ' + V.nombre.split(' ')[0] + ' · ' + arg + ' · ' + V.loss;
      case 'trade.be':   return V.e + ' BREAK EVEN · ' + V.be;
      case 'resumen.sub':return V.resumen;
      case 'gana.titulo':return V.gana;
      case 'gana.razon': return V.razon;
      case 'fin.titulo': return V.fin;
      case 'ficha.pie':  return V.nombre + ' · CONDICIÓN · CONTINUACIÓN · EQUILIBRIO + FVG · TP INTERNO';
      case 'cinta.vacia':return V.cinta;
      default: return normal;
    }
  }
  window.Tema = { TEMAS, RICH, aplicar, perfil, guardaPerfil, voz, perfilActivo, iniciales };
  aplicar((Store.ajustes && Store.ajustes.tema) || 'glass-oscuro');
})();
