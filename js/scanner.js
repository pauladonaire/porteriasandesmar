// scanner.js — Wrapper de html5-qrcode para escanear QR de unidades

const Scanner = {
  instance: null,
  activo: false,
  linternaPrendida: false,

  /**
   * Inicia la cámara en el contenedor #qr-reader y llama a onResult(idUnidad) al leer.
   */
  async iniciar(onResult) {
    if (this.activo) return;

    const container = document.getElementById('qr-reader');
    if (!container) return;

    try {
      this.instance = new Html5Qrcode('qr-reader');
      const config = {
        fps: 15,                             // antes 10 — más fotogramas/seg, detecta más rápido
        qrbox: { width: 250, height: 250 },   // recuadro más grande, más margen para encuadrar
        aspectRatio: 1.0,
        disableFlip: false,
        // Si el celular soporta el detector nativo del navegador (Chrome/Android en su
        // mayoría), lo usa en vez del decoder JS puro — mucho más rápido y confiable.
        // Si no lo soporta, cae solo al decoder normal, sin romper nada.
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      };

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

  // Prende/apaga la linterna del celular mientras la cámara está activa — útil en la
  // garita de noche. No todos los celulares/navegadores lo permiten; si falla, avisa
  // y no rompe el escaneo.
  async alternarLinterna() {
    if (!this.instance || !this.activo) return null;
    const nuevoEstado = !this.linternaPrendida;
    try {
      await this.instance.applyVideoConstraints({ advanced: [{ torch: nuevoEstado }] });
      this.linternaPrendida = nuevoEstado;
      return this.linternaPrendida;
    } catch (err) {
      App.toast('Este celular no permite prender la linterna desde acá', 'warn');
      return null;
    }
  },

  detener() {
    if (this.instance && this.activo) {
      this.instance.stop().catch(() => {});
      this.activo = false;
      this.linternaPrendida = false;
    }
  },
};

/**
 * Inicializa el botón de escáner en el formulario de distribución.
 * Al leer un QR, precarga el select de unidad y los campos de dominio.
 */
function initScanner() {
  const btnScan  = document.getElementById('btn-scan-qr');
  const btnTorch = document.getElementById('btn-scan-linterna');
  if (!btnScan) return;

  btnScan.addEventListener('click', () => {
    const reader = document.getElementById('qr-reader');
    if (Scanner.activo) {
      Scanner.detener();
      reader.style.display = 'none';
      btnScan.textContent = '📷 Escanear QR';
      if (btnTorch) { btnTorch.hidden = true; btnTorch.textContent = '🔦 Linterna'; }
      return;
    }
    reader.style.display = 'block';
    btnScan.textContent  = '✕ Cancelar escáner';
    if (btnTorch) btnTorch.hidden = false;

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
        // El select real quedó seteado, pero el combobox (input visible) no se entera solo —
        // sin esto, el vigilador ve el campo vacío y termina escribiendo la patente de nuevo.
        if (sel._comboInput) {
          const opt = Array.from(sel.options).find(o => o.value === sel.value);
          sel._comboInput.value = opt ? opt.textContent : unidad.Dominio;
        }
      }
      if (typeof Distribucion !== 'undefined') Distribucion.preseleccionarChofer(unidad);
      reader.style.display = 'none';
      btnScan.textContent  = '📷 Escanear QR';
      if (btnTorch) { btnTorch.hidden = true; btnTorch.textContent = '🔦 Linterna'; }
      App.toast('Unidad cargada: ' + unidad.Dominio, 'ok');
    });
  });

  btnTorch?.addEventListener('click', async () => {
    const prendida = await Scanner.alternarLinterna();
    if (prendida !== null) btnTorch.textContent = prendida ? '🔦 Apagar linterna' : '🔦 Linterna';
  });
}
