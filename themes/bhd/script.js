document.addEventListener('DOMContentLoaded', () => {
  const headerContainer = document.querySelector(
    '.site-header-fixed-container',
  );

  if (!headerContainer) {
    console.warn('Header container not found');
    return;
  }

  const scrollThreshold = 50;
  function handleScroll() {
    if (window.scrollY > scrollThreshold) {
      headerContainer.classList.remove('transparent');
    } else {
      headerContainer.classList.add('transparent');
    }
  }

  // init
  requestAnimationFrame(handleScroll);

  // monitor
  let requestedAnimFrame = 0;
  window.addEventListener('scroll', () => {
    cancelAnimationFrame(requestedAnimFrame);
    requestedAnimFrame = requestAnimationFrame(handleScroll);
  });
});
