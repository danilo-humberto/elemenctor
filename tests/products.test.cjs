const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'..','products.js'),'utf8');
const markup=fs.readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8');

function setup({reduced=false,fail=false}={}) {
  function element(dataset={}) {
    const classes=new Set();
    return {dataset,disabled:false,hidden:false,inert:false,style:{setProperty(){}},attributes:{},events:{},textContent:'',offsetWidth:100,
      classList:{add(...names){names.forEach(name=>classes.add(name));},remove(...names){names.forEach(name=>classes.delete(name));},toggle(name,value){if(value===undefined)value=!classes.has(name);value?classes.add(name):classes.delete(name);return value;},contains(name){return classes.has(name);}},
      setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,fn){this.events[k]=fn;},
      focus(){this.focused=true;},querySelectorAll(){return [];},
      replaceChildren(...children){this.textContent=children.map(c=>c.textContent||'').join('');}};
  }
  let timer=null;
  const elements=new Map();
  const query=s=>{if(!elements.has(s))elements.set(s,element());return elements.get(s);};
  const genders=[element({gender:'masculina'}),element({gender:'feminina'})];
  const sizes=['P','M','G','GG'].map(size=>element({size}));
  const directions=[element({direction:'-1'}),element({direction:'1'})];
  const buttons=[...genders,...sizes,...directions,query('.next-product'),query('.add-cart'),query('.size-guide-trigger')];
  const section=element();section.querySelector=s=>s==='[data-size]'?sizes[0]:query(s);
  section.querySelectorAll=s=>s==='button'?buttons:s==='[data-gender]'?genders:s==='[data-size]'?sizes:directions;
  const toast=query('.cart-toast');toast.hidden=true;toast.querySelector=query;
  const dispatched=[];
  class CustomEvent { constructor(type,options={}){this.type=type;this.detail=options.detail;} }
  const context={Intl,Map,Image:class{decode(){return fail?Promise.reject(Error('failed')):Promise.resolve();}},
    CustomEvent,
    document:{activeElement:null,body:element(),querySelector:s=>s==='#produtos'?section:query(s),createTextNode:textContent=>({textContent}),createElement:()=>element(),addEventListener(){}},
    matchMedia:()=>({matches:reduced,addEventListener(){}}),
    setTimeout(fn){timer=fn;return 1;},clearTimeout(){timer=null;},
    IntersectionObserver:class{observe(){} disconnect(){}},
    window:{addEventListener(){},dispatchEvent(event){dispatched.push(event);},...(reduced?{gsap:{}}:{})},
    gsap:{set(){},timeline(){throw Error('Animation must not run in fallback');}}
  };
  vm.runInNewContext(source,context);
  return {query,genders,sizes,directions,section,buttons,dispatched,runTimer(){const fn=timer;timer=null;fn?.();}};
}

for(const reduced of [false,true])test(reduced?'movimento reduzido mantém produto e variante sincronizados':'sem GSAP mantém produto e variante sincronizados',async()=>{
  const app=setup({reduced});
  await app.genders[1].events.click();
  assert.match(app.query('.product-current').src,/black-feminina/);
  assert.match(app.query('.next-product img').src,/chumbo-feminina/);
  await app.directions[1].events.click();
  assert.equal(app.query('#product-name').textContent,'Polo Personal Chumbo');
  assert.match(app.query('.product-current').src,/chumbo-feminina/);
  assert.match(app.query('.product-bg').style.background,/#596570/);
  assert.match(app.query('.product-price').textContent,/159/);
  app.sizes[1].events.click();
  app.query('.add-cart').events.click();
  assert.equal(app.query('.cart-toast').hidden,false);
  assert.match(app.query('.cart-toast__product').textContent,/Chumbo · feminina · tamanho M/);
  assert.equal(app.dispatched.at(-1).type,'elemenctor:cart-add');
  assert.deepEqual({...app.dispatched.at(-1).detail},{id:'chumbo',name:'Polo Personal Chumbo',gender:'feminina',size:'M',price:159.9,image:'assets/polo-chumbo-feminina.png'});
  assert.doesNotMatch(app.query('.cart-toast__product').textContent,/demonstra|disponível/i);
  await app.directions[0].events.click();
  assert.match(app.query('.product-current').src,/black-feminina/);
  assert.equal(app.section.attributes['aria-busy'],'false');
  assert.ok(app.buttons.every(b=>!b.disabled));
});
test('toast fecha manualmente e automaticamente sem duplicar o componente',()=>{
  const app=setup();
  app.sizes[0].events.click();
  app.query('.add-cart').events.click();
  assert.equal(app.query('.cart-toast').hidden,false);
  app.query('.cart-toast__close').events.click();
  assert.equal(app.query('.cart-toast').hidden,true);
  app.query('.add-cart').events.click();
  app.runTimer();
  assert.equal(app.query('.cart-toast').hidden,true);
  assert.match(markup,/class="cart-toast" role="status" aria-live="polite" aria-atomic="true"/);
  assert.equal((markup.match(/class="cart-toast" role=/g)||[]).length,1);
});
test('tamanho é obrigatório e permanece selecionado durante a navegação',async()=>{
  const app=setup();
  app.query('.add-cart').events.click();
  assert.equal(app.dispatched.length,0);
  assert.match(app.query('.size-error').textContent,/Selecione um tamanho/);
  assert.equal(app.sizes[0].focused,true);
  app.sizes[3].events.click();
  await app.genders[1].events.click();
  await app.directions[1].events.click();
  assert.equal(app.sizes[3].attributes['aria-pressed'],'true');
  app.query('.add-cart').events.click();
  assert.equal(app.dispatched.at(-1).detail.size,'GG');
});
test('falha de imagem preserva o produto e libera controles',async()=>{
  const app=setup({fail:true});await app.directions[1].events.click();
  assert.equal(app.query('#product-name').textContent,'Polo Personal Black');
  assert.match(app.query('.product-feedback').textContent,/Tente novamente/);
  assert.ok(app.buttons.every(b=>!b.disabled));
});
test('comandos concorrentes não duplicam navegação',async()=>{
  const app=setup();await Promise.all([app.directions[1].events.click(),app.directions[1].events.click()]);
  assert.equal(app.query('#product-name').textContent,'Polo Personal Chumbo');
});
test('troca de modelagem acontece de perfil sem ocultar a camisa',()=>{
  const block=source.match(/async function changeGender[\s\S]*?\n  }/)?.[0]||'';
  assert.match(block,/Promise\.all\(\[load\(products\[index\]\.images\[target\]\),load\(products\[nextIndex\]\.images\[target\]\)\]\)/);
  assert.match(block,/\.to\(\[spin,nextThumb\],\{rotationY:90,duration:\.6/);
  assert.match(block,/\.call\(\(\)=>\{gender=target;render\(\);\}\)/);
  assert.match(block,/\.set\(\[spin,nextThumb\],\{rotationY:-90\}\)/);
  assert.match(block,/\.to\(\[spin,nextThumb\],\{rotationY:0,duration:\.6/);
  assert.doesNotMatch(block,/opacity|autoAlpha/);
});
test('troca de produto faz handoff após esconder dados e camisa anterior',()=>{
  const block=source.match(/async function changeProduct[\s\S]*?\n  }/)?.[0]||'';
  const detailsOut=block.indexOf(".to(detailTargets,{autoAlpha:0");
  const updateDetails=block.indexOf('index=target;renderDetails()');
  const oldShirtOut=block.indexOf('.to(current,{autoAlpha:0');
  const updateImages=block.indexOf('.call(renderImages');
  const handoff=block.indexOf('.to(current,{autoAlpha:1');
  assert.ok(detailsOut>=0 && detailsOut<updateDetails);
  assert.ok(oldShirtOut>=0 && oldShirtOut<updateImages);
  assert.ok(updateImages<handoff);
  assert.match(block,/\.to\(incoming,\{autoAlpha:0/);
  assert.match(block,/\.fromTo\(nextLabel/);
});
test('modal do guia possui imagem, diálogo e rotas de fechamento',()=>{
  assert.match(markup,/id="size-guide-dialog"[^>]*role="dialog"[^>]*aria-modal="true"/);
  assert.match(markup,/GUIA DE TAMANHOS UNIF\.png/);
  assert.match(source,/sizeGuideOverlay\.addEventListener\('click',closeGuide\)/);
  assert.match(source,/event\.key==='Escape'/);
});
