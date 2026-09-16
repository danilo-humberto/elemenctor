(() => {
  const section = document.querySelector('.differentials');
  if (!section) return;

  const steps = [...section.querySelectorAll('[data-step]')];
  const visuals = [...section.querySelectorAll('[data-visual]')];
  const current = section.querySelector('.differentials__current');
  const progress = section.querySelector('.differentials__progress span');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let active = 0;

  function setActive(next, animate = true) {
    if (next < 0 || next >= steps.length || (next === active && steps[next].classList.contains('is-active'))) return;
    const previous = active;
    active = next;

    steps.forEach((step, index) => {
      const selected = index === next;
      step.classList.toggle('is-active', selected);
      if (selected) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
    });
    current.textContent = String(next + 1).padStart(2, '0');

    const useGsap = animate && window.gsap && !reduced.matches && innerWidth > 900;
    if (useGsap) {
      const incoming = visuals[next];
      const outgoing = visuals[previous];
      gsap.killTweensOf([incoming, outgoing, progress]);
      visuals.forEach((visual, index) => {
        if (index !== previous && index !== next) visual.classList.remove('is-active');
      });
      incoming.classList.add('is-active');
      outgoing.classList.add('is-active');
      gsap.fromTo(incoming, {autoAlpha: 0, scale: 1.035}, {autoAlpha: 1, scale: 1, duration: .72, ease: 'power2.out', clearProps: 'opacity,visibility,transform'});
      if (outgoing !== incoming) gsap.to(outgoing, {autoAlpha: 0, scale: .985, duration: .42, ease: 'power2.in', clearProps: 'opacity,visibility,transform', onComplete: () => outgoing.classList.remove('is-active')});
      gsap.to(progress, {scaleX: (next + 1) / steps.length, duration: .45, ease: 'power2.out'});
    } else {
      visuals.forEach((visual, index) => visual.classList.toggle('is-active', index === next));
      progress.style.transform = `scaleX(${(next + 1) / steps.length})`;
    }
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) setActive(Number(entry.target.dataset.step));
    });
  }, {rootMargin: '-45% 0px -45% 0px', threshold: 0});

  steps.forEach(step => observer.observe(step));
  reduced.addEventListener('change', () => setActive(active, false));
  setActive(0, false);
})();
