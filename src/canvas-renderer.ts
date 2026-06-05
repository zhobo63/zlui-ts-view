import { ImGui, ImGui_Impl } from '@zhobo63/imgui-ts';
import { ImVec4 } from '@zhobo63/imgui-ts/src/imgui';
import { zlUIMgr, zlUIWin } from '@zhobo63/zlui-ts';
import { BackendImGui } from '@zhobo63/zlui-ts/src/BackendImGui';
import { FGUI, FGUIPackage } from './fgui/fgui';

export class CanvasRenderer {
    private canvas: HTMLCanvasElement;
    private ui: zlUIMgr | null = null;
    private animFrameId: number | null = null;
    private backgroundColor: ImVec4;
    private scaleRatio: number = 1.0;

    // FGUI support
    private fguiPackage: FGUIPackage | null = null;

    // Scroll state
    private scrollX: number = 0;
    private scrollY: number = 0;

    // Scrollbar DOM elements
    private scrollVBar: HTMLElement | null = null;
    private scrollHBar: HTMLElement | null = null;
    private scrollVThumb: HTMLDivElement | null = null;
    private scrollHThumb: HTMLDivElement | null = null;

    // Callbacks
    onFileLoaded?: (ui: zlUIMgr, fileName: string) => void;
    onSelectObject?: (obj: zlUIWin | null) => void;
    onFguiLoaded?: (resourceKeys: string[]) => void;

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

        // Setup scrollbar DOM elements
        this.scrollVBar = document.getElementById('scroll-v');
        this.scrollHBar = document.getElementById('scroll-h');
        this.scrollVThumb = this.scrollVBar?.querySelector('.scrollbar-thumb') as HTMLDivElement | null;
        this.scrollHThumb = this.scrollHBar?.querySelector('.scrollbar-thumb') as HTMLDivElement | null;

        // Setup scrollbar drag handlers
        if (this.scrollVThumb) {
            this.setupScrollbarDrag(this.scrollVThumb, 'vertical');
        }
        if (this.scrollHThumb) {
            this.setupScrollbarDrag(this.scrollHThumb, 'horizontal');
        }

        // Setup mouse wheel on canvas area
        const canvasArea = document.getElementById('canvas-area');
        if (canvasArea) {
            canvasArea.addEventListener('wheel', (e: WheelEvent) => {
                e.preventDefault();
                if (!this.ui) return;

                const scaledW = this.scaledContentW;
                const scaledH = this.scaledContentH;
                const rect = this.canvas.getBoundingClientRect();
                const canvasW = rect.width;
                const canvasH = rect.height;

                // Horizontal scroll (shift+wheel or horizontal wheel)
                if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                    const maxScroll = Math.max(0, scaledW - canvasW);
                    this.scrollX = Math.max(0, Math.min(maxScroll, this.scrollX + e.deltaX));
                } else {
                    // Vertical scroll
                    const maxScroll = Math.max(0, scaledH - canvasH);
                    this.scrollY = Math.max(0, Math.min(maxScroll, this.scrollY + e.deltaY));
                }

                this.ui.x = -this.scrollX;
                this.ui.y = -this.scrollY;
                this.updateScrollbars();
                this.ui.isDirty = true;
            }, { passive: false });
        }
    }

    /** Setup drag handler for a scrollbar thumb */
    private setupScrollbarDrag(thumb: HTMLElement, axis: 'vertical' | 'horizontal'): void {
        let isDragging = false;
        let pointerStart: number = 0;
        let scrollStart: number = 0;

        const onPointerDown = (e: PointerEvent) => {
            e.preventDefault();
            e.stopPropagation();
            isDragging = true;
            thumb.classList.add('dragging');
            thumb.setPointerCapture(e.pointerId);

            pointerStart = axis === 'vertical' ? e.clientY : e.clientX;
            scrollStart = axis === 'vertical' ? this.scrollY : this.scrollX;
        };

        const onPointerMove = (e: PointerEvent) => {
            if (!isDragging || !this.ui) return;
            e.preventDefault();

            const scaledSize = axis === 'vertical' ? this.scaledContentH : this.scaledContentW;
            const trackSize = axis === 'vertical'
                ? this.canvas.getBoundingClientRect().height
                : this.canvas.getBoundingClientRect().width;
            const maxScroll = Math.max(0, scaledSize - trackSize);

            if (maxScroll <= 0) return;

            // Thumb and track dimensions for ratio calculation
            const thumbSize = axis === 'vertical'
                ? parseFloat(getComputedStyle(thumb).height) || 20
                : parseFloat(getComputedStyle(thumb).width) || 20;
            const trackLen = axis === 'vertical'
                ? (this.scrollVBar?.getBoundingClientRect().height ?? 1)
                : (this.scrollHBar?.getBoundingClientRect().width ?? 1);

            // Ratio: how many scroll units per pixel of thumb travel
            const dragRange = Math.max(1, trackLen - thumbSize);
            const ratio = maxScroll / dragRange;

            // Use captured anchor — reliable across all browsers
            const pointerDelta = (axis === 'vertical' ? e.clientY : e.clientX) - pointerStart;
            const newScroll = Math.max(0, Math.min(maxScroll, scrollStart + pointerDelta * ratio));

            if (axis === 'vertical') {
                this.scrollY = newScroll;
                this.ui.y = -this.scrollY;
            } else {
                this.scrollX = newScroll;
                this.ui.x = -this.scrollX;
            }
            this.ui.SetCalRect();

            // Update visual position — single source of truth
            this.updateScrollbars();
            this.ui.isDirty = true;
        };

        const onPointerUp = (e: PointerEvent) => {
            if (!isDragging) return;
            isDragging = false;
            thumb.classList.remove('dragging');
            thumb.releasePointerCapture(e.pointerId);
        };

        thumb.addEventListener('pointerdown', onPointerDown);
        thumb.addEventListener('pointermove', onPointerMove);
        thumb.addEventListener('pointerup', onPointerUp);
    }

    /** Get content dimensions from zlUIMgr.default_w/default_h */
    private get contentW(): number {
        if (!this.ui) return 0;
        return (this.ui as any).default_w ?? this.ui.w;
    }

    private get contentH(): number {
        if (!this.ui) return 0;
        return (this.ui as any).default_h ?? this.ui.h;
    }

    /** Get scaled content dimensions */
    private get scaledContentW(): number {
        return this.contentW * this.scaleRatio;
    }

    private get scaledContentH(): number {
        return this.contentH * this.scaleRatio;
    }

    /** Update scrollbar visibility, thumb size and position */
    private updateScrollbars(): void {
        if (!this.ui || !this.scrollVBar || !this.scrollHBar) return;

        const rect = this.canvas.getBoundingClientRect();
        const canvasW = rect.width;
        const canvasH = rect.height;

        const scaledW = this.scaledContentW;
        const scaledH = this.scaledContentH;

        // Vertical scrollbar
        const vMaxScroll = Math.max(0, scaledH - canvasH);
        if (vMaxScroll > 0) {
            this.scrollVBar.classList.add('visible');
            const trackLen = this.scrollVBar.getBoundingClientRect().height;
            const thumbSize = Math.max(20, (canvasH / scaledH) * trackLen);
            const ratio = Math.min(1, this.scrollY / vMaxScroll);
            const thumbOffset = ratio * (trackLen - thumbSize);

            if (this.scrollVThumb) {
                this.scrollVThumb.style.height = `${thumbSize}px`;
                this.scrollVThumb.style.top = `${thumbOffset}px`;
            }
        } else {
            this.scrollY=0;
            this.ui.y=0;
            this.scrollVBar.classList.remove('visible');
        }

        // Horizontal scrollbar
        const hMaxScroll = Math.max(0, scaledW - canvasW);
        if (hMaxScroll > 0) {
            this.scrollHBar.classList.add('visible');
            const trackLen = this.scrollHBar.getBoundingClientRect().width;
            const thumbSize = Math.max(20, (canvasW / scaledW) * trackLen);
            const ratio = Math.min(1, this.scrollX / hMaxScroll);
            const thumbOffset = ratio * (trackLen - thumbSize);

            if (this.scrollHThumb) {
                this.scrollHThumb.style.width = `${thumbSize}px`;
                this.scrollHThumb.style.left = `${thumbOffset}px`;
            }
        } else {
            this.scrollX=0;
            this.ui.x=0;
            this.scrollHBar.classList.remove('visible');
        }
    }

    get mgr(): zlUIMgr | null { return this.ui; }

    setScale(scalePercent: number): void {
        this.scaleRatio = scalePercent / 100.0;
        if (this.ui) {
            this.ui.scale.Set(this.scaleRatio, this.scaleRatio);
            this.ui.SetCalRect();
            this.ui.isDirty = true;

            // Clamp scroll values after scale change
            const rect = this.canvas.getBoundingClientRect();
            const scaledW = this.scaledContentW;
            const scaledH = this.scaledContentH;
            this.scrollX = Math.max(0, Math.min(Math.max(0, scaledW - rect.width), this.scrollX));
            this.scrollY = Math.max(0, Math.min(Math.max(0, scaledH - rect.height), this.scrollY));
            this.ui.x = -this.scrollX;
            this.ui.y = -this.scrollY;
            this.updateScrollbars();
        }
    }

    /** Load a .ui file using zlUIMgr.Load() which fetches and parses it */
    async loadUI(basePath: string, fileName: string): Promise<void> {
        if (!this.canvas) return;

        // Create a fresh zlUIMgr instance
        this.ui = new zlUIMgr();
        this.ui.backend=new BackendImGui(ImGui.GetBackgroundDrawList());
        this.ui.scale.Set(this.scaleRatio, this.scaleRatio);

        // zlUIMgr.Load() does: fetch(path + file), so basePath must end with '/' and fileName is just the filename
        const success = await this.ui.Load(fileName, basePath);

        if (!success) {
            throw new Error(`Failed to load ${fileName} from ${basePath}`);
        }

        // Reset scroll on new file load
        this.scrollX = 0;
        this.scrollY = 0;
        this.ui.x = 0;
        this.ui.y = 0;
        this.ui.origin.Set(0,0);
        this.ui.SetCalRect();
        this.updateScrollbars();

        console.log(`Loaded UI: ${fileName} (${this.ui.calrect_count} objects, ${this.contentW}x${this.contentH})`);

        if (this.onFileLoaded) this.onFileLoaded(this.ui, fileName);
    }

    /** Load a .fui file using FGUI.Load() */
    async loadFgui(fileName: string): Promise<void> {
        // Clear any existing UI
        this.fguiPackage = null;
        this.ui = null;

        const pkg = await FGUI.Load(fileName, 'upload/');
        this.fguiPackage = pkg;

        // Reset scroll on new file load
        this.scrollX = 0;
        this.scrollY = 0;
        this.updateScrollbars();

        console.log(`Loaded FGUI: ${fileName} (${Object.keys(pkg.resources).length} resources)`);

        if (this.onFguiLoaded) {
            const keys = Object.keys(this.fguiPackage.resources);
            this.onFguiLoaded(keys);
        }
    }

    /** Render a specific resource from the loaded FGUI package */
    renderResource(resourceName: string): void {
        if (!this.fguiPackage || !this.canvas) return;

        // Create fresh zlUIMgr for the resource
        this.ui = new zlUIMgr();
        this.ui.backend = new BackendImGui(ImGui.GetBackgroundDrawList());
        this.ui.scale.Set(this.scaleRatio, this.scaleRatio);

        const component = this.fguiPackage.Create(resourceName, this.ui);
        if (component) {
            this.ui.AddChild(component);
            this.ui.origin.Set(0, 0);
            this.ui.SetCalRect();

            // Reset scroll
            this.scrollX = 0;
            this.scrollY = 0;
            this.ui.x = 0;
            this.ui.y = 0;
            this.updateScrollbars();

            console.log(`Rendered FGUI resource: ${resourceName} (${this.ui.calrect_count} objects, ${this.contentW}x${this.contentH})`);

            // Update object tree
            if (this.onFileLoaded) {
                this.onFileLoaded(this.ui, resourceName);
            }
        } else {
            console.error(`Failed to create FGUI resource: ${resourceName}`);
        }
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

                // Apply scroll offset to UI position
                this.ui.x = -this.scrollX;
                this.ui.y = -this.scrollY;

                // Forward input to zlui — adjust mouse pos for scroll offset
                this.ui.any_pointer_down = (!ImGui.GetHoveredWindow())
                    ? ImGui_Impl.any_pointerdown() : false;
                this.ui.mouse_pos.Set(io.MousePos.x + this.scrollX, io.MousePos.y + this.scrollY);
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

            // Clamp scroll values after resize
            const scaledW = this.scaledContentW;
            const scaledH = this.scaledContentH;
            this.scrollX = Math.max(0, Math.min(Math.max(0, scaledW - width), this.scrollX));
            this.scrollY = Math.max(0, Math.min(Math.max(0, scaledH - height), this.scrollY));
            this.ui.x = -this.scrollX;
            this.ui.y = -this.scrollY;
            this.updateScrollbars();
        }
    }

    cleanup(): void {
        this.stopLoop();
        ImGui_Impl.Shutdown();
        ImGui.DestroyContext();
    }
}
