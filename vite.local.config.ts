import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Stub virtual modules provided by the platform vite preset
function platformStubPlugin(): Plugin {
  const virtualModules: Record<string, string> = {
    'virtual:capabilities': 'export default {};',
    'virtual:app-config': 'export default {};',
    'virtual:platform-info': 'export default { platform: "local" };',
    'virtual:lark-config': 'export default {};',
    'virtual:apaas-config': 'export default {};',
  };

  return {
    name: 'platform-stub',
    resolveId(id) {
      if (id in virtualModules) {
        return '\0' + id;
      }
      return null;
    },
    load(id) {
      const cleanId = id.replace(/^\0/, '');
      if (cleanId in virtualModules) {
        return virtualModules[cleanId];
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [react(), platformStubPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client/src'),
      '@client': path.resolve(__dirname, 'client'),
      '@server': path.resolve(__dirname, 'server'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
  root: path.resolve(__dirname),
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'client/index.html'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  define: {
    'import.meta.env.VITE_LOCAL_DEV': JSON.stringify('true'),
  },
});
