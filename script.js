(() => {
  const $ = (s) => document.querySelector(s);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let timeline, pulse, finished = false;
  const reveal = ['.title', '.portrait', '.hero-bottom', '.header'];
  const path = $('#brand-arc');
  const letters = [...document.querySelectorAll('.title-arc text')];
  const thresholds = letters.map(letter => parseFloat(letter.firstElementChild.getAttribute('startOffset')) / 100);
  const pathLength = path.getTotalLength();
  const metrics = document.createElement('canvas').getContext('2d');
  const letterStyle = getComputedStyle(letters[0]);
  metrics.font = `${letterStyle.fontWeight} ${letterStyle.fontSize} ${letterStyle.fontFamily}`;
  const halfCapHeight = metrics.measureText('H').actualBoundingBoxAscent / 2;
  // SVG and the fixed logo share screen coordinates, including responsive scaling.
  function arcPosition(progress) {
    const point = path.getPointAtLength(pathLength * progress);
    const before = path.getPointAtLength(Math.max(0, pathLength * progress - 1));
    const after = path.getPointAtLength(Math.min(pathLength, pathLength * progress + 1));
    const dx = after.x - before.x, dy = after.y - before.y;
    const length = Math.hypot(dx, dy);
    const screen = new DOMPoint(
      point.x + dy / length * halfCapHeight,
      point.y - dx / length * halfCapHeight
    ).matrixTransform(path.getScreenCTM());
    return {x:screen.x - innerWidth / 2, y:screen.y - innerHeight / 2};
  }
  function finish() {
    finished = true;
    timeline?.kill(); pulse?.kill();
    if (window.gsap) gsap.set([...reveal, ...letters], {clearProps:'all'});
    document.body.classList.add('is-ready');
    if (document.activeElement === $('.skip')) $('.cta').focus({preventScroll:true});
  }
  $('.skip').addEventListener('click', finish);
  reduce.addEventListener('change', e => { if (e.matches) finish(); });
  $('.cta').addEventListener('click', () => {
    $('#produtos').scrollIntoView({behavior: reduce.matches ? 'instant' : 'smooth'});
  });
  if (reduce.matches || !window.gsap) { finish(); return; }
  gsap.set(reveal, {autoAlpha:0});
  gsap.set(letters, {opacity:0});
  pulse = gsap.to('.travel-logo img', {opacity:.4,scale:.95,duration:.9,repeat:-1,yoyo:true,ease:'sine.inOut'});
  const images = [...document.querySelectorAll('.hero img, .header img, .travel-logo img')];
  const loaded = Promise.allSettled(images.map(img => img.decode()));
  const timeout = new Promise(resolve => setTimeout(resolve, 7000));
  gsap.to('.loading-track span',{scaleX:.8,duration:1.3,ease:'power2.out'});
  Promise.all([Promise.race([loaded, timeout]),new Promise(resolve => setTimeout(resolve,1400))]).then(() => {
    if (finished) return;
    pulse.kill();
    gsap.set('.travel-logo img',{opacity:1,scale:1});
    const arc = {progress:0};
    const gap = innerWidth <= 640 ? 16 : 24;
    const lastRight = letters.at(-1).getBoundingClientRect().right;
    // Reserve the full pulse width, including on narrow screens.
    const flightScale = Math.min(1, Math.max(.1, (innerWidth - 8 - lastRight - gap) / (100 * 1.12)));
    const end = arcPosition(1);
    const nearEnd = arcPosition(.99);
    const exitX = Math.max(end.x, lastRight + gap + 50 * flightScale * 1.12 - innerWidth / 2);
    const exitY = end.y + (exitX - end.x) * (end.y - nearEnd.y) / (end.x - nearEnd.x);
    timeline = gsap.timeline({onComplete:finish});
    timeline.to('.loading-track span',{scaleX:1,duration:.25})
      .to('.loading-track',{opacity:0,duration:.3})
      .to('.intro',{opacity:0,duration:.65},'brand')
      .to('.travel-logo',{...arcPosition(0),scale:flightScale,duration:.6,ease:'power2.inOut'},'brand')
      .set('.title',{autoAlpha:1},'brand+=.6')
      .to(arc,{progress:1,duration:2,ease:'power1.inOut',onUpdate:()=>{
        gsap.set('.travel-logo',arcPosition(arc.progress));
        letters.forEach((letter,index)=>{
          // A short fade driven by the same progress, with no independent stagger.
          const opacity = Math.max(0,Math.min(1,(arc.progress - thresholds[index]) / .04));
          letter.style.opacity = opacity;
        });
      }},'brand+=.6')
      .to('.travel-logo',{x:exitX,y:exitY,duration:.3,ease:'power2.out'},'brand+=2.6')
      .to('.travel-logo',{scale:flightScale * 1.12,duration:.25,ease:'sine.inOut'},'brand+=2.9')
      .to('.travel-logo',{scale:0,autoAlpha:0,duration:.4,ease:'power2.in'},'brand+=3.15')
      .fromTo('.portrait',{autoAlpha:0,y:220},{autoAlpha:1,y:0,duration:1.6,ease:'power3.out'},'brand+=2.6')
      .fromTo('.hero-bottom',{autoAlpha:0,y:20},{autoAlpha:1,y:0,duration:.75,ease:'power2.out'},'brand+=3.7')
      .fromTo('.header',{autoAlpha:0,y:-20},{autoAlpha:1,y:0,duration:.75,ease:'power2.out'},'brand+=3.7');
  });
  // SVG rescales the shared arc automatically; cancel any in-flight screen coordinates.
  window.addEventListener('resize', () => { if (!finished) finish(); });
})();
