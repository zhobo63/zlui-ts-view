import { zlUIWin } from '@zhobo63/zlui-ts';

export interface RightPanelCallbacks {
    onPropertyChange?: (obj: zlUIWin, propName: string, value: any) => void;
}

/** Property definitions for the editor */
interface PropDef {
    name: string;
    label: string;
    type: 'text' | 'number' | 'range' | 'color' | 'select';
    options?: string[]; // for select type
    min?: number;
    max?: number;
    step?: number;
}

// Common properties to show in the editor
const COMMON_PROPS: PropDef[] = [
    { name: 'Name', label: '名稱', type: 'text' },
    { name: 'x', label: 'X', type: 'number' },
    { name: 'y', label: 'Y', type: 'number' },
    { name: 'w', label: '寬度', type: 'number' },
    { name: 'h', label: '高度', type: 'number' },
    { name: 'visible', label: '可見', type: 'select', options: ['true', 'false'] },
    { name: 'enable', label: '啟用', type: 'select', options: ['true', 'false'] },
    { name: 'alpha', label: '透明度', type: 'range', min: 0, max: 1, step: 0.05 },
    { name: 'rotate', label: '旋轉', type: 'number' },
    { name: 'scale', label: '縮放', type: 'number' },
    { name: 'text', label: '文字', type: 'text' },
    { name: 'color', label: '背景色', type: 'color' },
    { name: 'textcolor', label: '文字顏色', type: 'color' },
    { name: 'font', label: '字體', type: 'number' },
    { name: 'padding', label: '內距', type: 'number' },
    { name: 'margin', label: '外距', type: 'text' },
    { name: 'clip', label: '裁切', type: 'select', options: ['true', 'false'] },
    { name: 'drag', label: '可拖曳', type: 'select', options: ['true', 'false'] },
    { name: 'resize', label: '可調整大小', type: 'select', options: ['true', 'false'] },
    { name: 'autosize', label: '自動大小', type: 'text' },
    { name: 'align', label: '對齊', type: 'text' },
];

export class RightPanel {
    private container: HTMLElement;
    private contentDiv: HTMLElement;
    private callbacks: RightPanelCallbacks;
    private currentObj: zlUIWin | null = null;

    constructor(container: HTMLElement, callbacks: RightPanelCallbacks) {
        this.container = container;
        this.contentDiv = container.querySelector('#properties-content') as HTMLElement;
        this.callbacks = callbacks;
    }

    /** Display properties of the given object */
    showProperties(obj: zlUIWin | null): void {
        this.currentObj = obj;
        
        if (!obj) {
            this.contentDiv.innerHTML = '<p class="placeholder">選擇物件以顯示屬性</p>';
            return;
        }

        // Build property editor UI
        let html = `<div style="margin-bottom:8px;font-size:13px;color:#4ec9b0;">${obj.constructor.name}</div>`;
        
        for (const prop of COMMON_PROPS) {
            const value = this.getPropertyValue(obj, prop.name);
            html += this.renderPropRow(prop, value);
        }

        // Show all other properties dynamically
        html += '<div style="margin-top:12px;padding-top:8px;border-top:1px solid #454545;">';
        html += '<label style="font-size:11px;color:#969696;text-transform:uppercase;letter-spacing:0.5px;">其他屬性</label>';
        
        const seen = new Set(COMMON_PROPS.map(p => p.name));
        for (const key of Object.keys(obj)) {
            if (seen.has(key) || typeof obj[key as keyof zlUIWin] === 'function' || key.startsWith('_')) continue;
            seen.add(key);
            
            const val = (obj as any)[key];
            if (val !== undefined && val !== null && typeof val !== 'object') {
                html += this.renderPropRow(
                    { name: key, label: key, type: typeof val === 'number' ? 'number' : 'text' },
                    String(val)
                );
            }
        }
        html += '</div>';

        this.contentDiv.innerHTML = html;

        // Bind input events
        this.bindPropertyEvents(obj);
    }

    private getPropertyValue(obj: zlUIWin, propName: string): string {
        try {
            const val = (obj as any)[propName];
            if (val === undefined || val === null) return '';
            
            // Handle Vec2 objects (like scale, mouse_pos)
            if (typeof val === 'object' && 'x' in val && 'y' in val) {
                return `${val.x}, ${val.y}`;
            }
            
            return String(val);
        } catch {
            return '';
        }
    }

    private renderPropRow(prop: PropDef, value: string): string {
        let inputHtml = '';

        switch (prop.type) {
            case 'text':
                inputHtml = `<input type="text" class="prop-value" data-prop="${prop.name}" value="${this.escapeAttr(value)}" />`;
                break;
            case 'number':
                if (prop.min !== undefined && prop.max !== undefined) {
                    const numVal = parseFloat(value) || 0;
                    inputHtml = `<input type="range" class="prop-value" data-prop="${prop.name}" min="${prop.min}" max="${prop.max}" step="${prop.step || 1}" value="${numVal}" />`;
                } else {
                    inputHtml = `<input type="number" class="prop-value" data-prop="${prop.name}" value="${value}" />`;
                }
                break;
            case 'range':
                const rangeVal = parseFloat(value) || 0;
                inputHtml = `<input type="range" class="prop-value" data-prop="${prop.name}" min="${prop.min}" max="${prop.max}" step="${prop.step || 0.01}" value="${rangeVal}" />`;
                break;
            case 'color':
                inputHtml = `<input type="text" class="prop-value" data-prop="${prop.name}" value="${value}" placeholder="#ff0000" />`;
                break;
            case 'select':
                const options = (prop.options || []).map(opt => 
                    `<option value="${opt}" ${opt === value ? 'selected' : ''}>${opt}</option>`
                ).join('');
                inputHtml = `<select class="prop-value" data-prop="${prop.name}">${options}</select>`;
                break;
        }

        return `
            <div class="prop-row">
                <span class="prop-name">${prop.label}</span>
                ${inputHtml}
            </div>
        `;
    }

    private escapeAttr(str: string): string {
        return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    private bindPropertyEvents(obj: zlUIWin): void {
        const inputs = this.contentDiv.querySelectorAll('.prop-value') as NodeListOf<HTMLInputElement | HTMLSelectElement>;
        
        inputs.forEach(input => {
            const propName = input.getAttribute('data-prop') || '';
            
            const onChange = () => {
                let newValue: any;
                
                if (input.type === 'range' || input.type === 'number') {
                    newValue = parseFloat((input as HTMLInputElement).value);
                } else if (input.tagName === 'SELECT') {
                    newValue = (input as HTMLSelectElement).value;
                } else {
                    newValue = (input as HTMLInputElement).value;
                }

                // Apply to object
                this.setPropertyValue(obj, propName, newValue);

                // Notify callback
                if (this.callbacks.onPropertyChange) {
                    this.callbacks.onPropertyChange(obj, propName, newValue);
                }
            };

            input.addEventListener('change', onChange);
            
            // For text inputs, also update on blur (but not for range/number which use change)
            if ((input as HTMLInputElement).type === 'text') {
                input.addEventListener('blur', onChange);
            }
        });
    }

    private setPropertyValue(obj: zlUIWin, propName: string, value: any): void {
        try {
            // Handle special cases for Vec2 properties
            if (propName === 'scale' && typeof value === 'string') {
                const parts = value.split(',').map(s => parseFloat(s.trim()));
                if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                    (obj as any).scale.Set(parts[0], parts[1]);
                    return;
                }
            }

            // Handle boolean strings
            if (typeof value === 'string') {
                if (value.toLowerCase() === 'true' || value === '1') value = true;
                else if (value.toLowerCase() === 'false' || value === '0') value = false;
            }

            (obj as any)[propName] = value;
        } catch (err) {
            console.warn(`Failed to set ${propName}:`, err);
        }
    }

    clear(): void {
        this.currentObj = null;
        this.contentDiv.innerHTML = '<p class="placeholder">選擇物件以顯示屬性</p>';
    }
}
