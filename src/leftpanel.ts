import { zlUIWin } from '@zhobo63/zlui-ts';

export interface LeftPanelCallbacks {
    onWorkdirChanged?: (basePath: string) => void;
    onScaleChanged?: (scale: number) => void;
    onFileSelected?: (basePath: string, fileName: string) => void;
    onSelectObject?: (obj: zlUIWin | null) => void;
}

/** Represents a file entry from the directory listing API */
interface FileEntry {
    name: string;
    isDirectory: boolean;
    ext: string;
}

export class LeftPanel {
    private workdirInput: HTMLInputElement;
    private browseBtn: HTMLButtonElement;
    private dirInput: HTMLInputElement; // hidden file input
    private scaleSlider: HTMLInputElement;
    private scaleValue: HTMLElement;
    private fileList: HTMLUListElement;

    private callbacks: LeftPanelCallbacks;
    private currentBasePath: string = ''; // e.g., "ui/" relative to web root

    constructor(container: HTMLElement, callbacks: LeftPanelCallbacks) {
        this.callbacks = callbacks;

        // Get DOM elements
        this.workdirInput = container.querySelector('#workdir-input') as HTMLInputElement;
        this.browseBtn = container.querySelector('#browse-btn') as HTMLButtonElement;
        this.dirInput = document.getElementById('dir-input') as HTMLInputElement;
        this.scaleSlider = container.querySelector('#scale-slider') as HTMLInputElement;
        this.scaleValue = container.querySelector('#scale-value') as HTMLElement;
        this.fileList = container.querySelector('#file-list') as HTMLUListElement;

        // Setup event listeners
        this.browseBtn.addEventListener('click', () => this.browseDirectory());
        this.dirInput.addEventListener('change', (e) => this.handleDirSelect(e));
        
        this.scaleSlider.addEventListener('input', () => {
            const scale = parseInt(this.scaleSlider.value);
            this.scaleValue.textContent = scale.toString();
            if (this.callbacks.onScaleChanged) this.callbacks.onScaleChanged(scale);
        });

        // Setup drag & drop on the workdir input area
        const dropZone = container.querySelector('.section') as HTMLElement;
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
        dropZone.addEventListener('drop', (e) => this.handleDrop(e));

        // Also allow dropping directly on the left panel
        container.addEventListener('dragover', (e) => { e.preventDefault(); });
        container.addEventListener('drop', (e) => this.handleDrop(e));
    }

    private browseDirectory(): void {
        this.dirInput.click();
    }

    private handleDirSelect(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

        // Get the base directory path from the first file's webkitRelativePath
        const firstFile = input.files[0];
        const relativePath = (firstFile as any).webkitRelativePath || '';
        const dirName = relativePath.substring(0, relativePath.indexOf('/'));

        // Set basePath relative to web root (zlUIMgr.Load() does: fetch(path + file))
        this.currentBasePath = dirName + '/';
        this.workdirInput.value = this.currentBasePath;

        if (this.callbacks.onWorkdirChanged) {
            this.callbacks.onWorkdirChanged(this.currentBasePath);
        }

        // Reset file input so same directory can be re-selected
        input.value = '';
    }

    private async handleDrop(event: DragEvent): Promise<void> {
        event.preventDefault();
        event.stopPropagation();

        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return;

        // Extract directory name from webkitRelativePath (folder drop) or use first file name
        const firstFile = files[0];
        const relativePath = (firstFile as any).webkitRelativePath || '';
        const dirName = relativePath.includes('/') 
            ? relativePath.substring(0, relativePath.indexOf('/'))
            : firstFile.name;

        this.currentBasePath = dirName + '/';
        this.workdirInput.value = this.currentBasePath;

        if (this.callbacks.onWorkdirChanged) {
            this.callbacks.onWorkdirChanged(this.currentBasePath);
        }

        // Upload ALL files to server (not just .ui)
        await this.uploadAllFiles(files, dirName);

        // If a .ui file exists in the dropped files, open it after upload completes
        const uiFile = Array.from(files).find(f => f.name.toLowerCase().endsWith('.ui'));
        if (uiFile) {
            console.log('Dropped .ui file:', uiFile.name);
            setTimeout(() => {
                if (this.callbacks.onFileSelected) {
                    this.callbacks.onFileSelected(this.currentBasePath, uiFile.name);
                }
            }, 200);
        }
    }

    /** Upload all dropped files to server */
    private async uploadAllFiles(fileList: FileList, targetDir: string): Promise<void> {
        const formData = new FormData();
        
        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            // webkitRelativePath is "folder/sub/file.ext" — use as-is for server path
            const relativePath = (file as any).webkitRelativePath || file.name;
            formData.append('files', file, relativePath);
        }

        console.log(`Uploading ${fileList.length} files to /api/upload...`);
        
        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const result = await response.json();
            console.log('Upload complete:', result.message || result.count + ' files uploaded');
            
            // Refresh file list after upload
            this.refreshFileList();
        } catch (err) {
            console.error('Upload failed:', err);
            alert(`上傳失敗：${(err as Error).message}`);
        }
    }

    /** Update the file list from server */
    async refreshFileList(): Promise<void> {
        if (!this.currentBasePath) return;

        try {
            // Extract directory name for API call (strip leading/trailing slashes)
            const dirName = this.currentBasePath.replace(/^\/+|\/+$/g, '');
            const response = await fetch(`/api/dir?path=${encodeURIComponent(dirName)}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            this.renderFileList(data.files || []);
        } catch (err) {
            console.error('Failed to list directory:', err);
            this.fileList.innerHTML = '<li class="error">無法讀取目錄</li>';
        }
    }

    private renderFileList(files: FileEntry[]): void {
        this.fileList.innerHTML = '';

        // Filter to show .ui files first, then all files
        const uiFiles = files.filter(f => f.ext === '.ui');
        const otherFiles = files.filter(f => f.ext !== '.ui' && !f.isDirectory);

        for (const file of [...uiFiles, ...otherFiles]) {
            const li = document.createElement('li');
            li.textContent = file.name;

            if (file.ext === '.ui') {
                li.classList.add('ext-ui');
                li.addEventListener('click', () => {
                    // Remove active from all
                    this.fileList.querySelectorAll('li').forEach(el => el.classList.remove('active'));
                    li.classList.add('active');

                    if (this.callbacks.onFileSelected) {
                        this.callbacks.onFileSelected(this.currentBasePath, file.name);
                    }
                });
            }

            this.fileList.appendChild(li);
        }
    }

    /** Update the object tree from a zlUIMgr instance */
    updateObjectTree(ui: zlUIWin | null): void {
        // Clear existing list
        this.fileList.innerHTML = '';

        if (!ui) return;

        // Store reference to current UI for selection
        const uiMgr = ui;

        // Build tree from zlUIWin children
        const buildTree = (parent: zlUIWin, parentLi: HTMLElement, depth: number): void => {
            // Try multiple ways to access children
            let children: any[] = [];
            
            // Method 1: Check for 'children' property
            if ((parent as any).children && Array.isArray((parent as any).children)) {
                children = (parent as any).children;
            }
            // Method 2: Check for internal array properties
            else {
                for (const key of Object.keys(parent)) {
                    const val = (parent as any)[key];
                    if (val instanceof Object && !('Name' in val) && Array.isArray(val)) {
                        children = val;
                        break;
                    }
                }
            }

            for (const child of children) {
                if (!child || typeof child !== 'object') continue;
                
                const li = document.createElement('li');
                li.style.paddingLeft = `${depth * 16 + 8}px`;
                
                const name = (child as zlUIWin).Name || '(unnamed)';
                const type = (child as any).constructor?.name || 'Win';
                li.innerHTML = `<span class="type">${type}</span> <span class="name">${name}</span>`;

                // Click to select object
                li.addEventListener('click', () => {
                    this.fileList.querySelectorAll('li').forEach(el => el.classList.remove('active'));
                    li.classList.add('active');
                    
                    // Notify right panel to show properties
                    if (this.callbacks.onSelectObject) {
                        this.callbacks.onSelectObject(child as zlUIWin);
                    }
                });

                parentLi.appendChild(li);

                // Recurse into children
                buildTree(child as zlUIWin, li, depth + 1);
            }
        };

        // The root UI manager's children are the top-level objects
        let topLevelChildren: any[] = [];
        
        // Try to get children from zlUIMgr
        if ((uiMgr as any).children && Array.isArray((uiMgr as any).children)) {
            topLevelChildren = (uiMgr as any).children;
        } else {
            // Fallback: look for common array properties
            for (const key of Object.keys(uiMgr)) {
                const val = (uiMgr as any)[key];
                if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
                    topLevelChildren = val;
                    break;
                }
            }
        }

        for (const child of topLevelChildren) {
            if (!child || typeof child !== 'object') continue;
            
            const li = document.createElement('li');
            const name = (child as zlUIWin).Name || '(unnamed)';
            const type = (child as any).constructor?.name || 'Win';
            li.innerHTML = `<span class="type">${type}</span> <span class="name">${name}</span>`;

            li.addEventListener('click', () => {
                this.fileList.querySelectorAll('li').forEach(el => el.classList.remove('active'));
                li.classList.add('active');
                
                if (this.callbacks.onSelectObject) {
                    this.callbacks.onSelectObject(child as zlUIWin);
                }
            });

            this.fileList.appendChild(li);
            buildTree(child as zlUIWin, li, 1);
        }
    }

    setWorkdir(path: string): void {
        this.currentBasePath = path;
        this.workdirInput.value = path;
    }

    getWorkdir(): string {
        return this.currentBasePath;
    }
}
