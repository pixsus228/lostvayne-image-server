window.addEventListener('DOMContentLoaded', () => {
  const heroImage = document.querySelector('.hero-image');

  const randomNumber = Math.floor(Math.random() * 5) + 1;

  const imagePath = `assets/images/${randomNumber}.png`;

  heroImage.style.backgroundImage = `url('${imagePath}')`;
});
