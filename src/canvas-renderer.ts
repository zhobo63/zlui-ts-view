import { ImGui, ImGui_Impl } from '@zhobo63/imgui-ts';
import { ImVec4 } from '@zhobo63/imgui-ts/src/imgui';
import { zlUIMgr, zlUIWin } from '@zhobo63/zlui-ts';

export class CanvasRenderer {
    private canvas: HTMLCanvasElement;
    private ui: zlUIMgr | null = null;
    private animFrameId: number | null = null;
    private backgroundColor: ImVec4;
    private scaleRatio: number = 1.0;

    // Callbacks
    onFileLoaded?: (ui: zlUIMgr, fileName: string) => void;
    onSelectObject?: (obj: zlUIWin | null) => void;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        // VSCode-like dark background color
        this.backgroundColor = new ImVec4(23 / 255, 26 / 255, 29 / 255, 0);
    }

    async init(): Promise<void> {
        await ImGui.default();
        ImGui.CHECKVERSION();
        ImGui.CreateContext();

        // Initialize ImGui backend with canvas (auto-detects WebGL)
        ImGui_Impl.Init(this.canvas);

        console.log('FontScale:', ImGui_Impl.font_scale);
        console.log('CanvasScale:', ImGui_Impl.canvas_scale);
    }

    get mgr(): zlUIMgr | null { return this.ui; }

    setScale(scalePercent: number): void {
        this.scaleRatio = scalePercent / 100.0;
        if (this.ui) {
            this.ui.scale.Set(this.scaleRatio, this.scaleRatio);
            this.ui.isDirty = true;
        }
    }

    /** Load a .ui file using zlUIMgr.Load() which fetches and parses it */
    async loadUI(basePath: string, fileName: string): Promise<void> {
        if (!this.canvas) return;

        // Create a fresh zlUIMgr instance
        this.ui = new zlUIMgr();
        this.ui.scale.Set(this.scaleRatio, this.scaleRatio);

        // zlUIMgr.Load() does: fetch(path + file), so basePath must end with '/' and fileName is just the filename
        const success = await this.ui.Load(fileName, basePath);
        
        if (!success) {
            throw new Error(`Failed to load ${fileName} from ${basePath}`);
        }

        console.log(`Loaded UI: ${fileName} (${this.ui.calrect_count} objects)`);

        if (this.onFileLoaded) this.onFileLoaded(this.ui, fileName);
    }

    /** Start the render loop */
    startLoop(): void {
        let prevTime = 0;
        let lockTime = 0;
        const lockFps = 1 / 30;

        const loop = (time: number): void => {
            const ti = (time - prevTime) * 0.001;
            prevTime = time;
            lockTime += ti;

            // Skip frame if not enough time passed and UI is not dirty
            if (lockTime < lockFps && (!this.ui || !this.ui.isDirty)) {
                this.animFrameId = requestAnimationFrame(loop);
                return;
            }
            lockTime = 0;

            // ImGui new frame
            ImGui_Impl.NewFrame(time);
            ImGui.NewFrame();

            if (this.ui) {
                const io = ImGui.GetIO();
                
                // Forward input to zlui
                this.ui.any_pointer_down = (!ImGui.GetHoveredWindow()) 
                    ? ImGui_Impl.any_pointerdown() : false;
                this.ui.mouse_pos.Set(io.MousePos.x, io.MousePos.y);
                this.ui.mouse_wheel = io.MouseWheel;

                // Update and paint zlui into the draw list
                this.ui.Refresh(io.DeltaTime);
                this.ui.Paint();

                if (this.ui.calrect_count > 0) {
                    this.ui.isDirty = true;
                }
            }

            ImGui.EndFrame();
            ImGui.Render();

            // Clear and render the draw list to canvas
            ImGui_Impl.ClearBuffer(this.backgroundColor);
            ImGui_Impl.RenderDrawData(ImGui.GetDrawData());

            this.animFrameId = requestAnimationFrame(loop);
        };

        this.animFrameId = requestAnimationFrame(loop);
    }

    stopLoop(): void {
        if (this.animFrameId !== null) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
    }

    resize(width: number, height: number): void {
        this.canvas.width = width * ImGui_Impl.canvas_scale;
        this.canvas.height = height * ImGui_Impl.canvas_scale;
        if (this.ui) {
            this.ui.w = width;
            this.ui.h = height;
            this.ui.SetCalRect();
        }
    }

    cleanup(): void {
        this.stopLoop();
        ImGui_Impl.Shutdown();
        ImGui.DestroyContext();
    }
}
