import { zlUIWin } from '@zhobo63/zlui-ts';

export interface LeftPanelCallbacks {
    onScaleChanged?: (scale: number) => void;
    onFileSelected?: (fileName: string) => void;
    onSelectObject?: (obj: zlUIWin | null) => void;
    onFguiSelected?: (fileName: string) => void;
    onResourceSelected?: (key: string) => void;
}

/** Represents a file entry from the directory listing API */
interface FileEntry {
    name: string;
    isDirectory: boolean;
    ext: string;
}

export class LeftPanel {
    private scaleSlider: HTMLInputElement;
    private scaleValue: HTMLElement;
    private fileList: HTMLUListElement;
    private objectTree: HTMLUListElement;
    private clearBtn: HTMLButtonElement;
    private resourceSection: HTMLElement;
    private resourceList: HTMLUListElement;

    private callbacks: LeftPanelCallbacks;

    constructor(container: HTMLElement, callbacks: LeftPanelCallbacks) {
        this.callbacks = callbacks;

        // Get DOM elements
        this.scaleSlider = container.querySelector('#scale-slider') as HTMLInputElement;
        this.scaleValue = container.querySelector('#scale-value') as HTMLElement;
        this.fileList = container.querySelector('#file-list') as HTMLUListElement;
        this.objectTree = container.querySelector('#object-tree') as HTMLUListElement;
        this.clearBtn = container.querySelector('#clear-btn') as HTMLButtonElement;
        this.resourceSection = container.querySelector('#resource-section') as HTMLElement;
        this.resourceList = container.querySelector('#resource-list') as HTMLUListElement;

        // Setup event listeners
        this.scaleSlider.addEventListener('input', () => {
            const scale = parseInt(this.scaleSlider.value);
            this.scaleValue.textContent = scale.toString();
            if (this.callbacks.onScaleChanged) this.callbacks.onScaleChanged(scale);
        });

        // Preset scale buttons
        container.querySelectorAll('.scale-presets button').forEach(btn => {
            btn.addEventListener('click', () => {
                const scale = parseInt((btn as HTMLButtonElement).dataset.scale || '100');
                this.scaleSlider.value = scale.toString();
                this.scaleValue.textContent = scale.toString();
                if (this.callbacks.onScaleChanged) this.callbacks.onScaleChanged(scale);
            });
        });

        // Clear button — delete all uploaded files
        this.clearBtn.addEventListener('click', () => this.clearUploads());

        // Setup drag & drop on the entire left panel
        container.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
        container.addEventListener('drop', (e) => this.handleDrop(e));

        this.refreshFileList();
    }

    private async handleDrop(event: DragEvent): Promise<void> {
        event.preventDefault();
        event.stopPropagation();

        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return;

        // Upload ALL dropped files to server's upload/ directory
        await this.uploadFiles(files);

        // If a .ui file exists in the dropped files, open it after upload completes
        const uiFile = Array.from(files).find(f => f.name.toLowerCase().endsWith('.ui'));
        if (uiFile) {
            console.log('Dropped .ui file:', uiFile.name);
            setTimeout(() => {
                if (this.callbacks.onFileSelected) {
                    this.callbacks.onFileSelected(uiFile.name);
                }
            }, 200);
        }
    }

    /** Upload files to server's upload/ directory — one request per file */
     private async uploadFiles(fileList: FileList): Promise<void> {
         console.log(`Uploading ${fileList.length} files to /api/upload...`);

         let successCount = 0;
         const errors: string[] = [];

         for (let i = 0; i < fileList.length; i++) {
             const file = fileList[i];
             const formData = new FormData();
             formData.append('file', file, file.name);

             try {
                 const response = await fetch('/api/upload', {
                     method: 'POST',
                     body: formData
                 });

                 if (!response.ok) throw new Error(`HTTP ${response.status}`);

                 const result = await response.json();
                 if (result.success) {
                     successCount++;
                 } else {
                     errors.push(`${file.name}: ${result.error || '上傳失敗'}`);
                 }
             } catch (err) {
                 errors.push(`${file.name}: ${(err as Error).message}`);
             }
         }

         console.log(`Upload complete: ${successCount} ok, ${errors.length} failed`);
         if (errors.length > 0) console.warn('Errors:', errors);

         // Refresh file list from upload/ directory
         this.refreshFileList();
     }

    /** Clear all uploaded files via /api/clear */
    private async clearUploads(): Promise<void> {
        try {
            const response = await fetch('/api/clear', { method: 'POST' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const result = await response.json();
            console.log('Clear complete:', result.message);

            // Refresh file list
            this.refreshFileList();
        } catch (err) {
            console.error('Clear failed:', err);
            alert(`清空失敗：${(err as Error).message}`);
        }
    }

    /** Update the file list from server's upload/ directory */
    async refreshFileList(): Promise<void> {
        try {
            const response = await fetch('/api/dir?path=upload');
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

        // Filter to show .ui and .fui files first, then all files
        const uiFiles = files.filter(f => f.ext === '.ui');
        const fuiFiles = files.filter(f => f.ext === '.fui');
        const otherFiles = files.filter(f => f.ext !== '.ui' && f.ext !== '.fui' && !f.isDirectory);

        for (const file of [...uiFiles, ...fuiFiles, ...otherFiles]) {
            const li = document.createElement('li');
            li.textContent = file.name;

            if (file.ext === '.ui') {
                li.classList.add('ext-ui');
                li.addEventListener('click', () => {
                    // Remove active from all
                    this.fileList.querySelectorAll('li').forEach(el => el.classList.remove('active'));
                    li.classList.add('active');

                    if (this.callbacks.onFileSelected) {
                        this.callbacks.onFileSelected(file.name);
                    }
                });
            } else if (file.ext === '.fui') {
                li.classList.add('ext-fui');
                li.addEventListener('click', () => {
                    // Remove active from all
                    this.fileList.querySelectorAll('li').forEach(el => el.classList.remove('active'));
                    li.classList.add('active');

                    if (this.callbacks.onFguiSelected) {
                        this.callbacks.onFguiSelected(file.name);
                    }
                });
            }

            this.fileList.appendChild(li);
        }
    }

    /** Show resource list from FGUI package */
    showResources(keys: string[]): void {
        this.resourceSection.style.display = '';
        this.resourceList.innerHTML = '';

        for (const key of keys) {
            const li = document.createElement('li');
            li.textContent = key;
            li.className = 'resource-item';
            li.addEventListener('click', () => {
                this.resourceList.querySelectorAll('li').forEach(el => el.classList.remove('active'));
                li.classList.add('active');

                if (this.callbacks.onResourceSelected) {
                    this.callbacks.onResourceSelected(key);
                }
            });
            this.resourceList.appendChild(li);
        }
    }

    /** Hide resource list */
    hideResources(): void {
        this.resourceSection.style.display = 'none';
        this.resourceList.innerHTML = '';
    }

    /** Resolve children array from a zlUIWin object */
    private resolveChildren(obj: any): any[] {
        // Method 1: Check for 'children' property
        if (obj.children && Array.isArray(obj.children)) {
            return obj.children;
        }
        // Method 2: Check for internal array properties
        for (const key of Object.keys(obj)) {
            const val = obj[key];
            if (val instanceof Object && !('Name' in val) && Array.isArray(val)) {
                return val;
            }
        }
        return [];
    }

    /** Update the object tree from a zlUIMgr instance */
    updateObjectTree(ui: zlUIWin | null): void {
        // Clear existing tree
        this.objectTree.innerHTML = '';

        if (!ui) return;

        const uiMgr = ui;

        // Create a single <li> node with toggle + label + children container
        const createNode = (obj: any, depth: number): HTMLLIElement => {
            const li = document.createElement('li');
            li.style.paddingLeft = `${depth * 16}px`;

            const name = obj.Name || '(unnamed)';
            const type = obj.constructor?.name || 'Win';

            // Check if this object has children
            const children = this.resolveChildren(obj);
            const hasChildren = children.length > 0;

            // Toggle arrow (only for nodes with children)
            let toggleSpan: HTMLSpanElement | null = null;
            if (hasChildren) {
                toggleSpan = document.createElement('span');
                toggleSpan.className = 'tree-toggle';
                toggleSpan.textContent = '\u25BC'; // down arrow (expanded)
                li.appendChild(toggleSpan);
            }

            // Label span — click to select
            const label = document.createElement('span');
            label.className = 'tree-label';
            label.innerHTML = `<span class="type">${type}</span> <span class="name">${name}</span>`;
            li.appendChild(label);

            // Children container (only for nodes with children)
            let childContainer: HTMLElement | null = null;
            if (hasChildren) {
                childContainer = document.createElement('ul');
                childContainer.className = 'tree-children';
                li.appendChild(childContainer);
            }

            // Click on label to select object
            label.addEventListener('click', (e) => {
                e.stopPropagation();
                this.objectTree.querySelectorAll('li.active').forEach(el => el.classList.remove('active'));
                li.classList.add('active');

                if (this.callbacks.onSelectObject) {
                    this.callbacks.onSelectObject(obj as zlUIWin);
                }
            });

            // Click on toggle to expand/collapse
            if (toggleSpan && childContainer) {
                toggleSpan.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isCollapsed = childContainer.classList.toggle('collapsed');
                    toggleSpan.textContent = isCollapsed ? '\u25B6' : '\u25BC'; // right / down arrow
                });
            }

            return li;
        };

        // Recursively populate children into the container
        const populateChildren = (obj: any, container: HTMLElement, depth: number): void => {
            const children = this.resolveChildren(obj);
            for (const child of children) {
                if (!child || typeof child !== 'object') continue;

                const childLi = createNode(child, depth + 1);
                container.appendChild(childLi);

                // Recurse — find the child's own container
                const grandChildContainer = childLi.querySelector(':scope > ul.tree-children');
                if (grandChildContainer) {
                    populateChildren(child, grandChildContainer as HTMLElement, depth + 1);
                }
            }
        };

        // Build top-level nodes from uiMgr
        const topLevelChildren = this.resolveChildren(uiMgr);
        for (const child of topLevelChildren) {
            if (!child || typeof child !== 'object') continue;

            const li = createNode(child, 0);
            this.objectTree.appendChild(li);

            // Populate children recursively
            const childContainer = li.querySelector(':scope > ul.tree-children');
            if (childContainer) {
                populateChildren(child, childContainer as HTMLElement, 0);
            }
        }
    }
}
