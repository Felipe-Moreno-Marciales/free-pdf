import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Aplicacion } from './Aplicacion.tsx'
import { registrarPwa } from './pwa/registrarPwa.ts'
import './estilos-globales.css'

const contenedor = document.getElementById('raiz')

if (contenedor === null) {
  throw new Error('No se encontró el contenedor con id «raiz» en el documento.')
}

createRoot(contenedor).render(
  <StrictMode>
    <Aplicacion />
  </StrictMode>,
)

registrarPwa()
