import { ImGui, ImGui_Impl } from '@zhobo63/imgui-ts';
import { zlUIMgr, zlUIWin } from '@zhobo63/zlui-ts';

// Import our modules
import { CanvasRenderer } from './canvas-renderer';
import { LeftPanel } from './leftpanel';
import { RightPanel } from './rightpanel';

class App {
    private canvas: HTMLCanvasElement;
    private renderer: CanvasRenderer;
    private leftPanel: LeftPanel;
    private rightPanel: RightPanel;

    constructor() {
        this.canvas = document.getElementById('render-canvas') as HTMLCanvasElement;
        
        // Initialize the canvas renderer
        this.renderer = new CanvasRenderer(this.canvas);
        
        // Setup callbacks for file loading and object selection
        this.renderer.onFileLoaded = (ui: zlUIMgr, fileName: string) => {
            console.log(`Loaded UI: ${fileName}`);
            // Update left panel with object tree
            this.leftPanel.updateObjectTree(ui);
        };

        this.renderer.onSelectObject = (obj: zlUIWin | null) => {
            if (obj) {
                this.rightPanel.showProperties(obj);
            } else {
                this.rightPanel.clear();
            }
        };

        // Setup fgui callbacks
        this.renderer.onFguiLoaded = (keys: string[]) => {
            this.leftPanel.hideResources();
            this.leftPanel.updateObjectTree(null);
            this.rightPanel.clear();
            this.leftPanel.showResources(keys);
        };

        // Initialize left panel
        const leftPanelContainer = document.getElementById('left-panel') as HTMLElement;
        this.leftPanel = new LeftPanel(leftPanelContainer, {
            onScaleChanged: (scale: number) => {
                this.renderer.setScale(scale);
            },
            onFileSelected: async (fileName: string) => {
                try {
                    await this.renderer.loadUI('upload/', fileName);
                } catch (err) {
                    console.error('Failed to load UI:', err);
                }
            },
            onSelectObject: (obj: zlUIWin | null) => {
                if (obj) {
                    this.rightPanel.showProperties(obj);
                } else {
                    this.rightPanel.clear();
                }
            },
            onFguiSelected: async (fileName: string) => {
                try {
                    await this.renderer.loadFgui(fileName);
                } catch (err) {
                    console.error('Failed to load FGUI:', err);
                }
            },
            onResourceSelected: (key: string) => {
                this.renderer.renderResource(key);
            }
        });

        // Initialize right panel
        const rightPanelContainer = document.getElementById('right-panel') as HTMLElement;
        this.rightPanel = new RightPanel(rightPanelContainer, {
            onPropertyChange: (obj: zlUIWin, propName: string, value: any) => {
                console.log(`Property changed: ${propName} = ${value}`);
                // Mark UI as dirty so it re-renders
                if (this.renderer.mgr) {
                    this.renderer.mgr.isDirty = true;
                }
            }
        });

        // Setup canvas resize handling
        window.addEventListener('resize', () => this.onResize());
    }

    async init(): Promise<void> {
        // Initialize ImGui and zlui-ts backend
        await this.renderer.init();

        // Set initial canvas size
        this.onResize();

        // Start the render loop
        this.renderer.startLoop();

        console.log('zlui-ts View initialized');
    }

    private onResize(): void {
        const area = document.getElementById('canvas-area') as HTMLElement;
        if (area) {
            const rect = area.getBoundingClientRect();
            this.canvas.width = rect.width * ImGui_Impl.canvas_scale;
            this.canvas.height = rect.height * ImGui_Impl.canvas_scale;
            this.renderer.resize(rect.width, rect.height);
        }
    }

    cleanup(): void {
        this.renderer.cleanup();
    }
}

// Bootstrap the application
window.addEventListener('DOMContentLoaded', async () => {
    const app = new App();
    await app.init();
});
