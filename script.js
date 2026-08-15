// ==========================================================================
// RIKDE PORTFOLIO — CONTINUOUS SCROLL FRAME ENGINE & INTERACTIVITY
// ==========================================================================

// Configuration: frame sequence from 6 to 240 (skipping closed-eye frames 1-5)
const START_FRAME = 6;
const END_FRAME = 240;
const TOTAL_FRAMES = END_FRAME - START_FRAME + 1;

const canvas = document.getElementById('animation-canvas');
const ctx = canvas.getContext('2d');
const loader = document.getElementById('loader');
const loaderProgress = document.getElementById('loader-progress');

// Storage for preloaded Image objects
const images = {};
let loadedCount = 0;

let currentFrame = START_FRAME;
let targetFrame = START_FRAME;
let lastRenderedFrame = -1;

// Generate file path for a frame
function getFramePath(index) {
  const paddedIndex = String(index).padStart(3, '0');
  return `frames/ezgif-frame-${paddedIndex}.jpg`;
}

// Adjust canvas resolution for crisp rendering (HiDPI / Retina)
function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  
  if (lastRenderedFrame >= START_FRAME) {
    renderFrame(lastRenderedFrame);
  }
}

// Draw image covering the entire canvas (preserving aspect ratio)
function drawCover(img) {
  if (!img || !img.complete || img.naturalWidth === 0) return;

  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const canvasRatio = canvasWidth / canvasHeight;

  let drawWidth, drawHeight, offsetX, offsetY;

  if (canvasRatio > imgRatio) {
    drawWidth = canvasWidth;
    drawHeight = canvasWidth / imgRatio;
    offsetX = 0;
    offsetY = (canvasHeight - drawHeight) / 2;
  } else {
    drawWidth = canvasHeight * imgRatio;
    drawHeight = canvasHeight;
    offsetX = (canvasWidth - drawWidth) / 2;
    offsetY = 0;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
}

// Render a specific frame with fallback to nearest loaded frame
function renderFrame(index) {
  let img = images[index];
  
  if (!img || !img.complete || img.naturalWidth === 0) {
    // Find closest loaded frame if requested frame is still buffering
    for (let d = 1; d <= TOTAL_FRAMES; d++) {
      if (index - d >= START_FRAME && images[index - d] && images[index - d].complete && images[index - d].naturalWidth > 0) {
        img = images[index - d];
        break;
      }
      if (index + d <= END_FRAME && images[index + d] && images[index + d].complete && images[index + d].naturalWidth > 0) {
        img = images[index + d];
        break;
      }
    }
  }

  if (img && img.complete && img.naturalWidth > 0) {
    drawCover(img);
  }
}

// Preload all active frames
function preloadImages() {
  // Load initial starting frame immediately
  const firstImg = new Image();
  firstImg.src = getFramePath(START_FRAME);
  images[START_FRAME] = firstImg;

  firstImg.onload = () => {
    loadedCount++;
    resizeCanvas();
    renderFrame(START_FRAME);
    lastRenderedFrame = START_FRAME;
    checkAllLoaded();
  };

  // Load the rest of the frames
  for (let i = START_FRAME + 1; i <= END_FRAME; i++) {
    const img = new Image();
    img.src = getFramePath(i);
    images[i] = img;

    img.onload = () => {
      loadedCount++;
      const progress = Math.round((loadedCount / TOTAL_FRAMES) * 100);
      if (loaderProgress) {
        loaderProgress.textContent = `${progress}%`;
      }
      checkAllLoaded();
    };

    img.onerror = () => {
      loadedCount++;
      checkAllLoaded();
    };
  }
}

function checkAllLoaded() {
  if (loadedCount >= TOTAL_FRAMES) {
    if (loader) {
      loader.classList.add('loaded');
    }
  }
}

// Calculate target frame from entire page scroll position
function updateScrollTarget() {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  if (maxScroll <= 0) return;

  const scrollFraction = Math.max(0, Math.min(1, window.scrollY / maxScroll));
  targetFrame = START_FRAME + scrollFraction * (END_FRAME - START_FRAME);
}

// Smooth requestAnimationFrame animation loop (LERP interpolation)
function animationLoop() {
  const diff = targetFrame - currentFrame;
  currentFrame += diff * 0.12; // Silky-smooth damping factor

  const frameToRender = Math.max(START_FRAME, Math.min(END_FRAME, Math.round(currentFrame)));

  if (frameToRender !== lastRenderedFrame) {
    renderFrame(frameToRender);
    lastRenderedFrame = frameToRender;
  }

  requestAnimationFrame(animationLoop);
}

// ==========================================================================
// UI INTERACTIONS & NAVIGATION
// ==========================================================================

// Mobile Drawer Toggle
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileDrawer = document.getElementById('mobileDrawer');

if (mobileMenuBtn && mobileDrawer) {
  mobileMenuBtn.addEventListener('click', () => {
    mobileDrawer.classList.toggle('open');
  });

  document.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', () => {
      mobileDrawer.classList.remove('open');
    });
  });
}

// Project Category Filters
const filterBtns = document.querySelectorAll('.filter-btn');
const projectCards = document.querySelectorAll('.project-card');

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const filterValue = btn.getAttribute('data-filter');

    projectCards.forEach(card => {
      const categories = card.getAttribute('data-category');
      if (filterValue === 'all' || (categories && categories.includes(filterValue))) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  });
});

// Contact Form Submission Mock
function handleFormSubmit() {
  const name = document.getElementById('name').value;
  const feedback = document.getElementById('formFeedback');
  const submitBtn = document.getElementById('submitBtn');

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Sending...</span>`;
  }

  setTimeout(() => {
    if (feedback) {
      feedback.textContent = `Thank you, ${name}! Your inquiry has been sent successfully. I'll get back to you within 24 hours.`;
      feedback.classList.add('success');
    }
    if (submitBtn) {
      submitBtn.innerHTML = `<span>Message Sent ✓</span>`;
      submitBtn.style.background = '#22c55e';
    }
  }, 800);
}

// Active Nav Link Observer
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-link');

window.addEventListener('scroll', () => {
  let currentSection = '';
  sections.forEach(section => {
    const sectionTop = section.offsetTop - 150;
    if (window.scrollY >= sectionTop) {
      currentSection = section.getAttribute('id');
    }
  });

  navLinks.forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === `#${currentSection}`) {
      link.classList.add('active');
    }
  });
}, { passive: true });

// Event Listeners
window.addEventListener('resize', resizeCanvas, { passive: true });
window.addEventListener('scroll', updateScrollTarget, { passive: true });

// Initialize
resizeCanvas();
preloadImages();
requestAnimationFrame(animationLoop);
