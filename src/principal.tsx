import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Aplicacion } from './Aplicacion.tsx'
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
