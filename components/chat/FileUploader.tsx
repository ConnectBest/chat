"use client";
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/Button';

interface FileUploaderProps {
  onUpload: (files: File[]) => Promise<void>;
  maxSize?: number; // in MB
  accept?: Record<string, string[]>;
}

interface UploadProgress {
  file: File;
  progress: number;
  status: 'uploading' | 'complete' | 'error';
}

export function FileUploader({ onUpload, maxSize = 10, accept }: FileUploaderProps) {
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    // Static code Backend team please change it to dynamic
    const newUploads: UploadProgress[] = acceptedFiles.map(file => ({
      file,
      progress: 0,
      status: 'uploading' as const
    }));
    
    setUploads(prev => [...prev, ...newUploads]);

    // Simulate upload progress
    for (const upload of newUploads) {
      for (let i = 0; i <= 100; i += 20) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setUploads(prev => prev.map(u => 
          u.file === upload.file 
            ? { ...u, progress: i, status: i === 100 ? 'complete' : 'uploading' }
            : u
        ));
      }
    }

    await onUpload(acceptedFiles);
    
    // Close the modal after all uploads complete
    setTimeout(() => {
      setIsOpen(false);
      setUploads([]);
    }, 500);
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: maxSize * 1024 * 1024,
    accept: accept || {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
      'text/*': ['.txt', '.md'],
      'application/zip': ['.zip']
    }
  });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-2 text-xl hover:bg-white/10 rounded transition"
        aria-label="Upload file"
      >
        📎
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-96 bg-brand-800/95 backdrop-blur-lg rounded-lg border border-white/20 shadow-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-white font-semibold">Upload Files</h3>
            <button onClick={() => setIsOpen(false)} className="text-white/50 hover:text-white">✕</button>
          </div>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
              isDragActive 
                ? 'border-brand-400 bg-brand-700/50' 
                : 'border-white/20 hover:border-white/40'
            }`}
          >
            <input {...getInputProps()} />
            <div className="text-4xl mb-2">📁</div>
            {isDragActive ? (
              <p className="text-white">Drop files here...</p>
            ) : (
              <>
                <p className="text-white mb-1">Drag & drop files here</p>
                <p className="text-white/50 text-sm">or click to browse</p>
                <p className="text-white/30 text-xs mt-2">Max {maxSize}MB per file</p>
              </>
            )}
          </div>

          {uploads.length > 0 && (
            <div className="mt-4 space-y-2">
              {uploads.map((upload, idx) => (
                <div key={idx} className="bg-white/5 rounded p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white text-sm truncate flex-1">{upload.file.name}</span>
                    <span className="text-white/50 text-xs ml-2">
                      {upload.status === 'complete' ? '✓' : `${upload.progress}%`}
                    </span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1">
                    <div 
                      className="bg-brand-400 h-1 rounded-full transition-all"
                      style={{ width: `${upload.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-[10px] text-white/40 mt-3 text-center">
            Static code Backend team please change it to dynamic
          </p>
        </div>
      )}
    </div>
  );
}
