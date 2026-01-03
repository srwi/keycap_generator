import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { preloadFonts } from './lib/generate/fonts'

// Preload fonts at startup for better performance
preloadFonts().catch((error) => {
  console.error('Failed to preload fonts:', error)
})

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
