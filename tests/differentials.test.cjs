const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'differentials.js'),'utf8');
const markup=fs.readFileSync(path.join(root,'index.html'),'utf8');
const styles=fs.readFileSync(path.join(root,'differentials.css'),'utf8');

function element(dataset={}){
  const classes=new Set();
  return {dataset,style:{},attributes:{},textContent:'',classList:{
    add:name=>classes.add(name),remove:name=>classes.delete(name),
    contains:name=>classes.has(name),toggle(name,value){value?classes.add(name):classes.delete(name);}
  },setAttribute(key,value){this.attributes[key]=value;},removeAttribute(key){delete this.attributes[key];}};
}

function setup({reduced=false}={}){
  const steps=Array.from({length:4},(_,index)=>element({step:String(index)}));
  const visuals=Array.from({length:4},(_,index)=>element({visual:String(index)}));
  steps[0].classList.add('is-active');visuals[0].classList.add('is-active');
  const current=element(),progress=element();
  const section={querySelectorAll(selector){return selector==='[data-step]'?steps:visuals;},querySelector(selector){return selector.includes('current')?current:progress;}};
  let callback;
  const context={
    document:{querySelector:selector=>selector==='.differentials'?section:null},
    matchMedia:()=>({matches:reduced,addEventListener(){}}),innerWidth:1280,
    window:{},IntersectionObserver:class{constructor(fn){callback=fn;}observe(){}},
  };
  vm.runInNewContext(source,context);
  return {steps,visuals,current,progress,activate(index){callback([{isIntersecting:true,target:steps[index]}]);}};
}

test('capítulos atualizam imagem, contador, progresso e aria-current sem GSAP',()=>{
  const app=setup();
  app.activate(2);
  assert.equal(app.current.textContent,'03');
  assert.equal(app.progress.style.transform,'scaleX(0.75)');
  assert.equal(app.steps[2].attributes['aria-current'],'step');
  assert.equal(app.steps[0].attributes['aria-current'],undefined);
  assert.equal(app.visuals[2].classList.contains('is-active'),true);
  assert.equal(app.visuals[0].classList.contains('is-active'),false);
});

test('movimento reduzido mantém troca imediata e estado consistente',()=>{
  const app=setup({reduced:true});
  app.activate(3);
  assert.equal(app.current.textContent,'04');
  assert.equal(app.progress.style.transform,'scaleX(1)');
  assert.equal(app.visuals.filter(item=>item.classList.contains('is-active')).length,1);
});

test('marcação preserva ordem, lazy loading e CTA original para produtos',()=>{
  const section=markup.match(/<section id="diferenciais" class="differentials"[\s\S]*?<section id="produtos"/)?.[0]||'';
  const expected=['ESTAMPA EMBORRACHADA.jpg.jpeg','GOLA ENTERTELA.jpeg','GOLA ACABAMENTO CRUZADO.jpeg','PRODUTO DE QUALIDADE.png'];
  let cursor=-1;
  expected.forEach(name=>{const next=section.indexOf(name,cursor+1);assert.ok(next>cursor);cursor=next;});
  assert.match(section,/loading="lazy"/);
  assert.match(markup,/<button class="cta" type="button">\s*Conhecer produtos/);
});

test('quarto visual usa enquadramento contido e fundo ambiente no desktop',()=>{
  const block=styles.match(/\.differentials__visual\[data-visual="3"\][\s\S]*?\.differentials__shade/)?.[0]||'';
  assert.match(block,/::before/);
  assert.match(block,/PRODUTO DE QUALIDADE\.png/) 
  assert.match(block,/filter: blur\(18px\)/);
  assert.match(block,/object-fit: contain/);
  assert.match(block,/transform: scale\(1\.05\)/);
});
