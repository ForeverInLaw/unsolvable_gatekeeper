const { createCanvas } = require("canvas");

function generateCaptcha() {
  const canvas = createCanvas(200, 70);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#f0f0f0";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Text
  const text = Math.random().toString(36).substring(2, 8).toUpperCase();
  ctx.font = 'bold 38px "Comic Sans MS"';
  ctx.fillStyle = "#333";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Apply some distortion
  const textMetrics = ctx.measureText(text);
  const x = canvas.width / 2;
  const y = canvas.height / 2;

  ctx.translate(x, y);
  ctx.rotate((Math.random() - 0.5) * 0.4); // Random rotation
  ctx.fillText(text, 0, 0);
  ctx.resetTransform();

  // Noise
  for (let i = 0; i < 15; i++) {
    // Lines
    ctx.strokeStyle = `rgba(0,0,0,${Math.random() * 0.5})`;
    ctx.beginPath();
    ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
    ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
    ctx.stroke();
  }

  for (let i = 0; i < 100; i++) {
    // Dots
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.5})`;
    ctx.beginPath();
    ctx.arc(
      Math.random() * canvas.width,
      Math.random() * canvas.height,
      Math.random() * 2,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  return {
    image: canvas.toBuffer(),
    text: text,
  };
}

module.exports = { generateCaptcha };
