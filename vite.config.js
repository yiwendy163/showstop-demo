import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the build works under any GitHub Pages repository path (D12).
// Routing is hash-based, so no 404 fallback is needed.
export default defineConfig({
  base: './',
  plugins: [react()],
})
