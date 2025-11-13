"use client";
import React, { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";

type Props = { 
  initialUrl?: string | null;
  onSaved: (url: string | null) => void;
};

const trimCanvas = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let top=null,bottom=null,left=null,right=null;
  for (let y=0;y<height&&top===null;y++) for (let x=0;x<width;x++) if (data[(y*width+x)*4+3]!==0){ top=y; break; }
  for (let y=height-1;y>=0&&bottom===null;y--) for (let x=0;x<width;x++) if (data[(y*width+x)*4+3]!==0){ bottom=y; break; }
  for (let x=0;x<width&&left===null;x++) for (let y=0;y<height;y++) if (data[(y*width+x)*4+3]!==0){ left=x; break; }
  for (let x=width-1;x>=0&&right===null;x--) for (let y=0;y<height;y++) if (data[(y*width+x)*4+3]!==0){ right=x; break; }
  if (top===null||left===null||right===null||bottom===null) { const c=document.createElement("canvas"); c.width=1;c.height=1; return c; }
  const w=right-left+1, h=bottom-top+1;
  const out=document.createElement("canvas"); out.width=w; out.height=h;
  out.getContext("2d")!.drawImage(canvas,left,top,w,h,0,0,w,h);
  return out;
};

export default function SignatureCanvasBox({ initialUrl, onSaved }: Props) {
  const ref = useRef<SignatureCanvas>(null);
  const [canSave, setCanSave] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCanvas, setShowCanvas] = useState(!initialUrl);

  const onEnd = () => setCanSave(!(ref.current?.isEmpty() ?? true));
  const onClear = () => { ref.current?.clear(); setCanSave(false); };

  const handleSave = async () => {
    if (!ref.current || isSaving) return;
    setIsSaving(true);
    try {
      const trimmed = trimCanvas(ref.current.getCanvas());
      const dataUrl = trimmed.toDataURL("image/png");
      
      const response = await fetch("/api/landlords/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl })
      });
      
      if (response.ok) {
        const result = await response.json();
        onSaved(result.signature_url);
        setShowCanvas(false);
        setCanSave(false);
      } else {
        throw new Error('Erreur lors de la sauvegarde');
      }
    } catch (error) {
      console.error('Error saving signature:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const response = await fetch("/api/landlords/signature", {
        method: "DELETE"
      });
      
      if (response.ok) {
        onSaved(null);
        setShowCanvas(true);
      } else {
        throw new Error('Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Error deleting signature:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleModify = () => {
    setShowCanvas(true);
  };
  // Si on a une signature et qu'on ne montre pas le canvas
  if (initialUrl && !showCanvas) {
    return (
      <div>
        <div style={{ border:"1px solid #e5e7eb", borderRadius:8, padding:6, backgroundColor: "#fff" }}>
          <img 
            src={initialUrl} 
            alt="Signature actuelle" 
            style={{ 
              maxWidth: "100%", 
              height: "auto", 
              maxHeight: "120px",
              display: "block",
              margin: "0 auto"
            }}
          />
        </div>
        <div style={{ display:"flex", gap:8, marginTop:10 }}>
          <button 
            type="button" 
            onClick={handleModify}
            style={{
              padding: "8px 16px",
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500"
            }}
          >
            Modifier
          </button>
          <button 
            type="button" 
            onClick={handleDelete}
            disabled={isDeleting}
            style={{
              padding: "8px 16px",
              backgroundColor: "#dc2626",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: isDeleting ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "500",
              opacity: isDeleting ? 0.5 : 1
            }}
          >
            {isDeleting ? "Suppression..." : "Supprimer"}
          </button>
        </div>
      </div>
    );
  }

  // Canvas de dessin
  return (
    <div>
      <div style={{ border:"1px solid #e5e7eb", borderRadius:8, padding:6 }}>
        <SignatureCanvas
          ref={ref}
          penColor="#000"
          backgroundColor="rgba(0,0,0,0)"
          canvasProps={{ width: 680, height: 180, style: { width:"100%", height:180, borderRadius:6, touchAction:"none" } }}
          onEnd={onEnd}
        />
      </div>
      <div style={{ display:"flex", gap:8, marginTop:10 }}>
        <button 
          type="button" 
          onClick={onClear}
          style={{
            padding: "8px 16px",
            backgroundColor: "#6b7280",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "500"
          }}
        >
          Effacer
        </button>
        <button 
          type="button" 
          onClick={handleSave} 
          disabled={!canSave || isSaving}
          style={{
            padding: "8px 16px",
            backgroundColor: (canSave && !isSaving) ? "#3b82f6" : "#9ca3af",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: (canSave && !isSaving) ? "pointer" : "not-allowed",
            fontSize: "14px",
            fontWeight: "500",
            opacity: (canSave && !isSaving) ? 1 : 0.5
          }}
        >
          {isSaving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
