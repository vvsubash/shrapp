import { useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { Upload, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useExtractImage } from "@/lib/queries";
import { preprocessImage } from "@/lib/image-utils";
import { IMAGE_MAX_BYTES } from "@shrapp/shared";

export function UploadPage() {
  const navigate = useNavigate();
  const extractMutation = useExtractImage();
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith("image/")) {
      toast.error("Please upload an image file (JPEG or PNG)");
      return;
    }
    if (f.size > IMAGE_MAX_BYTES) {
      toast.error("Image exceeds 10MB limit");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  const handleExtract = async () => {
    if (!file) return;
    try {
      const processed = await preprocessImage(file);
      const result = await extractMutation.mutateAsync(processed);
      if (result.status === "committed") {
        toast.info("This image was already committed");
      }
      navigate(`/review/${result.extraction_id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Extraction failed";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Upload Register</h2>
        <p className="text-muted-foreground">
          Upload a photo of today's attendance register to extract entries.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`flex min-h-[300px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50"
        }`}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        {preview ? (
          <img
            src={preview}
            alt="Register preview"
            className="max-h-[400px] rounded-md object-contain"
          />
        ) : (
          <>
            <ImageIcon className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-sm font-medium">
              Drag & drop a register photo, or click to select
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              JPEG or PNG, max 10MB
            </p>
          </>
        )}
        <input
          id="file-input"
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>

      {file && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {file.name} ({(file.size / 1024).toFixed(0)} KB)
          </p>
          <button
            onClick={handleExtract}
            disabled={extractMutation.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {extractMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Reading register...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Extract
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
