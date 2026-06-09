// scanner.js — Wrapper de html5-qrcode para escanear QR de unidades

const Scanner = {
  instance: null,
  activo: false,

  /**
   * Inicia la cámara en el contenedor #qr-reader y llama a onResult(idUnidad) al leer.
   */
  async iniciar(onResult) {
    if (this.activo) return;

    const container = document.getElementById('qr-reader');
    if (!container) return;

    try {
      this.instance = new Html5Qrcode('qr-reader');
      const config  = { fps: 10, qrbox: { width: 220, height: 220 } };

      await this.instance.start(
        { facingMode: 'environment' },
        config,
        async (text) => {
          // QR leído: text contiene el ID de la unidad (ej: "UND-00001")
          this.detener();
          App.toast('QR leído: ' + text, 'info');
          const res = await Catalogos.getUnidadPorId(text.trim());
          if (res.ok) {
            onResult(res.unidad);
          } else {
            App.toast('Unidad no encontrada: ' + text, 'err');
          }
        },
        () => { /* ignorar errores de fotograma */ }
      );
      this.activo = true;
    } catch (err) {
      App.toast('No se pudo acceder a la cámara: ' + err.message, 'err');
    }
  },

  detener() {
    if (this.instance && this.activo) {
      this.instance.stop().catch(() => {});
      this.activo = false;
    }
  },
};

/**
 * Inicializa el botón de escáner en el formulario de distribución.
 * Al leer un QR, precarga el select de unidad y los campos de dominio.
 */
function initScanner() {
  const btnScan = document.getElementById('btn-scan-qr');
  if (!btnScan) return;

  btnScan.addEventListener('click', () => {
    const reader = document.getElementById('qr-reader');
    if (Scanner.activo) {
      Scanner.detener();
      reader.style.display = 'none';
      btnScan.textContent = '📷 Escanear QR';
      return;
    }
    reader.style.display = 'block';
    btnScan.textContent  = '✕ Cancelar escáner';

    Scanner.iniciar(unidad => {
      // Precargar el select de unidad
      const sel = document.getElementById('sel-unidad-dist');
      if (sel) {
        sel.value = unidad.ID_Unidad;
        // Si no está en el select (unidad nueva), agregar opción temporal
        if (sel.value !== unidad.ID_Unidad) {
          const opt  = document.createElement('option');
          opt.value  = unidad.ID_Unidad;
          opt.textContent = unidad.Dominio + ' — ' + unidad.Tipo;
          sel.appendChild(opt);
          sel.value = unidad.ID_Unidad;
        }
      }
      reader.style.display = 'none';
      btnScan.textContent  = '📷 Escanear QR';
      App.toast('Unidad cargada: ' + unidad.Dominio, 'ok');
    });
  });
}
