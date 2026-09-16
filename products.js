(() => {
  const section = document.querySelector('#produtos');
  const $ = selector => section.querySelector(selector);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const products = [
    {id:'black',name:'Polo Personal Black',color:'Black',price:149.90,description:'Leveza para acompanhar seu ritmo. Polo Dry Fit respirável, de secagem rápida e acabamento premium para vestir sua profissão.',background:'radial-gradient(ellipse at 52% 44%, #555e69 0%, #303740 35%, #181c21 75%)',muted:'#d1d7de',border:'#b0bac4'},
    {id:'chumbo',name:'Polo Personal Chumbo',color:'Chumbo',price:159.90,description:'Presença em cada detalhe. O cinza chumbo encontra o conforto do Dry Fit em uma polo de caimento cuidado, feita para acompanhar seus atendimentos.',background:'radial-gradient(ellipse at 52% 44%, #596570 0%, #505c68 38%, #303b46 80%)',muted:'#e2e7ec',border:'#bec8d0'}
  ];
  products.forEach(p => {p.images={masculina:`assets/polo-${p.id}-masculina.png`,feminina:`assets/polo-${p.id}-feminina.png`};});
  let index=0, gender='masculina', size=null, busy=false, timeline=null;
  const current=$('.product-current'), incoming=$('.product-incoming'), spin=$('.product-spin');
  const nextThumb=$('.next-product img');
  const bg=$('.product-bg'), nextBg=$('.product-bg-next');
  const copy=$('.product-copy'), options=$('.product-options'), count=$('.product-count'), nextLabel=$('.next-product span');
  const detailTargets=[copy,options,count];
  const controls=[...section.querySelectorAll('button')];
  const feedback=$('.product-feedback');
  const toast=document.querySelector('.cart-toast');
  const toastProduct=toast.querySelector('.cart-toast__product');
  const toastClose=toast.querySelector('.cart-toast__close');
  const sizeOptions=$('.size-options'),sizeError=$('.size-error');
  const sizeGuideTrigger=$('.size-guide-trigger');
  const sizeGuideLayer=document.querySelector('.size-guide-layer');
  const sizeGuideDialog=document.querySelector('.size-guide-dialog');
  const sizeGuideOverlay=document.querySelector('.size-guide-overlay');
  const sizeGuideClose=document.querySelector('.size-guide-close');
  const pageHeader=document.querySelector('body > .header');
  const pageMain=document.querySelector('main');
  let toastTimer=null,toastTimeline=null;
  let guideOpen=false,guideTimeline=null,guideReturnFocus=null;
  const price=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const canAnimate=()=>window.gsap && !reduced.matches;
  const cache=new Map();
  function load(src){
    if(!cache.has(src)){
      const image=new Image();image.src=src;
      const promise=image.decode().catch(error=>{cache.delete(src);throw error;});
      cache.set(src,promise);
    }
    return cache.get(src);
  }
  function lock(value){busy=value;controls.forEach(button=>{button.disabled=value;});section.setAttribute('aria-busy',String(value));}
  function hideToast(immediate=false){
    clearTimeout(toastTimer);toastTimer=null;
    toastTimeline?.kill();toastTimeline=null;
    if(toast.hidden)return;
    const finish=()=>{toast.hidden=true;toast.setAttribute('aria-hidden','true');if(window.gsap)gsap.set(toast,{clearProps:'all'});};
    if(immediate || !canAnimate()){finish();return;}
    toastTimeline=gsap.to(toast,{y:14,autoAlpha:0,scale:.98,duration:.22,ease:'power2.in',onComplete:finish});
  }
  function showToast(product,variant,selectedSize){
    clearTimeout(toastTimer);
    toastTimeline?.kill();toastTimeline=null;
    toastProduct.textContent=`${product.name} · ${variant} · tamanho ${selectedSize}`;
    toast.hidden=false;toast.setAttribute('aria-hidden','false');
    if(canAnimate())toastTimeline=gsap.fromTo(toast,{y:18,autoAlpha:0,scale:.98},{y:0,autoAlpha:1,scale:1,duration:.36,ease:'power3.out'});
    toastTimer=setTimeout(()=>hideToast(),4000);
  }
  function renderDetails(){
    const p=products[index],next=products[(index+1)%products.length];
    $('#product-name').replaceChildren(document.createTextNode('Polo Personal '),document.createElement('br'),document.createTextNode(p.color));
    $('#product-description').textContent=p.description;
    $('.product-price').textContent=price.format(p.price);
    $('.product-count').textContent=`0${index+1} / 02`;
    $('.next-product strong').textContent=next.name;
    $('.next-product').setAttribute('aria-label',`Ver ${next.name}, modelagem ${gender}`);
    section.querySelectorAll('[data-gender]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.gender===gender)));
    section.querySelectorAll('[data-size]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.size===size)));
    section.style.setProperty('--product-muted',p.muted);section.style.setProperty('--product-border',p.border);
  }
  function renderImages(){
    const p=products[index],next=products[(index+1)%products.length];
    current.src=p.images[gender];current.alt=`${p.name}, modelagem ${gender}`;
    nextThumb.src=next.images[gender];
  }
  function render(){renderDetails();renderImages();}
  function settle(){
    timeline?.kill();timeline=null;
    render();bg.style.background=products[index].background;
    if(window.gsap)gsap.set([spin,current,incoming,nextBg,$('.product-stage'),nextThumb,nextLabel,...detailTargets],{clearProps:'all'});
    incoming.hidden=true;nextBg.style.opacity='0';lock(false);
  }
  function fitRect(element,ratio){
    const rect=element.getBoundingClientRect();
    const width=Math.min(rect.width,rect.height*ratio);
    const height=width/ratio;
    return {x:rect.left+(rect.width-width)/2,y:rect.top+(rect.height-height)/2,width,height};
  }
  async function changeProduct(direction){
    if(busy)return;lock(true);feedback.textContent='';
    const target=(index+direction+products.length)%products.length;
    try{await load(products[target].images[gender]);}catch{feedback.textContent='Não foi possível carregar a camisa. Tente novamente.';lock(false);return;}
    if(!canAnimate()){index=target;settle();return;}
    incoming.src=products[target].images[gender];incoming.hidden=false;
    nextBg.style.background=products[target].background;
    const ratio=incoming.naturalWidth/incoming.naturalHeight || 2/3;
    const origin=fitRect(nextThumb,ratio);
    const destination=fitRect(incoming,ratio);
    const startScale=origin.width/destination.width;
    const startX=origin.x+origin.width/2-(destination.x+destination.width/2);
    const startY=origin.y+origin.height/2-(destination.y+destination.height/2);
    gsap.set($('.product-stage'),{zIndex:5});
    gsap.set(incoming,{x:startX,y:startY,scale:startScale,transformOrigin:'50% 50%'});
    timeline=gsap.timeline({onComplete:()=>{settle();}})
      .set(nextThumb,{autoAlpha:0},0)
      .to(incoming,{x:0,y:0,scale:1,duration:1.05,ease:'power3.inOut'},0)
      .fromTo(nextBg,{opacity:0,scale:.96},{opacity:1,scale:1,duration:1.05,ease:'power2.out'},.08)
      .to(detailTargets,{autoAlpha:0,y:8,duration:.25,ease:'power2.in'},.25)
      .to(nextLabel,{autoAlpha:0,x:14,duration:.2,ease:'power2.in'},.3)
      .call(()=>{index=target;renderDetails();},[],.5)
      .set(detailTargets,{y:-8},.5)
      .to(detailTargets,{autoAlpha:1,y:0,duration:.42,ease:'power2.out'},.53)
      // Remove the old silhouette before the incoming shirt reaches its final bounds.
      .to(current,{autoAlpha:0,duration:.38,ease:'power2.out'},.48)
      .call(renderImages,[],.88)
      // Both layers are now the same product and aligned, so the handoff has no visible snap.
      .to(current,{autoAlpha:1,duration:.26,ease:'power1.out'},1.04)
      .to(incoming,{autoAlpha:0,duration:.26,ease:'power1.out'},1.04)
      .fromTo(nextThumb,{x:65,autoAlpha:0},{x:0,autoAlpha:1,duration:.55,ease:'power3.out'},1.1)
      .fromTo(nextLabel,{x:14,autoAlpha:0},{x:0,autoAlpha:1,duration:.45,ease:'power2.out'},1.15);
  }
  async function changeGender(target){
    if(busy || gender===target)return;lock(true);feedback.textContent='';
    const nextIndex=(index+1)%products.length;
    try{await Promise.all([load(products[index].images[target]),load(products[nextIndex].images[target])]);}catch{feedback.textContent='Não foi possível carregar essa modelagem. Tente novamente.';lock(false);return;}
    if(!canAnimate()){gender=target;settle();return;}
    timeline=gsap.timeline({onComplete:settle})
      .to([spin,nextThumb],{rotationY:90,duration:.6,ease:'power2.in'})
      .call(()=>{gender=target;render();})
      // Swap both shirts while edge-on, then continue from the opposite edge.
      .set([spin,nextThumb],{rotationY:-90})
      .to([spin,nextThumb],{rotationY:0,duration:.6,ease:'power2.out'});
  }
  section.querySelectorAll('[data-direction]').forEach(button=>button.addEventListener('click',()=>changeProduct(Number(button.dataset.direction))));
  $('.next-product').addEventListener('click',()=>changeProduct(1));
  section.querySelectorAll('[data-gender]').forEach(button=>button.addEventListener('click',()=>changeGender(button.dataset.gender)));
  section.querySelectorAll('[data-size]').forEach(button=>button.addEventListener('click',()=>{
    size=button.dataset.size;
    sizeError.textContent='';
    sizeOptions.classList.remove('is-invalid');
    sizeOptions.setAttribute('aria-invalid','false');
    section.querySelectorAll('[data-size]').forEach(option=>option.setAttribute('aria-pressed',String(option===button)));
  }));
  $('.add-cart').addEventListener('click',()=>{
    if(!size){
      sizeError.textContent='Selecione um tamanho para continuar.';
      sizeOptions.classList.remove('is-invalid');
      void sizeOptions.offsetWidth;
      sizeOptions.classList.add('is-invalid');
      sizeOptions.setAttribute('aria-invalid','true');
      section.querySelector('[data-size]').focus({preventScroll:true});
      return;
    }
    const product=products[index];
    showToast(product,gender,size);
    window.dispatchEvent(new CustomEvent('elemenctor:cart-add',{detail:{id:product.id,name:product.name,gender,size,price:product.price,image:product.images[gender]}}));
  });
  toastClose.addEventListener('click',()=>hideToast());
  function guideCanAnimate(){return window.gsap && !reduced.matches;}
  function setGuidePageInactive(value){pageHeader.inert=value;pageMain.inert=value;document.body.classList.toggle('size-guide-open',value);}
  function finishGuideClose(){
    guideOpen=false;sizeGuideLayer.hidden=true;sizeGuideLayer.setAttribute('aria-hidden','true');setGuidePageInactive(false);
    if(window.gsap)gsap.set([sizeGuideOverlay,sizeGuideDialog],{clearProps:'all'});
    guideReturnFocus?.focus({preventScroll:true});guideReturnFocus=null;
  }
  function openGuide(){
    if(guideOpen)return;guideOpen=true;guideReturnFocus=document.activeElement;
    sizeGuideLayer.hidden=false;sizeGuideLayer.setAttribute('aria-hidden','false');setGuidePageInactive(true);
    guideTimeline?.kill();
    if(!guideCanAnimate()){sizeGuideClose.focus({preventScroll:true});return;}
    guideTimeline=gsap.timeline({onComplete:()=>{guideTimeline=null;sizeGuideClose.focus({preventScroll:true});}})
      .fromTo(sizeGuideOverlay,{opacity:0},{opacity:1,duration:.28,ease:'power2.out'},0)
      .fromTo(sizeGuideDialog,{autoAlpha:0,y:18,scale:.975},{autoAlpha:1,y:0,scale:1,duration:.38,ease:'power3.out'},0);
  }
  function closeGuide(){
    if(!guideOpen)return;guideTimeline?.kill();
    if(!guideCanAnimate()){finishGuideClose();return;}
    guideTimeline=gsap.timeline({onComplete:finishGuideClose})
      .to(sizeGuideDialog,{autoAlpha:0,y:12,scale:.985,duration:.22,ease:'power2.in'},0)
      .to(sizeGuideOverlay,{opacity:0,duration:.2,ease:'power2.in'},.04);
  }
  function handleGuideKeys(event){
    if(!guideOpen)return;
    if(event.key==='Escape'){event.preventDefault();closeGuide();return;}
    if(event.key!=='Tab')return;
    const focusable=[...sizeGuideDialog.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
    if(!focusable.length){event.preventDefault();sizeGuideDialog.focus();return;}
    const first=focusable[0],last=focusable[focusable.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
  sizeGuideTrigger.addEventListener('click',openGuide);
  sizeGuideClose.addEventListener('click',closeGuide);
  sizeGuideOverlay.addEventListener('click',closeGuide);
  document.addEventListener('keydown',handleGuideKeys);
  // Complete a running transition if the motion preference changes mid-animation.
  reduced.addEventListener('change',()=>{if(reduced.matches&&timeline)timeline.progress(1);if(reduced.matches&&guideTimeline)guideTimeline.progress(1);});
  window.addEventListener('resize',()=>{if(timeline)timeline.progress(1);});
  const observer=new IntersectionObserver(entries=>{
    if(!entries.some(entry=>entry.isIntersecting))return;
    observer.disconnect();
    products.forEach(p=>Object.values(p.images).forEach(src=>load(src).catch(()=>{})));
    if(canAnimate())gsap.fromTo($('.product-layout'),{y:25,opacity:0},{y:0,opacity:1,duration:.8,ease:'power2.out',clearProps:'all'});
  },{threshold:.15});
  observer.observe(section);render();
})();
