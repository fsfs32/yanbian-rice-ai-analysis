import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Vite 配置：React 插件 + Tailwind CSS v4 插件 + 第三方库分包
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // 把体积最大的图表库单独拆一个 chunk。
        // 它本身是懒加载的，拆出来之后首屏只下载主包，图表库等真要看图时再取；
        // 而且图表库版本不常变，单独成块对浏览器缓存更友好。
        manualChunks: {
          echarts: ['echarts', 'echarts-for-react/lib/core'],
        },
      },
    },
    // 图表库未压缩体积超过默认 500 KB 告警线，这里调高避免无意义告警
    chunkSizeWarningLimit: 620,
  },
});
