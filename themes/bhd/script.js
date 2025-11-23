// Get a reference to the header element
const headerContainer = document.querySelector('.site-header-fixed-container');

// Define the scroll threshold (how far down the user needs to scroll)
const scrollThreshold = 50;

// Function to handle the scroll event
function handleScroll() {
  // Check if the vertical scroll position is greater than the threshold
  if (window.scrollY > scrollThreshold) {
    // Add the 'scrolled' class to make the header white
    headerContainer.classList.add('scrolled');
  } else {
    // Remove the 'scrolled' class to make the header transparent again
    headerContainer.classList.remove('scrolled');
  }
}

// Attach the handleScroll function to the window's scroll event
window.addEventListener('scroll', handleScroll);
