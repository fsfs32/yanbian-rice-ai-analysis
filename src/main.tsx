// 应用入口：挂载根组件并引入全局样式
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/globals.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('找不到 #root 挂载节点');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
