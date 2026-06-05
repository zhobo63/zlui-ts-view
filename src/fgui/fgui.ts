import { ImageFont, BoardType, TexturePack, UIImage, UIImageText, UIMgr, UIPanel, UIWin, UpdateTexturePack, Align, ParseColor } from "@zhobo63/zlui-ts";
import * as ZLIB from "pako"
import * as XML from "fast-xml-parser"
import { ImGui_Impl } from "@zhobo63/imgui-ts";

export const Version:string="0.0.2";

export class FGUIButton extends UIWin
{
    constructor(own:UIMgr)
    {
        super(own);
    }

    _csid_fgui:string="FGUIButton";

    Refresh(ti: number, parent?: UIWin): boolean {
        if(this.isEnable) {
            if(this._owner.hover==this) {
                this.isDown=this._owner.any_pointer_down;
            }
            if(this.win_disable) this.win_disable.isVisible=false;
            if(this.win_hover) this.win_hover.isVisible=false;
            if(this.win_down) this.win_down.isVisible=false;
            if(this.win_hover && this._owner.hover==this && !this.isDown) {
                this.win_hover.isVisible=true;
            }else if(this.win_down && this.isDown) {
                this.win_down.isVisible=true;
            }
        }
        else {
            if(this.win_disable) this.win_disable.isVisible=true;
            if(this.win_hover) this.win_hover.isVisible=false;
            if(this.win_down) this.win_down.isVisible=false;
        }
        return super.Refresh(ti, parent);
    }

    CalRect(parent: UIWin): void {
        super.CalRect(parent);

        for(let ch of this.pChild) {
            ch.isCanNotify=false;
            if(!ch.Name) {

            }
            else if(ch.Name.startsWith("disable")) {
                this.win_disable=ch as UIWin;
            }
            else if(ch.Name.startsWith("hover")) {
                this.win_hover=ch as UIWin;
            }
            else if(ch.Name.startsWith("down")) {
                this.win_down=ch as UIWin;
            }
        }
    }

    win_disable?:UIWin;
    win_hover?:UIWin;
    win_down?:UIWin;
}

export class FGUIImageText extends UIImageText
{
    constructor(own:UIMgr)
    {
        super(own);
        this.text="";
    }

    _csid_fgui:string="FGUImageText";

    CalRect(parent: UIWin): void {

        this.image_font=[];
        this.ascii={};
        for(let ch of this.pChild) {
            if(ch._csid==UIImage.CSID) {
                ch.isCanNotify=false;
                let img=ch as UIImage; 
                if(!(img.image && img.Name))
                    continue;
                if(img.image)
                    UpdateTexturePack(img.image);
                let imgfont:ImageFont={
                    width:ch.w,
                    height:ch.h,
                    offset_x:ch.x,
                    offset_y:ch.y,
                    texture:img.image,
                    uv1:img.image?.uv1,
                    uv2:img.image?.uv2,
                };
                let inx=this.image_font.push(imgfont);
                this.ascii[img.Name]=inx-1;
            }                            
        }

        super.CalRect(parent);
    }
}

enum EUIType
{
    Win,
    Image,
    Panel,
    Edit,
    Button,
    Check,
    Slider,
    ImageText,
}

enum EResourceType {
    None,
    Image,
    SWF,	//not support
    MovieClip,
    Sound,
    Index,
    Font,
    Atlas,
    Misc,
    Component,
    Graph,
    Text,
    Group,
    Sprite,
    Controller,
    DisplayList,
    Loader,
    MAX,
};

enum EAttribType {
    None,
    Id,
    Name,
    Path,
    Size,
    Scale,
    Scale9Grid,
    GridTile,
    XY,
    Src,
    File,
    Blend,
    Exported,
    Pivot,
    Color,
    Visible,
    Alpha,
    Extention,
    Mode,
    Controller,
    Pages,
    Target,
    SidePair,
    Title,
    Checked,
    Icon,
    Align,
    vAlign,
    AutoSize,
    SingleLine,
    Value,
    MaxValue,
    Text,
    Font,
    FontSize,
    Bold,
    ShadowColor,
    ShadowOffset,
    Selected,
    Flip,
    MAX,
};

enum EScaleType {
    None,
    Grid9,
    Tile,
};

enum EAlignType {
    None,
    Top,
    Left,
    Right,
    Bottom,
    Client,
    Center,
    MAX,
};

enum EPageType {
    Up,
    Down,
    Over,
    SelectedOver,
    Disable,
    SelectedDisable,
    MAX,
};

enum EBlendMode {
    Normal,
    Add,
    Multiply,
    Screen,
    Overlay,
    Darken,
    Lighten,
    ColorDodge,
    ColorBurn,
    HardLight,
    SoftLight,
    Difference,
    Exclusion,
    Hue,
    Saturation,
    Color,
    Luminosity,
    NormalNPM,
    AddNPM,
    ScreenNPM,
    None,
    SrcIn,
    SrcOut,
    SrcAtop,
    DstIn,
    DstOut,
    DstAtop,
    Subtract,
    SrcOver,
    Erase,
    XOR,
    MAX,
};

interface OnLoadAble {
    onload: any;
    onerror:any;
}

function LoadImage<T extends OnLoadAble>(src:T):Promise<T>
{
    return new Promise((resolve, reject)=>{
        src.onload=()=>resolve(src);
        src.onerror=reject;
    });
}

function ScaleType(s:string):EScaleType
{
    if(!s)
        return EScaleType.None;
    switch(s) {
    case '9grid':
        return EScaleType.Grid9;
    case 'tile':
        return EScaleType.Tile;
    default:
        //console.log("TODO ScaleType", s);
        break;
    }
    return EScaleType.None;
}

function ParseVec2(s:string):Vec2
{
    let row=s.split(/,/);
    return {x:Number.parseFloat(row[0]),y:Number.parseFloat(row[1]) }
}
function ParseVec4(s:string):Vec4
{
    let row=s.split(/,/);
    return {
        x:Number.parseInt(row[0]),
        y:Number.parseInt(row[1]),
        z:Number.parseInt(row[2]),
        w:Number.parseInt(row[3]),
    }
}

interface Vec2
{
    x:number;
    y:number;
}

interface Vec4
{
    x:number;
    y:number;
    z:number;
    w:number;
}

function toTexturePack(sprite:Sprite):TexturePack
{
    return {
        name:sprite.id,
        x1:sprite.x,
        y1:sprite.y,
        x2:sprite.x+sprite.width,
        y2:sprite.y+sprite.height,
        texture:sprite.texture,    
        scale:1,
    };
}

interface Sprite
{
    id:string;
    index:number;
    x:number;
    y:number;
    width:number;
    height:number;
    texture:any;
    type:EResourceType;

}

// class FGUImage
// {
//     scale_type:EScaleType=EScaleType.None;
//     id:string;
// }

class ByteBuffer
{
    constructor(buffer:ArrayBuffer)
    {
        this.dv=new DataView(buffer);
    }
    getInt32():number
    {
        let n=this.dv.getInt32(this.offset);
        this.offset+=4;
        return n;
    }

    dv:DataView;
    offset:number=0;
}

function makeFourCC(cc:string):number
{
    let n1=cc.charCodeAt(0);
    let n2=cc.charCodeAt(1);
    let n3=cc.charCodeAt(2);
    let n4=cc.charCodeAt(3);
    return (n1<<24)|(n2<<16)|(n3<<8)|n4;
}

const header_fgui= makeFourCC("FGUI");

class FGUIFile
{
    constructor(name:string, source:string)
    {
        this.name=name;
        this.source=source;
    }
    name:string;
    source:any;
    data:any;
}

class FGUIXmlFile extends FGUIFile
{
    constructor(name:string, source:string)
    {
        super(name, source);
        const xml_parser=new XML.XMLParser({
                ignoreAttributes : false,
                attributeNamePrefix : "",
                allowBooleanAttributes: true,
                parseAttributeValue: true,
                parseTagValue: true,
                preserveOrder: true,
            });
        this.data=xml_parser.parse(source);
    }

    // name:string;
    // source:string;
    // data:any;
}

class FGUIXmlParser
{
    constructor(data:FGUIPackage)
    {
        this.package=data;
    }
    async Parse(data:string)
    {
        let i=0;
        let start=0;
        let file_name:string|undefined=undefined;
        let file_size:number=0;
        let files=this.package.files;
        
        while(i<data.length)    {
            if(data.charAt(i)=='|') {
                if(!file_name)  {
                    file_name=data.slice(start, i);
                    start=i+1;
                }else {
                    file_size=Number.parseInt(data.slice(start,i));
                    start=i+1;
                    let xml=new FGUIXmlFile(file_name, data.slice(start,start+file_size));
                    files[file_name]=xml;
                    start+=file_size;
                    i=start;
                    file_name=undefined;
                    file_size=0;
                }
            }
            i++;
        }
        await this.ParseResource();
        this.ParseSprite();

    }

    async CreateAtlas(atlas :any, name:string)
    {
        let attr=atlas[":@"];
        atlas.type=EResourceType.Atlas;
        atlas.texture=new ImGui_Impl.Texture;
        let image=new Image;
        let loadprocess=LoadImage(image).then(r=>{
            atlas.texture.Update(image);
            console.log("load image "+ attr.file);
        });
        image.crossOrigin="anonymous";            
        image.src=this.package.path+name+"@"+attr.file;
        await loadprocess;
        this.package.textures[attr.id]=atlas.texture;
    }
    CreateResourceComponent(component:any)
    {
        let attr=component[":@"];
        let own=this.package;
        component.type=EResourceType.Component;
        let id=attr.id+".xml";
        let file=own.files[id];
        if(file) {
            component.component=file.data[0].component;
        }
        own.resources[attr.name]=component;
        own.resources[attr.id]=component;
    }

    async ParseResource()
    {
        let own=this.package;
        let item=own.files["package.xml"];
        console.log("ParseResource", item);

        let attr=item.data[0][":@"];
        let packageDescription=item.data[0].packageDescription;
        let name=attr.name;
        for(let res of packageDescription[0].resources) {
            if(Array.isArray(res.atlas)) {
                await this.CreateAtlas(res, name);
            }
            else if(Array.isArray(res.component)) {
                this.CreateResourceComponent(res);
            }
            else if(Array.isArray(res.image)) {
                let attr=res[":@"];
                res.type=EResourceType.Image;
                own.resources[attr.name]=res;
                own.resources[attr.id]=res;
            }
        }
    }
    ParseSprite()
    {
        let own=this.package;
        let item=own.files["sprites.bytes"];
        item.data.sprite=[];

        let sprites=item.source.split(/\r\n|\n/);
        for(let sprite of sprites) {
            if(sprite.startsWith("//"))
                continue;
            let rows=sprite.split(/ /);
            let atlas_name="atlas"+rows[1];
            let texture=own.textures[atlas_name];

            let sp:Sprite={
                id:rows[0],
                index:Number.parseInt(rows[1]),
                x:Number.parseInt(rows[2]),
                y:Number.parseInt(rows[3]),
                width:Number.parseInt(rows[4]),
                height:Number.parseInt(rows[5]),
                texture:texture,
                type:EResourceType.Sprite,
            }            
            item.data.sprite.push(sp);
            own.sprites[sp.id]=sp;
        }
        console.log(item);
    }

    package:FGUIPackage;
}

export class FGUIPackage
{
    constructor(path:string)
    {
        this.path=path;
    }

    async loadPackage(buffer:ArrayBuffer):Promise<FGUIPackage>  {
        let rd=new ByteBuffer(buffer);
        let header=rd.getInt32();
        if(header!=header_fgui) {
            let data = ZLIB.inflateRaw(buffer);
            let dec=new TextDecoder("utf-8");
            let xml=dec.decode(data);
            let parser=new FGUIXmlParser(this);
            await parser.Parse(xml);
        }
        console.log(this);
        return this;
    }
    Create(name:string, mgr:UIMgr):UIWin|undefined {
        let res=this.resources[name];
        let ui:UIWin|undefined;
        if(res) {
            ui=this.CreateFromResource(res, mgr);
        }else {
            console.error("fgui resource not found", name);
        }
        return ui;
    }
    CreateFromResource(res:any, mgr:UIMgr):UIWin|undefined
    {
        let ui:UIWin|undefined;
        switch(res.type) {
        case EResourceType.Component:
            ui=this.CreateFromComponent(res, mgr);
            break;
        case EResourceType.Image:
        case EResourceType.Loader:
            ui=this.CreateImage(res, mgr);
            break;
        default:
            console.warn("TODO CreateFromResource", res);
            break;
        }
        return ui;
    }

    CreateWin(res:any, mgr:UIMgr):UIWin|undefined
    {
        let type:EUIType=EUIType.Win;
        let attr=res[":@"];
        let name=attr.name;
        if(!name) {}
        else if(name.startsWith("btn_")) {
            type=EUIType.Button;        
        }else if(name.startsWith("pnl_")) {
            type=EUIType.Panel;
        }else if(name.startsWith("imagetext_")) {
            type=EUIType.ImageText;
        }
        if(res.component)   {
            if(res.component.Button || res.component.extention==="Button")  {
                type=EUIType.Button;
            }
        }

        let ui:UIWin;
        switch(type) {
        case EUIType.Win:
            ui=new UIWin(mgr);
            break;
        //case EUIType.Image:
        //    ui=new UIImage(mgr);
        //    break;
        case EUIType.Panel:
            let pnl=new UIPanel(mgr);
            pnl.isDrawClient=false;
            pnl.isDrawBorder=false;
            ui=pnl;
            break;
        case EUIType.Button:
            ui=new FGUIButton(mgr);
            break;
        case EUIType.ImageText:
            ui=new FGUIImageText(mgr);
            break;
        default:
            console.warn(`TODO CreateWin type:${type}`, res);
            return undefined;
        }
        ui.Name=name;
        return ui;
    }
    SetAttribute(res:any, ui:UIWin)
    {
        let attr=res[":@"]
        let fontName;
        let fontSize;
        let fontStyle="normal";
        let textAlignW=Align.Center;
        let textAlignH=Align.Center;
        for(let id in attr) {
            let val=attr[id];
            switch(id) {
            case "id":
            case "path":
            case "type":
            case "src":
            case "component":
            case "scale9grid":
            case "exported":
                break;
            case "name":
                ui.Name=`${val}`;
                break;
            case "xy":
                let pos=ParseVec2(val);
                ui.x=pos.x;
                ui.y=pos.y;
                ui.isCalRect=true;
                break;
            case "size":
                let size=ParseVec2(val);
                ui.w=size.x;
                ui.h=size.y;
                ui.isCalRect=true;
                break;
            case "visible":
                ui.isVisible=val;
                break;
            case "alpha": 
                ui.SetAlpha(val);            
                break;
            case "scale":
                switch(val) {
                case "9grid": 
                    //CreateImage() handles 9grid
                    break;
                case "tile":
                    console.log("TODO scale:tile", val);
                    break;
                default:
                    let scale=ParseVec2(val);
                    ui.scale.x=scale.x;
                    ui.scale.y=scale.y;
                    // if(scale.x<0) {
                    //     ui.FlipW();
                    // }
                    // if(scale.y<0) {
                    //     ui.FlipH();
                    // }
                    ui.isCalRect=true;        
                    break;
                }
                break;
            case "pivot":
                let v2=ParseVec2(val);
                ui.origin.Set(v2.x, v2.y);
                break;
            case "flip":
                switch(val) {
                case "hz":
                    ui.FlipW();
                    break;
                }
                break;
            case "color":
                ui.SetColor(val);
                break;
            case "text":
                ui.SetText(val);
                break;
            case "font":
                fontName=val;
                break;
            case "fontSize":
                fontSize=val;
                break;
            case "autoSize":
                break;
            case "bold":
                fontStyle=val?"bold":"normal";
                break;
            case "align":
                switch(val) {
                case "left":
                    textAlignW=Align.Left;
                    break;
                case "right":
                    textAlignW=Align.Right;
                    break;
                case "center":
                    textAlignW=Align.Center;
                    break;
                default:
                    console.warn("TODO SetAttribute:"+id, {res:res, value:val});
                    break;
                }
                break;
            case "vAlign":
                switch(val) {
                case "top":
                    textAlignH=Align.Top;
                    break;
                case "bottom":
                    textAlignH=Align.Down;
                    break;
                case "middle":
                    textAlignH=Align.Center;
                    break;
                default:
                    console.warn("TODO SetAttribute:"+id, {res:res, value:val});
                    break;
                }
                break;
            default:
                console.warn("TODO SetAttribute:"+id, {res:res, value:val});
                break;
            }
        }
        if(ui._csid==UIPanel.CSID) {
            let pnl=ui as UIPanel;
            if(fontName && fontSize) {
                pnl.font=pnl._owner.CreateFont(fontName, fontSize, fontStyle);
            }
            pnl.textAlignW=textAlignW;
            pnl.textAlignH=textAlignH;
        }
    }

    CreateImage(res:any, mgr:UIMgr):UIImage|undefined
    {        
        let attr=res[":@"];
        let ui:UIImage|undefined;
        if(!res) {
        }
        else if(attr.src) {
            let src=this.resources[attr.src];
            if(src === undefined) {
                console.warn("fgui CreateImage src not found", res);
                ui=new UIImage(mgr);
            }else {
                ui=this.CreateImage(src, mgr);
            }
        }else {
            let sprite=this.sprites[attr.id];
            let scale_type=ScaleType(attr.scale);
            switch(scale_type) {
            case EScaleType.None:
                ui=new UIImage(mgr);
                ui.image=toTexturePack(sprite);
                //console.log("CreateImage",res);
                break;
            case EScaleType.Grid9:
                let pnl=new UIPanel(mgr);
                pnl.rounding=0;
                pnl.borderWidth=0;
                pnl.isDrawClient=false;
                pnl.isDrawBorder=false;
                pnl.color=0xFFFFFFFF;
                let v4=ParseVec4(attr.scale9grid);
                v4.z+=v4.x;
                v4.w+=v4.y;
                pnl.board={
                    x1:v4.x,
                    y1:v4.y,
                    x2:v4.z,
                    y2:v4.w,
                    image:toTexturePack(sprite),
                    type:BoardType.NineGrid
                }
                ui=pnl;
                break;
            case EScaleType.Tile:
                console.log("TODO CreateImage scale_type:"+scale_type, res);
                return ui;
            }
        }
        if(ui) {
            this.SetAttribute(res, ui);
        }
        return ui;
    }
    CreateText(res:any, mgr:UIMgr):UIPanel|undefined
    {
        let attr=res[":@"];
        let ui:UIPanel|undefined;
        if(!res) {
        }
        else if(attr.src) {
            let src=this.resources[attr.src];
            if(src === undefined) {
                console.warn("fgui CreateText src not found", res);
                ui=new UIPanel(mgr);
            }else {
                ui=this.CreateText(src, mgr);
            }
        }else {
            ui=new UIPanel(mgr);
            ui.isDrawBorder=false;
            ui.isDrawClient=false;
            ui.textColor=ParseColor(attr.color);
            //console.log("fgui Text", attr)
        }
        if(ui) {
            this.SetAttribute(res, ui);
        }
        return ui;
    }

    CreateFromComponent(res:any, mgr:UIMgr):UIWin|undefined
    {
        let ui:UIWin|undefined;
        if(!res) {
            return ui;
        }
        let attr=res[":@"];
        if(attr.src) {
            let src=this.resources[attr.src];
            if(src===undefined) {
                console.warn("CreateFromComponent src not found", res);
            }else {
                ui=this.CreateFromComponent(src, mgr);
            }
        }else {
            ui=this.CreateWin(res, mgr);
            //console.log("CreateFromComponent", res, ui);
        }
        if(!ui)
            return ui;
        this.SetAttribute(res, ui);
        if(!res.component)
            return ui;
        for(let component of res.component) {
            if(component.displayList) {
                for(let display of component.displayList) {
                    let ch:UIWin|undefined;
                    if(display.image) {
                        ch=this.CreateImage(display, mgr);
                    }
                    else if(display.component) {
                        ch=this.CreateFromComponent(display, mgr);
                    }
                    else if(display.text) {
                        ch=this.CreateText(display, mgr);
                    }
                    else {

                        console.warn("TODO FGUI displayList", display);
                    }
                    if(ch) {
                        ui.AddChild(ch);
                    }
                }
            }
        }
        return ui;
    }

    //version:number;
    path:string;
    files:{[key:string]:FGUIFile}={}
    textures:{[key:string]:ImGui_Impl.Texture}={}
    sprites:{[key:string]:Sprite}={}
    resources:{[key:string]:any}={}
}

export class FGUI
{
    static async Load(file:string, path:string):Promise<FGUIPackage>
    {
        return fetch(path+file).then(r=>{
            return r.arrayBuffer();
        }).then(b=>{
            let pkg=new FGUIPackage(path);
            return pkg.loadPackage(b);
        })
    }
}
