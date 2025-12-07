// Update version in core.php when changing this file.
document.addEventListener('DOMContentLoaded', () => {
  const backToTopBtn = document.querySelector(
    '.back-to-top .wp-element-button',
  );
  if (backToTopBtn) {
    backToTopBtn.onclick = () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  }
});
