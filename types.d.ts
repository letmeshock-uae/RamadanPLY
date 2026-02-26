declare module '@mkkellogg/gaussian-splats-3d' {
    import * as THREE from 'three';

    export class DropInViewer extends THREE.Group {
        constructor(options?: any);
        addSplatScene(path: string, options?: any): Promise<void>;
        dispose(): void;
    }

    export class Viewer {
        constructor(options?: any);
        addSplatScene(path: string, options?: any): Promise<void>;
        start(): void;
        dispose(): void;
    }
}
