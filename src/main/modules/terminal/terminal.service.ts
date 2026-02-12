import * as pty from "node-pty";

type DataCallback = (id: string, data: string) => void;

interface PtyInstance {
  process: pty.IPty;
  onDataDispose: { dispose(): void };
}

const instances = new Map<string, PtyInstance>();

export const terminalService = {
  create(id: string, cwd: string, onData: DataCallback): void {
    // Kill existing instance if present
    this.destroy(id);

    const shell = process.platform === "win32" ? "powershell.exe" : "zsh";
    const proc = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd,
      env: process.env as Record<string, string>,
    });

    const onDataDispose = proc.onData((data) => {
      onData(id, data);
    });

    instances.set(id, { process: proc, onDataDispose });
  },

  write(id: string, data: string): void {
    const instance = instances.get(id);
    if (instance) {
      instance.process.write(data);
    }
  },

  resize(id: string, cols: number, rows: number): void {
    const instance = instances.get(id);
    if (instance) {
      instance.process.resize(cols, rows);
    }
  },

  destroy(id: string): void {
    const instance = instances.get(id);
    if (instance) {
      instance.onDataDispose.dispose();
      instance.process.kill();
      instances.delete(id);
    }
  },

  destroyAll(): void {
    for (const id of instances.keys()) {
      this.destroy(id);
    }
  },
};
