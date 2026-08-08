/** Registra la aplicación para instalación y uso sin conexión en producción. */
export function registrarPwa(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return
  }

  const registrar = () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}service-worker.js`, {
        scope: import.meta.env.BASE_URL,
        updateViaCache: 'none',
      })
      .catch(() => undefined)
  }

  if (document.readyState === 'complete') {
    registrar()
    return
  }

  window.addEventListener('load', registrar, { once: true })
}
