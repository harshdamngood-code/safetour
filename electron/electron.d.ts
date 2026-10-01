declare module 'electron' {
  export interface BrowserWindow {
    loadURL(url: string): Promise<void>;
    loadFile(filePath: string): Promise<void>;
    webContents: {
      setWindowOpenHandler(handler: (details: { url: string }) => { action: 'deny' | 'allow' }): void;
    };
    on(event: string, listener: (...args: any[]) => void): this;
  }

  export const BrowserWindow: {
    new (options?: any): BrowserWindow;
    getAllWindows(): BrowserWindow[];
  };

  export const app: {
    whenReady(): Promise<void>;
    on(event: string, listener: (...args: any[]) => void): void;
    quit(): void;
  };

  export const shell: {
    openExternal(url: string): Promise<void>;
  };

  export const ipcMain: any;
  export const contextBridge: {
    exposeInMainWorld(apiKey: string, api: any): void;
  };
  export const ipcRenderer: {
    send(channel: string, ...args: any[]): void;
  };
}
