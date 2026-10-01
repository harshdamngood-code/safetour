import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('billflowDesktop', {
  platform: 'electron',
  version: '2.5.0',
  printInvoice: () => ipcRenderer.send('print-invoice'),
});
